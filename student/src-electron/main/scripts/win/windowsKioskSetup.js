/**
 * Windows counterpart to Linux Cage kiosk setup.
 * - detectRunningInWindowsKiosk(): kiosk OS user + provisioned SID + active Assigned Access session
 * - detectWindowsKioskInstalled(): true when provisioning artifacts exist
 * - needsWindowsKioskSetup(): inverse, used by UI install button
 * - initiateKioskSetup(appPath): platform switch + UAC elevation + PowerShell payload
 *
 * Shares public field names with cage (runningInCage etc.) so renderer logic is unchanged.
 */
import { execSync, spawn } from 'child_process';
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

/** Resolves the full app tree to copy (not the NSIS portable launcher in Downloads). */
export function resolveWindowsKioskAppBundle() {
    if (!app.isPackaged) {
        return { ok: false, error: 'Kiosk setup requires a packaged Next-Exam build (not dev/quasar).' };
    }
    const launchExe = path.basename(process.execPath);
    let appDir = path.dirname(process.execPath);
    // PORTABLE_EXECUTABLE_DIR often points at Downloads (launcher), not %TEMP%\next-exam-student — validate
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim();
    if (portableDir && isElectronAppBundleDir(portableDir)) {
        appDir = portableDir;
    }
    if (!isElectronAppBundleDir(appDir)) {
        return {
            ok: false,
            error: `Could not locate Next-Exam app folder (expected resources\\app.asar). Got: ${appDir}`,
        };
    }
    if (!existsSync(path.join(appDir, launchExe))) {
        return { ok: false, error: `Launch exe missing in app folder: ${path.join(appDir, launchExe)}` };
    }
    log.info(`windowsKioskSetup: detected source bundle=${appDir} launch=${launchExe}`);
    return { ok: true, appDir, launchExe };
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

/**
 * Current user SID. Primary: reverse-lookup USERPROFILE in HKLM ProfileList (works under AA — whoami.exe
 * may be blocked by the AA allow-list, which silently returned '' and triggered the softer fallbacks).
 * Fallback: whoami /user (kept for diagnostics + non-AA sessions).
 */
function getCurrentUserSid() {
    if (process.platform !== 'win32') return '';
    const userProfile = (process.env.USERPROFILE || '').trim().toLowerCase();
    if (userProfile) {
        const listOut = String(runRegQuery('HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList') || '');
        const sids = [...listOut.matchAll(/(S-1-5-21-[0-9-]+)/g)].map((m) => m[1]);
        const seen = new Set();
        for (const sid of sids) {
            if (seen.has(sid)) continue;
            seen.add(sid);
            const pathOut = String(runRegQuery(`HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\${sid}`, 'ProfileImagePath') || '');
            // reg.exe output: "    ProfileImagePath    REG_EXPAND_SZ    C:\Users\next-exam-kiosk"
            const m = pathOut.match(/REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/im);
            const profilePath = m ? m[1].trim().toLowerCase() : '';
            if (profilePath && profilePath === userProfile) return sid;
        }
    }
    try {
        const out = execSync('whoami /user', { encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore'], timeout: 8000 });
        const m = String(out || '').match(/S-1-\d+(-\d+)+/);
        return m ? m[0].trim() : '';
    } catch {
        return '';
    }
}

/** reg.exe query; returns stdout string ('' if key/value missing or stdout is empty/null). */
function runRegQuery(keyPath, valueName = '') {
    const args = valueName
        ? `query "${keyPath}" /v ${valueName}`
        : `query "${keyPath}"`;
    try {
        const out = execSync(`reg.exe ${args}`, { encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore'], timeout: 8000 });
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

// MDM_AssignedAccess CSP read is the only forge-proof source of "AA is policy-configured for THIS user"
// (set by elevated install-windows-kiosk.ps1; non-admin students can't write it). Costs one powershell.exe
// spawn (~500ms), so cache per-process — config doesn't change at runtime without a reboot.
let mdmAssignedAccessCache = null;
function readMdmAssignedAccessForCurrentUser() {
    if (process.platform !== 'win32') return { ok: false, configured: false, reason: 'non-win32' };
    if (mdmAssignedAccessCache) return mdmAssignedAccessCache;
    const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$cfg = ''
try {
  Add-Type -AssemblyName System.Web | Out-Null
  $obj = Get-CimInstance -Namespace 'root\\cimv2\\mdm\\dmmap' -ClassName 'MDM_AssignedAccess' -ErrorAction Stop | Select-Object -First 1
  if ($obj -and $obj.Configuration) { $cfg = [System.Web.HttpUtility]::HtmlDecode([string]$obj.Configuration) }
} catch {}
@{ ok = [bool]$cfg; configuration = $cfg } | ConvertTo-Json -Compress -Depth 4
`;
    const data = runPowerShellJson(ps, 6000);
    if (!data) {
        mdmAssignedAccessCache = { ok: false, configured: false, reason: 'MDM_AssignedAccess CSP read failed or returned no data' };
        return mdmAssignedAccessCache;
    }
    const xml = String(data.configuration || '');
    // <Account>COMPUTER\next-exam-kiosk</Account> — locale-independent, case-insensitive
    const re = new RegExp(`<Account>[^<]*\\\\${KIOSK_USERNAME}<\\/Account>`, 'i');
    const configured = !!xml && re.test(xml);
    mdmAssignedAccessCache = {
        ok: !!data.ok,
        configured,
        reason: configured
            ? 'MDM AA policy lists kiosk user'
            : (data.ok ? 'MDM AA policy present but does not target kiosk user' : 'MDM_AssignedAccess CSP unreadable'),
    };
    return mdmAssignedAccessCache;
}

// Detection snapshot is expensive (multiple sync reg.exe spawns + one PowerShell spawn for MDM).
// State=128, SID, MDM config, Winlogon Shell, username don't change within a session, and RestrictRun
// is set at logon and stays — so cache aggressively. Called from per-tick syncAllowedKioskAppsClientinfo,
// blocking the main thread on every UDP heartbeat → renderer can be killed for unresponsiveness.
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

    const restrictRunKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\RestrictRun';
    const explorerKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer';
    const restrictRunOut = runRegQuery(restrictRunKey);
    const explorerRestrictRunValueOut = runRegQuery(explorerKey, 'RestrictRun');
    const explorerRestrictRunDword = parseRegDword(explorerRestrictRunValueOut);
    const explorerOut = runRegQuery(explorerKey);

    // Tightened: dropped the loose "any REG_SZ under RestrictRun" heuristic — it was too easy to satisfy
    // (a single AssignedAccess_NN value name match is the actual signal AA writes at logon).
    const aaCheck = {
        restrictRunKeyHasAssignedAccess: /AssignedAccess_/i.test(restrictRunOut),
        explorerRestrictRunDwordIs1: explorerRestrictRunDword === 1,
        explorerKeyHasAssignedAccess: /AssignedAccess_/i.test(explorerOut),
    };
    // Live-session signal: AA actually applied policies for this logon (RestrictRun is set by AA shell init).
    const assignedAccessActive = aaCheck.restrictRunKeyHasAssignedAccess
        || (aaCheck.explorerRestrictRunDwordIs1 && aaCheck.explorerKeyHasAssignedAccess);

    // Authoritative MDM CSP check: AA is policy-configured for THIS user (forge-proof — admin-only write).
    const mdm = readMdmAssignedAccessForCurrentUser();

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
    if (!sid) {
        provisionedSid = kioskOsUser && provisionMarkerExists;
        provisionedSidReason = provisionedSid
            ? 'sid lookup (ProfileList + whoami) failed; fallback kiosk user + provision marker'
            : 'sid lookup (ProfileList + whoami) failed';
    } else if (!sidMarkerExists) {
        provisionedSid = provisionMarkerExists;
        provisionedSidReason = provisionedSid
            ? 'no .kiosk-account-sid file; fallback provision marker'
            : 'no .kiosk-account-sid and no provision marker';
    } else {
        provisionedSid = sidMarkerValue === sid;
        provisionedSidReason = provisionedSid
            ? 'current sid matches .kiosk-account-sid'
            : `sid mismatch file=${sidMarkerValue || '(empty)'} current=${sid}`;
    }

    const profileKey = sid ? `HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\${sid}` : '';
    const profileStateOut = profileKey ? runRegQuery(profileKey, 'State') : '';
    const profileStateDword = parseRegDword(profileStateOut);
    const profilePathOut = profileKey ? runRegQuery(profileKey, 'ProfileImagePath') : '';
    const profilePathMatch = /\\next-exam-kiosk\b/i.test(profilePathOut);
    const profileState128 = profileStateDword === 128 || profilePathMatch;

    // AA-presence proof: any of (live RestrictRun, MDM policy lists this user, Winlogon shell hijacked).
    // Two of three independent sources rule out forgery: MDM is admin-only, Winlogon Shell is AA-managed.
    const aaProof = assignedAccessActive || mdm.configured || winlogonShellMatch;
    const runningInCage = kioskOsUser && profileState128 && provisionedSid && aaProof;

    return {
        runningInCage,
        kioskOsUser,
        username,
        sid,
        assignedAccessActive,
        aaCheck,
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
        profileState128,
    };
}

/** Log every kiosk detection sub-check (call once at startup or when sync/read needs diagnosis). */
function logWindowsKioskDetection(label, d) {
    log.info(`windowsKioskSetup @ ${label}: runningInCage=${d.runningInCage}`);
    log.info(`windowsKioskSetup @ ${label}: [kioskOsUser] ${d.kioskOsUser} (username=${d.username || '?'})`);
    log.info(`windowsKioskSetup @ ${label}: [sid] ${d.sid || 'EMPTY — ProfileList lookup + whoami both failed'}`);
    log.info(`windowsKioskSetup @ ${label}: [aaProof] ${d.aaProof} = assignedAccessActive(${d.assignedAccessActive}) || mdmConfigured(${d.mdm.configured}) || winlogonShellMatch(${d.winlogonShellMatch})`);
    log.info(`windowsKioskSetup @ ${label}:   aa.restrictRunKey AssignedAccess_* → ${d.aaCheck.restrictRunKeyHasAssignedAccess} | reg: ${d.regSnippets.restrictRunOut}`);
    log.info(`windowsKioskSetup @ ${label}:   aa.Explorer RestrictRun DWORD=1 → ${d.aaCheck.explorerRestrictRunDwordIs1} | reg: ${d.regSnippets.explorerRestrictRunValueOut}`);
    log.info(`windowsKioskSetup @ ${label}:   aa.Explorer AssignedAccess_* → ${d.aaCheck.explorerKeyHasAssignedAccess} | reg: ${d.regSnippets.explorerOut}`);
    log.info(`windowsKioskSetup @ ${label}:   mdm AA CSP: ok=${d.mdm.ok} configured=${d.mdm.configured} — ${d.mdm.reason}`);
    log.info(`windowsKioskSetup @ ${label}:   Winlogon Shell match → ${d.winlogonShellMatch} | reg: ${d.regSnippets.winlogonShellOut}`);
    log.info(`windowsKioskSetup @ ${label}: [provisionedSid] ${d.provisionedSid} — ${d.provisionedSidReason}`);
    log.info(`windowsKioskSetup @ ${label}:   markers provisionComplete=${d.provisionMarkerExists} sidFile=${d.sidMarkerExists} sidFileValue=${d.sidMarkerValue || 'n/a'}`);
    log.info(`windowsKioskSetup @ ${label}: [profileState128] ${d.profileState128} stateDword=${d.profileStateDword ?? 'n/a'} profilePathMatch=${d.profilePathMatch}`);
    log.info(`windowsKioskSetup @ ${label}:   reg State: ${d.regSnippets.profileStateOut}`);
    log.info(`windowsKioskSetup @ ${label}:   reg ProfileImagePath: ${d.regSnippets.profilePathOut}`);
}

/** Log OS allow-list read result locally (student log), not only teacher clientinfo. */
function logKioskSystemAllowedAppsRead(label, data) {
    if (!data.ok) {
        log.warn(`windowsKioskSetup @ ${label}: allowed-apps read FAILED: ${data.error || 'unknown'}`);
        return;
    }
    log.info(`windowsKioskSetup @ ${label}: allowed-apps read OK`);
    log.info(`windowsKioskSetup @ ${label}:   restrictRunExeNames (${(data.restrictRunExeNames || []).length}): ${(data.restrictRunExeNames || []).join(', ') || '(none)'}`);
    log.info(`windowsKioskSetup @ ${label}:   mdmPolicyReadable=${data.mdmOk}`);
    log.info(`windowsKioskSetup @ ${label}:   mdmDesktopPaths (${(data.mdmDesktopPaths || []).length}): ${(data.mdmDesktopPaths || []).join(' | ') || '(none)'}`);
    log.info(`windowsKioskSetup @ ${label}:   mdmAppUserModelIds (${(data.mdmAppUserModelIds || []).length}): ${(data.mdmAppUserModelIds || []).join(', ') || '(none)'}`);
    log.info(`windowsKioskSetup @ ${label}:   launcherJsonPaths (${(data.launcherJsonPaths || []).length}): ${(data.launcherJsonPaths || []).join(' | ') || '(none)'}`);
    log.info(`windowsKioskSetup @ ${label}:   mdmNotInLauncherJson (${(data.mdmPathsNotInLauncherJson || []).length}): ${(data.mdmPathsNotInLauncherJson || []).join(' | ') || '(none)'}`);
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

/** Win AA kiosk session: correct OS user + live AA session + provisioned SID (username alone is never enough). */
export function detectRunningInWindowsKiosk() {
    // DIAGNOSE: detection temporarily disabled to isolate Windows renderer launch-failed crash.
    // If app starts with this no-op, the kiosk detection code path is the culprit; if it still
    // crashes, the cause is elsewhere. Re-enable by restoring the body below.
    if (process.platform !== 'win32') return false;
    return false;
    // return evaluateWindowsKioskDetection().runningInCage;
}

/** Startup log lines for Win Assigned Access detection (electron-main platform block). */
export function getWindowsKioskDetectionLogLines() {
    // DIAGNOSE: detection temporarily disabled — see detectRunningInWindowsKiosk above.
    if (process.platform !== 'win32') return [];
    return ['main: Win AA detection DISABLED (diagnose: renderer launch-failed)'];
    // const d = evaluateWindowsKioskDetection();
    // logWindowsKioskDetection('startup', d);
    // return [
    //     `main: Win Assigned Access kiosk: runningInCage=${d.runningInCage} skipElectronKiosk=${d.runningInCage}`,
    //     `main: Win AA check: kioskOsUser=${d.kioskOsUser} sid=${d.sid || 'empty'} aaProof=${d.aaProof} (rrActive=${d.assignedAccessActive} mdmConfigured=${d.mdm.configured} shellMatch=${d.winlogonShellMatch}) provisionedSid=${d.provisionedSid} profileState128=${d.profileState128} profileStateDword=${d.profileStateDword ?? 'n/a'}`,
    //     `main: Win AA setup: provisionComplete=${detectWindowsKioskProvisionComplete()} bundleInstalled=${detectWindowsKioskInstalled()} needsSetup=${needsWindowsKioskSetup()}`,
    // ];
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
        const out = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${b64}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: timeoutMs,
            maxBuffer: 8 * 1024 * 1024,
        });
        const text = String(out || '').trim();
        if (!text) return null;
        return JSON.parse(text);
    } catch (err) {
        log.warn(`runPowerShellJson: ${err && err.message ? err.message : err}`);
        return null;
    }
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
 * Live Assigned Access allow-list from the OS (kiosk user, no admin): RestrictRun + MDM XML when readable.
 * Use to detect apps an admin added to policy but not in kiosk-launcher-apps.json (e.g. Start pins).
 */
export function readKioskSystemAllowedApps() {
    if (process.platform !== 'win32' || !isWindowsKioskOsUser()) {
        log.warn(`windowsKioskSetup @ readKioskSystemAllowedApps: skip (win32=${process.platform === 'win32'} kioskUser=${isWindowsKioskOsUser()})`);
        return { ok: false, error: 'win32 kiosk user only' };
    }
    const restrictRunKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\RestrictRun';
    log.info(`windowsKioskSetup @ readKioskSystemAllowedApps: reg RestrictRun → ${regSnippet(runRegQuery(restrictRunKey))}`);
    const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$restrictRun = @()
$sub = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\RestrictRun'
if (Test-Path -LiteralPath $sub) {
  $props = Get-ItemProperty -LiteralPath $sub
  $restrictRun = @($props.PSObject.Properties | Where-Object { $_.Name -like 'AssignedAccess_*' } | ForEach-Object { [string]$_.Value })
}
$mdmOk = $false
$desktopPaths = [System.Collections.ArrayList]@()
$aumids = [System.Collections.ArrayList]@()
try {
  Add-Type -AssemblyName System.Web
  $obj = Get-CimInstance -Namespace 'root\\cimv2\\mdm\\dmmap' -ClassName 'MDM_AssignedAccess' -ErrorAction Stop | Select-Object -First 1
  if ($obj -and $obj.Configuration) {
    $mdmOk = $true
    $xml = [System.Web.HttpUtility]::HtmlDecode([string]$obj.Configuration)
    foreach ($m in [regex]::Matches($xml, 'DesktopAppPath="([^"]+)"')) {
      [void]$desktopPaths.Add([Environment]::ExpandEnvironmentVariables($m.Groups[1].Value))
    }
    foreach ($m in [regex]::Matches($xml, 'AppUserModelId="([^"]+)"')) {
      [void]$aumids.Add($m.Groups[1].Value)
    }
  }
} catch {}
@{
  ok = $true
  restrictRunExeNames = @($restrictRun | Sort-Object -Unique)
  mdmOk = $mdmOk
  mdmDesktopPaths = @($desktopPaths | Sort-Object -Unique)
  mdmAppUserModelIds = @($aumids | Sort-Object -Unique)
} | ConvertTo-Json -Compress -Depth 6
`;
    try {
        const data = runPowerShellJson(ps) || {};
        const launcherJsonPaths = readKioskLauncherJsonPathsRaw();
        const jsonNorm = new Set(launcherJsonPaths.map((p) => p.toLowerCase()));
        const mdmDesktopPaths = (data.mdmDesktopPaths || []).map((p) => String(p));
        const mdmPathsNotInLauncherJson = mdmDesktopPaths.filter((p) => !jsonNorm.has(path.resolve(p).toLowerCase()));
        const result = {
            ok: true,
            restrictRunExeNames: data.restrictRunExeNames || [],
            mdmOk: !!data.mdmOk,
            mdmDesktopPaths,
            mdmAppUserModelIds: data.mdmAppUserModelIds || [],
            launcherJsonPaths,
            mdmPathsNotInLauncherJson,
        };
        logKioskSystemAllowedAppsRead('readKioskSystemAllowedApps', result);
        return result;
    } catch (err) {
        log.warn('windowsKioskSetup: readKioskSystemAllowedApps failed', err);
        return { ok: false, error: err.message || String(err) };
    }
}

const ALLOWED_KIOSK_APPS_REFRESH_MS = 60_000;
let allowedKioskAppsCache = null;
let allowedKioskAppsCachedAt = 0;

/** Attach live OS allow-list to clientinfo for teacher /update (Win AA session only). */
export function syncAllowedKioskAppsClientinfo(clientinfo) {
    if (!clientinfo || process.platform !== 'win32') return;
    const det = evaluateWindowsKioskDetection();
    if (!det.runningInCage) {
        log.info('windowsKioskSetup @ syncAllowedKioskApps: skip — runningInCage=false');
        logWindowsKioskDetection('syncAllowedKioskApps-skipped', det);
        delete clientinfo.allowedKioskApps;
        allowedKioskAppsCache = null;
        allowedKioskAppsCachedAt = 0;
        return;
    }
    const now = Date.now();
    const cacheHit = allowedKioskAppsCache && now - allowedKioskAppsCachedAt < ALLOWED_KIOSK_APPS_REFRESH_MS;
    if (!cacheHit) {
        log.info('windowsKioskSetup @ syncAllowedKioskApps: refresh OS allow-list (runningInCage=true)');
        logWindowsKioskDetection('syncAllowedKioskApps', det);
        const data = readKioskSystemAllowedApps();
        if (data.ok) {
            allowedKioskAppsCache = {
                restrictRunExeNames: data.restrictRunExeNames,
                desktopPaths: data.mdmDesktopPaths,
                appUserModelIds: data.mdmAppUserModelIds,
                mdmPolicyReadable: data.mdmOk,
                notInLauncherJson: data.mdmPathsNotInLauncherJson,
            };
        } else {
            allowedKioskAppsCache = { error: data.error || 'read failed' };
            log.warn(`windowsKioskSetup @ syncAllowedKioskApps: read failed, clientinfo gets error field only`);
        }
        allowedKioskAppsCachedAt = now;
    } else {
        log.info(`windowsKioskSetup @ syncAllowedKioskApps: using cached allow-list (age ${Math.round((now - allowedKioskAppsCachedAt) / 1000)}s)`);
    }
    clientinfo.allowedKioskApps = { ...allowedKioskAppsCache, collectedAt: allowedKioskAppsCachedAt };
    const a = clientinfo.allowedKioskApps;
    if (a.error) {
        log.warn(`windowsKioskSetup @ syncAllowedKioskApps: clientinfo.allowedKioskApps error=${a.error}`);
    } else {
        log.info(`windowsKioskSetup @ syncAllowedKioskApps: clientinfo payload — restrictRun (${(a.restrictRunExeNames || []).length}): ${(a.restrictRunExeNames || []).join(', ') || '(none)'}`);
        log.info(`windowsKioskSetup @ syncAllowedKioskApps: clientinfo payload — desktopPaths (${(a.desktopPaths || []).length}): ${(a.desktopPaths || []).join(' | ') || '(none)'}`);
        log.info(`windowsKioskSetup @ syncAllowedKioskApps: clientinfo payload — appUserModelIds (${(a.appUserModelIds || []).length}): ${(a.appUserModelIds || []).join(', ') || '(none)'}`);
        log.info(`windowsKioskSetup @ syncAllowedKioskApps: clientinfo payload — mdmPolicyReadable=${a.mdmPolicyReadable} notInLauncherJson (${(a.notInLauncherJson || []).length}): ${(a.notInLauncherJson || []).join(' | ') || '(none)'}`);
    }
    log.info('windowsKioskSetup @ syncAllowedKioskApps: attached allowedKioskApps to clientinfo for teacher update');
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
        if (list.length) log.info(`windowsKioskSetup: ${list.length} launcher app(s) from ${KIOSK_LAUNCHER_APPS_JSON}`);
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
 * extraAppsFile (optional) = absolute path to a plaintext file with one extra exe path per line.
 * Returns Promise<{ok:boolean,error?:string,code?:string,skipped?:boolean}>.
 */
export async function initiateKioskSetup(_appPathIgnored, extraAppsFile = '') {
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

    // when already elevated (rare for a portable app) skip Start-Process and run inline
    if (isProcessElevated()) {
        log.info('windowsKioskSetup: already elevated, running provisioning inline');
        const inline = await runPowerShellInline(script, bundle.appDir, bundle.launchExe, extraFile);
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
    const childCommand =
        `try { ` +
        `& '${psEscape(script)}' -AppDir '${psEscape(bundle.appDir)}' -LaunchExe '${psEscape(bundle.launchExe)}'${extraArg} *>&1 | Tee-Object -FilePath '${psEscape(logFile)}'; ` +
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
function runPowerShellInline(script, appDir, launchExe, extraFile = '') {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
        '-AppDir', appDir, '-LaunchExe', launchExe];
    if (extraFile) { args.push('-ExtraAppsFile', extraFile); }
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
