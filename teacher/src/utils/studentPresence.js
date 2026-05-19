// Heartbeat window aligned with dashboard: stale after this span.
export const STUDENT_HEARTBEAT_STALE_MS = 20000;

export function isStudentReachable(student, now = Date.now()) {
    return !!(student && typeof student.timestamp === 'number' && (now - STUDENT_HEARTBEAT_STALE_MS <= student.timestamp));
}

export function countReachableStudents(studentlist, now = Date.now()) {
    if (!Array.isArray(studentlist) || studentlist.length === 0) return 0;
    return studentlist.filter((s) => isStudentReachable(s, now)).length;
}
