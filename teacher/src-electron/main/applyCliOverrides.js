import log from 'electron-log';

/** Read --name=value or --name value from Electron argv. */
export function getArgValue(argv, name) {
    const prefix = `--${name}=`;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (typeof a !== 'string') continue;
        if (a.startsWith(prefix)) return a.slice(prefix.length);
        if (a === `--${name}`) return argv[i + 1];
    }
    return null;
}

/** Parse true/false/1/0/yes/no for --expose-students. */
export function parseBooleanArg(raw) {
    const v = String(raw).trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return null;
}

function applyExamModesOverride(config, argv) {
    const raw = getArgValue(argv, 'exam-modes');
    if (!raw) return false;

    const allowed = Object.keys(config.exammodes || {});
    const selected = String(raw)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    const next = {};
    for (const k of allowed) next[k] = false;

    for (const mode of selected) {
        if (mode === 'all') {
            for (const k of allowed) next[k] = true;
            continue;
        }
        if (allowed.includes(mode)) next[mode] = true;
    }

    config.exammodes = next;
    log.info(`applyCliOverrides @ exam-modes: ${Object.entries(next).filter(([, on]) => on).map(([k]) => k).join(',') || '(none)'}`);
    return true;
}

/** True if argv contains --expose-students or --expose-students=... */
function hasExposeStudentsFlag(argv) {
    return argv.some((a) => typeof a === 'string' && (a === '--expose-students' || a.startsWith('--expose-students=')));
}

function applyExposeStudentsOverride(config, argv) {
    if (!hasExposeStudentsFlag(argv)) return false;
    let raw = getArgValue(argv, 'expose-students');
    // Bare flag (no value or next token is another flag) defaults to enabled.
    if (raw == null || (typeof raw === 'string' && raw.startsWith('--'))) raw = 'true';
    const parsed = parseBooleanArg(raw);
    if (parsed === null) {
        log.warn(`applyCliOverrides @ expose-students: ignored (expected true/false): ${raw}`);
        return false;
    }
    config.exposeStudents = parsed;
    log.info(`applyCliOverrides @ expose-students: ${parsed}`);
    return true;
}

/** Apply teacher CLI overrides before Express routes load (imported from config.js). */
export function applyCliOverrides(config, argv) {
    applyExamModesOverride(config, argv);
    applyExposeStudentsOverride(config, argv);
}
