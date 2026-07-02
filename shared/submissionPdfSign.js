import crypto from 'node:crypto';
import fs from 'node:fs';
import forge from 'node-forge';
import { createRequire } from 'node:module';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib/dist/pdf-lib.js';

const require = createRequire(import.meta.url);
const verifyPDF = require('pdf-signature-reader');
const { getCertificatesInfoFromPDF } = require('pdf-signature-reader');

/** Resolves SignPdf instance across ESM default interop and electron bundlers. */
function getSignPdfClient() {
    const mod = require('@signpdf/signpdf');
    if (typeof mod?.sign === 'function') {
        return mod;
    }
    if (typeof mod?.default?.sign === 'function') {
        return mod.default;
    }
    const SignPdfClass = mod?.SignPdf || mod?.default?.SignPdf;
    if (SignPdfClass) {
        return new SignPdfClass();
    }
    throw new Error('signpdf client unavailable');
}

export const NXE_SALT_OU_PREFIX = 'NXE-SALT:';
export const NXE_MODE_OU_PREFIX = 'NXE-MODE:';
export const NXE_BIP_UID_OU_PREFIX = 'NXE-BIP-UID:';
export const SUBMISSION_SIGN_MODE_BIP = 'bip';
export const SUBMISSION_SIGN_MODE_LOCAL = 'local';
export const INTERNAL_P12_PASSPHRASE = 'next-exam-submission-sign-v1';

/** Issuer DN for the Next-Exam submission CA (shown as certificate issuer in PDF viewers). */
const NXE_CERT_ISSUER_DN = [
    { name: 'commonName', value: 'Next-Exam' },
    { name: 'organizationName', value: 'Next-Exam' },
];

const NXE_CA_SEED = 'next-exam-submission-ca-v1';
let cachedNextExamCa = null;

/** Lazy singleton: self-signed CA cert (CN/O Next-Exam) used to issue per-submission end-entity certs. */
function getNextExamSubmissionCa() {
    if (cachedNextExamCa) {
        return cachedNextExamCa;
    }
    const caSaltHex = crypto.createHash('sha256').update(NXE_CA_SEED).digest('hex').slice(0, 32);
    const caKeys = deriveKeyPairFromPassword(NXE_CA_SEED, caSaltHex);
    const caCert = forge.pki.createCertificate();
    caCert.publicKey = caKeys.publicKey;
    caCert.serialNumber = '01';
    caCert.validity.notBefore = new Date();
    caCert.validity.notAfter = new Date();
    caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 10);
    caCert.setSubject(NXE_CERT_ISSUER_DN);
    caCert.setIssuer(NXE_CERT_ISSUER_DN);
    caCert.setExtensions([
        { name: 'basicConstraints', cA: true, critical: true },
        { name: 'keyUsage', keyCertSign: true, critical: true },
    ]);
    caCert.sign(caKeys.privateKey, forge.md.sha256.create());
    cachedNextExamCa = { keys: caKeys, cert: caCert };
    return cachedNextExamCa;
}

/** Decodes BiP mobile token payload to wstoken string (base64 wrapper or raw redirect token). */
export function decodeBipWstoken(bipTokenRaw) {
    const raw = String(bipTokenRaw ?? '').trim();
    if (!raw) return null;
    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        if (decoded && /[:\s,]/.test(decoded)) {
            const parts = decoded.split(/[:\s,]+/).filter(Boolean);
            return parts.length > 1 ? parts[1] : parts[0];
        }
    } catch {
        // not base64 — use raw redirect token
    }
    return raw;
}

/** Fetches Moodle site_info for the logged-in BiP user. */
export async function fetchBipSiteInfo({ baseUrl, wstoken }) {
    const base = String(baseUrl || '').replace(/\/$/, '');
    const token = String(wstoken || '').trim();
    if (!base || !token) {
        throw new Error('missing bip url or token');
    }
    const url = `${base}/webservice/rest/server.php?wstoken=${encodeURIComponent(token)}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
        throw new Error(`bip site_info http ${res.status}`);
    }
    const data = await res.json();
    if (data?.exception || data?.errorcode) {
        throw new Error(data?.message || data?.errorcode || 'bip site_info error');
    }
    return data;
}

/** One-way secret for non-BiP auto-sign (not recoverable by teacher). */
export function buildLocalSubmissionSigningSecret(pin, studentToken, timeMs) {
    const payload = `${String(pin ?? '')}|${String(studentToken ?? '')}|${Number(timeMs)}`;
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Seeds node-forge PRNG deterministically from password + salt (same inputs → same RSA key). */
function seedForgePrng(password, saltBuffer) {
    const prng = forge.random.createInstance();
    let state = crypto.scryptSync(String(password), saltBuffer, 32);
    prng.seedFileSync = (needed) => {
        let out = Buffer.alloc(0);
        while (out.length < needed) {
            state = crypto.createHash('sha256').update(state).digest();
            out = Buffer.concat([out, state]);
        }
        return out.subarray(0, needed).toString('binary');
    };
    return prng;
}

/** SHA-256 hex fingerprint of RSA public key (identity check independent of cert CN). */
export function publicKeyFingerprint(publicKey) {
    const der = forge.asn1.toDer(forge.pki.publicKeyToAsn1(publicKey)).getBytes();
    return crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex');
}

/** Deterministic RSA keypair from password + salt (same inputs → same keys). */
function deriveKeyPairFromPassword(password, saltHex) {
    const salt = Buffer.from(String(saltHex), 'hex');
    if (salt.length < 8) {
        throw new Error('invalid salt');
    }
    const prng = seedForgePrng(password, salt);
    return forge.pki.rsa.generateKeyPair({ bits: 2048, prng, e: 0x10001 });
}

/** Reads OU token value from certificate subject. */
function readOuToken(cert, prefix) {
    const attrs = cert.subject.attributes || [];
    for (const a of attrs) {
        const name = String(a.shortName || a.name || '').toLowerCase();
        if (name !== 'ou' && name !== 'organizationalunitname') continue;
        const v = String(a.value || '');
        if (v.startsWith(prefix)) {
            return v.slice(prefix.length).trim();
        }
    }
    return null;
}

export function extractSaltHexFromCert(cert) {
    return readOuToken(cert, NXE_SALT_OU_PREFIX);
}

export function extractSignModeFromCert(cert) {
    return readOuToken(cert, NXE_MODE_OU_PREFIX);
}

export function extractBipUserIdFromCert(cert) {
    return readOuToken(cert, NXE_BIP_UID_OU_PREFIX);
}

/** Builds PKCS#12 buffer from secret, salt, display name, and signing mode metadata. */
export function deriveSigningP12(secret, saltHex, commonName, { mode = SUBMISSION_SIGN_MODE_LOCAL, bipUserId = null } = {}) {
    const salt = Buffer.from(String(saltHex), 'hex');
    if (salt.length < 8) {
        throw new Error('invalid salt');
    }
    const keys = deriveKeyPairFromPassword(secret, saltHex);
    const ca = getNextExamSubmissionCa();
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = crypto.createHash('sha256').update(salt).update(String(commonName)).digest('hex').slice(0, 16);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
    const cn = String(commonName || 'Next-Exam Student').slice(0, 64);
    const subject = [
        { name: 'commonName', value: cn },
        { name: 'organizationalUnitName', value: `${NXE_SALT_OU_PREFIX}${salt.toString('hex')}` },
        { name: 'organizationalUnitName', value: `${NXE_MODE_OU_PREFIX}${mode}` },
        { name: 'organizationName', value: 'Next-Exam' },
    ];
    if (bipUserId != null && String(bipUserId).trim() !== '') {
        subject.push({ name: 'organizationalUnitName', value: `${NXE_BIP_UID_OU_PREFIX}${String(bipUserId).trim()}` });
    }
    cert.setSubject(subject);
    cert.setIssuer(ca.cert.subject.attributes);
    cert.setExtensions([
        { name: 'basicConstraints', cA: false, critical: true },
        { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
    ]);
    cert.sign(ca.keys.privateKey, forge.md.sha256.create());
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert, ca.cert], INTERNAL_P12_PASSPHRASE);
    const p12Buffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
    return { p12Buffer, saltHex: salt.toString('hex'), mode };
}

const STAMP_WIDTH = 220;
const STAMP_HEIGHT = 50;
const STAMP_BOTTOM_PT = 48; // 76pt minus 1cm (72/2.54pt)

// Default signpdf widget [0,0,0,0] draws a visible gray edge line in common PDF viewers.
const HIDDEN_SIG_WIDGET_RECT = [-20, -20, -1, -1];

/** Formats stamp timestamp as DD.MM.YYYY HH:mm. */
function formatSubmissionStampDate(signedAt) {
    const date = signedAt instanceof Date ? signedAt : new Date(signedAt);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Yields the Node event loop so the renderer can paint (signing is CPU-heavy on main). */
function yieldToMain() {
    return new Promise((resolve) => { setImmediate(resolve) })
}

/** Rebuilds PDF with classic xref table so @signpdf/placeholder-plain can parse it. */
export async function rewritePdfForPlainSignpdf(pdfBuffer) {
    const plain = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const src = await PDFDocument.load(plain, { ignoreEncryption: true, updateMetadata: false });
    const dst = await PDFDocument.create();
    const pages = await dst.copyPages(src, src.getPageIndices());
    for (const page of pages) {
        dst.addPage(page);
    }
    return Buffer.from(await dst.save({ useObjectStreams: false }));
}

/** Baseline Y to vertically center single-line text in a box (pdf-lib drawText uses baseline). */
function stampTextBaselineY(boxY, boxH, fontSize) {
    return boxY + boxH / 2 - fontSize * 0.35;
}

/** Top-to-bottom baselines for three stamp lines, block vertically centered in the box. */
function stampThreeLineBaselines(boxY, boxH, lineGap, sizeTop, sizeMid, sizeBottom) {
    const ascent = (s) => s * 0.75;
    const descent = (s) => s * 0.25;
    const blockH = ascent(sizeTop) + 2 * lineGap + descent(sizeBottom);
    const centerY = boxY + boxH / 2;
    const bottomBaseline = centerY - blockH / 2 + descent(sizeBottom);
    return {
        top: bottomBaseline + 2 * lineGap,
        middle: bottomBaseline + lineGap,
        bottom: bottomBaseline,
    };
}

/** Draws compact Next-Exam stamp on the last page (visual only; PKCS#7 follows). Input must already be plain-signpdf-safe. */
export async function addSubmissionStampToPdf(pdfBuffer, { studentName, signedAt, signMode, logoPngPath } = {}) {
    const plain = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const doc = await PDFDocument.load(plain, { ignoreEncryption: true, updateMetadata: false });
    const pages = doc.getPages();
    if (pages.length === 0) {
        return plain;
    }
    const page = pages[pages.length - 1];
    const { width: pageWidth } = page.getSize();
    const x = (pageWidth - STAMP_WIDTH) / 2;
    const y = STAMP_BOTTOM_PT;
    const border = rgb(0, 0.502, 0.4);
    const fill = rgb(0.96, 0.98, 0.97);
    const textDark = rgb(0.1, 0.1, 0.1);
    const textMuted = rgb(0.35, 0.35, 0.35);

    page.drawRectangle({
        x,
        y,
        width: STAMP_WIDTH,
        height: STAMP_HEIGHT,
        color: fill,
        borderColor: border,
        borderWidth: 0.75,
    });

    const pad = 8;
    const logoSize = 30;
    const lineGap = 11;
    const textX = x + pad;
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const name = String(studentName || 'Student').slice(0, 42);
    const showBip = signMode === SUBMISSION_SIGN_MODE_BIP;
    const bipLabel = 'BiP signed';
    const bipSize = 7;
    const bipGap = 6;

    const logoPath = String(logoPngPath ?? '').trim();
    const hasLogo = logoPath && fs.existsSync(logoPath);
    const bipTextW = showBip ? fontBold.widthOfTextAtSize(bipLabel, bipSize) : 0;
    const logoX = hasLogo ? x + STAMP_WIDTH - logoSize - pad : null;

    const lines = stampThreeLineBaselines(y, STAMP_HEIGHT, lineGap, 6.5, 8.5, 7.5);
    page.drawText('Signed with Next-Exam', { x: textX, y: lines.top, size: 6.5, font, color: textMuted });
    page.drawText(name, { x: textX, y: lines.middle, size: 8.5, font: fontBold, color: textDark });
    page.drawText(formatSubmissionStampDate(signedAt ?? new Date()), {
        x: textX,
        y: lines.bottom,
        size: 7.5,
        font,
        color: textMuted,
    });

    const centerY = y + STAMP_HEIGHT / 2;
    if (hasLogo) {
        const img = await doc.embedPng(fs.readFileSync(logoPath));
        page.drawImage(img, {
            x: logoX,
            y: centerY - logoSize / 2,
            width: logoSize,
            height: logoSize,
        });
    }
    if (showBip) {
        const bipX = hasLogo
            ? logoX - bipGap - bipTextW
            : x + STAMP_WIDTH - pad - bipTextW;
        page.drawText(bipLabel, {
            x: bipX,
            y: stampTextBaselineY(y, STAMP_HEIGHT, bipSize),
            size: bipSize,
            font: fontBold,
            color: border,
        });
    }

    return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/** True when PDF buffer likely contains a digital signature field. */
export function pdfHasEmbeddedSignature(pdfBuffer) {
    const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const s = buf.toString('latin1');
    return /\/Type\s*\/Sig/.test(s) && /\/ByteRange\s*\[/.test(s);
}

/** Adds PAdES-style PKCS#7 detached signature into the PDF buffer. */
export async function signSubmissionPdf(pdfBuffer, p12Buffer, meta = {}) {
    let plain = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    if (!Buffer.isBuffer(p12Buffer) || p12Buffer.length === 0) {
        throw new Error('missing signing identity');
    }
    plain = await rewritePdfForPlainSignpdf(plain);
    await yieldToMain();
    if (meta.stamp !== false) {
        plain = await addSubmissionStampToPdf(plain, {
            studentName: meta.name,
            signedAt: meta.signedAt ?? new Date(),
            signMode: meta.signMode ?? null,
            logoPngPath: meta.logoPngPath,
        });
        await yieldToMain();
    }
    const withPlaceholder = plainAddPlaceholder({
        pdfBuffer: plain,
        reason: meta.reason || 'Next-Exam submission',
        contactInfo: meta.contactInfo || 'https://next-exam.at',
        name: meta.name || 'Next-Exam Student',
        location: meta.location || 'Next-Exam',
        widgetRect: HIDDEN_SIG_WIDGET_RECT,
    });
    const signer = new P12Signer(p12Buffer, { passphrase: INTERNAL_P12_PASSPHRASE });
    return getSignPdfClient().sign(withPlaceholder, signer);
}

function readSignerCertFromPdf(buf) {
    const infos = getCertificatesInfoFromPDF(buf);
    const chain = infos?.[0];
    const clientEntry = Array.isArray(chain)
        ? chain.find((c) => c.clientCertificate) || chain[0]
        : chain;
    const pem = clientEntry?.pemCertificate;
    if (!pem) return null;
    return forge.pki.certificateFromPem(pem);
}

/** Checks PKCS#7 integrity only (document bytes unchanged). */
export function verifySubmissionPdfIntegrity(pdfBuffer) {
    const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    if (!pdfHasEmbeddedSignature(buf)) {
        return { hasSignature: false, integrityValid: false, signMode: null, code: 'NO_SIGNATURE' };
    }
    let integrityValid = false;
    let verifyError = null;
    try {
        const check = verifyPDF(buf);
        integrityValid = check.integrity === true && check.signatures?.length > 0;
        if (check.error) verifyError = check.message || String(check.error);
    } catch (e) {
        verifyError = e?.message || String(e);
    }
    let signMode = null;
    try {
        const cert = readSignerCertFromPdf(buf);
        if (cert) signMode = extractSignModeFromCert(cert);
    } catch {
        signMode = null;
    }
    return {
        hasSignature: true,
        integrityValid,
        signMode,
        code: integrityValid ? 'INTEGRITY_OK' : 'INTEGRITY_FAIL',
        verifyError,
    };
}

/** Verifies PDF integrity and BiP userprivateaccesskey identity (same key as at student sign time). */
export function verifySubmissionPdfBipIdentity(pdfBuffer, userPrivateAccessKey) {
    const integrity = verifySubmissionPdfIntegrity(pdfBuffer);
    if (!integrity.hasSignature) {
        return { ...integrity, bipIdentityValid: false, ok: false, code: 'NO_SIGNATURE' };
    }
    if (!integrity.integrityValid) {
        return { ...integrity, bipIdentityValid: false, ok: false, code: 'INTEGRITY_FAIL' };
    }
    if (integrity.signMode !== SUBMISSION_SIGN_MODE_BIP) {
        return { ...integrity, bipIdentityValid: false, ok: false, code: 'NOT_BIP_SIGNED' };
    }
    const secret = String(userPrivateAccessKey || '').trim();
    if (!secret) {
        return { ...integrity, bipIdentityValid: false, ok: false, code: 'BIP_SECRET_MISSING' };
    }
    try {
        const cert = readSignerCertFromPdf(Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer));
        if (!cert) {
            return { ...integrity, bipIdentityValid: false, ok: false, code: 'NO_CERT' };
        }
        const saltHex = extractSaltHexFromCert(cert);
        if (!saltHex) {
            return { ...integrity, bipIdentityValid: false, ok: false, code: 'NO_SALT' };
        }
        const keys = deriveKeyPairFromPassword(secret, saltHex);
        const bipIdentityValid = publicKeyFingerprint(keys.publicKey) === publicKeyFingerprint(cert.publicKey);
        const bipUserIdInCert = extractBipUserIdFromCert(cert);
        return {
            ...integrity,
            bipIdentityValid,
            bipUserIdInCert,
            ok: bipIdentityValid,
            code: bipIdentityValid ? 'OK' : 'BIP_IDENTITY_MISMATCH',
        };
    } catch (e) {
        return {
            ...integrity,
            bipIdentityValid: false,
            ok: false,
            code: 'BIP_VERIFY_ERROR',
            verifyError: e?.message || String(e),
        };
    }
}
