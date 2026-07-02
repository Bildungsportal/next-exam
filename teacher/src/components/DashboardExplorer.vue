<template>
    <div v-if="visible" class="de-overlay" @click.self="$emit('close')">
        <div class="de-modal" @click.stop>

            <!-- Header -->
            <div class="wf-header">
                <div class="wf-header-title">
                    <img src="/src/assets/img/svg/folder-open.svg" class="me-2" width="20" height="20">
                    <span>{{ $t('dashboard.filesfolder') }}</span>
                </div>
                <div class="wf-header-actions">
                    <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
                </div>
            </div>

            <!-- Path + nav -->
            <div class="wf-path">
                <div class="btn btn-sm btn-dark d-flex align-items-center" @click="$emit('load-filelist', workdirectory)">
                    <img src="/src/assets/img/svg/go-home.svg" width="16" height="16">
                </div>
                <div v-if="currentdirectory !== workdirectory" class="btn btn-sm btn-dark d-flex align-items-center" @click="$emit('load-filelist', currentdirectoryparent)">
                    <img src="/src/assets/img/svg/edit-undo.svg" width="16" height="16">
                </div>
                <span class="wf-path-text">{{ currentdirectory }}</span>
            </div>

            <!-- File list -->
            <div class="wf-filelist">
                <div v-for="file in (localfiles || []).filter(f => f.type === 'file' || f.type === 'dir')" :key="file.path" class="wf-row">

                    <!-- name / open action -->
                    <div class="wf-name">
                        <div v-if="file.type === 'dir'" class="wf-entry wf-dir" @click="$emit('load-filelist', file.path)">
                            <img src="/src/assets/img/svg/folder-open.svg" width="18" height="18">
                            <span>{{ file.name }}</span>
                        </div>
                        <div v-else-if="file.ext === '.pdf'" class="wf-entry wf-pdf" @click="$emit('load-pdf', { path: file.path, name: file.name })">
                            <img src="/src/assets/img/svg/document.svg" width="18" height="18">
                            <span>{{ file.name }}</span>
                        </div>
                        <div v-else-if="['.png','.jpg','.webp','.jpeg'].includes(file.ext)" class="wf-entry wf-img" @click="$emit('load-image', file.path)">
                            <img src="/src/assets/img/svg/document.svg" width="18" height="18">
                            <span>{{ file.name }}</span>
                        </div>
                        <div v-else-if="file.ext === '.log'" class="wf-entry wf-log" @click="$emit('load-text', { path: file.path, name: file.name })">
                            <img src="/src/assets/img/svg/document.svg" width="18" height="18">
                            <span>{{ file.name }}</span>
                        </div>
                        <div v-else-if="isHtmlFile(file)" class="wf-entry wf-html" @click="$emit('load-html', { path: file.path, name: file.name })">
                            <img src="/src/assets/img/svg/document.svg" width="18" height="18">
                            <span>{{ file.name }}</span>
                        </div>
                        <div v-else class="wf-entry wf-other">
                            <img src="/src/assets/img/svg/document.svg" width="18" height="18">
                            <span>{{ file.name }}</span>
                        </div>
                    </div>

                    <!-- actions -->
                    <div class="wf-actions">
                        <div v-if="file.type === 'file' && file.ext === '.pdf'" class="btn btn-sm btn-dark" @click="$emit('load-pdf', { path: file.path, name: file.name })" :title="$t('dashboard.preview')">
                            <img src="/src/assets/img/svg/eye-fill.svg" class="white" width="16" height="16">
                        </div>
                        <div v-if="file.type === 'file' && ['.png','.jpg','.webp','.jpeg'].includes(file.ext)" class="btn btn-sm btn-dark" @click="$emit('load-image', file.path)" :title="$t('dashboard.preview')">
                            <img src="/src/assets/img/svg/eye-fill.svg" class="white" width="16" height="16">
                        </div>
                        <div v-if="file.type === 'file' && file.ext === '.log'" class="btn btn-sm btn-dark" @click="$emit('load-text', { path: file.path, name: file.name })" :title="$t('dashboard.preview')">
                            <img src="/src/assets/img/svg/eye-fill.svg" class="white" width="16" height="16">
                        </div>
                        <div v-if="file.type === 'file' && isHtmlFile(file)" class="btn btn-sm btn-dark" @click="$emit('load-html', { path: file.path, name: file.name })" :title="$t('dashboard.preview')">
                            <img src="/src/assets/img/svg/eye-fill.svg" class="white" width="16" height="16">
                        </div>
                        <div v-if="file.type === 'file'" class="btn btn-sm btn-dark" :class="lockSendFile ? 'disabledexam' : ''" @click="$emit('send-file', file)" :title="$t('dashboard.send')">
                            <img src="/src/assets/img/svg/document-send.svg" width="16" height="16">
                        </div>
                        <div v-if="file.type === 'dir' && isTimelineStudentDir(file)" class="btn btn-sm btn-dark" @click.stop="$emit('timeline-diff', file)" :title="$t('dashboard.editorTimelineDiffTooltip')">
                            <img src="/src/assets/img/svg/code-context.svg" class="" width="16" height="16" alt="">
                        </div>

                        <div class="btn btn-sm btn-dark" @click="$emit('download-file', file)" :title="$t('dashboard.download')">
                            <img src="/src/assets/img/svg/edit-download.svg" width="16" height="16">
                        </div>

                        <div class="btn btn-sm btn-dark" @click="$emit('delete-file', file)" :title="$t('dashboard.delete')">
                            <img src="/src/assets/img/svg/edit-delete.svg" width="16" height="16">
                        </div>
                    </div>

                </div>
            </div>

            <!-- Status bar -->
            <div class="wf-statusbar">
                <span class="wf-statusbar-label">Backup:</span>
                <span class="wf-statusbar-value">{{ backupdirectory.trim() || '-' }}</span>
            </div>

        </div>
    </div>
</template>

<script>
import { isStudentExplorerRowForTimeline } from '../utils/studentEditorTimeline.js'

const HTML_EXTENSIONS = ['.htm', '.html']

export default {
    name: 'DashboardExplorer',

    props: {
        visible:              { type: Boolean, default: false },
        localfiles:           { type: Array,   default: () => [] },
        currentdirectory:     { type: String,  default: '' },
        workdirectory:        { type: String,  default: '' },
        currentdirectoryparent: { type: String, default: '' },
        lockSendFile:         { type: Boolean, default: false },
        backupdirectory:      { type: String, default: '' },
    },

    emits: ['close', 'load-filelist', 'load-pdf', 'load-image', 'load-text', 'load-html', 'send-file', 'download-file', 'delete-file', 'timeline-diff'],

    methods: {
        isHtmlFile(file) {
            return file?.type === 'file' && HTML_EXTENSIONS.includes(file.ext)
        },
        isTimelineStudentDir(file) {
            return isStudentExplorerRowForTimeline(file, this.workdirectory)
        },
    },
}
</script>

<style scoped>
.de-overlay {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.75);
    z-index: 4100; /* above StudentView overlay (4000) */
    align-items: center;
    justify-content: center;
}
.de-modal {
    position: relative;
    width: 92vw;
    max-width: 1100px;
    min-height: 60vh;
    max-height: 88vh;
    background-color: rgb(33, 37, 41);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.wf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: rgb(20, 23, 26);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
    gap: 12px;
}
.wf-header-title {
    display: flex;
    align-items: center;
    color: #fff;
    font-size: 1.05rem;
    font-weight: 600;
}
.wf-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.wf-path {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgb(27, 30, 33);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
}
.wf-path-text {
    color: rgba(255,255,255,0.4);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.wf-filelist {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 8px 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.15) transparent;
}
.wf-filelist::-webkit-scrollbar {
    width: 6px;
}
.wf-filelist::-webkit-scrollbar-track {
    background: transparent;
}
.wf-filelist::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}
.wf-filelist::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.28);
}
.wf-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    gap: 8px;
}
.wf-row:hover { background: rgba(255,255,255,0.04); }
.wf-name { flex: 1; overflow: hidden; }
.wf-entry {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    max-width: 100%;
    overflow: hidden;
}
.wf-entry span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.85rem;
}
.wf-dir  span { color: var(--bs-success); }
.wf-pdf  span { color: var(--bs-info); }
.wf-img  span { color: var(--bs-info); }
.wf-log  span { color: var(--bs-warning); }
.wf-html span { color: var(--bs-info); }
.wf-other span { color: rgba(255,255,255,0.5); cursor: default; }
.wf-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}
.disabledexam { opacity: 0.4; pointer-events: none; }
.wf-statusbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: rgb(20, 23, 26);
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
}
.wf-statusbar-label {
    color: rgba(255,255,255,0.35);
    font-size: 0.72rem;
    flex-shrink: 0;
}
.wf-statusbar-value {
    color: rgba(255,255,255,0.5);
    font-size: 0.72rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
