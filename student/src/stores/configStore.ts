import { defineStore } from 'pinia'
import config from '../../src-electron/main/config.js';

export const useConfigStore = defineStore('info', {
    state: () => ({
        version: config.version as string,
        serverApiPort: config.serverApiPort as number,
        electron: false as boolean,
        development: config.development as boolean,
        info: config.info as string,
        buildDate: config.buildDate as string,
        hostIp: config.hostip as string
    }),
})