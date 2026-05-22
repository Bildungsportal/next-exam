/**
 * Windows counterpart to Linux Cage kiosk setup.
 * - detectRunningInWindowsKiosk(): true when current OS user === kiosk username
 * - detectWindowsKioskInstalled(): true when provisioning artifacts exist
 * - needsWindowsKioskSetup(): inverse, used by UI install button
 * - initiateKioskSetup(appPath): platform switch + UAC elevation + PowerShell payload
 *
 * Shares public field names with cage (runningInCage etc.) so renderer logic is unchanged.
 */
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import log from 'electron-log';

export const KIOSK_USERNAME = 'next-exam-kiosk';
export const KIOSK_INSTALL_DIR = 'C:\\NextExam';
// written only when install-windows-kiosk.ps1 finishes (incl. MDM); partial runs must not hide the UI button
export const KIOSK_PROVISION_MARKER = 'C:\\NextExam\\.kiosk-provision-complete';
const KIOSK_LAUNCH_EXE_MARKER = 'C:\\NextExam\\.kiosk-launch-exe.txt';
const KIOSK_LAUNCHER_APPS_JSON = path.join(KIOSK_INSTALL_DIR, 'kiosk-launcher-apps.json');
let kioskLogoffTriggered = false;

/** System32 (Sysnative when x86 Node runs on x64 Windows). */
function resolveWindowsSystem32Dir() {
    const winRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
    if (process.arch === 'ia32') {
        const native = path.join(winRoot, 'Sysnative');
        if (existsSync(path.join(native, 'cmd.exe'))) return native;
    }
    return path.join(winRoot, 'System32');
}

/** Start session logoff for win32 kiosk user (call before app.quit — will-quit spawn often fails UNKNOWN). */
export function triggerWindowsKioskLogoff() {
    if (process.platform !== 'win32' || kioskLogoffTriggered) return kioskLogoffTriggered;
    const system32 = resolveWindowsSystem32Dir();
    const tryStart = (file, args, label) => {
        if (!existsSync(file)) return false;
        try {
            const child = spawn(file, args, {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                windowsVerbatimArguments: true,
            });
            child.on('error', (err) => log.warn(`windowsKioskLogoff: ${label} error`, err));
            child.unref();
            log.info(`windowsKioskLogoff: ${label} (${file} ${args.join(' ')})`);
            kioskLogoffTriggered = true;
            return true;
        } catch (err) {
            log.warn(`windowsKioskLogoff: ${label} spawn failed`, err);
            return false;
        }
    };
    if (tryStart(path.join(system32, 'shutdown.exe'), ['/l', '/f'], 'shutdown /l /f')) return true;
    if (tryStart(path.join(system32, 'cmd.exe'), ['/d', '/s', '/c', 'logoff'], 'cmd /c logoff')) return true;
    if (tryStart(path.join(system32, 'logoff.exe'), [], 'logoff.exe')) return true;
    log.error('windowsKioskLogoff: all logoff attempts failed');
    return false;
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

/** True when this process runs as the dedicated kiosk OS user. */
export function detectRunningInWindowsKiosk() {
    if (process.platform !== 'win32') return false;
    try {
        const u = (os.userInfo().username || '').toLowerCase();
        return u === KIOSK_USERNAME.toLowerCase();
    } catch {
        return false;
    }
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

/** Strip UTF-8 BOM (PowerShell Set-Content -Encoding UTF8) so JSON.parse does not fail. */
function stripUtf8Bom(text) {
    return text?.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Parse launcher JSON; repair legacy PS output "{...},{...}" (missing array brackets). */
function parseLauncherJsonText(text) {
    const stripped = stripUtf8Bom(text).trim();
    if (!stripped) return null;
    try {
        return JSON.parse(stripped);
    } catch (firstErr) {
        if (stripped.startsWith('[')) throw firstErr;
        if (stripped.startsWith('{') && stripped.includes('},{')) {
            return JSON.parse(`[${stripped}]`);
        }
        throw firstErr;
    }
}

/** Normalize launcher JSON ({apps:[...]}, root array, or legacy PS shapes). */
function normalizeLauncherAppsRaw(raw) {
    if (!raw) return [];
    let items = raw;
    if (Array.isArray(raw.apps)) items = raw.apps;
    else if (!Array.isArray(raw)) {
        if (Array.isArray(raw.value)) items = raw.value;
        else items = [raw];
    }
    const out = [];
    for (const entry of items) {
        if (!entry || typeof entry !== 'object') continue;
        const appPath = entry.path || entry.Path || entry.desktopAppPath || entry.DesktopAppPath;
        if (!appPath) continue;
        const name = entry.name || entry.Name || path.basename(appPath, path.extname(appPath));
        out.push({ name: String(name), path: String(appPath) });
    }
    return withoutMainExamLauncherApps(out);
}

/** Read and parse one kiosk-launcher-apps.json file. */
function readLauncherAppsJsonFile(filePath) {
    try {
        const raw = parseLauncherJsonText(readFileSync(filePath, 'utf8'));
        const list = normalizeLauncherAppsRaw(raw);
        if (list.length) {
            log.info(`windowsKioskSetup: ${list.length} launcher app(s) from ${filePath}`);
            return list;
        }
    } catch (err) {
        log.warn(`windowsKioskSetup: launcher json unreadable: ${filePath}`, err);
    }
    return null;
}

/** Candidate JSON paths (install dir, workdir, app dir). */
function kioskLauncherJsonCandidates(workDir = '') {
    const candidates = [];
    if (process.platform !== 'win32') return candidates;
    candidates.push(KIOSK_LAUNCHER_APPS_JSON);
    if (workDir) candidates.push(path.join(workDir, 'kiosk-launcher-apps.json'));
    try {
        candidates.push(path.join(path.dirname(process.execPath), 'kiosk-launcher-apps.json'));
    } catch { /* ignore */ }
    return [...new Set(candidates)];
}

/** Parse kiosk-allowed-apps.txt into launcher entries for the in-app bar (extras only). */
function readCageLauncherAppsFromWorkdir(workDir) {
    const apps = [];
    const txt = workDir ? path.join(workDir, 'kiosk-allowed-apps.txt') : '';
    if (!txt || !existsSync(txt)) return apps;
    const skip = new Set(['java.exe', 'javaw.exe', 'disable-shortcuts.exe']);
    for (const raw of readFileSync(txt, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        if (!existsSync(line)) continue;
        if (skip.has(path.basename(line).toLowerCase())) continue;
        if (/next-exam-student\.exe$/i.test(line)) continue;
        const resolved = path.resolve(line);
        if (apps.some((a) => path.resolve(a.path) === resolved)) continue;
        apps.push({ name: path.basename(line, path.extname(line)), path: resolved });
    }
    return apps;
}

/** Apps for the cage launcher bar (provisioned JSON on win32, else workdir txt). */
export function readKioskLauncherApps(workDir = '') {
    for (const filePath of kioskLauncherJsonCandidates(workDir)) {
        if (!existsSync(filePath)) continue;
        const list = readLauncherAppsJsonFile(filePath);
        if (list?.length) return list;
    }
    return readCageLauncherAppsFromWorkdir(workDir);
}

/** Spawn a whitelisted exe from kiosk-launcher-apps.json. */
export function launchKioskAllowedApp(exePath) {
    const target = path.resolve(String(exePath || ''));
    const allowed = readKioskLauncherApps('').some((a) => path.resolve(a.path) === target);
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
 * Main entry. Linux path is handled elsewhere (pkexec install-cage-kiosk.sh).
 * On Windows: relaunches the PowerShell payload via `Start-Process -Verb RunAs` (UAC).
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
