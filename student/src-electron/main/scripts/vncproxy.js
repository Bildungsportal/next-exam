import { spawn } from 'child_process';
import net from 'net';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

let child = null;
let currentPort = null;
let currentTargetHost = null;
let currentTargetPort = null;

function getHelperPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Packaged: helper + its own node_modules/ws are shipped unpacked as extraResource (see quasar.config.ts);
    // the helper runs as a plain node process and cannot require from app.asar.
    const packaged = path.join(process.resourcesPath || '', 'vncproxy', 'vncproxy-helper.cjs');
    if (fs.existsSync(packaged)) return packaged;
    const nextToMain = path.join(__dirname, 'vncproxy-helper.cjs');
    if (fs.existsSync(nextToMain)) return nextToMain;
    // Dev: main is bundled in .quasar/dev-electron, helper lives in source tree
    return path.join(process.cwd(), 'src-electron', 'main', 'scripts', 'vncproxy-helper.cjs');
}

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', (err) => {
            server.close();
            reject(err);
        });
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : null;
            server.close(() => resolve(port));
        });
    });
}

async function waitForPort(port, timeoutMs = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const isOpen = await new Promise((resolve) => {
            const socket = new net.Socket();
            const finish = (open) => {
                socket.destroy();
                resolve(open);
            };
            socket.setTimeout(300);
            socket.once('connect', () => finish(true));
            socket.once('timeout', () => finish(false));
            socket.once('error', () => finish(false));
            try {
                socket.connect(port, '127.0.0.1');
            } catch (err) {
                finish(false);
            }
        });
        if (isOpen) return true;
    }
    return false;
}

function clearStateIfProcess(proc) {
    if (child === proc) {
        child = null;
        currentPort = null;
        currentTargetHost = null;
        currentTargetPort = null;
    }
}

export async function startProxy({ host, port }) {
    const scriptPath = getHelperPath();
    const portNum = Number(port);

    const sameTarget =
        child &&
        !child.killed &&
        currentPort &&
        currentTargetHost === host &&
        currentTargetPort === portNum;

    if (sameTarget) {
        log.info('vncproxy @ startProxy: reusing existing helper on ws port', currentPort, 'for', host, portNum);
        return currentPort;
    }

    if (child && !child.killed) {
        log.info(
            'vncproxy @ startProxy: target changed, restarting helper',
            currentTargetHost,
            currentTargetPort,
            '->',
            host,
            portNum
        );
        stopProxy();
    }

    try {
        currentPort = await getFreePort();
    } catch (err) {
        log.error('vncproxy @ startProxy: failed to obtain free port', err);
        currentPort = null;
        return null;
    }

    if (!currentPort) {
        log.error('vncproxy @ startProxy: no free port available for proxy');
        return null;
    }

    currentTargetHost = host;
    currentTargetPort = portNum;

    try {
        // ELECTRON_RUN_AS_NODE: run packaged electron binary in pure-Node mode so the helper
        // bypasses singleInstanceLock + app bootstrap and reaches WebSocketServer.listen
        const proc = spawn(process.execPath, [scriptPath, host, String(portNum), String(currentPort)], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        });
        child = proc;
        // pipe helper stdout/stderr into electron-log so packaged-build crashes (e.g. require/port) are visible
        proc.stdout?.on('data', (d) => log.info('vncproxy-helper(out):', String(d).trim()));
        proc.stderr?.on('data', (d) => log.error('vncproxy-helper(err):', String(d).trim()));
        proc.on('exit', (code, signal) => {
            log.info(`vncproxy-helper exited with code ${code}, signal ${signal}`);
            clearStateIfProcess(proc);
        });
        log.info('vncproxy @ startProxy: helper spawned for target', host, portNum, 'on ws port', currentPort);
    } catch (err) {
        log.error('vncproxy @ startProxy: failed to spawn helper', err);
        child = null;
        currentPort = null;
        currentTargetHost = null;
        currentTargetPort = null;
        return null;
    }

    const ready = await waitForPort(currentPort, 3000);
    if (!ready) {
        log.error('vncproxy @ startProxy: helper did not start listening on port', currentPort);
        if (child && !child.killed) {
            try {
                child.kill();
            } catch (e) {
                log.error('vncproxy @ startProxy: error killing non-listening helper', e);
            }
        }
        child = null;
        currentPort = null;
        currentTargetHost = null;
        currentTargetPort = null;
        return null;
    }

    return currentPort;
}

export function stopProxy() {
    if (child && !child.killed) {
        try {
            child.kill();
        } catch (e) {
            log.error('vncproxy @ stopProxy: error killing helper', e);
        }
    }
    child = null;
    currentPort = null;
    currentTargetHost = null;
    currentTargetPort = null;
}
