/** Generates a 256-bit random secret as 64 hex chars for serverstatus.encryptionPassword (NXE1 key material). */
export function generateEncryptionPassword() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
