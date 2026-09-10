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
const pin = '1111';
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
    execFileSync('xcrun', ['simctl', 'bootstatus', testSimulatorUdid, '-b'], {
        stdio: 'inherit',
        timeout: 180_000,
    });
    return `platform=iOS Simulator,id=${testSimulatorUdid}`;
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
async function runXcodeTest() {
    const destination = await getSimulatorDestination();
    const derivedData = path.join(profileRoot, 'xcode-derived-data');
    const baseArgs = [
        '-workspace', 'App.xcworkspace',
        '-scheme', 'App',
        '-destination', destination,
        '-derivedDataPath', derivedData,
    ];
    await runCommand('xcodebuild', [...baseArgs, 'build-for-testing'], { cwd: iosRoot, env: process.env });

    if (testSimulatorUdid) {
        const appPath = path.join(derivedData, 'Build', 'Products', 'Debug-iphonesimulator', 'App.app');
        execFileSync('xcrun', ['simctl', 'install', testSimulatorUdid, appPath], { stdio: 'inherit' });
    }

    await runCommand('xcodebuild', [...baseArgs, 'test-without-building'], { cwd: iosRoot, env: process.env });
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
    await teacherWindow.locator('.sidebar-exammode-toggle').click();
    await teacherWindow.locator('.sidebar-exammode-dropdown-wrap .dropdown-item').nth(1).click();

    const xcodeTest = runXcodeTest();
    const studentWidget = teacherWindow.locator('.studentwidget').filter({ hasText: studentName });
    const startExam = studentWidget.waitFor({ timeout: 600_000 }).then(() => (
        teacherWindow.locator('.control-buttons-container .btn-teal.control-button').first().click()
    ));
    await Promise.all([xcodeTest, startExam]);
} finally {
    await teacherApp?.close();
    if (testSimulatorUdid) {
        execFileSync('xcrun', ['simctl', 'delete', testSimulatorUdid]);
    }
    await fs.rm(profileRoot, { recursive: true, force: true });
    await fs.rm(path.join(os.homedir(), 'EXAM-TEACHER', examName), { recursive: true, force: true });
}
