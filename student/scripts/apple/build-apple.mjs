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
    'wifi-helper': path.join(projectRoot, 'scripts', 'entitlements.mac.wifi.plist'),
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

// Codesign one helper with its own entitlements plist.
async function signHelper(helperPath, entitlementsPath, identity, adhoc) {
    if (identity) {
        await run('codesign', [
            '--force',
            '--options', 'runtime',
            '--timestamp',
            '--entitlements', entitlementsPath,
            '-s', identity,
            helperPath,
        ]);
        console.log(`Signed ${path.basename(helperPath)} with: ${identity}`);
        return;
    }
    if (adhoc) {
        await run('codesign', [
            '--force',
            '--entitlements', entitlementsPath,
            '-s', '-',
            helperPath,
        ]);
        console.log(`Ad-hoc signed ${path.basename(helperPath)} (local dev)`);
    }
}

async function maybeSign() {
    const identity = (process.env.NXE_APPLE_SIGN_IDENTITY || process.env.CSC_NAME || process.env.SHAID || '').trim();
    const adhoc = process.env.NXE_APPLE_ADHOC === '1' || process.env.SIGN === 'false';
    for (const [name, entitlementsPath] of Object.entries(helperEntitlements)) {
        const helperPath = path.join(appleDir, name);
        if (!fs.existsSync(helperPath)) continue;
        await signHelper(helperPath, entitlementsPath, identity, adhoc);
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
