import {SignalBridge} from '../signalBridge.js'
import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";

const signalBridge = new SignalBridge(window)

class IosUpdateListener {
    currentExamType: string = "";
    lastServerStatus: any = null;
    infoStore: any = null;

    async init(): Promise<void> {
        if (!isIOS()) {
            return;
        }
        this.infoStore = useInfoStore();
        await this.infoStore.updateInfo();

        signalBridge.on('startExam', (serverstatus) => {
            loggingBridge.debug("iosUpdateListener @ startExam: message received: ", serverstatus);
            this.lastServerStatus = serverstatus;
            this.infoStore.exammode = serverstatus.exammode;
            this.infoStore.lockedSection = serverstatus.lockedSection;
            this.handleUpdateReceived();
        });

        signalBridge.on('endExam', () => {
            loggingBridge.debug("iosUpdateListener @ endExam: received signal");
            router.push("/student");
            this.infoStore.examtype = "";
            this.infoStore.exammode = false;
        });
    }

    handleUpdateReceived(sectionNumber: number = null): void {
        const newSectionNumber = sectionNumber ? sectionNumber : this.infoStore.lockedSection;
        loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: current serverstatus is:", this.lastServerStatus, "sectionNumber: ", newSectionNumber);
        this.infoStore.lockedSection = newSectionNumber;
        if (this.infoStore.exammode) {
            let newExamType = this.lastServerStatus.examSections[newSectionNumber].examtype;

            loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: currentExamType, ", this.currentExamType, "newExamType: ", newExamType);
            if (this.currentExamType !== newExamType) {
                this.infoStore.examtype = newExamType;
                this.currentExamType = newExamType;
                const examPath = `/${newExamType}/${this.infoStore.token}/${newSectionNumber}`;
                loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: router push to: ", examPath);
                router.push({
                    path: examPath
                });
            }
        }
    }
}

export default new IosUpdateListener();