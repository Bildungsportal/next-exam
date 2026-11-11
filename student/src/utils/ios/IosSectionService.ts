import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";
import {useConfigStore} from "../../stores/configStore.js";
import {switchExamSectionFiles, flushSectionSwitchBackup} from "../switchExamSection.ts";

// Commit roundtrip budget before the pipeline aborts and lets the heartbeat retry the switch.
export const SECTION_SWITCH_COMMIT_TIMEOUT_MS = 10000;
// Overlay fallback: never leave the full-screen switch loading state up longer than this.
export const SECTION_SWITCH_OVERLAY_FALLBACK_MS = 12000;
export const SECTION_SWITCH_STATUS_REFRESH_TIMEOUT_MS = 8000;
export const SECTION_SWITCH_FILES_TIMEOUT_MS = 25000;
export const SECTION_SWITCH_RECONCILE_DELAY_MS = 1500;

/** Resolves with the promise's value or `onTimeout` if it does not settle within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => resolve(onTimeout), ms);
        p.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
}

/**
 * Tracks the iOS exam session state and handles section navigation.
 * Owns currentExamType / lastServerStatus and the router decisions that depend on them.
 */
class IosSectionService {
    currentExamType: string = "";
    lastServerStatus: any = null;
    // True while a section switch is being processed; further switches are ignored.
    private _switchRunning = false;
    // Monotonic session counter: incremented on every startExam/endExam so an in-flight switch
    // (bounded ≤ ~43s) can never reroute or reconcile into a newer exam session.
    private _examGeneration = 0;

    get infoStore() {
        return useInfoStore();
    }

    get configStore() {
        return useConfigStore();
    }

    /** Applies a startExam signal from the renderer bridge. */
    startExam(serverstatus: any): void {
        this._examGeneration++;
        this.lastServerStatus = serverstatus;
        this.infoStore.exammode = serverstatus.exammode;
        this.infoStore.lockedSection = serverstatus.allowSectionSwitch
            ? 1
            : (serverstatus.lockedSection ?? serverstatus.activeSection ?? 1);
        this.infoStore.localLockdown = serverstatus.localLockdown || false;
        if (serverstatus.password) {
            this.infoStore.password = serverstatus.password;
        }
        // Exam files live in the folder reported by the native side (Documents/<servername>-<pin>)
        // so they end up next to the native exam directory; local lockdown uses its own folder.
        const nativeExamDir = serverstatus.examdirectory;
        this.configStore.examdirectory = typeof nativeExamDir === 'string' && nativeExamDir
            ? nativeExamDir
            : (serverstatus.localLockdown ? 'local-exam' : '');
        this.handleUpdateReceived();
    }

    /** Clears the exam session state on an endExam signal. */
    endExam(): void {
        this._examGeneration++;
        router.push("/student");
        this.infoStore.examtype = "";
        this.infoStore.exammode = false;
        this.currentExamType = "";
        this.lastServerStatus = null;
        this.configStore.examdirectory = '';
        // Never leak a stuck switch into the next exam session.
        this.infoStore.endSectionSwitchOverlay();
        this._switchRunning = false;
    }

    /** Single iOS section-switch pipeline for student and teacher switches:
     * flush backup → shuffle files → commit clientinfo → reroute with silent restore.
     * Ignored while a switch is already running or when the target section is invalid. */
    async performSectionSwitch(sectionNumber: number): Promise<void> {
        if (this._switchRunning) {
            loggingBridge.info('IosSectionService @ performSectionSwitch: request ignored, switch already running');
            return;
        }
        this._switchRunning = true;
        loggingBridge.info(`IosSectionService @ performSectionSwitch(${sectionNumber}): start (exammode=${this.infoStore.exammode}, lockedSection=${this.infoStore.lockedSection})`);
        // Generation at switch start: if startExam/endExam runs while this pipeline is in flight,
        // the reroute and the reconcile timer below must not bleed into the new exam session.
        const examGeneration = this._examGeneration;
        // Watchdog: if the pipeline stalls (e.g. the commit IPC response is dropped), never leave
        // the full-screen section-switch overlay up longer than SECTION_SWITCH_OVERLAY_FALLBACK_MS.
        const watchdog = setTimeout(() => {
            if (this.infoStore.switchingToSection === sectionNumber) {
                loggingBridge.warn('IosSectionService @ performSectionSwitch: section switch stalled, clearing overlay via fallback watchdog');
                this.infoStore.endSectionSwitchOverlay();
            }
        }, SECTION_SWITCH_OVERLAY_FALLBACK_MS);
        try {
            // lastServerStatus is only set on startExam; the native mc.serverstatus (and the 5s
            // infoStore poll) is refreshed on every heartbeat. Refresh it so a section the teacher
            // added mid-exam is not permanently rejected by the guard below (silent retry loop).
            try {
                await withTimeout(this.infoStore.updateInfo(), SECTION_SWITCH_STATUS_REFRESH_TIMEOUT_MS, false);
                if (this.infoStore.serverstatus) this.lastServerStatus = this.infoStore.serverstatus;
            } catch (error) {
                loggingBridge.warn('IosSectionService @ performSectionSwitch: serverstatus refresh failed, using last known status');
            }
            if (!this.infoStore.exammode || !this.lastServerStatus?.examSections?.[sectionNumber] || sectionNumber === this.infoStore.lockedSection) {
                loggingBridge.info('IosSectionService @ performSectionSwitch: switch skipped (no exam / unknown section / already active)');
                // The full-screen overlay set by ExamHeader's _onSwitchingExamSection handler
                // (beginSectionSwitch) must be cleared even on skip, or it stays up forever.
                window.dispatchEvent(new CustomEvent('ipc-message', { detail: { channel: 'section-switch-aborted', args: [] } }));
                return;
            }
            // Capture the section we are LEAVING before any await: the 5s updateInfo poll may
            // otherwise set lockedSection to the target mid-pipeline (native clientinfo updates
            // first), which would suppress the same-examtype reroute decision.
            const fromSection = this.infoStore.lockedSection;
            this.infoStore.beginSectionSwitch(sectionNumber);
            const fromExamtype = this.currentExamType || this.lastServerStatus.examSections[fromSection]?.examtype;
            const ok = await withTimeout(
                switchExamSectionFiles(this.configStore.examdirectory, fromSection, sectionNumber, () => flushSectionSwitchBackup(fromExamtype)),
                SECTION_SWITCH_FILES_TIMEOUT_MS,
                false
            );
            if (!ok) {
                loggingBridge.error('IosSectionService @ performSectionSwitch: backup failed — abort');
                window.dispatchEvent(new CustomEvent('ipc-message', { detail: { channel: 'section-switch-aborted', args: [] } }));
                return;
            }
            if (!this.infoStore.exammode) {
                loggingBridge.info('IosSectionService @ performSectionSwitch: exam ended during switch, aborting');
                return;
            }
            // Time-box the commit: the native handler is a fast clientinfo update, but if the IPC
            // response is dropped (busy/flaky native side) the invoke would otherwise hang forever
            // and leave the switch permanently stuck (see IpcRenderer.invoke — it never rejects).
            const commitTimeoutMarker = { timedOut: true };
            let commitTimer: ReturnType<typeof setTimeout> | null = null;
            const commitResult: { status?: string; timedOut?: true } = await Promise.race([
                window.ipcRenderer.invoke('commit-exam-section', sectionNumber),
                new Promise((resolve) => { commitTimer = setTimeout(() => resolve(commitTimeoutMarker), SECTION_SWITCH_COMMIT_TIMEOUT_MS); }),
            ]);
            if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
            if (commitResult?.status !== 'success') {
                // Do not reroute and do not touch lockedSection: the next heartbeat re-request
                // retries the switch cleanly (the _switchRunning guard is cleared in finally).
                // The native commit may have applied even though we did not get a success response:
                // the iOS invoke shim never rejects and returns undefined on throw or a malformed
                // result (response dropped/mangled), and the race resolves to commitTimeoutMarker on
                // timeout. Reconcile in all of those cases — if the poll later reports
                // lockedSection === target, reroute so the editor matches the files on disk
                // (otherwise autosaves would write old-section work into the target section's files).
                // Guards inside reconcileCommittedSwitch make it a no-op when the commit truly failed
                // and prevent double work.
                loggingBridge.error('IosSectionService @ performSectionSwitch: commit failed — abort, next heartbeat will retry');
                window.dispatchEvent(new CustomEvent('ipc-message', { detail: { channel: 'section-switch-aborted', args: [] } }));
                setTimeout(() => { void this.reconcileCommittedSwitch(sectionNumber, fromSection, examGeneration); }, SECTION_SWITCH_RECONCILE_DELAY_MS);
                return;
            }
            if (!this.infoStore.exammode || examGeneration !== this._examGeneration) {
                loggingBridge.info('IosSectionService @ performSectionSwitch: exam ended or session changed during switch, skipping reroute');
                return;
            }
            loggingBridge.info(`IosSectionService @ performSectionSwitch(${sectionNumber}): rerouting with restore`);
            this.handleUpdateReceived(sectionNumber, true, fromSection);
        } catch (error) {
            // Belt-and-braces: the IPC shim never rejects, but a thrown Filesystem/router error
            // must still clear the switch state instead of stranding the overlay.
            loggingBridge.error('IosSectionService @ performSectionSwitch: pipeline error — abort, next heartbeat will retry', error);
            window.dispatchEvent(new CustomEvent('ipc-message', { detail: { channel: 'section-switch-aborted', args: [] } }));
        } finally {
            clearTimeout(watchdog);
            this._switchRunning = false;
        }
    }

    /** After a dropped/mangled commit response, reroutes if the native commit actually applied late. */
    private async reconcileCommittedSwitch(sectionNumber: number, fromSection: number, examGeneration: number): Promise<void> {
        if (examGeneration !== this._examGeneration) return; // exam ended or a newer session started while the timer was pending
        if (this._switchRunning || this.infoStore.switchingToSection != null) return; // a retry is already handling it
        try {
            await withTimeout(this.infoStore.updateInfo(), SECTION_SWITCH_STATUS_REFRESH_TIMEOUT_MS, false);
        } catch {
            return;
        }
        if (examGeneration !== this._examGeneration || this._switchRunning || this.infoStore.switchingToSection != null) return;
        if (this.infoStore.exammode && this.infoStore.lockedSection === sectionNumber) {
            loggingBridge.info(`IosSectionService @ performSectionSwitch: reconciliation — commit applied late, rerouting to section ${sectionNumber}`);
            this.handleUpdateReceived(sectionNumber, true, fromSection);
        }
    }

    handleUpdateReceived(sectionNumber: number = null, restoreBackup = false, fromSection: number = null): void {
        const newSectionNumber = sectionNumber ? sectionNumber : this.infoStore.lockedSection;
        loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: sectionNumber: ", newSectionNumber);

        if (this.infoStore.exammode) {
            if (!this.lastServerStatus?.examSections?.[newSectionNumber]) {
                loggingBridge.warn(`iosUpdateListener @ handleUpdateReceived: no exam section ${newSectionNumber} in serverstatus, skipping reroute`);
                if (this.infoStore.switchingToSection != null) {
                    loggingBridge.info('IosSectionService @ handleUpdateReceived: no exam section in serverstatus, clearing overlay');
                    this.infoStore.endSectionSwitchOverlay();
                }
                return;
            }
            let newExamType = this.lastServerStatus.examSections[newSectionNumber].examtype;

            loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: currentExamType, ", this.currentExamType, "newExamType: ", newExamType);
            // The section-switch pipeline passes fromSection so a same-examtype switch always reroutes:
            // infoStore.lockedSection can be pre-set to the target by the 5s updateInfo poll before
            // this runs, which would otherwise silently suppress the reroute (no remount, no restore).
            const currentSection = fromSection ?? this.infoStore.lockedSection;
            if (this.currentExamType !== newExamType || currentSection !== newSectionNumber) {
                this.infoStore.examtype = newExamType;
                this.currentExamType = newExamType;
                const examPath = `/${newExamType}/${this.infoStore.token}/${newSectionNumber}`;
                // restore=1 makes editor/activesheets load the backup silently (no confirm dialog) — same as Electron section-switch reroute.
                const route: any = { path: examPath };
                if (restoreBackup) route.query = { restore: '1' };
                loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: router push to: ", route);
                router.push(route);
            }
        }
        this.infoStore.lockedSection = newSectionNumber;
        // The pipeline reroute is the terminal step of a section switch: clear the overlay here
        // instead of relying on ExamHeader's watcher (a cross-page reroute unmounts the old page,
        // cancelling its 450ms overlay timer and stranding the overlay forever).
        if (this.infoStore.switchingToSection != null) {
            loggingBridge.info(`IosSectionService @ handleUpdateReceived: section switch to ${newSectionNumber} done, clearing overlay`);
            this.infoStore.endSectionSwitchOverlay();
        }
    }
}

export default new IosSectionService();
