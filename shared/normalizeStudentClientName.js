/** Trim and lowercase student client names (canonical id for folders and studentList). */
export function normalizeStudentClientName(name) {
    if (name == null || name === false) return '';
    return String(name).trim().toLowerCase();
}
