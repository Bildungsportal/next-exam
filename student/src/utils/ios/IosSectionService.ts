import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";
import {useConfigStore} from "../../stores/configStore.js";

/**
 * Tracks the iOS exam session state and handles section navigation.
 * Owns currentExamType / lastServerStatus and the router decisions that depend on them.
 */
class IosSectionService {
    currentExamType: string = "";
    lastServerStatus: any = null;

    get infoStore() {
        return useInfoStore();
    }

    get configStore() {
        return useConfigStore();
    }

    /** Applies a startExam signal from the renderer bridge. */
    startExam(serverstatus: any): void {
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
        router.push("/student");
        this.infoStore.examtype = "";
        this.infoStore.exammode = false;
        this.currentExamType = "";
        this.lastServerStatus = null;
        this.configStore.examdirectory = '';
    }

    handleUpdateReceived(sectionNumber: number = null, restoreBackup = false): void {
        const newSectionNumber = sectionNumber ? sectionNumber : this.infoStore.lockedSection;
        loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: sectionNumber: ", newSectionNumber);

        if (this.infoStore.exammode) {
            let newExamType = this.lastServerStatus.examSections[newSectionNumber].examtype;

            loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: currentExamType, ", this.currentExamType, "newExamType: ", newExamType);
            if (this.currentExamType !== newExamType || this.infoStore.lockedSection !== newSectionNumber) {
                this.infoStore.examtype = newExamType;
                this.currentExamType = newExamType;
                const examPath = `/${newExamType}/${this.infoStore.token}/${newSectionNumber}`;
                loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: router push to: ", examPath);
                // restore=1 makes editor/activesheets load the backup silently (no confirm dialog) — same as Electron section-switch reroute.
                const route: any = { path: examPath };
                if (restoreBackup) route.query = { restore: '1' };
                router.push(route);
            }
        }
        this.infoStore.lockedSection = newSectionNumber;
    }
}

export default new IosSectionService();
