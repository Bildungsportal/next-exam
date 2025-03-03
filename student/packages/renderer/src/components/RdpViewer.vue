<!-- RdpViewer.vue -->
<template>
    <div ref="container" tabindex="0" @mousemove="handleMouseMove" @click="handleClick" @keydown="handleKeyDown">
    <canvas ref="canvas" :width="rdpWidth" :height="rdpHeight"></canvas>
    <p v-if="error" style="color: red;">{{ error }}</p>
    </div>
</template>

<script>
export default {
    data() {
        return {
            rdpWidth: 1280,
            rdpHeight: 720,
            error: null,
            canvas: null,
            ctx: null,
            rdpConfig: {
                domain: '',           // Domain (optional)
                userName: 'USER',     // Benutzername
                password: 'PASS',     // Passwort
                ip: '192.168.1.100',  // RDP-Server-IP
                port: 3389,           // Standardport
                width: 1280,
                height: 720
            }
        };
    },
    computed: {
        // Zugriff auf rdpConfig über serverstatus, angenommen als globales Datenobjekt im root
        rdpConfig() {
            return this.$root.serverstatus.examSections[this.$root.serverstatus.activeSection].rdpConfig;
        }
    },
    async mounted() {
        this.canvas = this.$refs.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.$refs.container.focus();

        try {
            // Starte die RDP-Verbindung über den exposed ipcRenderer
            await ipcRenderer.invoke("start-rdp", this.rdpConfig);

        } catch (e) {
            this.error = e;
        }

        // Empfang von Bitmap-Frames
        ipcRenderer.on('rdp-bitmap', (event, bitmap) => {
            const imageData = this.ctx.createImageData(bitmap.width, bitmap.height);
            imageData.data.set(bitmap.data);
            this.ctx.putImageData(imageData, bitmap.x, bitmap.y);
        });

        // Empfang von Fehlern
        ipcRenderer.on('rdp-error', (event, error) => {
            this.error = error;
        });
    },
    methods: {
        handleMouseMove(event) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            ipcRenderer.send('rdp-input', { type: 'mouse', x, y, button: 0 });
        },
        handleClick(event) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const button = event.button === 2 ? 2 : 1;
            ipcRenderer.send('rdp-input', { type: 'mouse', x, y, button });
        },
        handleKeyDown(event) {
            ipcRenderer.send('rdp-input', { type: 'keyboard', keyCode: event.keyCode, event: true });
            setTimeout(() => {
                ipcRenderer.send('rdp-input', { type: 'keyboard', keyCode: event.keyCode, event: false });
            }, 50);
        }
    }
};
</script>

<style scoped>
div { outline: none; }
canvas { display: block; }
</style>
