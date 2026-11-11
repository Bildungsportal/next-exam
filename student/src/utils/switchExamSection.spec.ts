import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SECTION_SWITCH_SAVE_TIMEOUT_MS,
    SECTION_SWITCH_BACKUP_SAVE_EXAMTYPES,
    flushSectionSwitchBackup,
    isSectionSwitchRunning,
    switchExamSectionFiles,
} from './switchExamSection.js';

// ---------------------------------------------------------------------------
// Mocks (same conventions as src/utils/ios/IosExamFileService.spec.ts)
// ---------------------------------------------------------------------------

const fsMocks = vi.hoisted(() => ({
    mkdir: vi.fn(),
    readdir: vi.fn(),
    copy: vi.fn(),
    deleteFile: vi.fn(),
}));

vi.mock('./loggingBridge.js', () => ({
    default: { debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
    Directory: { Documents: 'Documents' },
    Filesystem: {
        mkdir: fsMocks.mkdir,
        readdir: fsMocks.readdir,
        copy: fsMocks.copy,
        deleteFile: fsMocks.deleteFile,
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Installs the iOS-style ipcRenderer shim that boot/main.ts only creates on
 * iOS. The real Window type only declares send/sendSync/invoke/on/etc., and
 * the module under test reads `(window as any).ipcRenderer`.
 */
function installIpcShim() {
    (window as any).ipcRenderer = {
        on: (channel: string, cb: (args: any) => void) => {
            const handler = (event: Event) => {
                const detail = (event as CustomEvent).detail;
                if (detail?.channel === channel) cb(detail.args);
            };
            window.addEventListener('ipc-message', handler);
            return () => window.removeEventListener('ipc-message', handler);
        },
    };
}

/** Simulates a page replying via the same route the pages use. */
function dispatchSectionSwitchSaveDone(ok: boolean) {
    window.dispatchEvent(new CustomEvent('ipc-message', {
        detail: { channel: 'section-switch-save-done', args: [ok] },
    }));
}

// ---------------------------------------------------------------------------
// flushSectionSwitchBackup
// ---------------------------------------------------------------------------

describe('flushSectionSwitchBackup', () => {
    beforeEach(() => {
        installIpcShim();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves true immediately for non-backup examtypes without dispatching ipc-message', async () => {
        const spy = vi.fn();
        window.addEventListener('ipc-message' as any, spy);
        try {
            for (const examtype of ['website', 'forms', 'rdp', 'microsoft365']) {
                await expect(flushSectionSwitchBackup(examtype)).resolves.toBe(true);
            }
        } finally {
            window.removeEventListener('ipc-message' as any, spy);
        }
        expect(spy).not.toHaveBeenCalled();
    });

    it('dispatches exactly one save-for-section-switch ipc-message per backup examtype', async () => {
        const spy = vi.fn();
        window.addEventListener('ipc-message' as any, spy);
        try {
            for (const examtype of SECTION_SWITCH_BACKUP_SAVE_EXAMTYPES) {
                spy.mockClear();
                const pending = flushSectionSwitchBackup(examtype);

                expect(spy).toHaveBeenCalledTimes(1);
                const event = spy.mock.calls[0][0] as CustomEvent;
                expect(event.type).toBe('ipc-message');
                expect(event.detail.channel).toBe('save-for-section-switch');
                expect(event.detail.args).toEqual([examtype]);

                // settle the pending flush so its 10s timer does not leak
                dispatchSectionSwitchSaveDone(true);
                await expect(pending).resolves.toBe(true);
            }
        } finally {
            window.removeEventListener('ipc-message' as any, spy);
        }
    });

    it('resolves true when the page replies with args [true]', async () => {
        const pending = flushSectionSwitchBackup('editor');
        dispatchSectionSwitchSaveDone(true);
        await expect(pending).resolves.toBe(true);
    });

    it('resolves false when the page replies with args [false]', async () => {
        const pending = flushSectionSwitchBackup('math');
        dispatchSectionSwitchSaveDone(false);
        await expect(pending).resolves.toBe(false);
    });

    it('resolves true after the 10s timeout when no reply arrives', async () => {
        vi.useFakeTimers();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const pending = flushSectionSwitchBackup('activesheets');
        await vi.advanceTimersByTimeAsync(SECTION_SWITCH_SAVE_TIMEOUT_MS);

        await expect(pending).resolves.toBe(true);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('cleans up its ipcRenderer.on listener after resolution', async () => {
        const cleanups: Array<ReturnType<typeof vi.fn>> = [];
        const onSpy = vi.fn((channel: string, cb: (args: any) => void) => {
            const handler = (event: Event) => {
                const detail = (event as CustomEvent).detail;
                if (detail?.channel === channel) cb(detail.args);
            };
            window.addEventListener('ipc-message', handler);
            const cleanup = vi.fn(() => window.removeEventListener('ipc-message', handler));
            cleanups.push(cleanup);
            return cleanup;
        });
        (window as any).ipcRenderer = { on: onSpy };

        const pending = flushSectionSwitchBackup('editor');
        expect(onSpy).toHaveBeenCalledTimes(1);
        expect(onSpy).toHaveBeenCalledWith('section-switch-save-done', expect.any(Function));
        const cleanup = cleanups[0];
        expect(cleanup).toBeTypeOf('function');

        dispatchSectionSwitchSaveDone(true);
        await expect(pending).resolves.toBe(true);

        // listener was removed once the promise settled
        expect(cleanup).toHaveBeenCalledTimes(1);

        // a second reply must not re-enter the settled promise / must not throw
        expect(() => dispatchSectionSwitchSaveDone(true)).not.toThrow();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('lets two overlapping flushes both resolve correctly from their replies', async () => {
        const p1 = flushSectionSwitchBackup('editor');
        const p2 = flushSectionSwitchBackup('math');

        dispatchSectionSwitchSaveDone(true);
        dispatchSectionSwitchSaveDone(true);

        await expect(p1).resolves.toBe(true);
        await expect(p2).resolves.toBe(true);
    });
});

// ---------------------------------------------------------------------------
// switchExamSectionFiles
// ---------------------------------------------------------------------------

describe('switchExamSectionFiles', () => {
    beforeEach(() => {
        fsMocks.mkdir.mockReset().mockResolvedValue({ uri: '' });
        fsMocks.readdir.mockReset().mockResolvedValue({ files: [] });
        fsMocks.copy.mockReset().mockResolvedValue({ uri: '' });
        fsMocks.deleteFile.mockReset().mockResolvedValue({ uri: '' });
    });

    it('returns true and performs save + load file ops when preSave is not provided', async () => {
        fsMocks.readdir
            // save phase: examDir contains one file and one (skipped) directory
            .mockResolvedValueOnce({ files: [{ name: 'a.txt', type: 'file' }, { name: 'sub', type: 'directory' }] })
            // load phase: new section contains one file
            .mockResolvedValueOnce({ files: [{ name: 'b.txt', type: 'file' }] });

        const result = await switchExamSectionFiles('exam', 1, 2);

        expect(result).toBe(true);
        expect(fsMocks.mkdir).toHaveBeenCalledTimes(1);
        expect(fsMocks.mkdir).toHaveBeenCalledWith({ path: 'exam/1', directory: 'Documents', recursive: true });
        expect(fsMocks.readdir).toHaveBeenCalledTimes(2);
        expect(fsMocks.readdir).toHaveBeenNthCalledWith(1, { path: 'exam', directory: 'Documents' });
        expect(fsMocks.readdir).toHaveBeenNthCalledWith(2, { path: 'exam/2', directory: 'Documents' });
        expect(fsMocks.copy).toHaveBeenCalledTimes(2);
        expect(fsMocks.copy).toHaveBeenCalledWith({ from: 'exam/a.txt', to: 'exam/1/a.txt', directory: 'Documents', toDirectory: 'Documents' });
        expect(fsMocks.copy).toHaveBeenCalledWith({ from: 'exam/2/b.txt', to: 'exam/b.txt', directory: 'Documents', toDirectory: 'Documents' });
        expect(fsMocks.deleteFile).toHaveBeenCalledTimes(1);
        expect(fsMocks.deleteFile).toHaveBeenCalledWith({ path: 'exam/a.txt', directory: 'Documents' });
    });

    it('returns false without any file ops when preSave resolves false', async () => {
        const preSave = vi.fn(async () => false);

        const result = await switchExamSectionFiles('exam', 1, 2, preSave);

        expect(result).toBe(false);
        expect(preSave).toHaveBeenCalledTimes(1);
        expect(fsMocks.mkdir).not.toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(fsMocks.copy).not.toHaveBeenCalled();
        expect(fsMocks.deleteFile).not.toHaveBeenCalled();
        expect(isSectionSwitchRunning()).toBe(false);
    });

    it('returns true and performs file ops when preSave resolves true', async () => {
        const preSave = vi.fn(async () => true);
        fsMocks.readdir.mockResolvedValue({ files: [{ name: 'a.txt', type: 'file' }] });

        const result = await switchExamSectionFiles('exam', 1, 2, preSave);

        expect(result).toBe(true);
        expect(preSave).toHaveBeenCalledTimes(1);
        expect(fsMocks.readdir).toHaveBeenCalledTimes(2);
        expect(fsMocks.copy).toHaveBeenCalledTimes(2);
        expect(fsMocks.deleteFile).toHaveBeenCalledTimes(1);
    });

    it('returns true when the new section directory does not exist (starting clean)', async () => {
        fsMocks.readdir
            .mockResolvedValueOnce({ files: [{ name: 'a.txt', type: 'file' }] }) // save phase succeeds
            .mockRejectedValueOnce(new Error('directory does not exist'));       // load phase rejects

        const result = await switchExamSectionFiles('exam', 1, 2);

        expect(result).toBe(true);
        // save phase completed, but nothing was loaded
        expect(fsMocks.copy).toHaveBeenCalledTimes(1);
        expect(fsMocks.deleteFile).toHaveBeenCalledTimes(1);
    });

    it('returns true without any file ops when examDir is empty', async () => {
        const result = await switchExamSectionFiles('', 1, 2);

        expect(result).toBe(true);
        expect(fsMocks.mkdir).not.toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(fsMocks.copy).not.toHaveBeenCalled();
        expect(fsMocks.deleteFile).not.toHaveBeenCalled();
    });

    it('leaves isSectionSwitchRunning false before and after the call', async () => {
        expect(isSectionSwitchRunning()).toBe(false);

        const result = await switchExamSectionFiles('exam', 1, 2);

        expect(result).toBe(true);
        expect(isSectionSwitchRunning()).toBe(false);
    });

    it('returns false (abort) when a previous shuffle is still running instead of falsely reporting success', async () => {
        let releaseReaddir!: (value: any) => void;
        fsMocks.readdir.mockReturnValueOnce(new Promise((resolve) => { releaseReaddir = resolve; }));

        const first = switchExamSectionFiles('exam', 1, 2);
        // Let the first call reach the (hanging) save-phase readdir.
        await Promise.resolve();
        await Promise.resolve();

        const duplicate = await switchExamSectionFiles('exam', 1, 2);
        expect(duplicate).toBe(false);
        // The duplicate aborted before any file ops; the first call is still pending on its readdir.
        expect(fsMocks.copy).not.toHaveBeenCalled();
        expect(fsMocks.readdir).toHaveBeenCalledTimes(1);

        releaseReaddir({ files: [] });
        await first;

        // The abandoned first shuffle completed, so _running was cleared in `finally`.
        expect(isSectionSwitchRunning()).toBe(false);
    });
});
