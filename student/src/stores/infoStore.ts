import {defineStore} from 'pinia'
import {SignalBridge} from "../utils/signalBridge.js";
import {useConfigStore} from "./configStore.ts";

const signalBridge = new SignalBridge(window);

export const useInfoStore = defineStore("info", {
    state: () => ({
        examtype: "" as string,
        servername: "" as string,
        servertoken: "" as string,
        serverip: "" as string,
        token: "" as string,
        clientname: "" as string,
        serverstatus: "" as string,
        clientApiPort: "" as string,
        pincode: "" as string,
        cmargin: "" as string,
        localLockdown: false as boolean,
        groups: [] as string[],
        group: "" as string,
        online: true as boolean,
        battery: 100 as number,
        entryTime: 0 as number,
        componentName: "" as string,
        wlanInfo: null as any,
        exammode: false as boolean,
        lockedSection: 1 as number,
        switchingToSection: null as number | null,
        switchingStartedAt: 0 as number,
    }),
    actions: {
        // Poll wlan + host IP for ExamHeader network icons.
        async refreshNetworkInfo(): Promise<void> {
            try {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info');
            } catch {
                // keep previous wlanInfo
            }
            try {
                const ipResult = await signalBridge.invoke('checkhostip');
                if (ipResult) useConfigStore().hostip = ipResult;
            } catch {
                // keep previous hostip
            }
        },
        async updateInfo(): Promise<boolean> {
            let response = await signalBridge.invoke('getinfoasync')
            if (response) {
                let clientinfo = response.clientinfo

                this.serverstatus = response.serverstatus;
                this.examtype = clientinfo.examtype;
                this.serverip = clientinfo.serverip;
                this.servername = clientinfo.servername;
                this.servertoken = clientinfo.servertoken;
                this.clientname = clientinfo.name;
                this.pincode = clientinfo.pin;
                this.cmargin = clientinfo.cmargin;
                this.localLockdown = clientinfo.localLockdown;
                this.groups = clientinfo.groups;
                this.group = clientinfo.group;
                this.exammode = !!clientinfo.exammode;
                this.lockedSection = clientinfo.lockedSection ?? 1;
                this.online = !!clientinfo?.token;
            }
            await this.refreshNetworkInfo();
            return true
        },
        // Brief section-switch overlay until target lockedSection is active.
        beginSectionSwitch(sectionNumber: number): void {
            this.switchingToSection = sectionNumber;
            this.switchingStartedAt = Date.now();
        },
        endSectionSwitchOverlay(): void {
            this.switchingToSection = null;
            this.switchingStartedAt = 0;
        },
    },
})