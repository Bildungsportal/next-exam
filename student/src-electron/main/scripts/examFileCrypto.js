import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const MAGIC = Buffer.from('NXE1'); // "Exam file v1" marker
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const MAX_EXAM_CRYPTO_LAYERS = 8;

/** True when buffer starts with NXE1 header and version byte produced by this module. */
export function isExamFileEncryptedBytes(raw) {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    return (
        buf.length >= MAGIC.length + 1 &&
        buf.subarray(0, MAGIC.length).equals(MAGIC) &&
        buf.readUInt8(MAGIC.length) === VERSION
    );
}

/** Encrypts exam file bytes using the given password. */
export function encryptExamFileBytes(plainBytes, password) {
    if (!password || typeof password !== 'string') {
        throw new Error('missing exam password');
    }
    const plain = Buffer.isBuffer(plainBytes) ? plainBytes : Buffer.from(plainBytes);
    const salt = crypto.randomBytes(SALT_LEN);
    const iv = crypto.randomBytes(IV_LEN);
    const key = crypto.scryptSync(password, salt, KEY_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, tag, ciphertext]);
}

/** Decrypts exam file bytes using the given password. */
export function decryptExamFileBytes(cipherBytes, password) {
    if (!password || typeof password !== 'string') {
        throw new Error('missing exam password');
    }
    const buf = Buffer.isBuffer(cipherBytes) ? cipherBytes : Buffer.from(cipherBytes);
    if (buf.length < MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN) {
        throw new Error('ciphertext too short');
    }
    if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new Error('not encrypted');
    }
    const version = buf.readUInt8(MAGIC.length);
    if (version !== VERSION) {
        throw new Error('unsupported version');
    }
    const saltOff = MAGIC.length + 1;
    const ivOff = saltOff + SALT_LEN;
    const tagOff = ivOff + IV_LEN;
    const dataOff = tagOff + TAG_LEN;
    const salt = buf.subarray(saltOff, ivOff);
    const iv = buf.subarray(ivOff, tagOff);
    const tag = buf.subarray(tagOff, dataOff);
    const ciphertext = buf.subarray(dataOff);
    const key = crypto.scryptSync(password, salt, KEY_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Peels nested NXE1 blobs (same password per layer) until plaintext or non-NXE1 bytes remain. */
export function decryptExamFileAllLayers(cipherBytes, password) {
    let buf = Buffer.isBuffer(cipherBytes) ? cipherBytes : Buffer.from(cipherBytes);
    let depth = 0;
    while (isExamFileEncryptedBytes(buf) && depth < MAX_EXAM_CRYPTO_LAYERS) {
        buf = decryptExamFileBytes(buf, password);
        depth++;
    }
    return buf;
}

/** Decrypts exam file bytes using the given password (async scrypt, no Worker). */
export async function decryptExamFileBytesAsync(cipherBytes, password) {
    if (!password || typeof password !== 'string') {
        throw new Error('missing exam password');
    }
    const buf = Buffer.isBuffer(cipherBytes) ? cipherBytes : Buffer.from(cipherBytes);
    if (buf.length < MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN) {
        throw new Error('ciphertext too short');
    }
    if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new Error('not encrypted');
    }
    const version = buf.readUInt8(MAGIC.length);
    if (version !== VERSION) {
        throw new Error('unsupported version');
    }
    const saltOff = MAGIC.length + 1;
    const ivOff = saltOff + SALT_LEN;
    const tagOff = ivOff + IV_LEN;
    const dataOff = tagOff + TAG_LEN;
    const salt = buf.subarray(saltOff, ivOff);
    const iv = buf.subarray(ivOff, tagOff);
    const tag = buf.subarray(tagOff, dataOff);
    const ciphertext = buf.subarray(dataOff);
    const key = await scryptAsync(password, salt, KEY_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Async variant of decryptExamFileAllLayers for non-blocking IPC reads. */
export async function decryptExamFileAllLayersAsync(cipherBytes, password) {
    let buf = Buffer.isBuffer(cipherBytes) ? cipherBytes : Buffer.from(cipherBytes);
    let depth = 0;
    while (isExamFileEncryptedBytes(buf) && depth < MAX_EXAM_CRYPTO_LAYERS) {
        buf = await decryptExamFileBytesAsync(buf, password);
        depth++;
    }
    return buf;
}
