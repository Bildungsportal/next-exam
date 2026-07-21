import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const appleDir = path.join(projectRoot, 'scripts', 'apple');

// Load signing identity (SHAID etc.) from .env — invoked standalone via `npm run build:apple`, which does not inherit prebuild's dotenv.
const envFile = fs.existsSync(path.join(projectRoot, '.env')) ? path.join(projectRoot, '.env') : path.join(projectRoot, '.env.production');
dotenv.config({ path: envFile });

// assessment-helper is a .app bundle (embedded profile authorizes the restricted AAC entitlement);
// wifi-helper is a plain CLI. Sign each at its bundle/binary path with its own entitlements.
const helperEntitlements = {
    'assessment-helper.app': path.join(projectRoot, 'scripts', 'entitlements.mac.assessment.plist'),
};

function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${cmd} ${args.join(' ')} failed (${code})`));
        });
    });
}

// Ad-hoc sign helpers for local dev only; production signing is in notarize.cjs afterSign.
async function signHelper(helperPath, entitlementsPath, adhoc) {
    if (!adhoc) return;
    await run('codesign', [
        '--force',
        '--entitlements', entitlementsPath,
        '-s', '-',
        helperPath,
    ]);
    console.log(`Ad-hoc signed ${path.basename(helperPath)} (local dev)`);
}

async function maybeSign() {
    const identity = (process.env.NXE_APPLE_SIGN_IDENTITY || process.env.CSC_NAME || process.env.SHAID || '').trim();
    const adhoc = process.env.NXE_APPLE_ADHOC === '1' || process.env.SIGN === 'false';
    // Production signing runs in notarize.cjs afterSign (resignAppleHelpers); pre-pack codesign duplicates and can hang in CI.
    if (identity && !adhoc) {
        console.log('Skipping pre-pack codesign (notarize.cjs resigns helpers after electron-builder)');
        return;
    }
    for (const [name, entitlementsPath] of Object.entries(helperEntitlements)) {
        const helperPath = path.join(appleDir, name);
        if (!fs.existsSync(helperPath)) continue;
        await signHelper(helperPath, entitlementsPath, adhoc);
    }
}

async function main() {
    if (process.platform !== 'darwin') {
        console.warn('apple helper build skipped: requires macOS (swiftc + Apple frameworks)');
        const allPresent = Object.keys(helperEntitlements).every((name) => fs.existsSync(path.join(appleDir, name)));
        if (!allPresent) process.exit(0);
        return;
    }
    await run('bash', [path.join(appleDir, 'build.sh')], { cwd: appleDir });
    await maybeSign();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
