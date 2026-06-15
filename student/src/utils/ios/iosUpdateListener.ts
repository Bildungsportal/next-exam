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

        let lastPath = "";
        if(!isIOS()) {
            return;
        }
        await infoStore.updateInfo();

        signalBridge.on('updateReceived', (update) => {
            loggingBridge.info("updateReceived in update handler: ", update);
            const examPath = `/${update.serverstatus.examSections[update.serverstatus.activeSection].examtype}/${infoStore.token}`;
            if (update.serverstatus.exammode) {
                if (lastPath !== examPath) {
                    lastPath = examPath;
                    router.push({
                        path: examPath
                    });
                }
            }
        });

         signalBridge.on('endExam', (update) => {
             router.push("/student");
         });


    }
}

export default new IosUpdateListener();