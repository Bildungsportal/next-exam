const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');
let virtual = false;

if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    // Prüfe, ob WEBGL_debug_renderer_info existiert
    if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL).toLowerCase();
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
  
        // Erweiterte Keywords für moderne VM-Setups
        const keywords = [
            'vmware', 'virtualbox', 'parallels', 'solarwinds', 
            'qemu', 'hyper-v', 'bootcamp', 'xen', 
            'citrix', 'kvm', 'wsl', 'docker', 'cloud',
            'llvmpipe', 'microsoft basic render driver', 'basic render',
            'virgl', 'virtio', 'spice', 'qxl'
        ];

        // Zusätzliche Checks für indirekte VM-Indikatoren
        const isLowEndGraphics = renderer.includes('swiftshader') || 
                                renderer.includes('llvmpipe') || 
                                renderer.includes('basic render');

        // Überprüfe beide Parameter und indirekte Indikatoren
        let matchFound = false;
        keywords.forEach(keyword => {
            if (vendor.includes(keyword) || renderer.includes(keyword)) {
                matchFound = true;
                virtual = true;
            }
        });

        // Wenn Low-End-Grafik erkannt wurde, könnte es sich um eine VM handeln
        if (isLowEndGraphics) {
            virtual = true;
        }

        // Erkennung von Wayland über Umgebungsvariable
        const isWayland = typeof process !== 'undefined' && process.env.WAYLAND_DISPLAY;

        // Wenn Wayland aktiv ist und SwiftShader erkannt wird, aber KEINE anderen VM-Hinweise existieren
        if (isWayland && renderer.includes('swiftshader')) {
            if (!matchFound) {
                console.log('Wayland detected with SwiftShader, likely not a VM.');
                virtual = false;  // Setze virtual auf false, wenn keine VM-Hinweise vorliegen
            }
        }

    } else {
        // Wenn kein debugInfo vorhanden ist, VM vermuten
        console.log("WEBGL_debug_renderer_info nicht verfügbar.");
        virtual = true;
    }
} else {
    // Wenn WebGL nicht unterstützt wird, könnte es eine VM sein
    console.log("WebGL wird nicht unterstützt, möglicherweise eine VM.");
    virtual = true;
}

export default virtual;
