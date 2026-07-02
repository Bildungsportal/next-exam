import { defineStore } from 'pinia'
import config from '../../src-electron/main/config.js';

export const useConfigStore = defineStore("config", {
    state: () => ({
        version: config.version as string,
        serverApiPort: config.serverApiPort as number,
        electron: false as boolean,
        development: config.development as boolean,
        info: config.info as string,
        buildDate: config.buildDate as string,
        hostip: config.hostip as string | Record<string, unknown> | false,
        bipIntegration: config.bipIntegration as boolean,
        bipApiUrl: config.bipApiUrl as string,
        bipDemo: config.bipDemo as boolean,
        showdevtools: config.showdevtools as boolean
    }),
});