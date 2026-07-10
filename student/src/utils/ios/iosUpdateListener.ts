import {SignalBridge} from '../signalBridge.js'
import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";

const signalBridge = new SignalBridge(window)

class IosUpdateListener {
    infoStore: any = null;

    async init(): Promise<void> {
        if (!isIOS()) {
            return;
        }
        this.infoStore = useInfoStore();
        await this.infoStore.updateInfo();

        signalBridge.on('startExam', (serverstatus) => {
            const section = serverstatus.lockedSection;
            let newExamType = serverstatus.examSections[section].examtype;
            const examPath = `/${newExamType}/${this.infoStore.token}`;

            loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: currentExamType, ", this.infoStore.examtype, "newExamType: ", newExamType);
            this.infoStore.lockedSection = section;
            if (this.infoStore.examtype !== newExamType) {
                this.infoStore.exammode = serverstatus.exammode;
                this.infoStore.examtype = newExamType;
                router.push({
                    path: examPath
                });
            }
        });

        signalBridge.on('endExam', () => {
            loggingBridge.debug("endExam received in update handler: ");
            router.push("/student");
            this.infoStore.examtype = "";
            this.infoStore.exammode = false;
        });
    }
}

export default new IosUpdateListener();