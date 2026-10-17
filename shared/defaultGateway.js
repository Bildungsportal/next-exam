import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { networkInterfaces } from 'os';

const EXEC_OPTS = { encoding: 'utf8', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] };

let cacheKey = null;
let cacheValue = null;

/** Linux: parse /proc/net/route (no process spawn); returns lowest-metric default route. */
function linuxGateway() {
    const rows = readFileSync('/proc/net/route', 'utf8').trim().split('\n').slice(1).map(l => l.trim().split(/\s+/));
    const def = rows
        .filter(c => c[1] === '00000000' && c[7] === '00000000' && (parseInt(c[3], 16) & 1))
        .sort((a, b) => Number(a[6]) - Number(b[6]))[0];
    if (!def) return null;
    const gateway = def[2].match(/../g).reverse().map(h => parseInt(h, 16)).join('.');
    return { gateway, int: def[0] };
}

/** macOS: parse `route -n get default`. */
function macGateway() {
    const out = execFileSync('/sbin/route', ['-n', 'get', 'default'], EXEC_OPTS);
    const gateway = out.match(/gateway:\s*(\S+)/)?.[1];
    const int = out.match(/interface:\s*(\S+)/)?.[1];
    return gateway && int ? { gateway, int } : null;
}

/** Windows: parse `route print -4 0.0.0.0` (5-column active routes), map interface IP to adapter name. */
function winGateway() {
    const out = execFileSync('route', ['print', '-4', '0.0.0.0'], EXEC_OPTS);
    const def = out.split(/\r?\n/).map(l => l.trim().split(/\s+/))
        .filter(c => c.length === 5 && c[0] === '0.0.0.0' && c[1] === '0.0.0.0')
        .sort((a, b) => Number(a[4]) - Number(b[4]))[0];
    if (!def) return null;
    const ifaces = networkInterfaces();
    const int = Object.keys(ifaces).find(name => ifaces[name].some(a => a.address === def[3]));
    return int ? { gateway: def[2], int } : null;
}

/** IPv4 default gateway {gateway, version, int}; cached until networkInterfaces() changes; throws if none. Args ignored (compat with default-gateway). */
export function gateway4sync() {
    const key = JSON.stringify(Object.entries(networkInterfaces()).map(([n, a]) => [n, a.map(x => x.address)]));
    if (key !== cacheKey) {
        let res = null;
        try {
            if (process.platform === 'linux') res = linuxGateway();
            else if (process.platform === 'darwin') res = macGateway();
            else if (process.platform === 'win32') res = winGateway();
        } catch (e) {}
        cacheKey = key;
        cacheValue = res && { gateway: res.gateway, version: 4, int: res.int };
    }
    if (!cacheValue) throw new Error('Unable to determine default gateway');
    return cacheValue;
}
