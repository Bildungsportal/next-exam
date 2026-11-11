import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeBackupCopyWithPdf } from './backupSaveService.js';

const FILENAME = 'exam-backup';
const EDITOR_CONTENT = '<html>content</html>';
const WHY = 'sectionswitch';

/** Returns { promise, resolve } for controlling async steps manually. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

describe('storeBackupCopyWithPdf', () => {
    let io: {
        writeHtml: ReturnType<typeof vi.fn>;
        writePdf: ReturnType<typeof vi.fn>;
        reloadFileList: ReturnType<typeof vi.fn>;
        onPdfError: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        io = {
            writeHtml: vi.fn(async () => undefined),
            writePdf: vi.fn(async () => ({ ok: true })),
            reloadFileList: vi.fn(async () => undefined),
            onPdfError: vi.fn(),
        };
    });

    it('happy path: writeHtml then writePdf then reloadFileList after writePdf resolves, returns true', async () => {
        const writePdfDeferred = deferred<{ ok: boolean }>();
        io.writePdf.mockReturnValue(writePdfDeferred.promise);

        const resultPromise = storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io });

        expect(io.writeHtml).toHaveBeenCalledTimes(1);
        expect(io.writeHtml).toHaveBeenCalledWith({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY });
        expect(io.writePdf).not.toHaveBeenCalled();
        expect(io.reloadFileList).not.toHaveBeenCalled();

        writePdfDeferred.resolve({ ok: true });
        await expect(resultPromise).resolves.toBe(true);

        expect(io.writePdf).toHaveBeenCalledTimes(1);
        expect(io.writePdf).toHaveBeenCalledWith({ filename: FILENAME, why: WHY });
        expect(io.reloadFileList).toHaveBeenCalledTimes(1);
        expect(io.writePdf.mock.invocationCallOrder[0]).toBeLessThan(io.reloadFileList.mock.invocationCallOrder[0]);
    });

    it('writePdf is not called until writeHtml resolves', async () => {
        const writeHtmlDeferred = deferred<void>();
        io.writeHtml.mockReturnValue(writeHtmlDeferred.promise);

        const resultPromise = storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io });

        expect(io.writeHtml).toHaveBeenCalledTimes(1);
        expect(io.writePdf).not.toHaveBeenCalled();

        writeHtmlDeferred.resolve();
        await expect(resultPromise).resolves.toBe(true);
        expect(io.writePdf).toHaveBeenCalledTimes(1);
    });

    it('pdf failure: onPdfError called with (result, why), reloadFileList NOT called, returns false', async () => {
        const pdfResult = { ok: false, error: { message: 'boom' } };
        io.writePdf.mockResolvedValue(pdfResult);

        const result = await storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io });

        expect(result).toBe(false);
        expect(io.onPdfError).toHaveBeenCalledTimes(1);
        expect(io.onPdfError).toHaveBeenCalledWith(pdfResult, WHY);
        expect(io.reloadFileList).not.toHaveBeenCalled();
    });

    it('reloadFileList is awaited: returns true only after it resolves', async () => {
        const reloadDeferred = deferred<void>();
        io.reloadFileList.mockReturnValue(reloadDeferred.promise);

        const resultPromise = storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io });

        // writeHtml + writePdf already settled; still pending on reloadFileList.
        let settled = false;
        resultPromise.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);

        reloadDeferred.resolve();
        await expect(resultPromise).resolves.toBe(true);
        expect(settled).toBe(true);
    });

    it('reloadFileList is optional: returns true when io has no reloadFileList', async () => {
        const ioWithoutReload = { ...io };
        delete ioWithoutReload.reloadFileList;

        await expect(
            storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io: ioWithoutReload }),
        ).resolves.toBe(true);
    });

    it('onPdfError is optional: pdf failure returns false without throwing', async () => {
        const ioWithoutOnError = { ...io };
        delete ioWithoutOnError.onPdfError;
        ioWithoutOnError.writePdf.mockResolvedValue({ ok: false, error: { message: 'boom' } });

        await expect(
            storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io: ioWithoutOnError }),
        ).resolves.toBe(false);
        expect(ioWithoutOnError.reloadFileList).not.toHaveBeenCalled();
    });

    it('rejections propagate: a rejecting writeHtml or writePdf rejects the whole call', async () => {
        io.writeHtml.mockRejectedValue(new Error('html write failed'));
        await expect(
            storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io }),
        ).rejects.toThrow('html write failed');

        io.writeHtml.mockResolvedValue(undefined);
        io.writePdf.mockRejectedValue(new Error('pdf write failed'));
        await expect(
            storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io }),
        ).rejects.toThrow('pdf write failed');
    });

    it('writePdf resolving undefined is treated as failure: onPdfError called with (undefined, why), reloadFileList NOT called, returns false', async () => {
        io.writePdf.mockResolvedValue(undefined);

        const result = await storeBackupCopyWithPdf({ filename: FILENAME, editorContent: EDITOR_CONTENT, why: WHY, io });

        expect(result).toBe(false);
        expect(io.onPdfError).toHaveBeenCalledTimes(1);
        expect(io.onPdfError).toHaveBeenCalledWith(undefined, WHY);
        expect(io.reloadFileList).not.toHaveBeenCalled();
    });
});
