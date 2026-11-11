import { Filesystem, Directory } from '@capacitor/filesystem';
import loggingBridge from './loggingBridge.js';

let _running: boolean = false;

export const SECTION_SWITCH_SAVE_TIMEOUT_MS = 10000;
export const SECTION_SWITCH_BACKUP_SAVE_EXAMTYPES = ['editor', 'math', 'activesheets'];

/**
 * Renderer-side counterpart of Electron's awaitRendererBackup (switchExamSection.js):
 * asks the currently mounted page to flush its section-switch backup by dispatching a
 * local 'save-for-section-switch' ipc-message event (same shape the native IPCBridge
 * dispatches — pages already listen via window.ipcRenderer.on('save-for-section-switch')).
 * Resolves with the page's 'section-switch-save-done' reply or true on timeout (timeout is
 * non-fatal: the switch proceeds with the last auto-save on disk). Only meaningful on iOS
 * (pages reply locally there); called from ExamHeader's iOS branch and
 * IosSectionService.performSectionSwitch.
 */
export function flushSectionSwitchBackup(examtype: string): Promise<boolean> {
    if (!SECTION_SWITCH_BACKUP_SAVE_EXAMTYPES.includes(examtype)) return Promise.resolve(true);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (typeof cleanup === 'function') cleanup();
            resolve(ok);
        };
        // NOTE: env.d.ts types window.ipcRenderer.on() as returning void, but the iOS
        // IpcRenderer shim (plugins/ipc-renderer.ts) returns a cleanup function.
        const ipc = (window as any).ipcRenderer;
        const cleanup = ipc.on('section-switch-save-done', (args: any[]) => {
            finish(args?.[0] !== false);
        });
        const timer = setTimeout(() => {
            // No page replied (e.g. no backup-savable exam page mounted): not fatal, continue
            // the switch with the last auto-save on disk instead of aborting (aborting here
            // caused an infinite retry loop via the ~5s teacher heartbeat re-request).
            console.warn('flushSectionSwitchBackup: backup save timed out, continuing with last auto-save on disk');
            finish(true);
        }, SECTION_SWITCH_SAVE_TIMEOUT_MS);
        window.dispatchEvent(new CustomEvent('ipc-message', { detail: { channel: 'save-for-section-switch', args: [examtype] } }));
    });
}

/** True while save → shuffle → reroute pipeline is running (blocks stray examDir writes). */
export function isSectionSwitchRunning() {
    return !!_running;
}

/**
 * Switches the exam to a new section by saving current section files to a
 * numbered subdirectory and loading the new section's files back to examDir.
 *
 * Mirrors `src-electron/main/scripts/switchExamSection.js` file-move logic.
 * Uses @capacitor/filesystem so it works on both Electron and iOS.
 */
export async function switchExamSectionFiles(
    examDir: string,
    currentSection: number | null | undefined,
    newSection: number,
    preSave?: () => Promise<boolean>
): Promise<boolean> {
    if (_running) {
        // Return false, not true: the caller (IosSectionService.performSectionSwitch) treats false as
        // "abort, next heartbeat retries". Returning true would let the retry commit clientinfo and
        // reroute while examDir is half-shuffled — when the abandoned shuffle later completes, its
        // PART-2 load can overwrite files the user has since autosaved (silent data loss). _running is
        // cleared in `finally` when the abandoned shuffle finishes, so retries after that proceed normally.
        loggingBridge.warn('switchExamSection: already running, aborting duplicate (previous shuffle still in flight)');
        return false;
    }
    if (!examDir) {
        loggingBridge.warn('switchExamSection: examDir is empty, skipping file ops');
        return true;
    }

    _running = true;
    try {
        if (preSave) {
            const ok = await preSave();
            if (ok !== true) {
                loggingBridge.error('switchExamSection: pre-save failed, aborting switch');
                return false;
            }
        }
        // PART 1: save files from examDir into subdirectory named by current section
        if (currentSection != null && currentSection !== undefined) {
            loggingBridge.debug(`switchExamSection: saving examDir content to section ${currentSection}`);

            const savePath = `${examDir}/${currentSection}`;
            await Filesystem.mkdir({ path: savePath, directory: Directory.Documents, recursive: true }).catch(() => {});

            const { files } = await Filesystem.readdir({ path: examDir, directory: Directory.Documents });
            loggingBridge.info(`switchExamSection: found ${files.length} items in examDir`);

            let saved = 0;
            for (const file of files) {
                if (file.type === 'directory') {
                    loggingBridge.info(`switchExamSection: skipping directory ${file.name}`);
                    continue;
                }
                const src  = `${examDir}/${file.name}`;
                const dest = `${savePath}/${file.name}`;
                await Filesystem.copy({ from: src, to: dest, directory: Directory.Documents, toDirectory: Directory.Documents });
                await Filesystem.deleteFile({ path: src, directory: Directory.Documents });
                saved++;
                loggingBridge.info(`switchExamSection: saved ${file.name} to section ${currentSection}`);
            }
            loggingBridge.info(`switchExamSection: saved ${saved} files to section ${currentSection}`);
        } else {
            loggingBridge.warn('switchExamSection: skipping save – no active section');
        }

        // PART 2: load files from new section subdirectory into examDir
        loggingBridge.debug(`switchExamSection: loading section ${newSection} into examDir`);
        const loadPath = `${examDir}/${newSection}`;

        let sectionFiles: Awaited<ReturnType<typeof Filesystem.readdir>>['files'];
        try {
            ({ files: sectionFiles } = await Filesystem.readdir({ path: loadPath, directory: Directory.Documents }));
        } catch {
            loggingBridge.info(`switchExamSection: section ${newSection} directory does not exist, starting clean`);
            return true;
        }

        let copied = 0;
        for (const file of sectionFiles) {
            if (file.type === 'directory') {
                loggingBridge.warn(`switchExamSection: skipping non-file ${file.name} in section ${newSection}`);
                continue;
            }
            const src  = `${loadPath}/${file.name}`;
            const dest = `${examDir}/${file.name}`;
            await Filesystem.copy({ from: src, to: dest, directory: Directory.Documents, toDirectory: Directory.Documents });
            copied++;
            loggingBridge.info(`switchExamSection: copied ${file.name} from section ${newSection} to examDir`);
        }
        loggingBridge.info(`switchExamSection: loaded ${copied} files from section ${newSection}`);
        return true;

    } catch (error) {
        loggingBridge.error(`switchExamSection: error during file ops – ${error}`);
        loggingBridge.error(`switchExamSection: currentSection=${currentSection}, newSection=${newSection}, examDir=${examDir}`);
        return true;
    } finally {
        _running = false;
    }
}
