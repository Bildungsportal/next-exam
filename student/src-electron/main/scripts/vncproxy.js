import { spawn } from 'child_process';
import net from 'net';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

let child = null;
let currentPort = null;

function getHelperPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
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

export async function startProxy({ host, port }) {
    const scriptPath = getHelperPath();

    // Wenn der Helper bereits läuft, einfach den bestehenden Proxy-Port zurückgeben
    if (child && !child.killed && currentPort) {
        log.info('vncproxy @ startProxy: reusing existing helper on ws port', currentPort);
        return currentPort;
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

    try {
        child = spawn(process.execPath, [scriptPath, host, String(port), String(currentPort)], {
            stdio: 'inherit'
        });
        child.on('exit', (code, signal) => {
            log.info(`vncproxy-helper exited with code ${code}, signal ${signal}`);
            child = null;
            currentPort = null;
        });
        log.info('vncproxy @ startProxy: helper spawned for target', host, port, 'on ws port', currentPort);
    } catch (err) {
        log.error('vncproxy @ startProxy: failed to spawn helper', err);
        child = null;
        currentPort = null;
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
}

