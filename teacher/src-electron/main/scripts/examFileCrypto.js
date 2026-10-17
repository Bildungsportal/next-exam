// Node wrapper: pure crypto core, Buffer results for Electron fs/toString callers.
import {
    encryptExamFileBytes as encryptCore,
    decryptExamFileBytes as decryptCore,
} from '../../../../shared/examFileCryptoCore.js';

/** Encrypts bytes; returns Buffer. */
export const encryptExamFileBytes = (plain, pw) => Buffer.from(encryptCore(plain, pw));
/** Decrypts one NXE1 layer; returns Buffer. */
export const decryptExamFileBytes = (buf, pw) => Buffer.from(decryptCore(buf, pw));
