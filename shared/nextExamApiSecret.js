/**
 * Shared app secret for HTTPS API calls to the teacher Express server (/server/control/*, /server/data/*).
 * Replace the string before production builds; must be identical in Teacher + Student bundles.
 */

export const NEXT_EXAM_API_SECRET = 'CHANGE_ME_NEXT_EXAM_API_SECRET_REPLACE_BEFORE_RELEASE';

/** Lowercase header name (Express normalizes incoming headers). */
export const NEXT_EXAM_API_SECRET_HEADER = 'x-next-exam-app-secret';
