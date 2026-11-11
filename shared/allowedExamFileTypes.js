// File types a teacher may hand out (materials + "send files"). One list for the picker hint and the real check.
export const ALLOWED_EXAM_FILE_EXTENSIONS = ['.pdf', '.docx', '.odt', '.htm', '.ogg', '.wav', '.mp3', '.jpg', '.png', '.gif', '.ggb'];

/** Value for <input type="file" accept="..."> (only a hint - the OS dialog lets users pick anything). */
export const ALLOWED_EXAM_FILE_ACCEPT = ALLOWED_EXAM_FILE_EXTENSIONS.join(', ');

/** True if the filename has an allowed extension (case-insensitive). */
export function isAllowedExamFileName(name) {
    const lower = String(name || '').toLowerCase();
    return ALLOWED_EXAM_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Names of the files (FileList, array or single File/{name}) that are not allowed. */
export function disallowedExamFileNames(files) {
    const list = files?.name ? [files] : Array.from(files || []);
    return list.map((f) => f?.name).filter((n) => !isAllowedExamFileName(n));
}
