import { SignalBridge } from '../signalBridge.js'
import {MulticastClient} from "../../../src-electron/main/scripts/multicastclient.js";
import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";

const signalBridge = new SignalBridge(window)

class IosUpdateListener {

    /** Initialize the multicast client with the IPC gateway and register the updateReceived listener. */
     init(): void {
        loggingBridge.info("initializing iosUpdateListener");
        const infoStore = useInfoStore();

        let lastPath = "";
        if(!isIOS()) {
            return;
        }
        infoStore.updateInfo().then(_ => {
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
        });

    }
}

export default new IosUpdateListener();