import {defineStore} from 'pinia'
import {SignalBridge} from "../utils/signalBridge.js";

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
    }),
    actions: {
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
            }
            return true
        },
    },
})