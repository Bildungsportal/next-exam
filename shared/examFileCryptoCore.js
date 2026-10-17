// Pure exam-file crypto (no Node crypto/Buffer/fs) so it runs in Electron main and in the iOS/Capacitor WKWebView.
import { scrypt, scryptAsync } from '@noble/hashes/scrypt.js';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';

const MAGIC = new Uint8Array([0x4e, 0x58, 0x45, 0x31]); // "NXE1" exam file marker
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 }; // AES-256 key from password
const MAX_LAYERS = 8;

// Coerce string/ArrayBuffer/Uint8Array to Uint8Array (utf8 for strings).
const toBytes = (v) => typeof v === 'string' ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v);

// Concatenate Uint8Arrays into one buffer.
const concat = (parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return out;
};

/** True when bytes start with the NXE1 header and known version. */
export function isExamFileEncryptedBytes(raw) {
    const b = toBytes(raw);
    return b.length >= MAGIC.length + 1 && MAGIC.every((v, i) => b[i] === v) && b[MAGIC.length] === VERSION;
}

// Split an NXE1 buffer into salt, iv and gcm payload (ciphertext||tag).
const readHeader = (raw) => {
    const b = toBytes(raw);
    if (b.length < HEADER_LEN || !isExamFileEncryptedBytes(b)) throw new Error('not encrypted');
    const saltOff = MAGIC.length + 1;
    const ivOff = saltOff + SALT_LEN;
    const dataOff = ivOff + IV_LEN;
    return { salt: b.subarray(saltOff, ivOff), iv: b.subarray(ivOff, dataOff), payload: b.subarray(dataOff) };
};

/** Encrypts bytes with a password (scrypt key + AES-256-GCM); returns NXE1 buffer. */
export function encryptExamFileBytes(plainBytes, password) {
    if (!password || typeof password !== 'string') throw new Error('missing exam password');
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = scrypt(password, salt, SCRYPT);
    const payload = gcm(key, iv).encrypt(toBytes(plainBytes));
    return concat([MAGIC, Uint8Array.of(VERSION), salt, iv, payload]);
}

/** Decrypts one NXE1 layer with a password. */
export function decryptExamFileBytes(cipherBytes, password) {
    if (!password || typeof password !== 'string') throw new Error('missing exam password');
    const { salt, iv, payload } = readHeader(cipherBytes);
    const key = scrypt(password, salt, SCRYPT);
    return gcm(key, iv).decrypt(payload);
}

/** Async decrypt (non-blocking scrypt) of one NXE1 layer. */
export async function decryptExamFileBytesAsync(cipherBytes, password) {
    if (!password || typeof password !== 'string') throw new Error('missing exam password');
    const { salt, iv, payload } = readHeader(cipherBytes);
    const key = await scryptAsync(password, salt, SCRYPT);
    return gcm(key, iv).decrypt(payload);
}

/** Peels nested NXE1 layers (same password) until plaintext remains. */
export function decryptExamFileAllLayers(cipherBytes, password) {
    let b = toBytes(cipherBytes);
    for (let i = 0; i < MAX_LAYERS && isExamFileEncryptedBytes(b); i++) b = decryptExamFileBytes(b, password);
    return b;
}

/** Async variant of decryptExamFileAllLayers. */
export async function decryptExamFileAllLayersAsync(cipherBytes, password) {
    let b = toBytes(cipherBytes);
    for (let i = 0; i < MAX_LAYERS && isExamFileEncryptedBytes(b); i++) b = await decryptExamFileBytesAsync(b, password);
    return b;
}
