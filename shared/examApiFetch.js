import { NEXT_EXAM_API_SECRET, NEXT_EXAM_API_SECRET_HEADER } from './nextExamApiSecret.js';

/** fetch() to teacher /server/* with required app-secret header (merges into init.headers). */
export function examApiFetch(input, init = {}) {
    const headers = new Headers(init.headers ?? undefined);
    headers.set(NEXT_EXAM_API_SECRET_HEADER, NEXT_EXAM_API_SECRET);
    return fetch(input, { ...init, headers });
}

export { NEXT_EXAM_API_SECRET, NEXT_EXAM_API_SECRET_HEADER } from './nextExamApiSecret.js';
