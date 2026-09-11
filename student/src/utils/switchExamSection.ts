import { Filesystem, Directory } from '@capacitor/filesystem';
import loggingBridge from './loggingBridge.js';

let _running: boolean = false;

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
    newSection: number
): Promise<void> {
    if (_running) {
        loggingBridge.warn('switchExamSection: already running, skip duplicate');
        return;
    }
    if (!examDir) {
        loggingBridge.warn('switchExamSection: examDir is empty, skipping file ops');
        return;
    }

    _running = true;
    try {
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
            return;
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

    } catch (error) {
        loggingBridge.error(`switchExamSection: error during file ops – ${error}`);
        loggingBridge.error(`switchExamSection: currentSection=${currentSection}, newSection=${newSection}, examDir=${examDir}`);
    } finally {
        _running = false;
    }
}
