// Font adjustments and helpers for pdfparser

export const fontAdjustments = {
    'SegoeUISymbol': {
        family: 'notosanssymbols, sans-serif',
        scale: 1,
    },
    'SymbolMT': {
        family: 'dejavuserif, Symbol, serif',
        scale: 1,
    },
    'Cambria': {
        family: 'caladea, sans-serif',
        scale: 1,
    },
    'CambriaMath': {
        family: 'Latin-Modern-Math, sans-serif',
        scale: 1,
    },
    'calibri-bold': {
        family: 'carlito-bold, sans-serif',
        scale: 1,
    },
    'Calibri': {
        family: 'carlito-regular, sans-serif',
        scale: 1,
    },
    'calibri-italic': {
        family: 'carlito-italic, sans-serif',
        scale: 1,
    },
    'calibri-bold-italic': {
        family: 'carlito-bold-italic, sans-serif',
        scale: 1,
    },
    NotoSansRegular: {
        family: 'sans-serif',
        scale: 1,
    },
    'NotoSans-Regular': {
        family: 'sans-serif',
        scale: 1,
    },
    LiberationSans: {
        family: 'sans-serif',
        scale: 1,
    },
    'HelveticaNeueLTPro-Lt': {
        family: 'hv, Helvetica Neue, Helvetica, Arial, sans-serif',
        scale: 1,
    },
    ArialMT: {
        family: 'Arial, Helvetica, sans-serif',
        scale: 1,
    },
    TimesNewRomanPSMT: {
        family: 'Times New Roman, Times, serif',
        scale: 1,
    },
    'MS-Mincho': {
        family: 'sans-serif',
        scale: 1,
    },

    'PoloBasisTB-Leicht': {
        family: 'Arial, Helvetica, sans-serif',
        scale: 1,
        kerningCompensationEm: 0.022,
        encoding: {
            baseEncoding: 'WinAnsiEncoding',
            differences: {
                26: 0,
                27: 1,
                28: 2,
                29: 3,
                30: 4,
                31: 5,
            },
        },
        glyphWidths: {
            widths: [486, 567, 567, 595, 486, 486, 243, 0, 0, 0, 495, 0, 587, 0, 324, 324, 0, 486, 203, 277, 203, 375, 486, 412, 486, 486, 486, 486, 486, 465, 486, 486, 243, 220, 486, 486, 486, 385, 0, 587, 608, 547, 628, 527, 466, 628, 648, 0, 284, 547, 466, 830, 648, 648, 527, 648, 567, 527, 466, 628, 547, 830, 526, 506, 506, 284, 0, 284, 0, 608, 0, 506, 547, 446, 547, 506, 324, 542, 547, 243, 223, 466, 243, 830, 547, 527, 547, 547, 344, 425, 344, 527, 466, 749, 446, 446, 446, 0, 283, 0, 0, 0, 0, 0, 0, 0, 319, 1009, 0, 0, 0, 1142, 0, 0, 0, 0, 0, 0, 0, 0, 0, 319, 0, 0, 486, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 883, 0, 0, 0, 0, 0, 0, 342, 0, 301, 0, 0, 0, 0, 283, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 587, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 648, 0, 668, 0, 0, 0, 628, 0, 0, 567, 0, 0, 0, 0, 506, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 527, 0, 0, 0, 0, 0, 527],
            firstChar: 26,
            lastChar: 252,
        },
    },
    'PoloBasisTB-Krftg': {
        family: 'Arial, Helvetica, sans-serif',
        scale: 1,
        kerningCompensationEm: 0.022,
        encoding: {
            baseEncoding: 'WinAnsiEncoding',
            differences: {
                27: 0,
                28: 1,
                29: 2,
                30: 3,
                31: 4,
            },
        },
        glyphWidths: {
            widths: [596, 599, 486, 486, 598, 243, 311, 0, 0, 0, 770, 0, 0, 321, 321, 0, 486, 235, 287, 235, 387, 486, 412, 486, 486, 486, 486, 486, 470, 486, 486, 263, 253, 486, 486, 486, 405, 0, 600, 608, 524, 633, 527, 487, 632, 641, 295, 294, 574, 468, 858, 652, 625, 556, 618, 567, 525, 470, 628, 556, 854, 0, 0, 496, 0, 0, 0, 0, 0, 0, 507, 547, 415, 545, 506, 333, 529, 547, 253, 253, 508, 253, 833, 547, 526, 545, 545, 351, 435, 355, 537, 454, 739, 473, 456, 431, 0, 0, 0, 0, 0, 0, 0, 0, 0, 351, 1339, 0, 0, 0, 1134, 0, 0, 0, 0, 0, 0, 0, 0, 0, 375, 0, 0, 486, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 337, 0, 336, 336, 0, 0, 0, 303, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 600, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 625, 0, 0, 0, 0, 0, 628, 0, 0, 572, 0, 0, 0, 0, 507, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 526, 0, 0, 0, 0, 0, 537],
            firstChar: 27,
            lastChar: 252,
        },
    },
};

export const fontMethods = {
    /**
     * Retrieve font info from PDF.js common objects.
     */
    getFontInfo(page, fontName) {
        if (!page || !fontName) return null;
        const commonObjs = page.commonObjs;
        if (!commonObjs) return null;
        const stores = [commonObjs._objs, commonObjs._objMap, commonObjs._objCache];
        const keyCandidates = new Set([fontName, `font_${fontName}`]);
        let entry = null;

        if (typeof commonObjs.get === 'function') {
            try {
                const direct = commonObjs.get(fontName);
                if (direct) {
                    return this.formatFontInfo(direct);
                }
            } catch (err) {
                if (this.debugClozeFonts) {
                    console.log(`pdfparser @ getFontInfo: commonObjs.get(${fontName}) failed`, err);
                }
            }
        }

        for (const store of stores) {
            if (!store) continue;
            const fetchFromStore = (key) => (typeof store.get === 'function' ? store.get(key) : store[key]);
            for (const key of [...keyCandidates]) {
                entry = fetchFromStore(key);
                if (entry) break;
            }
            if (!entry && typeof store === 'object') {
                const keys = Object.keys(store);
                for (const key of keys) {
                    if (entry) break;
                    const value = store[key];
                    const actualKey = typeof key === 'string' ? key : `${key}`;
                    if (
                        actualKey === fontName ||
                        actualKey === `font_${fontName}` ||
                        actualKey.startsWith(fontName) ||
                        (value?.data?.loadedName && value.data.loadedName === fontName)
                    ) {
                        entry = value;
                        keyCandidates.add(actualKey);
                    }
                }
            }
            if (entry) break;
        }

        if (!entry) {
            return null;
        }
        if (!entry.data && entry.promise && typeof entry.promise.then === 'function') {
            if (!this.pendingFontLogs.has(fontName)) {
                this.pendingFontLogs.add(fontName);
                entry.promise
                    .then(() => {
                        this.pendingFontLogs.delete(fontName);
                    })
                    .catch(() => this.pendingFontLogs.delete(fontName));
            }
            if (this.debugClozeFonts) {
                console.log(`pdfparser @ getFontInfo: font ${fontName} still loading, will log once ready`);
            }
            return null;
        }
        return this.formatFontInfo(entry);
    },

    /**
     * Normalize font info structure.
     */
    formatFontInfo(entry) {
        const data = entry?.data || entry;
        if (!data) return null;

        const baseName = data.name || data.loadedName || data.baseFont;
        const fallback = data.fallbackName || data.systemFontFamily;
        const isEmbedded = baseName && fallback ? baseName !== fallback : Boolean(data.data);
        const isSubset = typeof baseName === 'string' ? /^[A-Z0-9]{6}\+/.test(baseName) : false;
        const fontType = data.type;
        return {
            baseFont: baseName,
            fontName: data.loadedName || baseName,
            family: fallback,
            isEmbedded,
            isSubset,
            fontType,
        };
    },

    /**
     * Find custom adjustment by font name (including subset prefixes).
     */
    findFontAdjustmentByName(name) {
        if (!name) return null;
        const cleanName = name.replace(/^[A-Z0-9]{6}\+/, '');
        for (const [key, value] of Object.entries(this.fontAdjustments)) {
            if (key === name || key === cleanName || key.includes(cleanName) || cleanName.includes(key)) {
                return value;
            }
        }
        return null;
    },
};
