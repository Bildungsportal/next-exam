/** Preset EDID sizes for student headless VNC (examConfig.localvm.displayResolution). */
export const DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION = '1366x768';

export const LOCAL_VM_DISPLAY_RESOLUTIONS = [
    { id: '1024x768', width: 1024, height: 768 },
    { id: '1280x720', width: 1280, height: 720 },
    { id: '1366x768', width: 1366, height: 768 },
    { id: '1600x900', width: 1600, height: 900 },
    { id: '1920x1080', width: 1920, height: 1080 },
];

/** Normalize config id and return { id, width, height } (default 1366×768). */
export function resolveLocalVmDisplayResolution(id) {
    const raw = String(id || '').trim().toLowerCase().replace(/\s/g, '').replace(/×/g, 'x');
    const hit = LOCAL_VM_DISPLAY_RESOLUTIONS.find((r) => r.id === raw);
    if (hit) {
        return { id: hit.id, width: hit.width, height: hit.height };
    }
    const def = LOCAL_VM_DISPLAY_RESOLUTIONS.find((r) => r.id === DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION)
        || LOCAL_VM_DISPLAY_RESOLUTIONS[2];
    return { id: def.id, width: def.width, height: def.height };
}
