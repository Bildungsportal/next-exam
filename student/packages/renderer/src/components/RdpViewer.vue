<!-- RdpViewer.vue -->
<template>
    <div ref="container" tabindex="0" @mousemove="handleMouseMove" @click="handleClick" @keydown="handleKeyDown">
        <canvas ref="canvas" :width="rdpWidth" :height="rdpHeight"></canvas>
        <div v-if="error" style="position: absolute; top: 100px; left: 50%; transform: translateX(-50%); color: #b02a37; z-index: 100000; text-align: center;">
            {{ error }} <br>
            <button class="btn btn-danger" @click="reconnect">Reconnect</button>
        </div>
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
                domain: 'Europagymnasium',         
                userName: 'gast01',   
                password: 'gast01',    
                ip: '10.1.1.72',  
                port: 3389,          
                width: 1280,
                height: 720
            }
        };
    },
    computed: {
        // Zugriff auf rdpConfig über serverstatus, angenommen als globales Datenobjekt im root
        //rdpConfig() {
            //return this.$root.serverstatus.examSections[this.$root.serverstatus.activeSection].rdpConfig;
        //}
    },
    async mounted() {
        this.canvas = this.$refs.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.$refs.container.focus();

      const cleanConfig = {
            domain: this.rdpConfig.domain,
            userName: this.rdpConfig.userName,
            password: this.rdpConfig.password,
            ip: this.rdpConfig.ip,
            port: this.rdpConfig.port,
            width: this.rdpConfig.width,
            height: this.rdpConfig.height
        };

        try {
            // Starte die RDP-Verbindung über den exposed ipcRenderer
            await ipcRenderer.invoke("start-rdp", cleanConfig);

        } catch (e) {
            this.error = e;
        }

        // Empfang von Bitmap-Frames
        ipcRenderer.on('rdp-bitmap', (event, bitmap) => {
            console.log(bitmap)
            try {
                const imageData = this.ctx.createImageData(bitmap.width, bitmap.height);
                imageData.data.set(bitmap.data);
                const x = Math.floor(bitmap.x) || 0;  // Fallback to 0 if undefined
                const y = Math.floor(bitmap.y) || 0;  // Fallback to 0 if undefined
                
                this.ctx.putImageData(imageData, x, y);
            } catch (error) {
                console.error('Error in rdp-bitmap handler:', error);
                console.error('Bitmap data:', bitmap);
            }
        });

        // Empfang von Fehlern
        ipcRenderer.on('rdp-error', (event, error) => {
            this.error = error;
        });
    },
    methods: {
        async reconnect(){
            console.log("RdpViewer.vue @ reconnect: reconnecting RDP connection")
            this.error = null;
            this.canvas = this.$refs.canvas;
            this.ctx = this.canvas.getContext('2d');
            this.$refs.container.focus();

            const cleanConfig = {
                domain: this.rdpConfig.domain,
                userName: this.rdpConfig.userName,
                password: this.rdpConfig.password,
                ip: this.rdpConfig.ip,
                port: this.rdpConfig.port,
                width: this.rdpConfig.width,
                height: this.rdpConfig.height
            }   

            try {
                await ipcRenderer.invoke("start-rdp", cleanConfig);
            } catch (e) {
                this.error = e;
            }
        },

        // handle mouse move
        handleMouseMove(event) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            ipcRenderer.send('rdp-input', { type: 'mouse', x, y, button: 0 });
        },

        // handle click
        handleClick(event) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const button = event.button === 2 ? 2 : 1;
            ipcRenderer.send('rdp-input', { type: 'mouse', x, y, button });
            },

        // handle key down
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
