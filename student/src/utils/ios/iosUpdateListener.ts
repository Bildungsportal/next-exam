import {SignalBridge} from '../signalBridge.js'
import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";

const signalBridge = new SignalBridge(window)

class IosUpdateListener {
    currentExamType: string = "";
    lastUpdate: any = null;
    infoStore: any = null;

    async init(): Promise<void> {
        if (!isIOS()) {
            return;
        }
        this.infoStore = useInfoStore();
        await this.infoStore.updateInfo();
        this.currentExamType = this.infoStore.examtype;

        signalBridge.on('updateReceived', (update) => {
            loggingBridge.debug("updateReceived in update handler: ", update);
            this.lastUpdate = update;
            this.handleUpdateReceived(update.serverstatus.exammode, this.infoStore.lockedSection);
        });

        signalBridge.on('endExam', () => {
            loggingBridge.debug("endExam received in update handler: ");
            router.push("/student");
            this.infoStore.examtype = "";
            this.infoStore.exammode = false;
        });
    }

    handleUpdateReceived(examMode: boolean, newSectionNumber: number): void {
        if (examMode) {
            let newExamType = this.lastUpdate.serverstatus.examSections[newSectionNumber].examtype;
            const examPath = `/${newExamType}/${this.infoStore.token}`;

            loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: currentExamType, ", this.currentExamType, "newExamType: ", newExamType);
            if (this.currentExamType !== newExamType) {
                this.infoStore.exammode = examMode;
                this.infoStore.examtype = newExamType;
                this.currentExamType = newExamType;
                router.push({
                    path: examPath
                });
            }
        }
    }
}

export default new IosUpdateListener();