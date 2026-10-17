import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';

const infoState = vi.hoisted(() => ({
    exammode: false,
    clientname: 'alex',
    token: 'tok-123',
    lastExamWriteSaveReason: '',
    numberOfFiles: 0,
    encryptionPassword: '',
    localLockdown: false,
    password: '',
    serverip: '',
    servername: '',
}));
const configState = vi.hoisted(() => ({ examdirectory: '', serverApiPort: 22422 }));
const switchRunning = vi.hoisted(() => vi.fn(() => false));
const checkPathExists = vi.hoisted(() => vi.fn(async () => true));
const sendToTeacher = vi.hoisted(() => vi.fn(async () => {}));
const apiFetch = vi.hoisted(() => vi.fn());
const fsData = vi.hoisted(() => ({ files: new Map(), dirs: new Set() }));
const mockCrypto = vi.hoisted(() => {
    const MAGIC = 'NXE1MOCK|';
    const toStr = (u8) => String.fromCharCode(...u8);
    const encrypt = (plain, pw) => new TextEncoder().encode(MAGIC + btoa(toStr(plain)));
    const decrypt = (cipher, pw) => Uint8Array.from(atob(new TextDecoder().decode(cipher).slice(MAGIC.length)), c => c.charCodeAt(0));
    const isEnc = (raw) => new TextDecoder().decode(raw.slice(0, MAGIC.length)) === MAGIC;
    return { MAGIC, encrypt, decrypt, isEnc };
});

vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../../stores/configStore.js', () => ({ useConfigStore: () => configState }));
vi.mock('../loggingBridge.js', () => ({ default: { debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../switchExamSection.ts', () => ({ isSectionSwitchRunning: switchRunning }));
vi.mock('../commonMethods.js', () => ({
    checkPathExists,
    readUint8Array: async ({ path }) => {
        const data = fsData.files.get(path);
        if (data === undefined) {
            const err = new Error('File does not exist');
            err.code = 'ENOENT';
            throw err;
        }
        return Uint8Array.from(atob(data), c => c.charCodeAt(0));
    },
}));
vi.mock('@capacitor/filesystem', () => ({
    Directory: { Documents: 'Documents' },
    Filesystem: {
        writeFile: vi.fn(async ({ path, data }) => { fsData.files.set(path, data); return { uri: path }; }),
        readFile: vi.fn(async ({ path }) => {
            const data = fsData.files.get(path);
            if (data === undefined) {
                const err = new Error('File does not exist');
                err.code = 'ENOENT';
                throw err;
            }
            return { data };
        }),
        readdir: vi.fn(async ({ path }) => {
            const entries = [];
            const prefix = `${path.replace(/\/+$/, '')}/`;
            for (const dir of fsData.dirs) {
                if (dir.startsWith(prefix) && !dir.slice(prefix.length).includes('/')) {
                    entries.push({ name: dir.slice(prefix.length), type: 'directory' });
                }
            }
            for (const file of fsData.files.keys()) {
                if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) {
                    entries.push({ name: file.slice(prefix.length), type: 'file' });
                }
            }
            return { files: entries };
        }),
        stat: vi.fn(async () => ({ mtime: 1767225600000 })),
        mkdir: vi.fn(async ({ path }) => { fsData.dirs.add(path); return { uri: path }; }),
    },
}));
vi.mock('../../../../shared/examFileCryptoCore.js', () => ({
    isExamFileEncryptedBytes: (raw) => mockCrypto.isEnc(raw),
    encryptExamFileBytes: (plain, pw) => mockCrypto.encrypt(plain, pw),
    decryptExamFileAllLayers: (cipher, pw) => mockCrypto.isEnc(cipher) ? mockCrypto.decrypt(cipher, pw) : cipher,
}));
vi.mock('../../../../shared/examApiFetch.js', () => ({ examApiFetch: apiFetch }));
vi.mock('../../../src-electron/main/scripts/examFileCrypto.js', () => ({
    decryptExamFileAllLayersAsync: async (cipher, pw) => mockCrypto.isEnc(cipher) ? mockCrypto.decrypt(cipher, pw) : cipher,
}));
vi.mock('mammoth', () => ({ default: { convertToHtml: vi.fn(async () => ({})) } }));
vi.mock('../../locales/locales.js', () => ({ default: { global: { t: (key) => key } } }));
vi.mock('./IosSubmissionService.js', () => ({ default: { sendToTeacher } }));

import fileService from './IosExamFileService.js';
import { isExamFileEncryptedBytes } from '../../../../shared/examFileCryptoCore.js';

const b64 = (u8) => btoa(String.fromCharCode(...u8));

describe('IosExamFileService', () => {
    beforeEach(() => {
        fsData.files.clear();
        fsData.dirs.clear();
        infoState.exammode = false;
        infoState.clientname = 'alex';
        infoState.token = 'tok-123';
        infoState.lastExamWriteSaveReason = '';
        infoState.numberOfFiles = 0;
        infoState.encryptionPassword = '';
        infoState.localLockdown = false;
        infoState.password = '';
        configState.examdirectory = '';
        switchRunning.mockReturnValue(false);
        checkPathExists.mockResolvedValue(true);
        sendToTeacher.mockReset();
    });

    describe('resolveWritablePathUnderExamDir', () => {
        it('blocks path traversal and unsafe names', () => {
            expect(fileService.resolveWritablePathUnderExamDir('exam', '../evil.htm', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', 'a/b.htm', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', 'a\\b.htm', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', '..', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', '.', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', '', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', 'CON.htm', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', 'notes.txt', ['.htm'])).toBeNull();
            expect(fileService.resolveWritablePathUnderExamDir('exam', null, ['.htm'])).toBeNull();
        });

        it('accepts a valid single-segment filename with a matching extension', () => {
            expect(fileService.resolveWritablePathUnderExamDir('exam', 'notes.htm', ['.htm'])).toBe('exam/notes.htm');
            expect(fileService.resolveWritablePathUnderExamDir('exam/', 'notes.htm', ['.htm'])).toBe('exam/notes.htm');
            expect(fileService.resolveWritablePathUnderExamDir('exam', 'data.txt')).toBe('exam/data.txt');
        });
    });

    describe('resolveExamDecryptPassword', () => {
        it('prefers the exam encryption password', () => {
            infoState.encryptionPassword = '  abc  ';
            expect(fileService.resolveExamDecryptPassword()).toBe('abc');
        });

        it('falls back to the local lockdown password', () => {
            infoState.localLockdown = true;
            infoState.password = '  pw  ';
            expect(fileService.resolveExamDecryptPassword()).toBe('pw');
        });

        it('returns an empty key outside exam mode', () => {
            expect(fileService.resolveExamDecryptPassword()).toBe('');
        });
    });

    describe('encryptExamFileBytesUnlessAlready', () => {
        it('encrypts plaintext with a password and leaves ciphertext untouched', () => {
            const plain = new TextEncoder().encode('hello');
            const enc = fileService.encryptExamFileBytesUnlessAlready(plain, 'pw');

            expect(isExamFileEncryptedBytes(enc)).toBe(true);
            expect(fileService.encryptExamFileBytesUnlessAlready(enc, 'pw')).toBe(enc);
        });

        it('writes plaintext when no key is set', () => {
            const plain = new TextEncoder().encode('hello');
            expect(fileService.encryptExamFileBytesUnlessAlready(plain, '')).toBe(plain);
        });
    });

    describe('isExamDirWriteBlocked', () => {
        it('blocks writes during a section switch except for section-switch saves', () => {
            switchRunning.mockReturnValue(true);
            expect(fileService.isExamDirWriteBlocked('auto')).toBe(true);
            expect(fileService.isExamDirWriteBlocked('sectionswitch')).toBe(false);

            switchRunning.mockReturnValue(false);
            expect(fileService.isExamDirWriteBlocked('auto')).toBe(false);
        });
    });

    describe('storeHTML', () => {
        it('writes an encrypted backup file and asks for a file-list reload', async () => {
            configState.examdirectory = 'exam';
            infoState.encryptionPassword = 'pw';

            const result = await fileService.storeHTML('backup', '<p>hi</p>', 'manual');

            expect(result).toEqual({ returnSignal: 'loadfilelist', args: {} });
            const written = fsData.files.get('exam/backup.htm');
            expect(written).toBeDefined();
            expect(isExamFileEncryptedBytes(Uint8Array.from(atob(written), c => c.charCodeAt(0)))).toBe(true);
            expect(infoState.lastExamWriteSaveReason).toBe('manual');
        });
    });

    describe('getPdfAsync', () => {
        it('decrypts an encrypted exam PDF', async () => {
            configState.examdirectory = 'exam';
            infoState.encryptionPassword = 'pw';
            const plain = new TextEncoder().encode('%PDF-1.4 fake pdf');
            fsData.files.set('exam/doc.pdf', b64(mockCrypto.encrypt(plain, 'pw')));

            const result = await fileService.getPdfAsync('doc.pdf');

            expect(result).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(result)).toBe('%PDF-1.4 fake pdf');
        });

        it('rejects an unsafe filename', async () => {
            configState.examdirectory = 'exam';
            expect(await fileService.getPdfAsync('../doc.pdf')).toBe(false);
        });
    });

    describe('getBackupFile', () => {
        it('returns decrypted backup HTML', async () => {
            configState.examdirectory = 'exam';
            infoState.encryptionPassword = 'pw';
            fsData.files.set('exam/backup.htm', b64(mockCrypto.encrypt(new TextEncoder().encode('<p>backup</p>'), 'pw')));

            expect(await fileService.getBackupFile('backup.htm')).toBe('<p>backup</p>');
        });

        it('returns false for a missing backup file', async () => {
            configState.examdirectory = 'exam';
            expect(await fileService.getBackupFile('nope.htm')).toBe(false);
        });

        it('returns false without a filename', async () => {
            expect(await fileService.getBackupFile('')).toBe(false);
        });
    });

    describe('getFilesAsync', () => {
        it('lists exam-directory files with their types', async () => {
            configState.examdirectory = 'exam';
            fsData.files.set('exam/a.pdf', b64(new TextEncoder().encode('%PDF')));
            fsData.files.set('exam/b.htm', b64(new TextEncoder().encode('<p>b</p>')));
            fsData.files.set('exam/c.ggb', b64(new TextEncoder().encode('ggb')));
            fsData.files.set('exam/d.mp3', b64(new TextEncoder().encode('mp3')));
            fsData.files.set('exam/sub/x.jpg', b64(new TextEncoder().encode('nested')));

            const list = await fileService.getFilesAsync(null);

            expect(list).toEqual([
                { name: 'a.pdf', type: 'pdf', mod: 1767225600000 },
                { name: 'b.htm', type: 'htm', mod: 1767225600000 },
                { name: 'c.ggb', type: 'ggb', mod: 1767225600000 },
                { name: 'd.mp3', type: 'audio', mod: 1767225600000 },
            ]);
            expect(infoState.numberOfFiles).toBe(4);
        });

        it('reads and decrypts a single HTML file', async () => {
            configState.examdirectory = 'exam';
            infoState.encryptionPassword = 'pw';
            fsData.files.set('exam/notes.htm', b64(mockCrypto.encrypt(new TextEncoder().encode('<p>notes</p>'), 'pw')));

            expect(await fileService.getFilesAsync('notes.htm')).toBe('<p>notes</p>');
        });
    });

    describe('requestFilesFromServer', () => {
        beforeEach(() => {
            configState.examdirectory = 'exam';
            infoState.serverip = '192.168.1.10';
            infoState.servername = 'math';
            infoState.token = 'tok-123';
        });

        it('downloads, unzips and stores teacher-sent files into the exam directory', async () => {
            const plain = new TextEncoder().encode('<p>hello</p>');
            apiFetch.mockResolvedValue({
                arrayBuffer: async () => zipSync({'hello.htm': plain}).buffer,
            });

            await fileService.requestFilesFromServer();

            expect(apiFetch).toHaveBeenCalledTimes(1);
            const [url, init] = apiFetch.mock.calls[0];
            expect(url).toBe('https://192.168.1.10:22422/server/data/download/math');
            expect(init.method).toBe('POST');
            expect(init.headers.Authorization).toBe('Bearer tok-123');
            expect(init.body).toBe(JSON.stringify({type: 'studentfilerequest'}));
            expect(fsData.files.get('exam/hello.htm')).toBe(b64(plain));
        });

        it('asks the editor to load the backup when a .htm file is sent during exam mode', async () => {
            infoState.exammode = true;
            const dispatchEvent = vi.fn();
            vi.stubGlobal('window', {dispatchEvent});
            vi.stubGlobal('CustomEvent', class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } });
            apiFetch.mockResolvedValue({
                arrayBuffer: async () => zipSync({'sheet.htm': new TextEncoder().encode('<p>x</p>')}).buffer,
            });

            await fileService.requestFilesFromServer();

            expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
                detail: {channel: 'backup', args: 'sheet.htm'},
            }));
            expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
                detail: {channel: 'loadfilelist'},
            }));
        });
    });
});
