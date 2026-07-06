import log from 'electron-log';
import fs from 'fs';
import { webContents, ipcMain } from 'electron';
import WindowHandler from './windowhandler.js';
import config from '../config.js';
import multicastClient from './multicastclient.js';

const SECTION_SAVE_TIMEOUT_MS = 10000;
const NEEDS_BACKUP_SAVE = ['editor', 'math', 'activesheets'];

/** True while save → shuffle → reroute pipeline is running (blocks stray examDir writes). */
export function isSectionSwitchRunning() {
    return !!switchExamSection._running;
}

/** Ask renderer to flush .htm/.ggb backup; resolves when write finished or timed out. */
function awaitRendererBackup(webContents, previousExamtype) {
    if (!NEEDS_BACKUP_SAVE.includes(previousExamtype)) return Promise.resolve(true);
    if (!webContents || webContents.isDestroyed?.()) return Promise.resolve(false);
    return new Promise((resolve) => {
        const onDone = (_event, ok) => {
            clearTimeout(timer);
            ipcMain.removeListener('section-switch-save-done', onDone);
            resolve(ok !== false);
        };
        const timer = setTimeout(() => {
            ipcMain.removeListener('section-switch-save-done', onDone);
            log.warn('switchExamSection: backup save timed out');
            resolve(false);
        }, SECTION_SAVE_TIMEOUT_MS);
        ipcMain.once('section-switch-save-done', onDone);
        webContents.send('save-for-section-switch', previousExamtype);
    });
}

export async function switchExamSection(CommunicationHandler, serverstatus, newSectionNumber) {
    if (switchExamSection._running) {
        log.warn('switchExamSection: already running, skip duplicate');
        return;
    }
    if (!multicastClient.clientinfo.exammode) {
        log.warn('switchExamSection: not in exammode, skip');
        return;
    }
    if (!serverstatus?.examSections?.[newSectionNumber]) {
        log.warn(`switchExamSection: invalid section ${newSectionNumber}`);
        return;
    }

    switchExamSection._running = true;
    const examWin = WindowHandler.mainWin();
    const fromSection = multicastClient.clientinfo.lockedSection;
    const fromExamtype = multicastClient.clientinfo.examtype;
    const toSection = newSectionNumber;
    const examDir = config.examdirectory;

    try {
        // --- 1) UI overlay ---
        if (examWin?.webContents && !examWin.isDestroyed?.()) {
            examWin.webContents.send('switching-exam-section', toSection);
        }
        log.warn(`switchExamSection: ${fromSection} → ${toSection} (${serverstatus.examSections[toSection].sectionname}, ${serverstatus.examSections[toSection].examtype})`);

        // --- 2) backup current section (renderer → disk, awaited) ---
        const backupOk = await awaitRendererBackup(examWin?.webContents, fromExamtype);
        if (!backupOk && NEEDS_BACKUP_SAVE.includes(fromExamtype)) {
            log.error('switchExamSection: backup failed — abort');
            examWin?.webContents?.send('section-switch-aborted');
            return;
        }

        // --- 3) shuffle examDir: root → fromSection/, then toSection/ → root ---
        if (fs.existsSync(examDir) && fromSection != null) {
            const savePath = `${examDir}/${fromSection}`;
            if (!fs.existsSync(savePath)) fs.mkdirSync(savePath, { recursive: true });
            for (const file of fs.readdirSync(examDir)) {
                const oldPath = `${examDir}/${file}`;
                if (!fs.statSync(oldPath).isFile()) continue;
                fs.copyFileSync(oldPath, `${savePath}/${file}`);
                fs.unlinkSync(oldPath);
            }
        }
        const loadPath = `${examDir}/${toSection}`;
        if (fs.existsSync(loadPath)) {
            for (const file of fs.readdirSync(loadPath)) {
                const sourcePath = `${loadPath}/${file}`;
                if (!fs.statSync(sourcePath).isFile()) continue;
                fs.copyFileSync(sourcePath, `${examDir}/${file}`);
            }
        }

        // --- 4) clientinfo (after files on disk) ---
        multicastClient.clientinfo.examtype = serverstatus.examSections[toSection].examtype;
        multicastClient.clientinfo.lockedSection = toSection;

        // --- 5) reroute to new exam view ---
        if (!examWin || examWin.isDestroyed?.()) {
            log.warn('switchExamSection: no mainwindow for reroute');
            return;
        }
        if (fromExamtype === 'localvm' || multicastClient.clientinfo.localVMState === 'running') {
            await CommunicationHandler.stopLocalVmIfActive();
        }
        if (config.development) {
            webContents.getAllWebContents().forEach(wc => {
                if (wc.hostWebContents?.id === examWin.webContents.id && wc.isDevToolsOpened?.()) {
                    wc.closeDevTools();
                }
            });
        }
        WindowHandler.teardownExamChrome(WindowHandler.mainwindow);
        await CommunicationHandler.rerouteExamSection(serverstatus);
    } catch (error) {
        log.error(`switchExamSection: ${error?.message || error}`, error?.stack);
        examWin?.webContents?.send('section-switch-aborted');
    } finally {
        switchExamSection._running = false;
    }
}
