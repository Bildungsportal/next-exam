/**
 * Path helpers for teacher HTTP routes: single-segment segments and containment under a root (blocks traversal).
 */
import path from 'path';

const RESERVED_WIN = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

// Returns true if seg is one directory/file name without separators or traversal.
export function isSafePathSegment(seg) {
    if (seg == null || typeof seg !== 'string') return false;
    const s = seg.trim();
    if (!s || s.includes('\0')) return false;
    if (s !== path.basename(s)) return false;
    if (s === '.' || s === '..') return false;
    if (RESERVED_WIN.test(path.parse(s).name)) return false;
    return true;
}

// Joins rootDir with validated segments; returns absolute path or null if any segment is unsafe or result escapes root.
export function resolvePathUnderRoot(rootDir, segments) {
    if (!rootDir || typeof rootDir !== 'string' || !Array.isArray(segments) || segments.length === 0) return null;
    const rootResolved = path.resolve(rootDir);
    let cur = rootResolved;
    for (const seg of segments) {
        if (!isSafePathSegment(String(seg))) return null;
        cur = path.resolve(path.join(cur, String(seg).trim()));
    }
    const rel = path.relative(rootResolved, cur);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return cur;
}

// Safe .zip basename for student backup upload (body filename).
export function safeClientZipBasename(name) {
    const b = path.basename(String(name ?? '').trim());
    if (!b.toLowerCase().endsWith('.zip')) return null;
    if (!isSafePathSegment(b)) return null;
    return b;
}

// User-provided screenshot file suffix: basename only, allowed image extensions, ASCII stem.
export function safeScreenshotFileName(raw) {
    const base = path.basename(String(raw ?? '').trim());
    if (!base || base.includes('\0')) return null;
    const ext = path.extname(base).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!allowed.includes(ext)) return null;
    const stem = path.basename(base, ext).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 100);
    if (!stem) return null;
    return `${stem}${ext}`;
}

// Normalizes ABGABE / PRINTJOBS section folder name to digits only (max 3 digits).
export function safeSectionFolderId(lockedsection) {
    const s = String(lockedsection ?? '1').replace(/\D/g, '');
    const n = s.length ? s.slice(0, 3) : '1';
    return n || '1';
}
