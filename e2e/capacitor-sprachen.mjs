import { _electron as electron } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.join(import.meta.dirname, '..');
const teacherMain = path.join(repoRoot, 'teacher', 'dist/electron/UnPackaged/electron-main.js');
const iosRoot = path.join(repoRoot, 'student', 'src-capacitor', 'ios', 'App');
const examName = 'e2e-ios';
const studentName = 'iosstudent';
const profileRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'next-exam-ios-e2e-'));
let teacherApp;
let testSimulatorUdid;

// Returns the teacher renderer instead of a possible DevTools page.
async function getTeacherWindow(app) {
    await app.firstWindow();
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const window = app.windows().find(page => page.url().startsWith('file:'));
        if (window) return window;
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error('Teacher renderer did not open');
}

// Updates CocoaPods only when its generated manifest differs from the lockfile.
async function syncPods() {
    const lockfile = path.join(iosRoot, 'Podfile.lock');
    const manifest = path.join(iosRoot, 'Pods', 'Manifest.lock');
    let synchronized = false;
    try {
        synchronized = (await fs.readFile(lockfile)).equals(await fs.readFile(manifest));
    } catch {
        // Missing manifests require pod install.
    }
    if (!synchronized) {
        execFileSync('pod', ['install'], { cwd: iosRoot, stdio: 'inherit' });
    }
}

// Creates an isolated simulator from an installed iPad or iPhone runtime.
async function getSimulatorDestination() {
    if (process.env.NXE_IOS_DESTINATION) return process.env.NXE_IOS_DESTINATION;

    const output = execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
        encoding: 'utf8',
    });
    const devices = Object.entries(JSON.parse(output).devices).flatMap(([runtime, runtimeDevices]) => (
        runtimeDevices.filter(device => device.isAvailable).map(device => ({ ...device, runtime }))
    ));
    const template = devices.find(device => device.name.startsWith('iPad'))
        ?? devices.find(device => device.name.startsWith('iPhone'));
    if (!template?.deviceTypeIdentifier) throw new Error('No available iOS Simulator found in Xcode');

    testSimulatorUdid = execFileSync('xcrun', [
        'simctl', 'create', `NextExam E2E ${Date.now()}`, template.deviceTypeIdentifier, template.runtime,
    ], { encoding: 'utf8' }).trim();
    execFileSync('xcrun', ['simctl', 'boot', testSimulatorUdid], { stdio: 'inherit' });
    execFileSync('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', testSimulatorUdid]);
    try {
        execFileSync('xcrun', ['simctl', 'bootstatus', testSimulatorUdid, '-b'], {
            stdio: 'inherit',
            timeout: 600_000,
        });
    } catch {
        console.warn('Simulator did not finish booting; restarting it once');
        execFileSync('xcrun', ['simctl', 'shutdown', testSimulatorUdid], { stdio: 'inherit' });
        execFileSync('xcrun', ['simctl', 'boot', testSimulatorUdid], { stdio: 'inherit' });
        execFileSync('xcrun', ['simctl', 'bootstatus', testSimulatorUdid, '-b'], {
            stdio: 'inherit',
            timeout: 600_000,
        });
    }
    return `platform=iOS Simulator,id=${testSimulatorUdid}`;
}

async function findFile(directory, extension) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            const match = await findFile(entryPath, extension);
            if (match) return match;
        } else if (entry.name.endsWith(extension)) {
            return entryPath;
        }
    }
    return undefined;
}

// Injects variables into the test runner, whose environment Xcode otherwise sanitizes.
async function setTestEnvironment(derivedData, variables) {
    const xctestrun = await findFile(path.join(derivedData, 'Build', 'Products'), '.xctestrun');
    if (!xctestrun) throw new Error('Xcode did not produce an .xctestrun file');

    const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', xctestrun], {
        encoding: 'utf8',
    }));
    let updated = false;
    function updateTargets(value) {
        if (!value || typeof value !== 'object') return;
        if (value.BlueprintName === 'AppUITests') {
            value.EnvironmentVariables = { ...value.EnvironmentVariables, ...variables };
            updated = true;
        }
        Object.values(value).forEach(updateTargets);
    }
    updateTargets(plist);
    if (!updated) throw new Error('AppUITests target was not found in the .xctestrun file');

    await fs.writeFile(xctestrun, JSON.stringify(plist));
    execFileSync('plutil', ['-convert', 'binary1', xctestrun]);
    return xctestrun;
}

// Runs a child process while preserving its output and exit code.
function runCommand(command, args, options) {
    const child = spawn(command, args, { ...options, stdio: 'inherit' });
    return new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
    });
}

// Builds and installs the app before XCUITest launches it.
async function runXcodeTest(pin) {
    const destination = await getSimulatorDestination();
    const derivedData = path.join(profileRoot, 'xcode-derived-data');
    if (testSimulatorUdid) {
        execFileSync('xcrun', [
            'simctl', 'spawn', testSimulatorUdid, 'launchctl', 'setenv', 'NXE_E2E_PIN', pin,
        ]);
    }
    const baseArgs = [
        '-workspace', 'App.xcworkspace',
        '-scheme', 'App',
        '-destination', destination,
        '-derivedDataPath', derivedData,
    ];
    await runCommand('xcodebuild', [...baseArgs, 'build-for-testing'], { cwd: iosRoot, env: process.env });
    const xctestrun = await setTestEnvironment(derivedData, { NXE_E2E_PIN: pin });

    if (testSimulatorUdid) {
        const appPath = path.join(derivedData, 'Build', 'Products', 'Debug-iphonesimulator', 'App.app');
        execFileSync('xcrun', ['simctl', 'install', testSimulatorUdid, appPath], { stdio: 'inherit' });
    }

    const resultBundle = path.join(profileRoot, 'AppUITests.xcresult');
    try {
        await runCommand('xcodebuild', [
            '-xctestrun', xctestrun,
            '-destination', destination,
            '-resultBundlePath', resultBundle,
            'test-without-building',
        ], {
            cwd: iosRoot,
            env: { ...process.env, NXE_E2E_PIN: pin },
        });
    } catch (error) {
        execFileSync('xcrun', [
            'xcresulttool', 'get', 'test-results', 'summary', '--path', resultBundle,
        ], { stdio: 'inherit' });
        throw error;
    }
}

try {
    await fs.access(teacherMain);
    await syncPods();
    teacherApp = await electron.launch({
        args: [teacherMain, `--user-data-dir=${path.join(profileRoot, 'teacher')}`],
        cwd: path.join(repoRoot, 'teacher'),
        env: { ...process.env, DEBUG: '1' },
    });

    const teacherWindow = await getTeacherWindow(teacherApp);
    teacherWindow.setDefaultTimeout(30_000);

    const serverNameInput = teacherWindow.locator('#servername');
    await serverNameInput.waitFor();
    await serverNameInput.fill(examName);
    const startupDialog = teacherWindow.locator('.swal2-container');
    if (await startupDialog.isVisible()) {
        await startupDialog.locator('.swal2-confirm').click();
        await startupDialog.waitFor({ state: 'hidden' });
    }
    await teacherWindow.locator('#examstart').click();
    await teacherWindow.locator('#studentslist').waitFor();
    await teacherWindow.locator('[data-e2e="exam-mode-toggle"]').click();
    await teacherWindow.locator('[data-e2e="exam-mode-editor"]').click();
    const pin = (await teacherWindow.locator('[data-e2e="exam-pin"]').textContent()).trim();
    if (!/^\d{4}$/.test(pin)) throw new Error(`Invalid exam PIN: ${pin}`);

    const xcodeTest = runXcodeTest(pin);
    const studentWidget = teacherWindow.locator('.studentwidget').filter({ hasText: studentName });
    const startExam = studentWidget.waitFor({ timeout: 600_000 }).then(() => (
        teacherWindow.locator('[data-e2e="start-exam"]').click()
    ));
    await Promise.all([xcodeTest, startExam]);
} finally {
    await teacherApp?.close();
    if (testSimulatorUdid) {
        execFileSync('xcrun', ['simctl', 'delete', testSimulatorUdid]);
    }
    await fs.rm(profileRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    await fs.rm(path.join(os.homedir(), 'EXAM-TEACHER', examName), {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 500,
    });
}
