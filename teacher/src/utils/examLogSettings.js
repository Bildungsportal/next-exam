// Build a compact, serializable exam-settings snapshot for the exam event log (no file payloads).

const getBaseMaterialUrl = (examtype, examConfig, section) => {
    if (!examConfig || typeof examConfig !== 'object') return null
    switch (examtype) {
        case 'website':
            return examConfig.website?.url || null
        case 'eduvidual':
            return examConfig.eduvidual?.url || null
        case 'forms':
            return examConfig.forms?.url || null
        case 'rdp':
            return examConfig.rdp?.domain || null
        case 'localvm':
            return examConfig.localvm?.qcow2Name || null
        case 'activesheets':
            return examConfig.activeSheets?.filename || null
        case 'microsoft365':
            return examConfig.microsoft365?.template?.filename || null
        case 'editor':
            return examConfig.editor?.editorTemplate?.filename || null
        default:
            return null
    }
}

const summarizeLanguagetool = (editor) => {
    if (!editor?.languagetool) return { enabled: false, suggestions: false, host: null }
    const host = editor.languagetoolhost || null
    const port = editor.languagetoolport
    const hostLine = host
        ? `${host}${port && !String(host).match(/:\d+$/) ? `:${port}` : ''}`
        : null
    return { enabled: true, suggestions: !!editor.suggestions, host: hostLine }
}

const summarizeGroup = (group, examtype, section) => {
    const examConfig = group?.examConfig || {}
    const files = (group?.examInstructionFiles || []).map(f => f?.filename).filter(Boolean)
    const urls = (group?.allowedUrls || [])
        .map(u => (typeof u === 'string' ? u : u?.url))
        .filter(Boolean)
    return {
        baseMaterialUrl: getBaseMaterialUrl(examtype, examConfig, section),
        materialsFiles: files,
        materialsUrls: urls,
        languagetool: summarizeLanguagetool(examConfig.editor),
    }
}

/** Snapshot active section settings at exam start (stored on examstart log events). */
export const buildExamLogSettingsSnapshot = (serverstatus, sectionIndex) => {
    const section = serverstatus?.examSections?.[sectionIndex]
    if (!section) return null
    const examtype = section.examtype || 'unknown'
    const snap = {
        sectionIndex,
        sectionName: section.sectionname || String(sectionIndex),
        examtype,
        groups: !!section.groups,
        groupA: summarizeGroup(section.groupA, examtype, section),
    }
    if (section.groups) snap.groupB = summarizeGroup(section.groupB, examtype, section)
    return snap
}
