import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import platformDispatcher from './platformDispatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let assessmentChild = null;
let assessmentActive = false;

/** true while a macOS AAC session is live (begin received, not yet ended). Mirrors the real helper state. */
export function isAssessmentSessionActive() {
    return assessmentActive;
}

// assessment-helper is bundled as assessment-helper.app (embedded profile authorizes the restricted
// AAC entitlement); the executable sits at Contents/MacOS/assessment-helper.
function helperPath() {
    const inner = path.join('assessment-helper.app', 'Contents', 'MacOS', 'assessment-helper');
    for (const p of [
        path.join(process.resourcesPath, 'apple', inner),
        path.join(process.cwd(), 'scripts', 'apple', inner),
        path.join(__dirname, '../../../../scripts/apple', inner),
    ]) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

/** Spawn assessment-helper start; resolves once the helper reports the real AAC outcome. { ok, reason? }. No-op off darwin. */
export async function startAssessmentSession() {
    if (platformDispatcher.platform !== 'darwin') return { ok: true };
    if (assessmentChild && assessmentChild.exitCode === null && !assessmentChild.killed) return { ok: true };

    const bin = helperPath();
    if (!bin) {
        return { ok: false, reason: 'assessment-helper not found (npm run build:apple:local on macOS)' };
    }
    try { fs.chmodSync(bin, 0o755); } catch (_) { /* ignore */ }

    return new Promise((resolve) => {
        // keep stdin open: closing it is the helper's fallback stop trigger (EOF -> session.end())
        const child = spawn(bin, ['start'], { stdio: ['pipe', 'pipe', 'pipe'] });
        assessmentChild = child;
        let settled = false;
        const fail = (reason) => {
            if (settled) return;
            settled = true;
            if (assessmentChild === child) assessmentChild = null;
            assessmentActive = false;
            try { child.kill('SIGTERM'); } catch (_) { /* ignore */ }
            log.error('assessmentSession @ start:', reason);
            resolve({ ok: false, reason });
        };
        const succeed = () => {
            if (settled) return;
            settled = true;
            log.info('assessmentSession @ start: AAC session begin');
            assessmentActive = true;
            child.on('exit', () => { assessmentActive = false; if (assessmentChild === child) assessmentChild = null; });
            resolve({ ok: true });
        };

        // AEAssessmentSession reports begin/fail asynchronously via delegate -> line-delimited JSON on stdout
        let buf = '';
        child.stdout?.on('data', (d) => {
            buf += String(d);
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line) continue;
                let event;
                try { event = JSON.parse(line).event; } catch (_) { log.warn('assessment-helper (stdout):', line); continue; }
                if (event === 'begin') succeed();
                // pre-begin: settle the start promise as failure. post-begin (settled): the live AAC
                // session ended/was interrupted by the system -> clear active flag so isAssessmentSessionActive() stays truthful.
                else if (event === 'failed' || event === 'interrupted' || event === 'end') {
                    if (settled) { assessmentActive = false; log.warn(`assessmentSession @ live: ${event}: ${line}`); }
                    else fail(`helper event=${event}: ${line}`);
                }
            }
        });
        child.stderr?.on('data', (d) => log.warn('assessment-helper:', String(d).trim()));
        child.once('error', (err) => fail(err.message));
        child.once('exit', (code, signal) => fail(`exited before begin (code=${code} signal=${signal})`));
        // safety net: no begin/fail event within timeout -> treat as failure (do not silently proceed)
        setTimeout(() => fail('no begin event (timeout)'), 5000);
    });
}

/** End the live AAC session by signalling the running start child (helper calls session.end() on SIGTERM). No-op off darwin. */
export async function stopAssessmentSession() {
    if (platformDispatcher.platform !== 'darwin') return;
    const child = assessmentChild;
    assessmentChild = null;
    assessmentActive = false;
    if (!child || child.killed || child.exitCode !== null) return;

    await new Promise((resolve) => {
        const done = () => { clearTimeout(t); resolve(); };
        child.once('exit', done);
        // graceful: SIGTERM -> session.end() -> didEnd -> exit; SIGKILL fallback if it hangs
        try { child.kill('SIGTERM'); } catch (_) { return done(); }
        const t = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
            done();
        }, 5000);
    });
}
