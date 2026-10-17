import loggingBridge from "../loggingBridge.js";
import {useInfoStore} from "../../stores/infoStore.js";
import {useConfigStore} from "../../stores/configStore.js";
import {IPC} from "../../plugins/index.js";

/**
 * Submits the exam directory to the teacher via the native `exam-submit` handler
 * (streams each file as its own request — no ZIP, no whole-exam base64 in renderer memory).
 */
class IosSubmissionService {
    get infoStore() {
        return useInfoStore();
    }

    get configStore() {
        return useConfigStore();
    }

    /** Sends the current exam directory to the teacher. */
    async sendExamToTeacher(): Promise<void> {
        await this.sendToTeacher();
    }

    /** Uploads the exam directory to the teacher, file by file, natively. */
    async sendToTeacher(): Promise<void> {
        try {
            const response = await IPC.invoke({
                channel: 'exam-submit',
                payload: [{
                    examdirectory: this.configStore.examdirectory,
                    serverip: this.infoStore.serverip,
                    servername: this.infoStore.servername,
                    port: this.configStore.serverApiPort,
                    token: this.infoStore.token,
                    lastExamWriteSaveReason: this.infoStore.lastExamWriteSaveReason || 'n/a',
                }],
            });
            const result = response?.result;
            if (result?.status === 'success') {
                this.infoStore.lastExamWriteSaveReason = 'n/a';
            } else {
                loggingBridge.error(`iosUpdateListener @ sendToTeacher: ${result?.message}`);
            }
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ sendToTeacher: ${error}`);
        }
    }
}

export default new IosSubmissionService();
