/**
 * Shared secret for Moodle quizaccess_nextexam proof header (Student eduvidual webview → Moodle).
 * Must match the value configured in the Moodle plugin; independent of NEXT_EXAM_API_SECRET.
 */

export const NEXT_EXAM_MOODLE_PROOF_SECRET = 'NEXT_EXAM_MOODLE_PROOF_SECRET';

/** Request header carrying HMAC proof (Moodle: HTTP_X_NEXT_EXAM_MOODLE_PROOF). */
export const NEXT_EXAM_MOODLE_PROOF_HEADER = 'X-Next-Exam-Moodle-Proof';
