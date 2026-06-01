import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const appleDir = path.join(projectRoot, 'scripts', 'apple');
const helpers = ['assessment-helper', 'wifi-helper'];
const entitlements = path.join(projectRoot, 'scripts', 'entitlements.mac.plist');

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

// Codesign a single helper binary with the shared entitlements file.
async function signHelper(helperPath, identity, adhoc) {
    if (identity) {
        await run('codesign', [
            '--force',
            '--options', 'runtime',
            '--timestamp',
            '--entitlements', entitlements,
            '-s', identity,
            helperPath,
        ]);
        console.log(`Signed ${path.basename(helperPath)} with: ${identity}`);
        return;
    }
    if (adhoc) {
        await run('codesign', [
            '--force',
            '--entitlements', entitlements,
            '-s', '-',
            helperPath,
        ]);
        console.log(`Ad-hoc signed ${path.basename(helperPath)} (local dev, no notarization)`);
    }
}

// Sign every built helper with the same identity/entitlements.
async function maybeSign() {
    const identity = (process.env.NXE_APPLE_SIGN_IDENTITY || process.env.CSC_NAME || process.env.SHAID || '').trim();
    const adhoc = process.env.NXE_APPLE_ADHOC === '1' || process.env.SIGN === 'false';
    for (const name of helpers) {
        const helperPath = path.join(appleDir, name);
        if (!fs.existsSync(helperPath)) continue;
        await signHelper(helperPath, identity, adhoc);
    }
}

async function main() {
    if (process.platform !== 'darwin') {
        console.warn('apple helper build skipped: requires macOS (swiftc + Apple frameworks)');
        const allPresent = helpers.every((name) => fs.existsSync(path.join(appleDir, name)));
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
