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

/** Current Windows user SID (S-1-5-21-…), or empty on failure. */
function getCurrentUserSid() {
    try {
        return execSync(
            'powershell.exe -NoProfile -NonInteractive -Command "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value"',
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }
        ).trim();
    } catch {
        return '';
    }
}

/** SID written at provisioning; blocks renaming another account to next-exam-kiosk. */
function isProvisionedKioskAccountSid() {
    const current = getCurrentUserSid();
    if (!current) return false;
    if (!existsSync(KIOSK_ACCOUNT_SID_MARKER)) {
        return existsSync(KIOSK_PROVISION_MARKER);
    }
    try {
        return readFileSync(KIOSK_ACCOUNT_SID_MARKER, 'utf8').trim() === current;
    } catch {
        return false;
    }
}

/** True when AA applied RestrictRun allow-list values to this session (AA actually running). */
export function isWindowsAssignedAccessSessionActive() {
    if (process.platform !== 'win32') return false;
    try {
        execSync(
            'powershell.exe -NoProfile -NonInteractive -Command "& { $rk=\'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\RestrictRun\'; if (-not (Test-Path -LiteralPath $rk)) { exit 1 }; $props = Get-ItemProperty -LiteralPath $rk; if (-not @(($props.PSObject.Properties | Where-Object { $_.Name -like \'AssignedAccess_*\' })).Count) { exit 1 } }"',
            { stdio: ['ignore', 'ignore', 'ignore'], timeout: 8000 }
        );
        return true;
    } catch {
        return false;
    }
}

/** ProfileList State=128 is set by install-windows-kiosk.ps1 for the real kiosk profile only. */
function isKioskProfileState128() {
    const sid = getCurrentUserSid();
    if (!sid) return false;
    try {
        execSync(
            `powershell.exe -NoProfile -NonInteractive -Command "if ((Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\${sid}' -Name State -ErrorAction SilentlyContinue).State -ne 128) { exit 1 }"`,
            { stdio: ['ignore', 'ignore', 'ignore'], timeout: 8000 }
        );
        return true;
    } catch {
        return false;
    }
}

/** Win AA kiosk session: correct OS user + live AA session + provisioned SID (username alone is never enough). */
export function detectRunningInWindowsKiosk() {
    if (!isWindowsKioskOsUser()) return false;
    if (!isWindowsAssignedAccessSessionActive()) return false;
    if (!isProvisionedKioskAccountSid()) return false;
    if (!isKioskProfileState128()) return false;
    return true;
}

/** Startup log lines for Win Assigned Access detection (electron-main platform block). */
export function getWindowsKioskDetectionLogLines() {
    if (process.platform !== 'win32') return [];
    const osUser = isWindowsKioskOsUser();
    const aaActive = isWindowsAssignedAccessSessionActive();
    const inCage = detectRunningInWindowsKiosk();
    return [
        `main: Win Assigned Access kiosk: runningInCage=${inCage} skipElectronKiosk=${inCage}`,
        `main: Win AA check: kioskOsUser=${osUser} assignedAccessActive=${aaActive} provisionedSid=${isProvisionedKioskAccountSid()} profileState128=${isKioskProfileState128()}`,
        `main: Win AA setup: provisionComplete=${detectWindowsKioskProvisionComplete()} bundleInstalled=${detectWindowsKioskInstalled()} needsSetup=${needsWindowsKioskSetup()}`,
    ];
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

/** Run a PowerShell script and parse its JSON stdout (UTF-16LE -EncodedCommand). */
function runPowerShellJson(script, timeoutMs = 15000) {
    const b64 = Buffer.from(script, 'utf16le').toString('base64');
    const out = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${b64}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: timeoutMs,
    });
    return JSON.parse(out.trim());
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
        return { ok: false, error: 'win32 kiosk user only' };
    }
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
        const data = runPowerShellJson(ps);
        const launcherJsonPaths = readKioskLauncherJsonPathsRaw();
        const jsonNorm = new Set(launcherJsonPaths.map((p) => p.toLowerCase()));
        const mdmDesktopPaths = (data.mdmDesktopPaths || []).map((p) => String(p));
        const mdmPathsNotInLauncherJson = mdmDesktopPaths.filter((p) => !jsonNorm.has(path.resolve(p).toLowerCase()));
        if (mdmPathsNotInLauncherJson.length) {
            log.warn(`windowsKioskSetup: ${mdmPathsNotInLauncherJson.length} MDM AllowedApp path(s) not in kiosk-launcher-apps.json`);
        }
        return {
            ok: true,
            restrictRunExeNames: data.restrictRunExeNames || [],
            mdmOk: !!data.mdmOk,
            mdmDesktopPaths,
            mdmAppUserModelIds: data.mdmAppUserModelIds || [],
            launcherJsonPaths,
            mdmPathsNotInLauncherJson,
        };
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
    if (!detectRunningInWindowsKiosk()) {
        delete clientinfo.allowedKioskApps;
        allowedKioskAppsCache = null;
        allowedKioskAppsCachedAt = 0;
        return;
    }
    const now = Date.now();
    if (!allowedKioskAppsCache || now - allowedKioskAppsCachedAt >= ALLOWED_KIOSK_APPS_REFRESH_MS) {
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
        }
        allowedKioskAppsCachedAt = now;
    }
    clientinfo.allowedKioskApps = { ...allowedKioskAppsCache, collectedAt: allowedKioskAppsCachedAt };
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
