import { buildAppSecretHeaders } from './nextExamApiSecret.js';

/** fetch() to teacher /server/* with timestamped HMAC app-secret headers (merges into init.headers). */
export async function examApiFetch(input, init = {}) {
    const headers = new Headers(init.headers ?? undefined);
    const auth = await buildAppSecretHeaders();
    for (const [k, v] of Object.entries(auth)) { headers.set(k, v); }
    return fetch(input, { ...init, headers });
}
