// Detects likely virtualized/remote environments via WebGL GPU vendor/renderer on the client, and lives in the preload so it runs in the renderer context where WebGL is available instead of the backend.
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');
let detected = false;
let vendor = null;
let renderer = null;

if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    if (debugInfo) {
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)?.toLowerCase() ?? null;
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)?.toLowerCase() ?? null;

        const keywords = [
            'vmware', 'virtualbox', 'parallels', 'solarwinds',
            'qemu', 'hyper-v', 'bootcamp', 'xen',
            'citrix', 'kvm', 'wsl', 'docker', 'cloud',
            'llvmpipe', 'microsoft basic render driver', 'basic render',
            'virgl', 'virtio', 'spice', 'qxl'
        ];

        const isLowEndGraphics = renderer?.includes('swiftshader') ||
            renderer?.includes('llvmpipe') ||
            renderer?.includes('basic render');

        let matchFound = false;
        keywords.forEach(keyword => {
            if (vendor?.includes(keyword) || renderer?.includes(keyword)) {
                matchFound = true;
                detected = true;
            }
        });

        if (isLowEndGraphics) {
            detected = true;
        }

        const isWayland = typeof process !== 'undefined' && process.env.WAYLAND_DISPLAY;
        if (isWayland && renderer?.includes('swiftshader')) {
            if (!matchFound) {
                console.log('Wayland detected with SwiftShader, likely not a VM.');
                detected = false;
            }
        }
    } else {
        console.log("WEBGL_debug_renderer_info not available.");
        detected = true;
    }
} else {
    console.log("WebGL is not supported, possibly a VM.");
    detected = true;
}

export default { detected, vendor, renderer };
