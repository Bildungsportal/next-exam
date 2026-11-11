import { reactive } from 'vue';

// Lightweight exam event log store with debounced persistence.
const examEventBus = reactive({
    events: [],
    examStart: null,
    examEnd: null,
    _ipc: null,
    _servername: null,
    _saveTimer: null,

    async init(ipcRenderer, servername) {
        this._ipc = ipcRenderer;
        this._servername = servername;
        this.clearMemory();
        try {
            const saved = await ipcRenderer.invoke('loadExamLog', servername);
            if (saved) {
                this.events.splice(0, this.events.length, ...(saved.events || []));
                this.examStart = saved.examStart || null;
                this.examEnd = saved.examEnd || null;
            }
        } catch (_e) {
        }
    },

    push(type, student = {}, meta = null) {
        const now = new Date();
        const entry = {
            type,
            student: student?.clientname ?? '',
            hostname: student?.hostname ?? '',
            ip: student?.clientip ?? '',
            time: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            ts: now.getTime(),
        };
        if (student?.virtualized)      entry.virtualized = true;
        if (student?.vmFindings)       entry.vmFindings = student.vmFindings;
        if (student?.webglFindings)    entry.webglFindings = student.webglFindings;
        if (student?.remoteassistant)  entry.remoteassistant = student.remoteassistant;
        if (meta?.settings)            entry.settings = meta.settings;

        // Ignore duplicate IPC delivery (e.g. stacked submission listeners on dashboard remount).
        const last = this.events[this.events.length - 1];
        if (
            last
            && last.type === type
            && last.student === entry.student
            && entry.ts - last.ts <= 1
        ) {
            return;
        }

        this.events.push(entry);
        this._scheduleSave();
    },

    _scheduleSave() {
        if (!this._ipc || !this._servername) return;
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._save(), 800);
    },

    async _save() {
        if (!this._ipc || !this._servername) return false;
        const payload = JSON.parse(JSON.stringify({
            events: this.events,
            examStart: this.examStart,
            examEnd: this.examEnd,
        }));
        try {
            await this._ipc.invoke('saveExamLog', this._servername, payload);
            return true;
        } catch (_e) {
            return false;
        }
    },

    clearMemory() {
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this.events.splice(0, this.events.length);
        this.examStart = null;
        this.examEnd = null;
    },

    reset() {
        this.clearMemory();
        this._save();
    },
});

export default examEventBus;
