import { SignalBridge } from '../signalBridge.js'
import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";

const signalBridge = new SignalBridge(window)

class IosUpdateListener {

     async init(): void {
        loggingBridge.info("initializing iosUpdateListener");
        const infoStore = useInfoStore();

        if(!isIOS()) {
            return;
        }
        await infoStore.updateInfo();

        signalBridge.on('updateReceived', (update) => {
            loggingBridge.info("updateReceived in update handler: ", update);
            if (update.serverstatus.exammode) {
                const examPath = `/${update.serverstatus.examSections[update.serverstatus.activeSection].examtype}/${infoStore.token}`;
                const currentExamType = infoStore.examtype;
                const newExamType = update.serverstatus.examSections[update.serverstatus.activeSection].examtype;

                loggingBridge.info("updateReceived in update handler: lastPath and new examPath", currentExamType, newExamType);
                if (currentExamType !== newExamType) {
                    infoStore.exammode = update.serverstatus.exammode;
                    infoStore.examtype = newExamType;
                    router.push({
                        path: examPath
                    });
                }
            }
        });

         signalBridge.on('endExam', () => {
             loggingBridge.info("endExam received in update handler: ");
             router.push("/student");
             infoStore.examtype = "";
             infoStore.exammode = false;
         });


    }
}

export default new IosUpdateListener();