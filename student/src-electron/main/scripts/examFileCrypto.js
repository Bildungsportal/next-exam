// Node wrapper: pure crypto core, Buffer results for Electron fs/toString callers.
import {
    isExamFileEncryptedBytes,
    encryptExamFileBytes as encryptCore,
    decryptExamFileBytes as decryptCore,
    decryptExamFileAllLayers as decryptAllCore,
    decryptExamFileAllLayersAsync as decryptAllCoreAsync,
} from '../../../../shared/examFileCryptoCore.js';

export { isExamFileEncryptedBytes };

/** Encrypts bytes; returns Buffer. */
export const encryptExamFileBytes = (plain, pw) => Buffer.from(encryptCore(plain, pw));
/** Decrypts one NXE1 layer; returns Buffer. */
export const decryptExamFileBytes = (buf, pw) => Buffer.from(decryptCore(buf, pw));
/** Peels all NXE1 layers; returns Buffer. */
export const decryptExamFileAllLayers = (buf, pw) => Buffer.from(decryptAllCore(buf, pw));
/** Async peels all NXE1 layers; returns Buffer. */
export const decryptExamFileAllLayersAsync = async (buf, pw) => Buffer.from(await decryptAllCoreAsync(buf, pw));
