const ROW_TOL = 4;

/** Parse overlay field style into numeric rect coords. */
function fieldRect(field) {
    const left = parseFloat(field?.style?.left) || 0;
    const top = parseFloat(field?.style?.top) || 0;
    return { left, top };
}

/** Sort merged overlay entries top-to-bottom, left-to-right within a row band. */
export function sortOverlayFieldEntriesByPosition(entries, rowTol = ROW_TOL) {
    if (!entries?.length) return [];
    return [...entries].sort((a, b) => {
        const ra = fieldRect(a.field);
        const rb = fieldRect(b.field);
        const topDiff = ra.top - rb.top;
        if (Math.abs(topDiff) > rowTol) return topDiff;
        return ra.left - rb.left;
    });
}

/** Merge parser + custom overlay fields for one page in tab/DOM reading order. */
export function mergePageOverlayFields(page, customFields = [], pageIndex = 0) {
    const entries = [];
    for (const field of page?.formFields || []) entries.push({ field, kind: 'form', isCustom: false });
    for (const field of page?.clozeFields || []) entries.push({ field, kind: 'cloze', isCustom: false });
    for (const field of page?.boxFields || []) entries.push({ field, kind: 'box', isCustom: false });
    for (const field of customFields) {
        if (field.pageIndex === pageIndex) entries.push({ field, kind: 'custom', isCustom: true });
    }
    return sortOverlayFieldEntriesByPosition(entries);
}
