import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import platformDispatcher from './platformDispatcher.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let assessmentChild = null;

function helperPath() {
    for (const p of [
        path.join(process.resourcesPath, 'apple', 'assessment-helper'),
        path.join(process.cwd(), 'scripts', 'apple', 'assessment-helper'),
        path.join(__dirname, '../../../../scripts/apple/assessment-helper'),
    ]) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

/** Spawn assessment-helper start; { ok, reason? }. No-op off darwin. */
export async function startAssessmentSession() {
    if (platformDispatcher.platform !== 'darwin') return { ok: true };
    if (assessmentChild && assessmentChild.exitCode === null && !assessmentChild.killed) return { ok: true };

    const bin = helperPath();
    if (!bin) {
        return { ok: false, reason: 'assessment-helper not found (npm run build:apple:local on macOS)' };
    }
    try { fs.chmodSync(bin, 0o755); } catch (_) { /* ignore */ }

    return new Promise((resolve) => {
        const child = spawn(bin, ['start'], { stdio: ['ignore', 'pipe', 'pipe'] });
        assessmentChild = child;
        const fail = (reason) => {
            if (assessmentChild === child) assessmentChild = null;
            try { child.kill('SIGTERM'); } catch (_) { /* ignore */ }
            resolve({ ok: false, reason });
        };
        child.once('error', (err) => fail(err.message));
        child.once('spawn', () => {
            const onEarlyExit = (code, signal) => fail(`exit code=${code} signal=${signal}`);
            child.once('exit', onEarlyExit);
            setTimeout(() => {
                child.removeListener('exit', onEarlyExit);
                if (child.exitCode !== null || child.killed) fail('exited immediately');
                else {
                    child.on('exit', () => { if (assessmentChild === child) assessmentChild = null; });
                    resolve({ ok: true });
                }
            }, 2500);
        });
        child.stderr?.on('data', (d) => log.warn('assessment-helper:', String(d).trim()));
    });
}

/** assessment-helper stop + kill start child. No-op off darwin. */
export async function stopAssessmentSession() {
    if (platformDispatcher.platform !== 'darwin') return;
    const bin = helperPath();
    if (bin) {
        try { await execFileAsync(bin, ['stop'], { timeout: 15000 }); } catch (err) {
            log.warn('assessmentSession @ stop:', err?.message || err);
        }
    }
    if (assessmentChild && !assessmentChild.killed) {
        try { assessmentChild.kill('SIGTERM'); } catch (_) { /* ignore */ }
    }
    assessmentChild = null;
}
