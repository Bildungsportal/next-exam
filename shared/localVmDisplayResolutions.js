/** Preset EDID sizes for student headless VNC (examConfig.localvm.displayResolution). */
export const DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION = '1920x1080';

export const LOCAL_VM_DISPLAY_RESOLUTIONS = [
    { id: '1920x1080', width: 1920, height: 1080 },
    { id: '1680x1050', width: 1680, height: 1050 },
    { id: '1440x900', width: 1440, height: 900 },
    { id: '1280x700', width: 1280, height: 700 },
    { id: '1024x768', width: 1024, height: 768 },
];

/** Map removed preset ids from older exam configs to current EDID sizes. */
const LEGACY_DISPLAY_RESOLUTION_IDS = {
    '1280x720': '1280x700',
    '1366x768': '1440x900',
    '1600x900': '1440x900',
};

/** Pick group A/B localvm config + resolved display for one student. */
export function pickLocalVmGroupConfig(examSection, clientname) {
    const hasGroups = !!examSection?.groups;
    let group = 'a';
    if (hasGroups) {
        const groupA = examSection.groupA?.users ?? [];
        const groupB = examSection.groupB?.users ?? [];
        const name = String(clientname || '').trim().toLowerCase();
        if (groupB.includes(name)) {
            group = 'b';
        }
    }
    const vmConfig = group === 'b'
        ? (examSection?.groupB?.examConfig?.localvm || {})
        : (examSection?.groupA?.examConfig?.localvm || {});
    const display = resolveLocalVmDisplayResolution(vmConfig.displayResolution);
    return { group, vmConfig, display };
}

/** Normalize config id and return { id, width, height } (default 1920×1080). */
export function resolveLocalVmDisplayResolution(id) {
    let raw = String(id || '').trim().toLowerCase().replace(/\s/g, '').replace(/×/g, 'x');
    raw = LEGACY_DISPLAY_RESOLUTION_IDS[raw] || raw;
    const hit = LOCAL_VM_DISPLAY_RESOLUTIONS.find((r) => r.id === raw);
    if (hit) {
        return { id: hit.id, width: hit.width, height: hit.height };
    }
    const def = LOCAL_VM_DISPLAY_RESOLUTIONS.find((r) => r.id === DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION)
        || LOCAL_VM_DISPLAY_RESOLUTIONS[0];
    return { id: def.id, width: def.width, height: def.height };
}
