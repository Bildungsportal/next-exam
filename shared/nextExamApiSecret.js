/**
 * Shared app secret for HTTPS API calls to the teacher Express server (/server/control/*, /server/data/*).
 * Replace the string before production builds; must be identical in Teacher + Student bundles.
 */

export const NEXT_EXAM_API_SECRET = 'NEXT_EXAM_API_SECRET';

/** Lowercase header name (Express normalizes incoming headers). */
export const NEXT_EXAM_API_SECRET_HEADER = 'x-next-exam-app-secret';
