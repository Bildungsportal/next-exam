import http from 'http';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import log from 'electron-log';

/** QEMU hostfwd 127.0.0.1:PORT → guest `rclone serve webdav :1900` (works with restrict=on, unlike guestfwd). */
export const EXAM_VM_SHARE_PORT = 1900;
const SYNC_INTERVAL_MS = 5000;
const PART_SUFFIX = '.nxpart';

let session = null;

/** Single WebDAV request against the guest; resolves with the raw response. */
function davRequest(s, method, rel, { headers = {}, body = null } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: EXAM_VM_SHARE_PORT,
            method,
            path: `/${rel.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`,
            headers: { Authorization: s.auth, ...headers },
            timeout: 10000,
        }, resolve);
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        if (body) body.pipe(req);
        else req.end();
    });
}

async function readBody(res) {
    const chunks = [];
    for await (const c of res) chunks.push(c);
    return Buffer.concat(chunks).toString('utf8');
}

/** Map a share-relative path to the host exam folder; rejects paths escaping it (guest is untrusted). */
function localPath(s, rel) {
    const abs = path.resolve(s.rootDir, ...rel.split('/'));
    if (!abs.startsWith(`${s.rootDir}${path.sep}`)) throw new Error(`path outside share: ${rel}`);
    return abs;
}

/** Recursive PROPFIND (Depth 1 per dir) → Map rel → { isDir, size, mtime }. */
async function listRemote(s) {
    const out = new Map();
    const queue = [''];
    while (queue.length) {
        const dir = queue.shift();
        const res = await davRequest(s, 'PROPFIND', dir ? `${dir}/` : '', { headers: { Depth: '1' } });
        const xml = await readBody(res);
        if (res.statusCode !== 207) throw new Error(`PROPFIND /${dir} → ${res.statusCode}`);
        for (const [block] of xml.matchAll(/<(?:\w+:)?response\b[\s\S]*?<\/(?:\w+:)?response>/g)) {
            const href = (/<(?:\w+:)?href>([^<]*)</.exec(block)?.[1] || '')
                .replace(/&amp;/g, '&')
                .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
                .replace(/^https?:\/\/[^/]+/, '');
            const rel = decodeURIComponent(href).replace(/^\/+|\/+$/g, '');
            if (rel === dir) continue;
            const isDir = /<(?:\w+:)?collection\b[^>]*\/>/.test(block);
            const size = Number(/getcontentlength>(\d+)</.exec(block)?.[1] || 0);
            const mtime = Date.parse(/getlastmodified>([^<]*)</.exec(block)?.[1] || '') || 0;
            out.set(rel, { isDir, size, mtime });
            if (isDir) queue.push(rel);
        }
    }
    return out;
}

/** Host exam folder tree → Map rel → { isDir, size, mtime }; parents are inserted before children. */
async function listLocal(s) {
    const out = new Map();
    const walk = async (dir, prefix) => {
        for (const ent of await fs.promises.readdir(dir, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                out.set(rel, { isDir: true });
                await walk(abs, rel);
            } else if (ent.isFile() && !ent.name.endsWith(PART_SUFFIX)) {
                const st = await fs.promises.stat(abs);
                out.set(rel, { isDir: false, size: st.size, mtime: st.mtimeMs });
            }
        }
    };
    await walk(s.rootDir, '');
    return out;
}

async function putFile(s, rel, size) {
    const res = await davRequest(s, 'PUT', rel, {
        headers: { 'Content-Length': size },
        body: fs.createReadStream(localPath(s, rel)),
    });
    res.resume();
    if (res.statusCode >= 300) throw new Error(`PUT ${rel} → ${res.statusCode}`);
}

async function mkcol(s, rel) {
    const res = await davRequest(s, 'MKCOL', rel);
    res.resume();
    if (res.statusCode >= 300 && res.statusCode !== 405) throw new Error(`MKCOL ${rel} → ${res.statusCode}`);
}

async function getFile(s, rel, abs, mtime) {
    const res = await davRequest(s, 'GET', rel);
    if (res.statusCode !== 200) {
        res.resume();
        throw new Error(`GET ${rel} → ${res.statusCode}`);
    }
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    const tmp = `${abs}${PART_SUFFIX}`;
    await pipeline(res, fs.createWriteStream(tmp));
    await fs.promises.rename(tmp, abs);
    if (mtime) await fs.promises.utimes(abs, new Date(mtime), new Date(mtime));
}

/**
 * One sync pass. Guest is the source of truth; host only pushes what changed locally since the last pass
 * (whole folder on first contact = seed after fresh overlay, files the teacher sent during the exam).
 */
async function syncOnce(s) {
    const local = await listLocal(s);
    const pushed = new Set();
    for (const [rel, l] of local) {
        const k = s.known.get(rel);
        if (l.isDir) {
            if (!k) await mkcol(s, rel);
        } else if (!k || k.lsize !== l.size || k.lmtime !== l.mtime) {
            await putFile(s, rel, l.size);
        } else {
            continue;
        }
        pushed.add(rel);
    }

    const remote = await listRemote(s);
    for (const [rel, r] of remote) {
        const abs = localPath(s, rel);
        if (r.isDir) {
            await fs.promises.mkdir(abs, { recursive: true });
            s.known.set(rel, { isDir: true });
            continue;
        }
        const k = s.known.get(rel);
        if (!pushed.has(rel) && (!k || k.rsize !== r.size || k.rmtime !== r.mtime)) {
            await getFile(s, rel, abs, r.mtime);
        }
        const st = await fs.promises.stat(abs);
        s.known.set(rel, { isDir: false, lsize: st.size, lmtime: st.mtimeMs, rsize: r.size, rmtime: r.mtime });
    }

    // mirror guest deletions; only for entries synced before, so unsynced host files are never dropped
    for (const rel of [...s.known.keys()]) {
        if (remote.has(rel)) continue;
        s.known.delete(rel);
        if (local.has(rel)) await fs.promises.rm(localPath(s, rel), { recursive: true, force: true });
    }
}

/** Queue a pass behind any running one; failures (guest still booting, etc.) are logged once per message. */
function enqueue(s) {
    s.chain = s.chain.then(() => syncOnce(s)).then(() => {
        if (s.lastError) log.info('examVmShareSync: guest share in sync');
        s.lastError = null;
    }, (e) => {
        const msg = String(e?.message || e);
        if (msg !== s.lastError) log.warn(`examVmShareSync: sync pending (${msg})`);
        s.lastError = msg;
    });
    return s.chain;
}

function schedule(s) {
    s.timer = setTimeout(() => {
        enqueue(s).then(() => { if (session === s) schedule(s); });
    }, SYNC_INTERVAL_MS);
}

export function startExamVmShareSync({ rootDir, user, pass }) {
    if (session) clearTimeout(session.timer);
    const s = {
        rootDir: path.resolve(rootDir),
        auth: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
        known: new Map(),
        chain: Promise.resolve(),
        lastError: 'starting',
        timer: null,
    };
    fs.mkdirSync(s.rootDir, { recursive: true });
    session = s;
    schedule(s);
    log.info(`examVmShareSync: started root=${s.rootDir} guest=127.0.0.1:${EXAM_VM_SHARE_PORT}`);
}

/** Run a pass now (e.g. before zipping the exam folder for the teacher). */
export async function syncExamVmShareNow() {
    if (session) await enqueue(session);
}

/** Stop the loop; finalSync pulls the guest state one last time before the VM goes down. */
export async function stopExamVmShareSync({ finalSync = false } = {}) {
    const s = session;
    if (!s) return;
    session = null;
    clearTimeout(s.timer);
    if (finalSync) await enqueue(s);
    else await s.chain;
    log.info('examVmShareSync: stopped');
}
