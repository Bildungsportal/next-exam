/** Collect activesheets form field values from a DOM root (same shape as student .htm backup). */
export function collectActivesheetsFormData(rootEl, pdfFilename = 'unknown.pdf') {
    const formData = { filename: pdfFilename || 'unknown.pdf' };
    const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('pdfrenderer') : null);
    if (!root) return formData;

    root.querySelectorAll('.interactive-input.text, .interactive-input.cloze, .interactive-input.table-cell').forEach((input) => {
        if (input.id) formData[input.id] = input.value || '';
    });
    root.querySelectorAll('.interactive-input.textarea').forEach((textarea) => {
        if (textarea.id) formData[textarea.id] = textarea.value || '';
    });
    root.querySelectorAll('.interactive-input.checkbox').forEach((checkbox) => {
        if (checkbox.id) formData[checkbox.id] = checkbox.checked || false;
    });
    return formData;
}

/** Parse JSON from .htm backup file content (UTF-8 string). */
export function parseActivesheetsFormDataJson(utf8) {
    return JSON.parse(String(utf8 ?? ''));
}

/** Fill interactive inputs under root from activesheets formData object. */
export function applyActivesheetsFormData(rootEl, formData) {
    const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('pdfrenderer') : null);
    if (!root || !formData || typeof formData !== 'object') return false;

    root.querySelectorAll('.interactive-input.text, .interactive-input.cloze, .interactive-input.table-cell').forEach((input) => {
        if (input.id && formData[input.id] !== undefined) input.value = formData[input.id];
    });
    root.querySelectorAll('.interactive-input.textarea').forEach((textarea) => {
        if (textarea.id && formData[textarea.id] !== undefined) textarea.value = formData[textarea.id];
    });
    root.querySelectorAll('.interactive-input.checkbox').forEach((checkbox) => {
        if (checkbox.id && formData[checkbox.id] !== undefined) checkbox.checked = Boolean(formData[checkbox.id]);
    });
    return true;
}

/** Normalize a single field value for comparison. */
function normalizeActivesheetsValue(value) {
    if (typeof value === 'boolean') return value;
    return String(value ?? '').trim();
}

/** Field ids in template that differ from submission (template keys only, excludes filename). */
export function diffActivesheetsFormData(template, submission) {
    const mismatches = [];
    if (!template || typeof template !== 'object') return mismatches;
    const sub = submission && typeof submission === 'object' ? submission : {};
    for (const key of Object.keys(template)) {
        if (key === 'filename') continue;
        const expected = template[key];
        if (!(key in sub)) {
            mismatches.push(key);
            continue;
        }
        const a = normalizeActivesheetsValue(expected);
        const b = normalizeActivesheetsValue(sub[key]);
        if (typeof expected === 'boolean' || typeof sub[key] === 'boolean') {
            if (Boolean(expected) !== Boolean(sub[key])) mismatches.push(key);
        } else if (a !== b) {
            mismatches.push(key);
        }
    }
    return mismatches;
}
