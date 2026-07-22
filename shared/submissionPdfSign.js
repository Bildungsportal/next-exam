// Isomorphic submission signing: deterministic P-256 (noble) + X.509/CMS (pkijs) + PDF placeholder (signpdf).
// Runs in Electron main, renderer and iOS/Capacitor WKWebView (WebCrypto native; Buffer polyfill needed on iOS).
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/ciphers/utils.js';
import { bytesToNumberBE, numberToBytesBE } from '@noble/curves/utils.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { Signer, SUBFILTER_ADOBE_PKCS7_DETACHED } from '@signpdf/utils';

export const SUBMISSION_SIGN_MODE_BIP = 'bip';
export const SUBMISSION_SIGN_MODE_LOCAL = 'local';

const OU_OID = '2.5.4.11';
const CN_OID = '2.5.4.3';
const O_OID = '2.5.4.10';
const OID_DATA = '1.2.840.113549.1.7.1';
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';

const NXE_SALT_OU_PREFIX = 'NXE-SALT:';
const NXE_MODE_OU_PREFIX = 'NXE-MODE:';
const NXE_BIP_UID_OU_PREFIX = 'NXE-BIP-UID:';
const NXE_CA_SEED = 'next-exam-submission-ca-v1';
const NXE_DN = [[CN_OID, 'Next-Exam'], [O_OID, 'Next-Exam']];

const CURVE_ORDER = p256.Point.Fn.ORDER;

// pkijs has no crypto of its own; bind it to the platform WebCrypto once.
if (globalThis.crypto?.subtle) {
    pkijs.setEngine('nxe', new pkijs.CryptoEngine({ name: 'nxe', crypto: globalThis.crypto }));
}

// Coerce string/ArrayBuffer/Uint8Array/Buffer to Uint8Array (utf8 for strings).
const toBytes = (v) => typeof v === 'string' ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v);
// Standalone ArrayBuffer slice (asn1js expects a real ArrayBuffer).
const toArrayBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
// base64url without padding (for JWK key material).
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** One-way secret for non-BiP auto-sign (not recoverable by teacher). */
export function buildLocalSubmissionSigningSecret(pin, studentToken, timeMs) {
    const payload = `${String(pin ?? '')}|${String(studentToken ?? '')}|${Number(timeMs)}`;
    return bytesToHex(sha256(new TextEncoder().encode(payload)));
}

// Deterministic P-256 scalar in [1, n-1] from secret + salt.
function deriveScalarBytes(secret, saltHex) {
    const material = sha256(concatBytes(hexToBytes(saltHex), new TextEncoder().encode(String(secret))));
    const d = (bytesToNumberBE(material) % (CURVE_ORDER - 1n)) + 1n;
    return numberToBytesBE(d, 32);
}

/** Deterministic P-256 keypair (WebCrypto CryptoKeys) from secret + salt; same inputs → same keys. */
async function deriveP256Identity(secret, saltHex) {
    const dBytes = deriveScalarBytes(secret, saltHex);
    const point = p256.getPublicKey(dBytes, false); // uncompressed 0x04||x||y
    const x = b64url(point.subarray(1, 33));
    const y = b64url(point.subarray(33, 65));
    const alg = { name: 'ECDSA', namedCurve: 'P-256' };
    const privateKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: b64url(dBytes), x, y, ext: true }, alg, false, ['sign']);
    const publicKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, ext: true }, alg, true, ['verify']);
    return { privateKey, publicKey, pointBytes: point };
}

/** SHA-256 hex fingerprint of an uncompressed EC point (identity check independent of cert fields). */
export function publicKeyFingerprint(pointBytes) {
    return bytesToHex(sha256(toBytes(pointBytes)));
}

// Sets a distinguished name on a pkijs RDN from [oid, value] pairs.
function setDn(rdn, entries) {
    rdn.typesAndValues = entries.map(([type, value]) => new pkijs.AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) }));
}

// BasicConstraints extension (critical).
function basicConstraintsExt(isCA) {
    const bc = new pkijs.BasicConstraints({ cA: isCA });
    return new pkijs.Extension({ extnID: '2.5.29.19', critical: true, extnValue: bc.toSchema().toBER(false), parsedValue: bc });
}

// KeyUsage extension (critical) from a single flags byte (bit 0 = MSB).
function keyUsageExt(flagsByte) {
    const buf = new ArrayBuffer(1);
    new Uint8Array(buf)[0] = flagsByte;
    const ku = new asn1js.BitString({ valueHex: buf });
    return new pkijs.Extension({ extnID: '2.5.29.15', critical: true, extnValue: ku.toBER(false), parsedValue: ku });
}

let cachedCaPromise = null;
// Lazy singleton: deterministic self-signed EC CA that issues per-submission end-entity certs.
function getSubmissionCa() {
    if (!cachedCaPromise) {
        cachedCaPromise = (async () => {
            const caSaltHex = bytesToHex(sha256(new TextEncoder().encode(NXE_CA_SEED))).slice(0, 32);
            const { privateKey, publicKey } = await deriveP256Identity(NXE_CA_SEED, caSaltHex);
            const cert = new pkijs.Certificate();
            cert.version = 2;
            cert.serialNumber = new asn1js.Integer({ value: 1 });
            setDn(cert.issuer, NXE_DN);
            setDn(cert.subject, NXE_DN);
            cert.notBefore.value = new Date();
            cert.notAfter.value = new Date();
            cert.notAfter.value.setFullYear(cert.notBefore.value.getFullYear() + 10);
            await cert.subjectPublicKeyInfo.importKey(publicKey);
            cert.extensions = [basicConstraintsExt(true), keyUsageExt(0x06)]; // keyCertSign + cRLSign
            await cert.sign(privateKey, 'SHA-256');
            return { cert, privateKey };
        })();
    }
    return cachedCaPromise;
}

/** Builds signing identity (deterministic EC key + issued X.509 cert with salt/mode/bipUserId in OU). */
export async function deriveSigningIdentity(secret, saltHex, commonName, { mode = SUBMISSION_SIGN_MODE_LOCAL, bipUserId = null } = {}) {
    const { privateKey, publicKey, pointBytes } = await deriveP256Identity(secret, saltHex);
    const ca = await getSubmissionCa();
    const cn = String(commonName || 'Next-Exam Student').slice(0, 64);
    const subject = [
        [CN_OID, cn],
        [OU_OID, `${NXE_SALT_OU_PREFIX}${saltHex}`],
        [OU_OID, `${NXE_MODE_OU_PREFIX}${mode}`],
        [O_OID, 'Next-Exam'],
    ];
    if (bipUserId != null && String(bipUserId).trim() !== '') {
        subject.push([OU_OID, `${NXE_BIP_UID_OU_PREFIX}${String(bipUserId).trim()}`]);
    }
    const cert = new pkijs.Certificate();
    cert.version = 2;
    const serial = sha256(concatBytes(hexToBytes(saltHex), new TextEncoder().encode(cn))).slice(0, 8);
    serial[0] &= 0x7f; // keep DER integer positive
    cert.serialNumber = new asn1js.Integer({ valueHex: serial });
    cert.issuer.typesAndValues = ca.cert.subject.typesAndValues;
    setDn(cert.subject, subject);
    cert.notBefore.value = new Date();
    cert.notAfter.value = new Date();
    cert.notAfter.value.setFullYear(cert.notBefore.value.getFullYear() + 2);
    await cert.subjectPublicKeyInfo.importKey(publicKey);
    cert.extensions = [basicConstraintsExt(false), keyUsageExt(0xc0)]; // digitalSignature + nonRepudiation
    await cert.sign(ca.privateKey, 'SHA-256');
    return { privateKey, cert, caCert: ca.cert, mode, pointBytes };
}

// @signpdf signer that returns a detached PAdES CMS (SignedData) over the ByteRange bytes.
class EcCmsSigner extends Signer {
    constructor(identity) {
        super();
        this.identity = identity;
    }

    async sign(pdfBuffer, signingTime = new Date()) {
        const content = toBytes(pdfBuffer);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', content));
        const signedData = new pkijs.SignedData({
            version: 1,
            encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID_DATA }),
            signerInfos: [new pkijs.SignerInfo({
                version: 1,
                sid: new pkijs.IssuerAndSerialNumber({ issuer: this.identity.cert.issuer, serialNumber: this.identity.cert.serialNumber }),
                signedAttrs: new pkijs.SignedAndUnsignedAttributes({
                    type: 0,
                    // Order must equal the DER SET OF sort that strict verifiers (OpenSSL/poppler) reconstruct,
                    // else the signature over signedAttrs fails. Sorted by full element encoding (length byte first):
                    // contentType (len 9) < signingTime (len 23) < messageDigest (len 33).
                    attributes: [
                        new pkijs.Attribute({ type: OID_CONTENT_TYPE, values: [new asn1js.ObjectIdentifier({ value: OID_DATA })] }),
                        new pkijs.Attribute({ type: OID_SIGNING_TIME, values: [new asn1js.UTCTime({ valueDate: signingTime || new Date() })] }),
                        new pkijs.Attribute({ type: OID_MESSAGE_DIGEST, values: [new asn1js.OctetString({ valueHex: digest })] }),
                    ],
                }),
            })],
            certificates: [this.identity.cert, this.identity.caCert],
        });
        await signedData.sign(this.identity.privateKey, 0, 'SHA-256');
        const cms = new pkijs.ContentInfo({ contentType: pkijs.ContentInfo.SIGNED_DATA, content: signedData.toSchema(true) });
        return Buffer.from(cms.toSchema().toBER(false));
    }
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

/** Draws compact Next-Exam stamp on the last page (visual only; PKCS#7 follows). */
export async function addSubmissionStampToPdf(pdfBuffer, { studentName, signedAt, signMode, logoPngBytes } = {}) {
    const doc = await PDFDocument.load(toBytes(pdfBuffer), { ignoreEncryption: true, updateMetadata: false });
    const pages = doc.getPages();
    if (pages.length === 0) {
        return toBytes(pdfBuffer);
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

    const hasLogo = logoPngBytes && logoPngBytes.length > 0;
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
        const img = await doc.embedPng(logoPngBytes);
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

    return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

/** True when PDF buffer likely contains a digital signature field. */
export function pdfHasEmbeddedSignature(pdfBuffer) {
    const s = new TextDecoder('latin1').decode(toBytes(pdfBuffer));
    return /\/Type\s*\/Sig/.test(s) && /\/ByteRange\s*\[/.test(s);
}

/** Adds a Next-Exam stamp and a detached PAdES ECDSA signature to a PDF. */
export async function signSubmissionPdf(pdfBuffer, identity, meta = {}) {
    if (!identity?.privateKey || !identity?.cert) {
        throw new Error('missing signing identity');
    }
    let bytes = toBytes(pdfBuffer);
    if (meta.stamp !== false) {
        bytes = await addSubmissionStampToPdf(bytes, {
            studentName: meta.name,
            signedAt: meta.signedAt ?? new Date(),
            signMode: meta.signMode ?? identity.mode ?? null,
            logoPngBytes: meta.logoPngBytes,
        });
    }
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    pdflibAddPlaceholder({
        pdfDoc: doc,
        reason: meta.reason || 'Next-Exam submission',
        contactInfo: meta.contactInfo || 'https://next-exam.at',
        name: meta.name || 'Next-Exam Student',
        location: meta.location || 'Next-Exam',
        signingTime: meta.signedAt ?? new Date(),
        // Plain PKCS#7 detached, not full CAdES: readers enforcing CAdES require a signingCertificateV2 attr we don't emit.
        subFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
        widgetRect: HIDDEN_SIG_WIDGET_RECT,
    });
    const withPlaceholder = await doc.save({ useObjectStreams: false });
    return new SignPdf().sign(Buffer.from(withPlaceholder), new EcCmsSigner(identity), meta.signedAt);
}

// Reads OU token value with the given prefix from a pkijs certificate subject.
function readOuToken(cert, prefix) {
    for (const tv of cert.subject.typesAndValues) {
        if (tv.type !== OU_OID) continue;
        const v = String(tv.value.valueBlock.value || '');
        if (v.startsWith(prefix)) {
            return v.slice(prefix.length).trim();
        }
    }
    return null;
}

// Picks the end-entity cert (the one carrying the NXE mode OU) from a CMS cert list.
function pickEndEntityCert(certificates) {
    const certs = (certificates || []).filter((c) => c instanceof pkijs.Certificate);
    return certs.find((c) => readOuToken(c, NXE_MODE_OU_PREFIX) != null) || certs[0] || null;
}

// Extracts signed ByteRange bytes and the CMS DER (from /Contents hex) of a signed PDF.
function extractSignature(pdfBuffer) {
    const bytes = toBytes(pdfBuffer);
    const s = new TextDecoder('latin1').decode(bytes);
    const m = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(s);
    if (!m) return null;
    const [a, b, c, d] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const signed = concatBytes(bytes.subarray(a, a + b), bytes.subarray(c, c + d));
    const region = s.slice(a + b, c);
    const lt = region.indexOf('<');
    const gt = region.indexOf('>', lt + 1);
    if (lt < 0 || gt < 0) return null;
    let hex = region.slice(lt + 1, gt).toLowerCase().replace(/[^0-9a-f]/g, '');
    if (hex.length % 2 === 1) hex = hex.slice(0, -1);
    return { signed, der: hexToBytes(hex) };
}

// Parses a signed PDF into its pkijs SignedData + end-entity cert + signed bytes.
function parseSignedData(pdfBuffer) {
    const ext = extractSignature(pdfBuffer);
    if (!ext) return null;
    const asn = asn1js.fromBER(toArrayBuffer(ext.der));
    if (asn.offset === -1) return null;
    const cms = new pkijs.ContentInfo({ schema: asn.result });
    const signedData = new pkijs.SignedData({ schema: cms.content });
    return { signedData, cert: pickEndEntityCert(signedData.certificates), signed: ext.signed };
}

/** Checks PKCS#7 integrity only (document bytes unchanged). */
export async function verifySubmissionPdfIntegrity(pdfBuffer) {
    if (!pdfHasEmbeddedSignature(pdfBuffer)) {
        return { hasSignature: false, integrityValid: false, signMode: null, code: 'NO_SIGNATURE' };
    }
    let integrityValid = false;
    let signMode = null;
    let verifyError = null;
    try {
        const parsed = parseSignedData(pdfBuffer);
        if (!parsed) {
            return { hasSignature: true, integrityValid: false, signMode: null, code: 'INTEGRITY_FAIL', verifyError: 'parse failed' };
        }
        integrityValid = await parsed.signedData.verify({ signer: 0, data: toArrayBuffer(parsed.signed) }) === true;
        if (parsed.cert) signMode = readOuToken(parsed.cert, NXE_MODE_OU_PREFIX);
    } catch (e) {
        verifyError = e?.message || String(e);
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
export async function verifySubmissionPdfBipIdentity(pdfBuffer, userPrivateAccessKey) {
    const integrity = await verifySubmissionPdfIntegrity(pdfBuffer);
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
        const parsed = parseSignedData(pdfBuffer);
        if (!parsed?.cert) {
            return { ...integrity, bipIdentityValid: false, ok: false, code: 'NO_CERT' };
        }
        const saltHex = readOuToken(parsed.cert, NXE_SALT_OU_PREFIX);
        if (!saltHex) {
            return { ...integrity, bipIdentityValid: false, ok: false, code: 'NO_SALT' };
        }
        const { pointBytes } = await deriveP256Identity(secret, saltHex);
        const certPoint = new Uint8Array(parsed.cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView);
        const bipIdentityValid = publicKeyFingerprint(pointBytes) === publicKeyFingerprint(certPoint);
        return {
            ...integrity,
            bipIdentityValid,
            bipUserIdInCert: readOuToken(parsed.cert, NXE_BIP_UID_OU_PREFIX),
            ok: bipIdentityValid,
            code: bipIdentityValid ? 'OK' : 'BIP_IDENTITY_MISMATCH',
        };
    } catch (e) {
        return { ...integrity, bipIdentityValid: false, ok: false, code: 'BIP_VERIFY_ERROR', verifyError: e?.message || String(e) };
    }
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
