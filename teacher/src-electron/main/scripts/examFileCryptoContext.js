import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { decryptExamFileBytes } from './examFileCrypto.js';

/** Returns true if buffer starts with NXE1 exam crypto header v1. */
export function isNxe1ExamEncrypted(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    return b.length >= 5 && b.subarray(0, 4).toString('ascii') === 'NXE1' && b.readUInt8(4) === 1;
}

/** Resolves active exam section index from serverstatus (mirrors student lockedSection logic). */
export function effectiveSectionIndex(serverstatus) {
    if (!serverstatus) return 1;
    const idx = serverstatus.allowSectionSwitch && serverstatus.lockedSection != null
        ? serverstatus.lockedSection
        : serverstatus.activeSection;
    return idx != null ? idx : 1;
}

/** Returns true when the active section exam type is localvm (student work files not NXE1-encrypted). */
export function isLocalVmServerstatus(serverstatus) {
    if (!serverstatus?.examSections) return false;
    const idx = effectiveSectionIndex(serverstatus);
    return serverstatus.examSections[idx]?.examtype === 'localvm';
}

/** Returns trimmed NXE1 encryption secret from serverstatus (auto-generated hex string). */
export function encryptionPasswordFromStatus(serverstatus) {
    return String(serverstatus?.encryptionPassword ?? '').trim();
}

/** True when we can decrypt NXE1 payloads from students (encryption secret set, not localvm exam type). */
export function canDecryptStudentNxE1(mcServer) {
    const s = mcServer?.serverstatus;
    if (!s) return false;
    if (isLocalVmServerstatus(s)) return false;
    return encryptionPasswordFromStatus(s).length > 0;
}

/** Unwraps nested NXE1 exam envelopes using password (maxLayers); returns status + buffer. */
export function unwrapNxe1ExamBuffer(buf, password, logLabel, maxLayers = 4) {
    const pw = String(password ?? '').trim();
    let b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    let layer = 0;
    while (layer < maxLayers && isNxe1ExamEncrypted(b)) {
        if (!pw) {
            return { ok: false, code: 'NEEDS_PASSWORD', buffer: b };
        }
        try {
            if (logLabel) log.info(`${logLabel}: NXE1 unwrap layer ${layer + 1}`);
            b = decryptExamFileBytes(b, pw);
        } catch (e) {
            log.error(`${logLabel || 'unwrapNxe1ExamBuffer'}: decrypt failed`, e);
            return { ok: false, code: 'BAD_PASSWORD', buffer: b };
        }
        layer++;
    }
    if (isNxe1ExamEncrypted(b)) {
        return { ok: false, code: pw ? 'STILL_ENCRYPTED' : 'NEEDS_PASSWORD', buffer: b };
    }
    return { ok: true, buffer: b };
}

/** Decrypts buffer when NXE1 and password set; logs on decrypt. */
export function decryptBufferIfNeeded(buf, mcServer, logLabel) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (!isNxe1ExamEncrypted(b)) return b;
    const pw = encryptionPasswordFromStatus(mcServer?.serverstatus);
    if (!pw) return b;
    try {
        if (logLabel) log.info(`${logLabel}: decrypted read`);
        return decryptExamFileBytes(b, pw);
    } catch (e) {
        log.error(`${logLabel || 'examFileCryptoContext'}: decrypt failed`, e);
        return b;
    }
}

/** Recursively replaces NXE1 files with plaintext on disk (teacher stores plaintext only). */
export async function decryptNxe1FilesUnderDir(dir, mcServer, logPrefix) {
    if (!canDecryptStudentNxE1(mcServer)) return;
    const pw = encryptionPasswordFromStatus(mcServer.serverstatus);
    let dirents;
    try {
        dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
        return;
    }
    for (const d of dirents) {
        const abs = path.join(dir, d.name);
        if (d.isDirectory()) {
            await decryptNxe1FilesUnderDir(abs, mcServer, logPrefix);
            continue;
        }
        if (d.name === 'next-exam-student.log') continue;
        let raw;
        try {
            raw = await fs.promises.readFile(abs);
        } catch (e) {
            continue;
        }
        if (!isNxe1ExamEncrypted(raw)) continue;
        let plain;
        try {
            plain = decryptExamFileBytes(raw, pw);
        } catch (e) {
            log.error(`${logPrefix}: decrypt failed ${d.name}`, e);
            continue;
        }
        log.info(`${logPrefix}: decrypted write ${d.name}`);
        const tmp = `${abs}.decpart`;
        try {
            await fs.promises.writeFile(tmp, plain);
            await fs.promises.rename(tmp, abs);
        } catch (e) {
            try { await fs.promises.unlink(tmp); } catch {}
        }
    }
}
