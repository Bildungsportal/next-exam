import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const assessmentDir = path.join(projectRoot, 'scripts', 'assessment');
const helperPath = path.join(assessmentDir, 'assessment-helper');
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

async function maybeSign() {
    if (!fs.existsSync(helperPath)) return;
    const identity = (process.env.NXE_ASSESSMENT_SIGN_IDENTITY || process.env.CSC_NAME || process.env.SHAID || '').trim();
    const adhoc = process.env.NXE_ASSESSMENT_ADHOC === '1' || process.env.SIGN === 'false';
    if (identity) {
        await run('codesign', [
            '--force',
            '--options', 'runtime',
            '--timestamp',
            '--entitlements', entitlements,
            '-s', identity,
            helperPath,
        ]);
        console.log(`Signed assessment-helper with: ${identity}`);
        return;
    }
    if (adhoc) {
        await run('codesign', [
            '--force',
            '--entitlements', entitlements,
            '-s', '-',
            helperPath,
        ]);
        console.log('Ad-hoc signed assessment-helper (local dev, no notarization)');
    }
}

async function main() {
    if (process.platform !== 'darwin') {
        console.warn('assessment build skipped: requires macOS (swiftc + AutomaticAssessmentConfiguration)');
        if (!fs.existsSync(helperPath)) process.exit(0);
        return;
    }
    await run('bash', [path.join(assessmentDir, 'build.sh')], { cwd: assessmentDir });
    await maybeSign();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
