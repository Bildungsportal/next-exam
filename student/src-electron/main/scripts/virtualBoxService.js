import { execSync } from 'child_process';
import log from 'electron-log';

const shell = (cmd) => {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
};

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

class VirtualBoxService {
    async startVmAndResolveHost(vmName) {
        let state = null;

        try {
            const listOutput = shell('VBoxManage list vms');
            const vmExists = listOutput.split('\n').some((line) => line.includes(`"${vmName}"`));
            if (!vmExists) {
                log.error(`virtualBoxService @ startVmAndResolveHost: VM '${vmName}' not found on client`);
                throw new Error('VM not installed on client');
            }
        } catch (err) {
            log.error('virtualBoxService @ startVmAndResolveHost: list vms failed', err);
            throw err;
        }

        try {
            shell(`VBoxManage startvm "${vmName}" --type headless`);
            state = 'starting';
        } catch (err) {
            const msg = err && err.message ? String(err.message) : '';
            if (/already running|VBOX_E_INVALID_VM_STATE/i.test(msg)) {
                log.info('virtualBoxService @ startVmAndResolveHost: VM already running, continuing');
                state = 'running';
            } else {
                log.warn('virtualBoxService @ startVmAndResolveHost: startvm failed (continuing anyway)', err?.message || err);
                state = 'unknown';
            }
        }

        let ipAddress = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                ipAddress = await this.resolveVmIp(vmName);
                if (ipAddress) {
                    log.info(`virtualBoxService @ startVmAndResolveHost: VM IP resolved to ${ipAddress}`);
                    return { ip: ipAddress, state: 'running' };
                }
            } catch (err) {
                log.error('virtualBoxService @ startVmAndResolveHost: resolveVmIp attempt failed', err);
            }
            await sleep(2000);
        }

        log.error('virtualBoxService @ startVmAndResolveHost: could not resolve VM IP');
        throw new Error('Could not resolve VM IP');
    }

    async resolveVmIp(vmName) {
        try {
            const guestProp = shell(`VBoxManage guestproperty get "${vmName}" "/VirtualBox/GuestInfo/Net/0/V4/IP"`).trim();
            const parts = guestProp.split(' ');
            const last = parts[parts.length - 1];
            if (last && last !== 'value' && last !== 'No' && last !== 'None') {
                return last;
            }
        } catch (err) {
            log.error('virtualBoxService @ resolveVmIp: guestproperty failed', err);
        }

        try {
            const info = shell(`VBoxManage showvminfo "${vmName}"`);
            const nicLine = info.split('\n').find((line) => line.includes('NIC 1'));
            if (!nicLine) {
                return null;
            }
            const macMatch = nicLine.match(/MAC address: ([0-9A-Fa-f]+)/);
            if (!macMatch || !macMatch[1]) {
                return null;
            }
            const mac = macMatch[1].toLowerCase();
            const arpOutput = shell('arp -an');
            const arpLine = arpOutput.split('\n').find((line) => line.toLowerCase().includes(mac));
            if (!arpLine) {
                return null;
            }
            const ipMatch = arpLine.match(/\(([^)]+)\)/);
            if (ipMatch && ipMatch[1]) {
                return ipMatch[1];
            }
        } catch (err) {
            log.error('virtualBoxService @ resolveVmIp: fallback resolution failed', err);
        }
        return null;
    }
}

export default new VirtualBoxService();

