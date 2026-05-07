import http from 'http';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import log from 'electron-log';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);

/** Matches Windows guest: net use E: http://10.0.2.2:1900/share */
export const EXAM_WEBDAV_PORT = 1900;
export const EXAM_WEBDAV_MOUNT_PATH = '/share';

let server = null;

function xmlEscape(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeMountUrlPath(p) {
    if (!p || p === '/') {
        return '/';
    }
    const withSlash = p.endsWith('/') ? p : `${p}/`;
    return path.posix.normalize(withSlash).replace(/\/+/g, '/');
}

/**
 * Map request URL to filesystem path under rootDir; returns null if outside root.
 * mountPath: e.g. '/share' (no trailing slash required).
 */
function urlPathToFsPath(rootDir, mountPath, urlPath) {
    const mount = normalizeMountUrlPath(mountPath);
    let rel = urlPath.split('?')[0] || '/';
    if (!rel.startsWith('/')) {
        rel = `/${rel}`;
    }
    if (rel.length > 1 && rel.endsWith('/')) {
        rel = rel.slice(0, -1);
    }
    const mountNoTrail = mount.endsWith('/') ? mount.slice(0, -1) : mount;
    if (rel === mountNoTrail || rel === `${mountNoTrail}/` || rel === mountNoTrail) {
        rel = '';
    } else if (rel.startsWith(`${mountNoTrail}/`)) {
        rel = rel.slice(mountNoTrail.length + 1);
    } else {
        return null;
    }
    const fsPath = path.resolve(rootDir, rel || '.');
    const rootResolved = path.resolve(rootDir);
    if (fsPath !== rootResolved && !fsPath.startsWith(`${rootResolved}${path.sep}`)) {
        return null;
    }
    return fsPath;
}

function checkBasicAuth(req, res, basicUser, basicPass) {
    if (basicUser == null || basicPass == null) {
        return true;
    }
    const h = req.headers.authorization || '';
    const m = /^Basic\s+(.+)$/i.exec(h);
    if (!m) {
        res.setHeader('WWW-Authenticate', 'Basic realm="exam"');
        res.writeHead(401);
        res.end();
        return false;
    }
    let decoded = '';
    try {
        decoded = Buffer.from(m[1], 'base64').toString('utf8');
    } catch (e) {
        res.writeHead(400);
        res.end();
        return false;
    }
    const idx = decoded.indexOf(':');
    const u = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const p = idx >= 0 ? decoded.slice(idx + 1) : '';
    if (u !== basicUser || p !== basicPass) {
        res.setHeader('WWW-Authenticate', 'Basic realm="exam"');
        res.writeHead(401);
        res.end();
        return false;
    }
    return true;
}

function davHeaders(res) {
    res.setHeader('DAV', '1, 2');
    res.setHeader('MS-Author-Via', 'DAV');
}

function propfindResponse(hrefs) {
    const rows = hrefs.map(({ href, collection, size, mtime }) => {
        const rt = collection
            ? '<D:resourcetype><D:collection/></D:resourcetype>'
            : '<D:resourcetype/>';
        const sizeTag = (!collection && size != null) ? `<D:getcontentlength>${size}</D:getcontentlength>` : '';
        const mtimeTag = mtime ? `<D:getlastmodified>${mtime.toUTCString()}</D:getlastmodified>` : '';
        return `
  <D:response>
    <D:href>${xmlEscape(href)}</D:href>
    <D:propstat>
      <D:prop>${rt}${sizeTag}${mtimeTag}</D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
    }).join('');
    return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">${rows}
</D:multistatus>`;
}

async function handlePropfind(rootDir, mountPath, urlPath, depth) {
    const fsPath = urlPathToFsPath(rootDir, mountPath, urlPath);
    if (!fsPath) {
        return { status: 404, body: '' };
    }
    let st;
    try {
        st = await stat(fsPath);
    } catch (e) {
        return { status: 404, body: '' };
    }
    const isDir = st.isDirectory();
    let pathname = urlPath.split('?')[0] || '/';
    if (isDir && !pathname.endsWith('/')) {
        pathname = `${pathname}/`;
    }
    const hrefs = [{ href: pathname, collection: isDir, size: isDir ? null : st.size, mtime: st.mtime }];

    if (isDir && (depth === '1' || depth === 'infinity')) {
        const entries = await readdir(fsPath);
        const prefix = pathname.endsWith('/') ? pathname : `${pathname}/`;
        for (const name of entries) {
            const childFs = path.join(fsPath, name);
            let cst;
            try {
                cst = await stat(childFs);
            } catch (e) {
                continue;
            }
            const isChildDir = cst.isDirectory();
            const seg = `${encodeURIComponent(name)}${isChildDir ? '/' : ''}`;
            hrefs.push({ href: `${prefix}${seg}`, collection: isChildDir, size: isChildDir ? null : cst.size, mtime: cst.mtime });
        }
    }

    const xml = propfindResponse(hrefs);
    return { status: 207, body: xml, contentType: 'application/xml; charset=utf-8' };
}

/**
 * Start WebDAV server for localvm exam folder (QEMU user NAT: guest uses http://10.0.2.2:PORT/share).
 * @param {{ rootDir: string, port?: number, mountPath?: string, basicUser?: string|null, basicPass?: string|null }} opts
 */
export function startExamWebdav(opts) {
    stopExamWebdav();
    const rootDir = path.resolve(opts.rootDir);
    const port = Number(opts.port) || EXAM_WEBDAV_PORT;
    const mountPath = opts.mountPath || EXAM_WEBDAV_MOUNT_PATH;
    const basicUser = opts.basicUser ?? null;
    const basicPass = opts.basicPass ?? null;

    if (!fs.existsSync(rootDir)) {
        log.warn(`examWebdavServer: rootDir missing, mkdir ${rootDir}`);
        fs.mkdirSync(rootDir, { recursive: true });
    }

    server = http.createServer(async (req, res) => {
        try {
            if (!checkBasicAuth(req, res, basicUser, basicPass)) {
                return;
            }

            const urlPath = decodeURIComponent(new URL(req.url || '/', `http://127.0.0.1`).pathname);

            if (req.method === 'OPTIONS') {
                davHeaders(res);
                res.setHeader('Allow', 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, MOVE, LOCK, UNLOCK');
                res.writeHead(200);
                res.end();
                return;
            }

            const fsPath = urlPathToFsPath(rootDir, mountPath, urlPath);
            if (fsPath == null) {
                res.writeHead(404);
                res.end();
                return;
            }

            if (req.method === 'PROPFIND') {
                davHeaders(res);
                const depth = req.headers.depth || 'infinity';
                const r = await handlePropfind(rootDir, mountPath, urlPath, depth);
                if (r.contentType) {
                    res.setHeader('Content-Type', r.contentType);
                }
                res.writeHead(r.status);
                res.end(r.body);
                return;
            }

            if (req.method === 'GET' || req.method === 'HEAD') {
                let st;
                try {
                    st = await stat(fsPath);
                } catch (e) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                if (st.isDirectory()) {
                    if (!urlPath.endsWith('/')) {
                        res.writeHead(301, { Location: `${urlPath}/` });
                        res.end();
                        return;
                    }
                    // Avoid redirect loops for directory GET (browser check); WebDAV clients use PROPFIND.
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.writeHead(200);
                    res.end('OK');
                    return;
                }
                if (req.method === 'HEAD') {
                    res.writeHead(200, { 'Content-Length': st.size });
                    res.end();
                    return;
                }
                res.writeHead(200, { 'Content-Length': st.size });
                fs.createReadStream(fsPath).pipe(res);
                return;
            }

            if (req.method === 'PUT') {
                await mkdir(path.dirname(fsPath), { recursive: true });
                const ws = fs.createWriteStream(fsPath);
                await new Promise((resolve, reject) => {
                    req.pipe(ws);
                    ws.on('finish', resolve);
                    ws.on('error', reject);
                    req.on('error', reject);
                });
                res.writeHead(201);
                res.end();
                return;
            }

            if (req.method === 'MKCOL') {
                try {
                    await mkdir(fsPath, { recursive: false });
                    res.writeHead(201);
                    res.end();
                } catch (e) {
                    if (e?.code === 'EEXIST') {
                        res.writeHead(405);
                    } else {
                        res.writeHead(409);
                    }
                    res.end();
                }
                return;
            }

            if (req.method === 'DELETE') {
                try {
                    const st = await stat(fsPath);
                    if (st.isDirectory()) {
                        await fs.promises.rm(fsPath, { recursive: true, force: true });
                    } else {
                        await unlink(fsPath);
                    }
                    res.writeHead(204);
                    res.end();
                } catch (e) {
                    res.writeHead(404);
                    res.end();
                }
                return;
            }

            if (req.method === 'MOVE') {
                const destUrl = req.headers.destination;
                if (!destUrl) {
                    res.writeHead(400);
                    res.end();
                    return;
                }
                let destPathname;
                try {
                    destPathname = new URL(destUrl).pathname;
                } catch (e) {
                    res.writeHead(400);
                    res.end();
                    return;
                }
                const destFs = urlPathToFsPath(rootDir, mountPath, destPathname);
                if (!destFs) {
                    res.writeHead(403);
                    res.end();
                    return;
                }
                try {
                    await mkdir(path.dirname(destFs), { recursive: true });
                    await rename(fsPath, destFs);
                    res.writeHead(201);
                    res.end();
                } catch (e) {
                    res.writeHead(409);
                    res.end();
                }
                return;
            }

            if (req.method === 'LOCK' || req.method === 'UNLOCK') {
                davHeaders(res);
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                res.writeHead(200);
                res.end('<?xml version="1.0"?><D:prop xmlns:D="DAV:"/>');
                return;
            }

            res.writeHead(405);
            res.end();
        } catch (e) {
            log.error('examWebdavServer: request error', e);
            if (!res.headersSent) {
                res.writeHead(500);
            }
            res.end();
        }
    });

    server.listen(port, '0.0.0.0', () => {
        log.info(`examWebdavServer: listening ${port} mount=${mountPath} root=${rootDir}`);
    });
    server.on('error', (e) => {
        log.error('examWebdavServer: server error', e);
    });
}

export function stopExamWebdav() {
    if (server) {
        try {
            server.close();
        } catch (e) {
            log.warn('examWebdavServer: close', e);
        }
        server = null;
        log.info('examWebdavServer: stopped');
    }
}
