import fs from 'fs';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

const COPY_LOG_BYTES = 64 * 1024 * 1024;

/** Wait until dest file on disk has expected byte size (Windows AV can delay pipeline finish). */
async function waitForFileSize(dest, expectedBytes, { intervalMs = 400, timeoutMs = 3600000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const st = await fs.promises.stat(dest);
            if (st.size === expectedBytes) {
                return;
            }
        } catch (e) {}
        await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
    }
    throw new Error(`copy timeout: ${dest} did not reach ${expectedBytes} bytes`);
}

function reportCopyProgress(onProgress, copied, total) {
    if (!onProgress) return;
    const percent = total > 0 ? Math.min(100, Math.round((copied * 100) / total)) : 0;
    try {
        onProgress({ phase: 'copying', percent, copied, total });
    } catch (e) {}
}

/** Stream qcow2 copy with percent callbacks; win32 uses size watchdog when pipeline stalls after data is on disk. */
export async function copyQcow2ToDest(src, dest, onProgress = null, { onLog = null } = {}) {
    const total = (await fs.promises.stat(src)).size;
    const copyStart = Date.now();
    let copied = 0;
    let lastLog = 0;
    let lastUiPct = -1;

    try {
        onProgress?.({ phase: 'start', percent: 0, copied: 0, total });
    } catch (e) {}

    const rs = fs.createReadStream(src, { highWaterMark: 1024 * 1024 });
    const ws = fs.createWriteStream(dest);
    const counter = new Transform({
        transform(chunk, _enc, cb) {
            copied += chunk.length;
            const pct = total > 0 ? Math.min(100, Math.round((copied * 100) / total)) : 0;
            if (pct !== lastUiPct) {
                lastUiPct = pct;
                reportCopyProgress(onProgress, copied, total);
            }
            if (copied - lastLog >= COPY_LOG_BYTES) {
                lastLog = copied;
                try { onLog?.(`copy ${pct}% (${copied}/${total})`); } catch (e) {}
            }
            cb(null, chunk);
        },
    });

    const pipeDone = pipeline(rs, counter, ws);
    if (process.platform === 'win32') {
        const watchdog = waitForFileSize(dest, total).then(() => {
            rs.destroy();
            ws.destroy();
            try { onLog?.('win32 watchdog — dest size ok, releasing streams'); } catch (e) {}
        });
        await Promise.race([pipeDone, watchdog]);
        try {
            await pipeDone;
        } catch (e) {
            const st = await fs.promises.stat(dest).catch(() => null);
            if (!st || st.size !== total) {
                throw e;
            }
            try { onLog?.(`pipeline error after complete copy (${e?.message || e})`); } catch (err) {}
        }
    } else {
        await pipeDone;
    }

    const destStat = await fs.promises.stat(dest);
    if (destStat.size !== total) {
        throw new Error(`copy size mismatch: expected ${total} got ${destStat.size}`);
    }
    try { onLog?.(`copy done in ${Date.now() - copyStart}ms (${total} bytes)`); } catch (e) {}
    try {
        onProgress?.({ phase: 'done', percent: 100, copied: total, total });
    } catch (e) {}
}
