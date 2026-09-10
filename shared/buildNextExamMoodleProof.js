import { createHmac } from 'node:crypto';
import { NEXT_EXAM_MOODLE_PROOF_SECRET } from './nextExamMoodleProofSecret.js';

/** HMAC-SHA256 hex: moodle quiz cmid/id + UTC date (YYYY-MM-DD), matches Moodle plugin contract. */
export function buildNextExamMoodleProof(quizId, dateUtcYmd = new Date().toISOString().slice(0, 10)) {
    const payload = `${String(quizId)}|${dateUtcYmd}`;
    return createHmac('sha256', NEXT_EXAM_MOODLE_PROOF_SECRET).update(payload, 'utf8').digest('hex');
}

export { NEXT_EXAM_MOODLE_PROOF_SECRET, NEXT_EXAM_MOODLE_PROOF_HEADER } from './nextExamMoodleProofSecret.js';
