/** Default editor exam settings under group.examConfig.editor. */
export const DEFAULT_EDITOR_EXAM_CONFIG = {
    spellchecklang: 'de-DE',
    suggestions: false,
    cmargin: { side: 'right', size: 3 },
    linespacing: '2',
    languagetool: false,
    fontfamily: 'sans-serif',
    fontsize: '12pt',
    audioRepeat: '0',
};

/** Resolve groupA vs groupB from section.groups and client group letter. */
export function resolveGroupKey(section, clientGroup) {
    if (section?.groups && String(clientGroup || '').toLowerCase() === 'b') return 'groupB';
    return 'groupA';
}

/** Merge defaults with group.examConfig.editor for one section/group. */
export function resolveEditorExamConfig(section, groupKey = 'groupA') {
    const editor = section?.[groupKey]?.examConfig?.editor;
    return { ...DEFAULT_EDITOR_EXAM_CONFIG, ...(editor && typeof editor === 'object' ? editor : {}) };
}
