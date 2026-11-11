/**
 * Best-effort ODT → HTML for TipTap (student editor). Unknown ODF is skipped.
 */

const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const DRAW_NS = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const STYLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const FO_NS = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const SVG_NS = 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** @param {Uint8Array} u8 @param {number} o */
function u16(u8, o) {
    return u8[o] | (u8[o + 1] << 8);
}

/** @param {Uint8Array} u8 @param {number} o */
function u32(u8, o) {
    return u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24);
}

/** @param {Uint8Array} bytes @param {number} gpFlags */
function decodeZipFilename(bytes, gpFlags) {
    const enc = gpFlags & 0x800 ? 'utf-8' : 'cp437';
    try {
        return new TextDecoder(enc).decode(bytes);
    } catch {
        return new TextDecoder('utf-8').decode(bytes);
    }
}

/** @param {Element} parent @param {string} ns @param {string} ln */
function childrenNs(parent, ns, ln) {
    /** @type {Element[]} */
    const r = [];
    for (let el = parent.firstElementChild; el; el = el.nextElementSibling) {
        if (el.namespaceURI === ns && el.localName === ln) r.push(el);
    }
    return r;
}

/** @param {Uint8Array} comp */
async function inflateRawIfNeeded(comp) {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('ZIP deflate requires DecompressionStream (deflate-raw)');
    }
    const ds = new DecompressionStream('deflate-raw');
    const out = await new Response(new Blob([comp]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
}

/** @param {ArrayBuffer} ab */
async function unzipToMap(ab) {
    const u8 = new Uint8Array(ab);
    let eocd = -1;
    const minTail = 22;
    const scan = Math.min(u8.length, 65536 + minTail);
    for (let i = u8.length - minTail; i >= 0 && i >= u8.length - scan; i--) {
        if (u32(u8, i) >>> 0 === SIG_EOCD) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('ZIP end of central directory not found');
    const cdOffset = u32(u8, eocd + 16) >>> 0;
    const totalEntries = u16(u8, eocd + 10);
    /** @type {Map<string, Uint8Array>} */
    const out = new Map();
    let p = cdOffset;
    for (let e = 0; e < totalEntries; e++) {
        if ((u32(u8, p) >>> 0) !== SIG_CENTRAL) throw new Error('ZIP central directory corrupt');
        const gpFlags = u16(u8, p + 8);
        const method = u16(u8, p + 10);
        const compSize = u32(u8, p + 20) >>> 0;
        const uncompSize = u32(u8, p + 24) >>> 0;
        const n = u16(u8, p + 28);
        const m = u16(u8, p + 30);
        const k = u16(u8, p + 32);
        const localHeaderRel = u32(u8, p + 42) >>> 0;
        const nameBytes = u8.subarray(p + 46, p + 46 + n);
        const name = decodeZipFilename(nameBytes, gpFlags).replace(/\\/g, '/');
        p += 46 + n + m + k;
        if (name.endsWith('/')) continue;
        if ((u32(u8, localHeaderRel) >>> 0) !== SIG_LOCAL) throw new Error('ZIP local header corrupt');
        const nL = u16(u8, localHeaderRel + 26);
        const mL = u16(u8, localHeaderRel + 28);
        const dataStart = localHeaderRel + 30 + nL + mL;
        const slice = u8.subarray(dataStart, dataStart + compSize);
        let payload;
        if (method === 0) {
            payload = slice;
        } else if (method === 8) {
            payload = await inflateRawIfNeeded(slice);
            if (uncompSize && payload.length !== uncompSize) {
                /* tolerate slight mismatch */
            }
        } else {
            continue;
        }
        out.set(name, payload);
    }
    return out;
}

/** @param {Uint8Array} bytes */
function utf8Text(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
}

/** @param {string} path */
function mimeFromPath(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
}

/** @param {Uint8Array} u8 */
function bytesToBase64(u8) {
    const chunk = 0x8000;
    let bin = '';
    for (let i = 0; i < u8.length; i += chunk) {
        bin += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunk, u8.length)));
    }
    return btoa(bin);
}

/** @param {Element} el @param {string} local */
function attrAny(el, local) {
    if (!el || !el.attributes) return '';
    for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        if (a.localName === local) return a.value;
    }
    return '';
}

/** @param {string} raw */
function normalizeOdfColorForCss(raw) {
    const s = String(raw || '').trim();
    if (!s || /^(transparent|inherit|auto)$/i.test(s)) return '';
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
    if (/^rgba?\s*\([^)]+\)$/i.test(s) && !/[<>;]/.test(s)) return s;
    if (/^hsla?\s*\([^)]+\)$/i.test(s) && !/[<>;]/.test(s)) return s;
    return '';
}

/** @param {string} raw */
function normalizeOdfLineHeightForCss(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(',', '.');
    if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return s;
    if (/^[0-9]+(\.[0-9]+)?%$/.test(s)) return s;
    if (/^[0-9]+(\.[0-9]+)?(cm|mm|in|pt|pc|px)$/.test(s)) return s;
    return '';
}

/** @param {string} fw */
function isBoldFontWeight(fw) {
    const t = String(fw || '').trim().toLowerCase();
    if (!t) return false;
    if (t === 'bold') return true;
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t) >= 600;
    return false;
}

/** @param {Element|null|undefined} tp */
function readTextPropsFromElement(tp) {
    /** @type {{ b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string }} */
    const o = {};
    if (!tp) return o;
    const fw = attrAny(tp, 'font-weight') || tp.getAttributeNS(FO_NS, 'font-weight');
    if (isBoldFontWeight(fw)) o.b = true;
    const fs = attrAny(tp, 'font-style') || tp.getAttributeNS(FO_NS, 'font-style');
    if (fs && /italic|oblique/i.test(fs)) o.i = true;
    const ul = attrAny(tp, 'text-underline-style');
    if (ul && String(ul).toLowerCase() !== 'none') o.u = true;
    const pos = attrAny(tp, 'text-position');
    if (pos) {
        if (/super/i.test(pos)) o.sup = true;
        else if (/sub/i.test(pos)) o.sub = true;
    }
    const col = attrAny(tp, 'color') || tp.getAttributeNS(FO_NS, 'color');
    if (col) {
        const safe = normalizeOdfColorForCss(col);
        if (safe) o.color = safe;
    }
    return o;
}

/** @param {Element|null|undefined} pp */
function readParagraphPropsFromElement(pp) {
    /** @type {{ lineHeight?: string }} */
    const o = {};
    if (!pp) return o;
    const lh = attrAny(pp, 'line-height') || pp.getAttributeNS(FO_NS, 'line-height');
    if (lh) {
        const safe = normalizeOdfLineHeightForCss(lh);
        if (safe) o.lineHeight = safe;
        return o;
    }

    const atLeast = attrAny(pp, 'line-height-at-least');
    if (atLeast) {
        const safe = normalizeOdfLineHeightForCss(atLeast);
        if (safe) o.lineHeight = safe;
        return o;
    }

    const spacing = attrAny(pp, 'line-spacing');
    if (spacing) {
        const safe = normalizeOdfLineHeightForCss(spacing);
        if (safe) {
            // LibreOffice encodes both relative values (e.g. 115%) and absolute add-ons (e.g. 0.2cm)
            if (safe.endsWith('%') || /^[0-9]+(\.[0-9]+)?$/.test(safe)) o.lineHeight = safe;
            else o.lineHeight = `calc(1em + ${safe})`;
        }
    }
    return o;
}

/**
 * @param {{ b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string }|null|undefined} st
 * @param {string} html
 */
function applyCharStyleAttrsToHtml(html, st) {
    if (!st || html === '') return html;
    let h = html;
    if (st.b) h = `<strong>${h}</strong>`;
    if (st.i) h = `<em>${h}</em>`;
    if (st.u) h = `<u>${h}</u>`;
    if (st.sup) h = `<sup>${h}</sup>`;
    if (st.sub) h = `<sub>${h}</sub>`;
    if (st.color) h = `<span style="color: ${st.color}">${h}</span>`;
    return h;
}

/** @param {Document[]} docs */
function readDefaultParagraphLineHeight(docs) {
    for (const doc of docs) {
        if (!doc) continue;
        const defaults = doc.getElementsByTagNameNS(STYLE_NS, 'default-style');
        for (let i = 0; i < defaults.length; i++) {
            const ds = defaults[i];
            if (attrAny(ds, 'family') !== 'paragraph') continue;
            const pp = ds.getElementsByTagNameNS(STYLE_NS, 'paragraph-properties')[0];
            const props = readParagraphPropsFromElement(pp);
            if (props?.lineHeight) return props.lineHeight;
        }
    }
    // LibreOffice typically applies "Standard" as the paragraph default when a text:p has no style-name.
    for (const doc of docs) {
        if (!doc) continue;
        const styles = doc.getElementsByTagNameNS(STYLE_NS, 'style');
        for (let i = 0; i < styles.length; i++) {
            const st = styles[i];
            const name = attrAny(st, 'name');
            if (String(name || '').toLowerCase() !== 'standard') continue;
            if (attrAny(st, 'family') !== 'paragraph') continue;
            const pp = st.getElementsByTagNameNS(STYLE_NS, 'paragraph-properties')[0];
            const props = readParagraphPropsFromElement(pp);
            if (props?.lineHeight) return props.lineHeight;
        }
    }
    return '';
}

/**
 * @param {string} flow
 * @param {{ b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string }|null|undefined} paraStyle
 * @param {string} defaultLineHeight
 */
function paragraphHtmlFromFlow(flow, paraStyle, defaultLineHeight) {
    const lh = paraStyle?.lineHeight || defaultLineHeight || 'normal';
    if (flow === '') {
        return `<p style="line-height: ${lh}"></p>`;
    }
    const inner = applyCharStyleAttrsToHtml(flow, paraStyle);
    return `<p style="line-height: ${lh}">${inner}</p>`;
}

/**
 * @param {Document[]} docs
 * @returns {Map<string, { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string }>}
 */
function buildMergedStyleMap(docs) {
    /** @type {Map<string, { parent: string|null, props: { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string } }>} */
    const graph = new Map();
    for (const doc of docs) {
        if (!doc) continue;
        const styles = doc.getElementsByTagNameNS(STYLE_NS, 'style');
        for (let i = 0; i < styles.length; i++) {
            const st = styles[i];
            const name = attrAny(st, 'name');
            if (!name) continue;
            const parent = attrAny(st, 'parent-style-name') || null;
            const tp = st.getElementsByTagNameNS(STYLE_NS, 'text-properties')[0];
            const pp = st.getElementsByTagNameNS(STYLE_NS, 'paragraph-properties')[0];
            const props = { ...readTextPropsFromElement(tp), ...readParagraphPropsFromElement(pp) };
            graph.set(name, { parent, props });
        }
    }
    /** @param {string} name */
    function ancestorPropsMerged(name) {
        /** @type {{ b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string }} */
        const merged = {};
        /** @type {{ b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string }[]} */
        const chain = [];
        let cur = name;
        const seen = new Set();
        while (cur && graph.has(cur) && !seen.has(cur)) {
            seen.add(cur);
            chain.push(graph.get(cur).props);
            cur = graph.get(cur).parent;
        }
        chain.reverse();
        for (let i = 0; i < chain.length; i++) Object.assign(merged, chain[i]);
        return merged;
    }
    /** @type {Map<string, { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string, lineHeight?: string }>} */
    const flat = new Map();
    for (const name of graph.keys()) {
        const merged = ancestorPropsMerged(name);
        if (Object.keys(merged).length) flat.set(name, merged);
    }
    return flat;
}

/** @param {string} raw */
function odfLengthToCssSafe(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(',', '.');
    if (!/^[0-9]+(\.[0-9]+)?(cm|mm|in|pt|pc|px|%)$/i.test(s)) return '';
    return s;
}

/** @param {string} raw absolute length only (no %); returns px for img width/height attributes */
function odfLengthToPxInt(raw) {
    let s = String(raw || '').trim().replace(',', '.');
    if (!s) return NaN;
    const m = s.match(/^([0-9]+(?:\.[0-9]+)?)(cm|mm|in|pt|pc|px)$/i);
    if (!m) return NaN;
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    if (u === 'cm') return Math.round(n * (96 / 2.54));
    if (u === 'mm') return Math.round(n * (96 / 2.54) / 10);
    if (u === 'in') return Math.round(n * 96);
    if (u === 'pt') return Math.round(n * (96 / 72));
    if (u === 'pc') return Math.round(n * 12 * (96 / 72));
    if (u === 'px') return Math.round(n);
    return NaN;
}

/** @param {Element|null|undefined} el */
function pickDrawingWidthRaw(el) {
    if (!el) return '';
    return (
        attrAny(el, 'width') ||
        el.getAttributeNS(SVG_NS, 'width') ||
        el.getAttributeNS(FO_NS, 'width') ||
        ''
    );
}

/** @param {Element|null|undefined} el */
function pickDrawingHeightRaw(el) {
    if (!el) return '';
    return (
        attrAny(el, 'height') ||
        el.getAttributeNS(SVG_NS, 'height') ||
        el.getAttributeNS(FO_NS, 'height') ||
        ''
    );
}

/**
 * @param {Element|null} frameEl draw:frame
 * @param {Element} imgEl draw:image
 * @returns {string} suffix e.g. ` width="400" height="300"` and optional ` style="..."`
 */
function buildImgDimensionHtmlAttrs(frameEl, imgEl) {
    const wRaw = pickDrawingWidthRaw(frameEl) || pickDrawingWidthRaw(imgEl);
    const hRaw = pickDrawingHeightRaw(frameEl) || pickDrawingHeightRaw(imgEl);
    const attrs = [];
    const styleParts = [];
    const wCss = odfLengthToCssSafe(wRaw);
    const hCss = odfLengthToCssSafe(hRaw);
    if (wCss && wCss.endsWith('%')) {
        styleParts.push(`width: ${wCss}`, 'max-width: 100%');
    } else {
        const wPx = odfLengthToPxInt(wRaw);
        if (Number.isFinite(wPx)) attrs.push(`width="${wPx}"`);
        else if (wCss) styleParts.push(`width: ${wCss}`, 'max-width: 100%');
    }
    if (hCss && hCss.endsWith('%')) styleParts.push(`height: ${hCss}`);
    else {
        const hPx = odfLengthToPxInt(hRaw);
        if (Number.isFinite(hPx)) attrs.push(`height="${hPx}"`);
        else if (hCss) styleParts.push(`height: ${hCss}`);
        else if (attrs.some((a) => a.startsWith('width='))) styleParts.push('height: auto');
    }
    let out = attrs.length ? ` ${attrs.join(' ')}` : '';
    if (styleParts.length) out += ` style="${styleParts.join('; ')}"`;
    return out;
}

/** @param {string} href @param {Map<string, Uint8Array>} zip */
function resolveZipPath(href, zip) {
    if (!href) return null;
    let p = href.trim();
    if (p.startsWith('./')) p = p.slice(2);
    const parts = p.split('/').filter(Boolean);
    while (parts[0] === '..') parts.shift();
    const key = parts.join('/');
    if (zip.has(key)) return key;
    const alt = key.replace(/^Pictures\//i, 'Pictures/');
    if (zip.has(alt)) return alt;
    for (const k of zip.keys()) {
        if (k.endsWith(parts[parts.length - 1])) return k;
    }
    return null;
}

/**
 * @param {Element} el
 * @param {Map<string, { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean, color?: string }>} styleMap
 * @param {Map<string, Uint8Array>} zip
 * @param {Map<string, string>} manifestMime
 */
function serializeInline(el, styleMap, zip, manifestMime) {
    const ns = el.namespaceURI;
    const ln = el.localName;
    let inner = '';
    for (let c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
            inner += escapeHtml(c.textContent || '');
        } else if (c.nodeType === 1) {
            inner += serializeInline(/** @type {Element} */ (c), styleMap, zip, manifestMime);
        }
    }
    if (ns === TEXT_NS && ln === 's') {
        const count = parseInt(attrAny(el, 'c') || '1', 10) || 1;
        return escapeHtml(' '.repeat(Math.min(count, 200)));
    }
    if (ns === TEXT_NS && ln === 'tab') return '&#9;';
    if (ns === TEXT_NS && ln === 'line-break') return '<br>';
    if (ns === TEXT_NS && ln === 'a') return inner;
    if (ns === TEXT_NS && ln === 'span') {
        const sn = attrAny(el, 'style-name');
        const st = sn ? styleMap.get(sn) : null;
        return applyCharStyleAttrsToHtml(inner, st);
    }
    if (ns === DRAW_NS && ln === 'frame') {
        const img = el.getElementsByTagNameNS(DRAW_NS, 'image')[0];
        if (!img) return inner;
        const href = attrAny(img, 'href') || img.getAttribute('href') || '';
        const zipPath = resolveZipPath(href.replace(/^#/, ''), zip);
        if (!zipPath) return inner;
        const bytes = zip.get(zipPath);
        if (!bytes) return inner;
        const mime = manifestMime.get(zipPath) || mimeFromPath(zipPath);
        const b64 = bytesToBase64(bytes);
        const sizeSt = buildImgDimensionHtmlAttrs(el, img);
        return `<img src="data:${mime};base64,${b64}" alt=""${sizeSt} />`;
    }
    if (ns === DRAW_NS && ln === 'image') {
        const href = attrAny(el, 'href') || el.getAttribute('href') || '';
        const zipPath = resolveZipPath(href.replace(/^#/, ''), zip);
        if (!zipPath) return '';
        const bytes = zip.get(zipPath);
        if (!bytes) return '';
        const mime = manifestMime.get(zipPath) || mimeFromPath(zipPath);
        const sizeSt = buildImgDimensionHtmlAttrs(null, el);
        return `<img src="data:${mime};base64,${bytesToBase64(bytes)}" alt=""${sizeSt} />`;
    }
    return inner;
}

/** @param {string} s */
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {Element} block
 * @param {Map<string, { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean }>} styleMap
 * @param {Map<string, Uint8Array>} zip
 * @param {Map<string, string>} manifestMime
 */
function serializeFlow(block, styleMap, zip, manifestMime) {
    let html = '';
    for (let n = block.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) html += escapeHtml(n.textContent || '');
        else if (n.nodeType === 1) html += serializeInline(/** @type {Element} */ (n), styleMap, zip, manifestMime);
    }
    return html;
}

/**
 * @param {string} manifestXml
 * @returns {Map<string, string>}
 */
function parseManifestMediaTypes(manifestXml) {
    /** @type {Map<string, string>} */
    const map = new Map();
    try {
        const p = new DOMParser().parseFromString(manifestXml, 'application/xml');
        const entries = p.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:manifest:1.0', 'file-entry');
        for (let i = 0; i < entries.length; i++) {
            const fe = entries[i];
            const path = attrAny(fe, 'full-path');
            const mt = attrAny(fe, 'media-type');
            if (path && mt) map.set(path.replace(/\\/g, '/'), mt);
        }
    } catch {
        /* ignore */
    }
    return map;
}

/**
 * @param {Element} bodyText
 * @param {Map<string, { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean }>} styleMap
 * @param {Map<string, Uint8Array>} zip
 * @param {Map<string, string>} manifestMime
 */
function serializeOfficeText(bodyText, styleMap, defaultLineHeight, zip, manifestMime) {
    let html = '';
    for (let ch = bodyText.firstElementChild; ch; ch = ch.nextElementSibling) {
        const ns = ch.namespaceURI;
        const ln = ch.localName;
        if (ns === TEXT_NS && ln === 'p') {
            const flow = serializeFlow(ch, styleMap, zip, manifestMime);
            const sn = attrAny(ch, 'style-name');
            const pst = sn ? styleMap.get(sn) : undefined;
            html += paragraphHtmlFromFlow(flow, pst, defaultLineHeight);
        } else if (ns === TEXT_NS && ln === 'h') {
            const level = Math.min(6, Math.max(1, parseInt(attrAny(ch, 'outline-level') || '1', 10) || 1));
            const flow = serializeFlow(ch, styleMap, zip, manifestMime);
            const sn = attrAny(ch, 'style-name');
            const pst = sn ? styleMap.get(sn) : undefined;
            const inner = flow === '' ? '' : applyCharStyleAttrsToHtml(flow, pst);
            html += `<h${level}>${inner}</h${level}>`;
        } else if (ns === TEXT_NS && ln === 'list') {
            html += '<ul>';
            const items = childrenNs(ch, TEXT_NS, 'list-item');
            for (let i = 0; i < items.length; i++) {
                const li = items[i];
                html += '<li>';
                for (let c = li.firstElementChild; c; c = c.nextElementSibling) {
                    if (c.namespaceURI === TEXT_NS && c.localName === 'p') {
                        const flow = serializeFlow(c, styleMap, zip, manifestMime);
                        const sn = attrAny(c, 'style-name');
                        const pst = sn ? styleMap.get(sn) : undefined;
                        html += paragraphHtmlFromFlow(flow, pst, defaultLineHeight);
                    } else if (c.namespaceURI === TEXT_NS && c.localName === 'list') {
                        html += serializeOfficeText(c, styleMap, defaultLineHeight, zip, manifestMime);
                    } else if (c.namespaceURI === TABLE_NS && c.localName === 'table') {
                        html += serializeTable(c, styleMap, defaultLineHeight, zip, manifestMime);
                    } else if (c.namespaceURI === DRAW_NS && c.localName === 'frame') {
                        html += serializeInline(c, styleMap, zip, manifestMime);
                    }
                }
                html += '</li>';
            }
            html += '</ul>';
        } else if (ns === TABLE_NS && ln === 'table') {
            html += serializeTable(ch, styleMap, defaultLineHeight, zip, manifestMime);
        } else if (ns === DRAW_NS && ln === 'frame') {
            html += paragraphHtmlFromFlow(serializeInline(ch, styleMap, zip, manifestMime), undefined, defaultLineHeight);
        }
    }
    return html;
}

/**
 * @param {Element} tableEl
 * @param {Map<string, { b?: boolean, i?: boolean, u?: boolean, sup?: boolean, sub?: boolean }>} styleMap
 * @param {Map<string, Uint8Array>} zip
 * @param {Map<string, string>} manifestMime
 */
function serializeTable(tableEl, styleMap, defaultLineHeight, zip, manifestMime) {
    let html = '<table><tbody>';
    const rows = childrenNs(tableEl, TABLE_NS, 'table-row');
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        html += '<tr>';
        const cells = childrenNs(row, TABLE_NS, 'table-cell');
        for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            html += '<td>';
            let had = false;
            for (let x = cell.firstElementChild; x; x = x.nextElementSibling) {
                if (x.namespaceURI === TEXT_NS && x.localName === 'p') {
                    const flow = serializeFlow(x, styleMap, zip, manifestMime);
                    const sn = attrAny(x, 'style-name');
                    const pst = sn ? styleMap.get(sn) : undefined;
                    html += paragraphHtmlFromFlow(flow, pst, defaultLineHeight);
                    had = true;
                } else if (x.namespaceURI === TEXT_NS && x.localName === 'list') {
                    html += serializeOfficeText(x, styleMap, defaultLineHeight, zip, manifestMime);
                    had = true;
                } else if (x.namespaceURI === TABLE_NS && x.localName === 'table') {
                    html += serializeTable(x, styleMap, defaultLineHeight, zip, manifestMime);
                    had = true;
                }
            }
            if (!had) html += paragraphHtmlFromFlow('', undefined, defaultLineHeight);
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

/**
 * Converts ODT bytes to an HTML fragment suitable for TipTap insertContent.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{ html: string, warnings: string[] }>}
 */
export async function odtToTiptapHtml(arrayBuffer) {
    const warnings = [];
    const zip = await unzipToMap(arrayBuffer);
    const contentBytes = zip.get('content.xml');
    if (!contentBytes) throw new Error('ODT missing content.xml');
    const contentXml = utf8Text(contentBytes);
    const contentDoc = new DOMParser().parseFromString(contentXml, 'application/xml');
    const parseErr = contentDoc.getElementsByTagName('parsererror')[0];
    if (parseErr) {
        warnings.push('content.xml parse warning');
    }
    const stylesBytes = zip.get('styles.xml');
    /** @type {Document[]} */
    const styleDocs = [contentDoc];
    if (stylesBytes) {
        try {
            const sd = new DOMParser().parseFromString(utf8Text(stylesBytes), 'application/xml');
            styleDocs.push(sd);
        } catch {
            warnings.push('styles.xml skipped');
        }
    }
    const styleMap = buildMergedStyleMap(styleDocs);
    const defaultLineHeight = readDefaultParagraphLineHeight(styleDocs);
    let manifestMime = new Map();
    const man = zip.get('META-INF/manifest.xml');
    if (man) manifestMime = parseManifestMediaTypes(utf8Text(man));
    const bodies = contentDoc.getElementsByTagNameNS(OFFICE_NS, 'body');
    const body = bodies[0];
    if (!body) throw new Error('ODT missing office:body');
    const texts = body.getElementsByTagNameNS(OFFICE_NS, 'text');
    const officeText = texts[0];
    if (!officeText) {
        warnings.push('office:text missing');
        return { html: '<p></p>', warnings };
    }
    const html = serializeOfficeText(officeText, styleMap, defaultLineHeight, zip, manifestMime);
    return { html: html || '<p></p>', warnings };
}
