/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * macOS exam restrictions: appsToClose kill + clipboard clear (AAC owns lockdown).
 */

import childProcess from 'child_process';

/** Kill appsToClose processes via pkill -f. */
export async function killMacAppsToClose(apps) {
    const killPromises = apps.map((app) => new Promise((resolve) => {
        childProcess.exec(`pkill -9 -f "${app}"`, () => resolve());
    }));
    await Promise.all(killPromises);
}

/** Clear macOS pasteboard once at exam start. */
export function clearMacClipboard() {
    childProcess.exec('pbcopy < /dev/null');
}
