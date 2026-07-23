/**
 * Read/write PDF annotation JSON files in the student examdirectory.
 * Stored visibly in: <examdirectory>/annotations/<key>.annotations.json
 */
import {Directory, Encoding, Filesystem, GetUriOptions, ReadFileResult} from "@capacitor/filesystem";
import {useConfigStore} from "../stores/configStore.js";

class PdfHelper {

    configStore: any = null;
    direction: string = "";

    async init(): Promise<void> {
        this.configStore = useConfigStore();
        this.direction = `${this.configStore.examdirectory}/annonations`;
    }

    async readPdfAnnotations(key: string): Promise<ReadFileResult> {
        if (!key || typeof key !== 'string') return null;
        const filePath = this.generateFilePath(key);
        if(!await this.checkPathExists({path: filePath, directory: Directory.Documents})) return null
        return Filesystem.readFile({path: filePath, directory: Directory.Documents, encoding: Encoding.UTF8});
    }

    private generateFilePath(key: string): string {
        const safeKey =  key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
        return `${this.direction}/${safeKey}.annotations.json`;
    }

    async writePdfAnnotations(key: string, jsonString: string): Promise<any> {
        if (!key || typeof key !== 'string') return { status: 'error', message: 'invalid_key' };
        const filePath = this.generateFilePath(key);
        try {
            if(!await this.checkPathExists({path: filePath, directory: Directory.Documents})) {
                await Filesystem.mkdir({path: this.direction, directory: Directory.Documents, recursive: true})
            }
            JSON.parse(jsonString);
            await Filesystem.writeFile({path: filePath, directory: Directory.Documents, encoding: Encoding.UTF8, data: jsonString})
        } catch (exception) {
            console.error("pdfHelper @ writePdfAnnotations: ", exception?.message || exception)
            return { status: 'error', message: exception?.message || 'error' };
        }
    }

    async checkPathExists(getUriOptions: GetUriOptions): Promise<boolean> {
        try {
            await Filesystem.stat(getUriOptions);
            return true;
        } catch (exception) {
            if ((exception as any).message.includes('does not exist')) {
                return false;
            } else {
                console.error("pdfHelper @ checkFileExists: Exception during exists check: ", exception);
            }
        }
    }

}

export default new PdfHelper();