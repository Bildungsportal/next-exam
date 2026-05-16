<template>
    <div v-if="visible" class="stv-overlay" @click.self="$emit('close')">
        <div class="stv-modal" @click.stop>
            <div class="stv-body">
                <div class="stv-actions">
                    <div class="stv-actions-buttons">
                        <button type="button" class="btn btn-sm btn-info stv-action" @click="$emit('send-files', student?.token)" :disabled="!student?.token">
                            {{ $t('dashboard.sendfileSingle') }}
                        </button>
                        <button type="button" class="btn btn-sm btn-info stv-action" @click="$emit('get-files', { token: student?.token, force: true })" :disabled="!student?.token">
                            {{ $t('dashboard.getfileSingle') }}
                        </button>
                        <button type="button" class="btn btn-sm btn-teal stv-action" @click="$emit('download-screenshot', student)" :disabled="!canSaveScreenshot">
                            {{ $t('dashboard.downloadScreenshot') }}
                        </button>
                        <button type="button" class="btn btn-sm btn-dark stv-action" @click="$emit('open-latest-folder', student)" :disabled="!student">
                            {{ $t('dashboard.shownewestfolder') }}
                        </button>
                        <button type="button" class="btn btn-sm btn-warning stv-action" @click="emitKick" :disabled="!student?.token">
                            {{ $t('dashboard.kick') }}
                        </button>
                    </div>
                    <transition name="stv-hint-fade">
                        <div v-if="screenshotSidebarHint" class="stv-sidebar-hint">{{ screenshotSidebarHint }}</div>
                    </transition>
                </div>

                <div class="stv-preview" :style="previewStyle">
                    <div class="stv-preview-overlay"></div>
                    <button type="button" class="btn-close btn-close-white stv-close" @click="$emit('close')"></button>
                    <div class="stv-preview-content">
                        <div class="stv-name">{{ truncate(student?.clientname, 12) }}</div>
                        <div class="stv-meta">{{ student?.clientip || '' }}</div>
                        <div class="stv-meta">{{ student?.hostname || '' }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'StudentView',

    props: {
        visible:      { type: Boolean, default: false },
        student:      { type: Object,  default: null },
        reachable:    { type: Boolean, default: false },
        screenshotSidebarHint: { type: String, default: '' },
    },

    emits: ['close', 'send-files', 'get-files', 'download-screenshot', 'open-latest-folder', 'kick'],

    computed: {
        canSaveScreenshot() {
            return !!(this.reachable && this.student?.imageurl && String(this.student.imageurl).startsWith('data:image/'))
        },

        previewStyle() {
            const url = (this.reachable && this.student?.imageurl) ? String(this.student.imageurl) : 'user-red.svg'
            return `background-image: url('${url}')`
        },
    },

    methods: {
        truncate(value, len = 18) {
            if (!value) return ''
            const s = String(value)
            return s.length > len ? s.substr(0, len) + '...' : s
        },

        emitKick() {
            this.$emit('kick', { token: this.student?.token, ip: this.student?.clientip })
            this.$emit('close')
        },
    },
}
</script>

<style scoped>
.stv-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 4000;
    display: flex;
    align-items: center;
    justify-content: center;
}
.stv-modal {
    width: 50vw;
    height: 50vh;
    max-width: 92vw;
    max-height: 80vh;
    min-width: 360px;
    min-height: 320px;
    background: rgb(33, 37, 41);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
}
.stv-body {
    display: flex;
    width: 100%;
    height: 100%;
}
.stv-preview {
    position: relative;
    flex: 1;
    min-height: 220px;
    background-size: cover;
    background-position: center;
}
.stv-preview-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.65));
}
.stv-close {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
}
.stv-preview-content {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 2;
}
.stv-name {
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1.2;
}
.stv-meta {
    color: rgba(255,255,255,0.7);
    font-size: 0.75rem;
    line-height: 1.2;
}
.stv-actions {
    width: 180px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    padding: 12px;
    background: rgb(20, 23, 26);
    border-right: 1px solid rgba(255,255,255,0.08);
}
.stv-actions-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
}
.stv-sidebar-hint {
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 0.68rem;
    line-height: 1.25;
    color: rgba(255,255,255,0.72);
    text-align: left;
}
.stv-hint-fade-enter-active,
.stv-hint-fade-leave-active {
    transition: opacity 0.35s ease;
}
.stv-hint-fade-enter-from,
.stv-hint-fade-leave-to {
    opacity: 0;
}
.stv-action {
    width: 100%;
}
.disabledexam {
    opacity: 0.4;
    pointer-events: none;
}
</style>
