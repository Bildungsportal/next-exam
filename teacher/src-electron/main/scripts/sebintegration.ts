/**
 * SEB (Safe Exam Browser) integration for Electron
 *
 * Implements:
 *  - Parsing/decrypting .seb config files (plain, plnd, pswd via RNCryptor v3)
 *  - Computing X-SafeExamBrowser-RequestHash (Browser Exam Key mode)
 *  - Computing X-SafeExamBrowser-ConfigKeyHash (Config Key mode)
 *  - Patching Electron's session to attach SEB headers to all Moodle requests
 *
 * Spec references:
 *  https://safeexambrowser.org/developer/seb-file-format.html
 *  https://safeexambrowser.org/developer/documents/SEB-Specification-BrowserExamKey.pdf
 *  https://safeexambrowser.org/developer/seb-config-key.html
 *
 * Node's built-in `crypto` and `zlib` modules cover everything else.
 */

import * as crypto from "crypto";
import * as zlib from "zlib";
import { promisify } from "util";
// @ts-ignore – plist has usable types but the import style varies by version
import plist from "plist";

const gunzip = promisify(zlib.gunzip);

export interface SEBConfig {
  sebConfigFile?: string | null,
  sebConfigPassword?: string | null,
  sebConfigBek?: string | null,
  sebConfig?: string | null,
  sebConfigHash?: string | null,
  sebBekHash?: string | null,
}

/**
 * Load and decrypt a .seb config file.
 *
 * Supports:
 *   - Unencrypted XML plist (starts with "<?xm")
 *   - `plnd` prefix  – gzip-compressed plain XML, no encryption
 *   - `pswd` prefix  – RNCryptor v3 password-encrypted
 *
 * Does NOT support `pkhs` (certificate/private-key encryption) because that
 * requires institution-specific private keys deployed to client machines.
 *
 * @param filePath   Absolute path to the .seb file
 * @param password   Only required for `pswd`-encrypted files
 */
export async function loadSEBConfig(
  configFile: Buffer | string,
  password?: string,
  bek?: string
): Promise<SEBConfig> {

  // Outer gzip wrapper (the file itself is gzipped)
  const decompressed = await decodeBuffer(configFile);

  const xmlBuffer = await decryptSEBData(decompressed, password);
  const xmlBase64 = xmlBuffer.toString("base64");
  const xmlString = xmlBuffer.toString("utf8");

  const config = plist.parse(xmlString) as Record<string, unknown>;
  const configKey = computeConfigKey(config);
  const startURL = typeof config["startURL"] === "string"
    ? config["startURL"]
    : undefined;
  const configHash = computeKeyHash(startURL, configKey);
  const bekHash = bek != null ? computeKeyHash(startURL, bek) : undefined;

  return {
    sebConfigFile: xmlBase64,
    sebConfigPassword: password,
    sebConfigBek: bek,
    sebConfig: config,
    sebConfigHash: configHash,
    sebBekHash: bekHash,
  };
}

/**
 * Decrypts the gzip-decompressed inner payload of a .seb file.
 * Returns the raw XML bytes.
 */
async function decryptSEBData(
  data: Buffer,
  password?: string
): Promise<Buffer> {
  const prefix = data.slice(0, 4).toString("utf8");

  // ── Unencrypted XML ────────────────────────────────────────────────────────
  if (prefix === "<?xm") {
    return data; // already plain XML
  }

  // ── Plain (gzip-compressed, no encryption) ─────────────────────────────────
  if (prefix === "plnd") {
    const inner = data.slice(4);
    return gunzip(inner);
  }

  // ── Password-encrypted (RNCryptor v3 / "pswd") ─────────────────────────────
  if (prefix === "pswd" || prefix === "pwcc") {
    if (!password) {
      throw new Error(
        `SEB config is password-encrypted (prefix="${prefix}") but no password was provided.`
      );
    }
    const cipherData = data.slice(4);
    const plainCompressed = await rncryptorDecrypt(cipherData, password);
    return gunzip(plainCompressed);
  }

  // ── Certificate-encrypted ──────────────────────────────────────────────────
  if (prefix === "pkhs" || prefix === "phsk") {
    throw new Error(
      `SEB config uses certificate/private-key encryption (prefix="${prefix}"). ` +
      "This requires deploying your institution's private key to each client machine " +
      "and is not implemented here."
    );
  }

  throw new Error(`Unknown .seb prefix: "${prefix}" (hex: ${data.slice(0, 4).toString("hex")})`);
}

/**
 * RNCryptor v3 decryption.
 *
 * Format (66-byte header):
 *   [0]      version  = 0x03
 *   [1]      options  = 0x01 (password-based)
 *   [2–9]    encryption salt (8 bytes)
 *   [10–17]  HMAC salt       (8 bytes)
 *   [18–33]  IV              (16 bytes)
 *   [34–N-32] ciphertext
 *   [N-32–N]  HMAC-SHA256    (32 bytes)
 *
 * Key derivation: PBKDF2-HMAC-SHA1, 10 000 iterations, 32-byte output
 */
async function rncryptorDecrypt(data: Buffer, password: string): Promise<Buffer> {
  if (data.length < 66) {
    throw new Error("RNCryptor data too short to be valid.");
  }

  const version = data[0];
  const options = data[1];

  if (version !== 0x02 && version !== 0x03) {
    throw new Error(`Unsupported RNCryptor version: 0x${version.toString(16)}`);
  }

  if (options !== 0x01) {
    throw new Error(
      `Unsupported RNCryptor options byte: 0x${options.toString(16)} (only password-based is supported)`
    );
  }

  const encSalt  = data.slice(2, 10);
  const hmacSalt = data.slice(10, 18);
  const iv       = data.slice(18, 34);
  const ciphertext = data.slice(34, data.length - 32);
  const hmacReceived = data.slice(data.length - 32);

  // Derive encryption and HMAC keys
  const encKey  = await pbkdf2(password, encSalt,  10000, 32, "sha1");
  const hmacKey = await pbkdf2(password, hmacSalt, 10000, 32, "sha1");

  // Verify HMAC
  const hmacData = data.slice(0, data.length - 32);
  const hmacComputed = crypto
    .createHmac("sha256", hmacKey)
    .update(hmacData)
    .digest();

  if (!crypto.timingSafeEqual(hmacReceived, hmacComputed)) {
    throw new Error(
      "RNCryptor HMAC verification failed – wrong password or corrupted data."
    );
  }

  // Decrypt AES-256-CBC
  const decipher = crypto.createDecipheriv("aes-256-cbc", encKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function pbkdf2(
  password: string,
  salt: Buffer,
  iterations: number,
  keylen: number,
  digest: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

function isGzip(buffer: Buffer) {
  return buffer[0] === 0x1f && buffer[1] === 0x8b
}

function isBase64(str: Buffer | string) {
  if (!str || typeof str !== 'string') return false
  if (str.length % 4 !== 0) return false
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str)
}

async function decodeBuffer(str: Buffer | string): Buffer {
  let buffer;

  // Step 1: Base64 decode if needed
  if (isBase64(str)) {
    buffer = Buffer.from(str, 'base64')
  } else {
    buffer = Buffer.from(str)
  }

  // Step 2: Gunzip if needed
  if (isGzip(buffer)) {
    buffer = await gunzip(buffer)
  }

  return buffer;
}

/**
 * Compute the SEB Config Key.
 *
 * The Config Key is SHA-256 of a canonical JSON representation of the plist
 * settings where every dict (at every level) has its keys sorted
 * alphabetically.  Moodle sends this back as `X-SafeExamBrowser-ConfigKeyHash`
 * (itself hashed with the URL – see below).
 *
 * Spec: https://safeexambrowser.org/developer/seb-config-key.html
 */
export function computeConfigKey(settings: Record<string, unknown>): string {
  const canonical = canonicaliseSEBJSON(settings);
  const json = JSON.stringify(canonical);
  return crypto.createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Recursively sort dict keys alphabetically and convert plist types to the
 * SEB-JSON representation required by the Config Key spec:
 *   - <data>  → Base64 string
 *   - <date>  → ISO 8601 string
 *   - <real>  → rounded JSON number
 *   - Empty <dict> elements are removed
 */
function canonicaliseSEBJSON(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(canonicaliseSEBJSON);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" })
    );
    for (const k of keys) {
      if (k == 'originatorVersion') {
        continue;
      }
      const v = canonicaliseSEBJSON(obj[k], k);
      // Drop empty dicts
      if (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) {
        continue;
      }
      sorted[k] = v;
    }
    return sorted;
  }

  return value;
}

/**
 * Compute hash for a given URL and key to be used as  `X-SafeExamBrowser-...Hash` header.
 *
 * SEB sends: SHA-256((absoluteURL + configKey)_utf8_hex)
 *
 * @param absoluteURL  The full absolute URL of the request
 * @param key    The key
 */
export function computeKeyHash(absoluteURL: string, key: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(absoluteURL + key, "utf8");
  return hash.digest("hex");
}
