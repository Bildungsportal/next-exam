/**
 * Shared app secret for HTTPS API calls to the teacher Express server (/server/control/*, /server/data/*).
 * Replace the string before production builds; must be identical in Teacher + Student bundles.
 * The secret is never sent in clear: callers send a timestamped HMAC proof instead (see buildAppSecretHeaders).
 */

export const NEXT_EXAM_API_SECRET = 'NEXT-EXAM';

/** Timestamp (ms) header; used together with the HMAC to bound replay to a time window. */
export const NEXT_EXAM_API_TS_HEADER = 'x-next-exam-app-ts';

/** HMAC-SHA256(secret, ts) as base64; proves secret knowledge without exposing it. */
export const NEXT_EXAM_API_MAC_HEADER = 'x-next-exam-app-mac';

/** Max clock skew (ms) the teacher accepts between its clock and the request timestamp. */
export const NEXT_EXAM_API_TS_WINDOW_MS = 300000;

const enc = new TextEncoder();

/** HMAC-SHA256(secret, message) -> base64 string. Works in Node (>=global crypto.subtle) and browser. */
export async function computeAppMac(message) {
    const key = await crypto.subtle.importKey('raw', enc.encode(NEXT_EXAM_API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(message)));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** Builds the {ts, mac} auth headers for a /server/* request. */
export async function buildAppSecretHeaders() {
    const ts = String(Date.now());
    const mac = await computeAppMac(ts);
    return { [NEXT_EXAM_API_TS_HEADER]: ts, [NEXT_EXAM_API_MAC_HEADER]: mac };
}
