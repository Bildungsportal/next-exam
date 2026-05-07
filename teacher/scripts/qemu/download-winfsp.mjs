import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

const WINFSP_VERSION = '2.1.25156';
const WINFSP_SHA256 = '073A70E00F77423E34BED98B86E600DEF93393BA5822204FAC57A29324DB9F7A';
const WINFSP_MSI_NAME = `winfsp-${WINFSP_VERSION}.msi`;
const WINFSP_URL = `https://github.com/winfsp/winfsp/releases/download/v2.1/${WINFSP_MSI_NAME}`;

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', reject);
        stream.on('data', (d) => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex').toUpperCase()));
    });
}

function downloadToFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const tmp = `${destPath}.part`;
        const out = fs.createWriteStream(tmp);
        const req = https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                out.close(() => {});
                try { fs.unlinkSync(tmp); } catch {}
                downloadToFile(res.headers.location, destPath).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                out.close(() => {
                    try { fs.unlinkSync(tmp); } catch {}
                    reject(new Error(`download failed: ${res.statusCode} ${res.statusMessage || ''}`.trim()));
                });
                return;
            }
            res.pipe(out);
            out.on('finish', () => {
                out.close(() => {
                    try {
                        fs.renameSync(tmp, destPath);
                        resolve();
                    } catch (e) {
                        try { fs.unlinkSync(tmp); } catch {}
                        reject(e);
                    }
                });
            });
        });
        req.on('error', (e) => {
            try { out.close(() => {}); } catch {}
            try { fs.unlinkSync(tmp); } catch {}
            reject(e);
        });
    });
}

async function main() {
    const outDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
    fs.mkdirSync(outDir, { recursive: true });
    const dest = path.join(outDir, WINFSP_MSI_NAME);

    if (fs.existsSync(dest)) {
        const current = await sha256File(dest);
        if (current === WINFSP_SHA256) {
            process.stdout.write(`${WINFSP_MSI_NAME} already present (sha256 ok)\n`);
            return;
        }
        process.stdout.write(`${WINFSP_MSI_NAME} present but sha256 mismatch, re-downloading\n`);
        fs.unlinkSync(dest);
    }

    process.stdout.write(`Downloading ${WINFSP_URL}\n`);
    await downloadToFile(WINFSP_URL, dest);
    const got = await sha256File(dest);
    if (got !== WINFSP_SHA256) {
        fs.unlinkSync(dest);
        throw new Error(`WinFsp sha256 mismatch (got=${got}, expected=${WINFSP_SHA256})`);
    }
    process.stdout.write(`OK: ${dest}\n`);
}

main().catch((e) => {
    process.stderr.write(`${e?.stack || e}\n`);
    process.exit(1);
});

