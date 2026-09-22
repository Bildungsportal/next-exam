<template>
    <div v-if="visible" class="examlog-overlay" @click.self="$emit('close')">
        <div class="examlog-modal" @click.stop>

            <!-- Header -->
            <div class="examlog-header">
                <div class="examlog-title">
                    <img src="/src/assets/img/svg/speedometer.svg" class="white" width="18" height="18" style="vertical-align: -3px; margin-right: 6px;">
                    {{ $t('examlog.title') }}
                </div>
                <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
            </div>

            <!-- Info bar -->
            <div class="examlog-infobar">
                <div class="examlog-chip">
                    <span class="examlog-chip-label">{{ $t('examlog.server') }}</span>
                    <span class="examlog-chip-value">{{ examName }}</span>
                </div>
                <div class="examlog-chip">
                    <span class="examlog-chip-label">{{ $t('examlog.start') }}</span>
                    <span class="examlog-chip-value">{{ examStart || '–' }}</span>
                </div>
                <div class="examlog-chip">
                    <span class="examlog-chip-label">{{ $t('examlog.end') }}</span>
                    <span class="examlog-chip-value">{{ examEnd || '–' }}</span>
                </div>
                <div class="examlog-chip">
                    <span class="examlog-chip-label">{{ $t('examlog.students') }}</span>
                    <span class="examlog-chip-value">{{ studentSummaries.length }}</span>
                </div>
                <div class="ms-auto d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-secondary" @click="showPrintPreview">
                        <img src="/src/assets/img/svg/print.svg" class="white" width="15" height="15" style="vertical-align: -2px;">
                        {{ $t('examlog.printpreview') }}
                    </button>
                    <button class="btn btn-sm btn-teal" @click="directPrint">
                        <img src="/src/assets/img/svg/print.svg" class="white" width="15" height="15" style="vertical-align: -2px;">
                        {{ $t('examlog.print') }}
                    </button>
                </div>
            </div>

            <!-- Empty state -->
            <div v-if="!events || events.length === 0" class="examlog-empty">
                {{ $t('examlog.nodata') }}
            </div>

            <!-- Content -->
            <div v-else class="examlog-content">

                <!-- General log: server events + exam settings -->
                <section v-if="serverEvents.length || examSettingsEvents.length" class="examlog-section">
                    <h3 class="examlog-section-title">{{ $t('examlog.generalLog') }}</h3>

                    <div v-if="serverEvents.length" class="examlog-server-strip">
                    <div v-for="(ev, idx) in serverEvents" :key="idx" class="examlog-server-event">
                        <span class="examlog-server-time">{{ ev.time }}</span>
                        <span class="examlog-server-dot" :class="serverDotClass(ev.type)"></span>
                        <span class="examlog-server-label" :class="serverLabelClass(ev.type)">{{ typeLabel(ev.type) }}</span>
                    </div>
                </div>

                <!-- Exam settings (snapshotted at each exam start) -->
                <div v-for="(ev, idx) in examSettingsEvents" :key="'settings-' + idx" class="examlog-settings">
                    <div class="examlog-settings-header">
                        <span class="examlog-server-time">{{ ev.time }}</span>
                        <span class="examlog-settings-title">{{ $t('examlog.settingsTitle') }}</span>
                        <span v-if="ev.settings.sectionName" class="examlog-settings-section">— {{ ev.settings.sectionName }}</span>
                    </div>
                    <div class="examlog-settings-grid examlog-settings-grid--ui">
                        <div class="examlog-settings-row">
                            <span class="examlog-settings-label">{{ $t('examlog.examMode') }}</span>
                            <span class="examlog-settings-value">{{ examTypeLabel(ev.settings.examtype) }}</span>
                        </div>
                        <div class="examlog-settings-row">
                            <span class="examlog-settings-label">{{ $t('examlog.groups') }}</span>
                            <span class="examlog-settings-value">{{ ev.settings.groups ? $t('examlog.groupsOn') : $t('examlog.groupsOff') }}</span>
                        </div>
                        <template v-for="gk in settingsGroupKeys(ev.settings)" :key="gk">
                            <div class="examlog-settings-grouphead">{{ groupLabel(gk) }}</div>
                            <div class="examlog-settings-row">
                                <span class="examlog-settings-label">{{ $t('examlog.baseMaterialUrl') }}</span>
                                <span class="examlog-settings-value">{{ formatSettingValue(ev.settings[gk].baseMaterialUrl) }}</span>
                            </div>
                            <div class="examlog-settings-row examlog-settings-row--stack">
                                <span class="examlog-settings-label">{{ $t('examlog.materials') }}</span>
                                <div class="examlog-settings-value examlog-settings-stack">
                                    <div v-if="!materialsItems(ev.settings[gk]).length" class="examlog-settings-line">–</div>
                                    <div v-for="(line, mi) in materialsItems(ev.settings[gk])" :key="mi" class="examlog-settings-line">{{ line }}</div>
                                </div>
                            </div>
                            <div v-if="ev.settings.examtype === 'editor'" class="examlog-settings-row">
                                <span class="examlog-settings-label">{{ $t('examlog.languagetool') }}</span>
                                <span class="examlog-settings-value">{{ formatLanguagetool(ev.settings[gk].languagetool) }}</span>
                            </div>
                        </template>
                    </div>
                </div>
                </section>

                <!-- Student log -->
                <section v-if="studentSummaries.length" class="examlog-section">
                    <h3 class="examlog-section-title">{{ $t('examlog.studentLog') }}</h3>
                    <div class="examlog-cards">
                    <div v-for="s in studentSummaries" :key="s.name" class="examlog-card">

                        <!-- Card header -->
                        <div class="examlog-card-header">
                            <div class="examlog-card-name">{{ s.name }}</div>
                            <div class="examlog-card-badges">
                                <span class="badge" :class="s.secured ? 'bg-danger' : 'bg-secondary'">
                                    {{ s.secured ? $t('examlog.secured') : $t('examlog.ev_unsecured') }}
                                </span>
                                <span v-if="s.kicked" class="badge bg-warning text-dark">
                                    {{ $t('examlog.kicked') }}
                                </span>
                            </div>
                        </div>

                        <!-- Card meta -->
                        <div class="examlog-card-meta">
                            <span v-if="s.hostname" class="examlog-meta-item">{{ s.hostname }}</span>
                            <span v-if="s.hostname && s.ip" class="examlog-meta-sep">|</span>
                            <span v-if="s.ip" class="examlog-meta-item">{{ s.ip }}</span>
                            <span v-if="s.virtualized || s.vmFindings?.isVM || s.webglFindings?.detected" class="examlog-meta-sep">|</span>
                            <span v-if="s.virtualized || s.vmFindings?.isVM || s.webglFindings?.detected" class="examlog-meta-item examlog-meta-warn">
                                {{ $t('dashboard.virtualized') }}
                                <span class="examlog-meta-details" v-if="vmDetails(s)"> ({{ vmDetails(s) }})</span>
                            </span>
                            <span v-if="s.remoteassistant" class="examlog-meta-sep">|</span>
                            <span v-if="s.remoteassistant" class="examlog-meta-item examlog-meta-warn">
                                {{ $t('examlog.ev_remoteassistant') }}
                                <span class="examlog-meta-details" v-if="remoteDetails(s)"> ({{ remoteDetails(s) }})</span>
                            </span>
                        </div>

                        <!-- Stats row -->
                        <div class="examlog-stats">
                            <div class="examlog-stat">
                                <span class="examlog-stat-label">{{ $t('examlog.submissions') }}</span>
                                <span class="examlog-stat-value" :class="s.submissionCount > 0 ? 'text-teal' : ''">{{ s.submissionCount }}</span>
                            </div>
                            <div class="examlog-stat">
                                <span class="examlog-stat-label">{{ $t('examlog.focuslost') }}</span>
                                <span class="examlog-stat-value" :class="s.focusLostCount > 0 ? 'text-warning' : ''">{{ s.focusLostCount }}</span>
                            </div>
                            <div class="examlog-stat">
                                <span class="examlog-stat-label">{{ $t('examlog.relogins') }}</span>
                                <span class="examlog-stat-value" :class="s.reloginCount > 0 ? 'text-warning' : ''">{{ s.reloginCount }}</span>
                            </div>
                            <div class="examlog-stat">
                                <span class="examlog-stat-label">{{ $t('examlog.printrequests') }}</span>
                                <span class="examlog-stat-value" :class="s.printRequests > 0 ? 'text-warning' : ''">{{ s.printRequests }}</span>
                            </div>
                        </div>

                        <!-- Timeline -->
                        <div class="examlog-timeline">
                            <div v-for="(ev, idx) in s.events" :key="idx" class="examlog-timeline-entry">
                                <span class="examlog-tl-time">{{ ev.time }}</span>
                                <span class="examlog-tl-dot" :class="dotClass(ev.type)"></span>
                                <span class="examlog-tl-label" :class="labelClass(ev.type)">{{ typeLabel(ev.type) }}</span>
                                <span v-if="idx + 1 < s.events.length" class="examlog-tl-sep">›</span>
                            </div>
                        </div>

                    </div>
                    </div>
                </section>
            </div>

        </div>
    </div>

    <!-- Hidden iframe for direct print -->
    <iframe ref="silentPrintFrame" :srcdoc="silentPrintHtml" style="position:fixed; width:0; height:0; border:none; opacity:0; pointer-events:none;" @load="onSilentFrameLoad"></iframe>

    <!-- Print preview overlay -->
    <div v-if="printPreviewVisible" class="examlog-overlay-print" @click.self="printPreviewVisible = false">
        <div class="examlog-modal-print" @click.stop>
            <div class="examlog-print-header">
                <span>{{ $t('examlog.printpreview') }}</span>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-teal" @click="triggerPrint">
                        <img src="/src/assets/img/svg/print.svg" class="white" width="15" height="15" style="vertical-align: -2px;">
                        {{ $t('examlog.print') }}
                    </button>
                    <button type="button" class="btn-close btn-close-white" @click="printPreviewVisible = false"></button>
                </div>
            </div>
            <iframe ref="printFrame" :srcdoc="printHtml" style="width:100%; flex:1; border:none; background:#fff;"></iframe>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ExamLog',
    props: {
        visible:   { type: Boolean, default: false },
        examName:  { type: String,  default: '' },
        examStart: { type: String,  default: null },
        examEnd:   { type: String,  default: null },
        events:    { type: Array,   default: () => [] },
    },

    emits: ['close'], // required: fragment root cannot inherit listeners (Vue 3)

    data() {
        return {
            printPreviewVisible: false,
            printHtml: '',
            silentPrintHtml: '',
            _silentPrintPending: false,
        }
    },

    computed: {
        SERVER_TYPES() {
            return ['serverstart', 'serverstop', 'examstart', 'examend']
        },

        serverEvents() {
            return (this.events || []).filter(ev =>
                this.SERVER_TYPES.includes(ev.type) || !ev.student
            )
        },

        studentSummaries() {
            const students = {}
            const SERVER_TYPES = this.SERVER_TYPES

            for (const ev of (this.events || [])) {
                if (SERVER_TYPES.includes(ev.type) || !ev.student) continue

                const name = ev.student
                if (!students[name]) {
                    students[name] = {
                        name,
                        hostname: ev.hostname || '',
                        ip: ev.ip || '',
                        secured: false,
                        kicked: false,
                        submissionCount: 0,
                        focusLostCount: 0,
                        reloginCount: 0,
                        printRequests: 0,
                        virtualized: false,
                        vmFindings: null,
                        webglFindings: null,
                        remoteassistant: null,
                        events: [],
                    }
                }
                const s = students[name]
                s.events.push(ev)

                // pick up security findings from any event that carries them
                if (ev.virtualized)     s.virtualized = true
                if (ev.vmFindings)      s.vmFindings = ev.vmFindings
                if (ev.webglFindings)   s.webglFindings = ev.webglFindings
                if (ev.remoteassistant) s.remoteassistant = ev.remoteassistant

                if (ev.type === 'login') {
                    if (s.kicked) {
                        s.reloginCount++
                        s.kicked = false
                    }
                }
                if (ev.type === 'relogin')    { s.reloginCount++ }
                if (ev.type === 'focuslost')  { s.focusLostCount++ }
                if (ev.type === 'submission') { s.submissionCount++ }
                if (ev.type === 'printrequest') { s.printRequests++ }
                if (ev.type === 'secured')        { s.secured = true }
                if (ev.type === 'unsecured')      { s.secured = false }
                if (ev.type === 'kick')           { s.kicked = true }
                if (ev.type === 'virtualized')    { s.virtualized = true; if (ev.vmFindings) s.vmFindings = ev.vmFindings; if (ev.webglFindings) s.webglFindings = ev.webglFindings }
                if (ev.type === 'remoteassistant') { s.remoteassistant = ev.remoteassistant || true }
            }

            return Object.values(students)
        },

        examSettingsEvents() {
            return (this.events || []).filter(ev => ev.type === 'examstart' && ev.settings)
        },
    },

    methods: {
        serverDotClass(type) {
            if (type === 'serverstart' || type === 'examstart') return 'sdot-success'
            if (type === 'serverstop'  || type === 'examend')   return 'sdot-danger'
            return 'sdot-secondary'
        },

        serverLabelClass(type) {
            if (type === 'serverstart' || type === 'examstart') return 'tl-success'
            if (type === 'serverstop'  || type === 'examend')   return 'tl-white'
            return ''
        },

        vmDetails(s) {
            const parts = []
            if (s.vmFindings?.reasons?.length) parts.push(...s.vmFindings.reasons)
            if (s.vmFindings?.vendor) parts.push('Vendor: ' + s.vmFindings.vendor)
            if (s.webglFindings?.vendor) parts.push('WebGL Vendor: ' + s.webglFindings.vendor)
            if (s.webglFindings?.renderer) parts.push('WebGL Renderer: ' + s.webglFindings.renderer)
            return parts.join(' | ') || '–'
        },

        remoteDetails(s) {
            const parts = []
            if (s.remoteassistant?.keywords?.length) parts.push('Keywords: ' + s.remoteassistant.keywords.join(', '))
            if (s.remoteassistant?.ports?.length) parts.push('Ports: ' + s.remoteassistant.ports.join(', '))
            return parts.join(' | ') || '–'
        },

        typeLabel(type) {
            if (!type) return ''
            const key = `examlog.ev_${type}`
            const translated = this.$t(key)
            return translated === key ? type : translated
        },

        examTypeLabel(examtype) {
            switch (examtype) {
                case 'math': return this.$t('dashboard.math')
                case 'editor': return this.$t('dashboard.lang')
                case 'eduvidual': return this.$t('dashboard.eduvidual')
                case 'forms': return this.$t('dashboard.forms')
                case 'website': return 'Website'
                case 'activesheets': return 'Active Sheets'
                case 'microsoft365': return this.$t('dashboard.microsoft365')
                case 'rdp': return 'RDP'
                case 'localvm': return 'LocalVM'
                default: return examtype || '–'
            }
        },

        settingsGroupKeys(settings) {
            if (!settings) return []
            return settings.groups ? ['groupA', 'groupB'] : ['groupA']
        },

        groupLabel(gk) {
            if (gk === 'groupB') return this.$t('examlog.groupB')
            return this.$t('examlog.groupA')
        },

        formatSettingValue(value) {
            return value || '–'
        },

        materialsItems(group) {
            return [
                ...(group?.materialsFiles || []),
                ...(group?.materialsUrls || []),
            ]
        },

        formatMaterialsList(group) {
            const items = this.materialsItems(group)
            return items.length ? items.join(', ') : '–'
        },

        formatLanguagetool(lt) {
            if (!lt?.enabled) return this.$t('examlog.languagetoolOff')
            const host = lt.host ? ` (${lt.host})` : ''
            if (lt.suggestions) return this.$t('examlog.languagetoolWithSuggestions') + host
            return this.$t('examlog.languagetoolWithoutSuggestions') + host
        },

        dotClass(type) {
            if (type === 'login' || type === 'relogin') return 'dot-success'
            if (type === 'focuslost')       return 'dot-danger'
            if (type === 'submission')      return 'dot-teal'
            if (type === 'printrequest')    return 'dot-warning'
            if (type === 'kick')            return 'dot-warning'
            if (type === 'secured')         return 'dot-danger'
            if (type === 'unsecured')       return 'dot-secondary'
            if (type === 'virtualized')     return 'dot-warning'
            if (type === 'remoteassistant') return 'dot-warning'
            return 'dot-secondary'
        },

        labelClass(type) {
            if (type === 'login' || type === 'relogin') return 'tl-success'
            if (type === 'focuslost')       return 'tl-danger'
            if (type === 'submission')      return 'tl-teal'
            if (type === 'printrequest')    return 'tl-warning'
            if (type === 'kick')            return 'tl-warning'
            if (type === 'secured')         return 'tl-white'
            if (type === 'virtualized')     return 'tl-warning'
            if (type === 'remoteassistant') return 'tl-warning'
            return ''
        },

        buildSettingsPrintHtml() {
            const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            const events = this.examSettingsEvents
            if (!events.length) return ''
            const blocks = events.map(ev => {
                const s = ev.settings
                const groupKeys = this.settingsGroupKeys(s)
                const rows = [
                    `<tr><th>${this.$t('examlog.examMode')}</th><td class="print-mono" colspan="3">${esc(this.examTypeLabel(s.examtype))}</td></tr>`,
                    `<tr><th>${this.$t('examlog.groups')}</th><td class="print-mono" colspan="3">${esc(s.groups ? this.$t('examlog.groupsOn') : this.$t('examlog.groupsOff'))}</td></tr>`,
                ]
                for (const gk of groupKeys) {
                    const g = s[gk]
                    rows.push(`<tr><th colspan="4" class="settings-grouphead print-mono">${esc(this.groupLabel(gk))}</th></tr>`)
                    rows.push(`<tr><th>${this.$t('examlog.baseMaterialUrl')}</th><td class="print-mono" colspan="3">${esc(this.formatSettingValue(g.baseMaterialUrl))}</td></tr>`)
                    const matLines = this.materialsItems(g)
                    const matCell = matLines.length
                        ? matLines.map(l => esc(l)).join('<br>')
                        : '–'
                    rows.push(`<tr><th>${this.$t('examlog.materials')}</th><td class="print-mono" colspan="3">${matCell}</td></tr>`)
                    if (s.examtype === 'editor') {
                        rows.push(`<tr><th>${this.$t('examlog.languagetool')}</th><td class="print-mono" colspan="3">${esc(this.formatLanguagetool(g.languagetool))}</td></tr>`)
                    }
                }
                return `<h3 class="settings-block-title print-mono">${esc(this.$t('examlog.settingsTitle'))} — ${esc(ev.time)}${s.sectionName ? ' — ' + esc(s.sectionName) : ''}</h3>
                <table class="settings-table"><tbody>${rows.join('')}</tbody></table>`
            }).join('')
            return blocks
        },

        showPrintPreview() {
            this.printHtml = this.buildPrintHtml()
            this.printPreviewVisible = true
        },

        triggerPrint() {
            this.$refs.printFrame?.contentWindow?.print()
        },

        directPrint() {
            this._silentPrintPending = true
            this.silentPrintHtml = this.buildPrintHtml()
        },

        onSilentFrameLoad() {
            if (!this._silentPrintPending) return
            this._silentPrintPending = false
            this.$refs.silentPrintFrame?.contentWindow?.print()
        },

        buildPrintHtml() {
            const tl = (type) => {
                const key = `examlog.ev_${type}`
                const t = this.$t(key)
                return t === key ? type : t
            }

            const sevs = this.serverEvents
            const times = (type) => sevs.filter(e => e.type === type).map(e => e.time).join(', ') || '–'
            const serverSummaryRow = `<tr>
                <td>${times('serverstart')}</td>
                <td>${times('serverstop')}</td>
                <td>${times('examstart')}</td>
                <td>${times('examend')}</td>
            </tr>`

            const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

            // Two-column cell: count/label left, detail lines stacked right (monospace).
            const splitMetricCell = (left, rightLines) => {
                const lines = (rightLines || []).map(t => esc(t))
                const leftStr = left === 0 || left === '0' ? '0' : String(left ?? '')
                const muted = leftStr === '0' || leftStr === 'Nein'
                const warn = leftStr === 'Ja'
                const nClass = (i) => `split-n${i === 0 && warn ? ' yes-warn' : ''}${i === 0 && muted ? ' muted' : ''}`
                if (!lines.length) {
                    return `<td class="split-metric"><table class="split-inner"><tr>
                        <td class="${nClass(0)}">${esc(leftStr || '0')}</td><td class="split-v"></td>
                    </tr></table></td>`
                }
                const rows = lines.map((line, i) =>
                    `<tr><td class="${nClass(i)}">${i === 0 ? esc(leftStr || lines.length) : ''}</td><td class="split-v">${line}</td></tr>`
                ).join('')
                return `<td class="split-metric"><table class="split-inner">${rows}</table></td>`
            }

            const splitTimesByType = (events, type) => {
                const times = events.filter(e => e.type === type).map(e => e.time)
                return splitMetricCell(times.length, times)
            }

            const splitTimeListCell = (times) => splitMetricCell(times.length, times)

            const splitYesDetailsCell = (yes, detailsStr) => {
                if (!yes) return splitMetricCell('Nein', [])
                const lines = detailsStr && detailsStr !== '–' ? detailsStr.split(' | ') : []
                return splitMetricCell('Ja', lines)
            }

            // Split login vs relogin times the same way studentSummaries counts reloginCount.
            const loginReloginTimes = (events) => {
                const loginTimes = []
                const reloginTimes = []
                let kicked = false
                for (const ev of events) {
                    if (ev.type === 'kick') kicked = true
                    else if (ev.type === 'relogin') {
                        reloginTimes.push(ev.time)
                        kicked = false
                    } else if (ev.type === 'login') {
                        if (kicked) {
                            reloginTimes.push(ev.time)
                            kicked = false
                        } else {
                            loginTimes.push(ev.time)
                        }
                    }
                }
                return { loginTimes, reloginTimes }
            }

            const studentRows = this.studentSummaries.map(s => {
                const { loginTimes, reloginTimes } = loginReloginTimes(s.events)
                const vmYes = s.virtualized || s.vmFindings?.isVM || s.webglFindings?.detected
                return `<tr>
                    <td class="print-mono">${esc(s.name)}</td>
                    <td class="print-mono">${esc(s.hostname || '–')}${s.ip ? ' | ' + esc(s.ip) : ''}</td>
                    ${splitTimeListCell(loginTimes)}
                    ${splitTimeListCell(reloginTimes)}
                    ${splitTimesByType(s.events, 'submission')}
                    ${splitTimesByType(s.events, 'focuslost')}
                    ${splitTimesByType(s.events, 'printrequest')}
                    ${splitTimesByType(s.events, 'kick')}
                    ${splitYesDetailsCell(vmYes, this.vmDetails(s))}
                    ${splitYesDetailsCell(!!s.remoteassistant, this.remoteDetails(s))}
                </tr>`
            }).join('')

            return `<!DOCTYPE html><html><head><meta charset="utf-8">
            <style>
                @page { size: A4 landscape; margin: 12mm; }
                * { box-sizing: border-box; }
                body { font-family: sans-serif; font-size: 9px; color: #111; margin: 8mm; }
                h2 { font-size: 12px; margin-bottom: 3px; }
                h3 { font-size: 9px; margin: 8px 0 3px 0; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                th, td { border: 1px solid #ccc; padding: 2px 4px; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; }
                th { background: #eee; font-size: 8px; }
                .server-table td { color: #555; }
                .print-mono, .split-inner { font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace; }
                .split-metric { padding: 0; vertical-align: top; }
                .split-inner { width: 100%; border-collapse: collapse; }
                .split-inner td { border: none; padding: 1px 3px; vertical-align: top; line-height: 1.35; }
                .split-n { width: 1.4em; text-align: right; font-weight: 700; white-space: nowrap; }
                .split-n.muted { color: #aaa; font-weight: 400; }
                .split-v { color: #444; }
                .yes-warn { color: #c77700; }
                .settings-block-title { font-size: 9px; margin: 10px 0 4px 0; color: #444; }
                .settings-table { margin-bottom: 8px; }
                .settings-table th { width: 22%; background: #f5f5f5; }
                .settings-grouphead { background: #e8e8e8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
            </style></head><body>
            <h2>${this.$t('examlog.title')} | ${this.examName}</h2>
            <div style="font-size:11px; margin-bottom:10px; color:#666;">
                ${this.$t('examlog.start')}: ${this.examStart || '–'} &nbsp;|&nbsp;
                ${this.$t('examlog.end')}: ${this.examEnd || '–'} &nbsp;|&nbsp;
                ${this.$t('examlog.students')}: <b>${this.studentSummaries.length}</b>
            </div>

            <h3>${this.$t('examlog.generalLog')}</h3>
            <table class="server-table">
                <thead>
                    <tr>
                        <th>${this.$t('examlog.ev_serverstart')}</th>
                        <th>${this.$t('examlog.ev_serverstop')}</th>
                        <th>${this.$t('examlog.ev_examstart')} (${this.$t('examlog.secured')})</th>
                        <th>${this.$t('examlog.ev_examend')} (${this.$t('examlog.ev_unsecured')})</th>
                    </tr>
                </thead>
                <tbody>${serverSummaryRow}</tbody>
            </table>

            ${this.buildSettingsPrintHtml()}

            <h3>${this.$t('examlog.studentLog')}</h3>
            <table class="students-table">
                <thead>
                    <tr>
                        <th>${this.$t('examlog.students')}</th>
                        <th>Host / IP</th>
                        <th>${this.$t('examlog.logins')}</th>
                        <th>${this.$t('examlog.relogins')}</th>
                        <th>${this.$t('examlog.submissions')}</th>
                        <th>${this.$t('examlog.focuslost')}</th>
                        <th>${this.$t('examlog.printrequests')}</th>
                        <th>${this.$t('examlog.kicked')}</th>
                        <th>${this.$t('dashboard.virtualized')}</th>
                        <th>${this.$t('dashboard.remoteassistant')}</th>
                    </tr>
                </thead>
                <tbody>${studentRows}</tbody>
            </table>
            </body></html>`
        },
    },
}
</script>

<style scoped>
/* Overlay & modal */
.examlog-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 4000;
    display: flex; align-items: center; justify-content: center;
}
.examlog-modal {
    width: 92vw; max-width: 1200px;
    height: 92vh; max-height: 92vh;
    background: rgb(33, 37, 41);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    display: flex; flex-direction: column;
}

/* Header */
.examlog-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: rgb(20, 23, 26);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
}
.examlog-title { color: #fff; font-weight: 600; font-size: 1.05rem; }

/* Info bar */
.examlog-infobar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    padding: 8px 16px;
    background: rgb(27, 30, 33);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
}
.examlog-chip {
    display: inline-flex; align-items: baseline; gap: 5px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
    padding: 3px 8px;
}
.examlog-chip-label {
    color: rgba(255,255,255,0.45);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.examlog-chip-value {
    color: #fff;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
}

/* Empty */
.examlog-empty { padding: 24px 16px; color: rgba(255,255,255,0.5); }

/* Content scroll area */
.examlog-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.15) transparent;
    /* Row typography tokens; marker uses whole px so layout rounding cannot vary per cell */
    --examlog-row-font-size: 0.75rem;
    --examlog-row-line-height: 1.4;
    --examlog-marker: 7px;
}
.examlog-content::-webkit-scrollbar {
    width: 6px;
}
.examlog-content::-webkit-scrollbar-track {
    background: transparent;
}
.examlog-content::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}
.examlog-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.28);
}

/* Section headings (general vs student log) */
.examlog-section {
    margin-bottom: 14px;
}
.examlog-section-title {
    color: rgba(255,255,255,0.5);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 8px 0;
}

/* Exam settings (snapshot at exam start) */
.examlog-settings {
    margin-bottom: 12px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.04);
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.08);
}
.examlog-settings-header {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px;
    margin-bottom: 8px;
}
.examlog-settings-title {
    color: rgba(255,255,255,0.85);
    font-weight: 600;
    font-size: 0.8rem;
}
.examlog-settings-section {
    color: rgba(255,255,255,0.45);
    font-size: 0.75rem;
}
.examlog-settings-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.examlog-settings-row {
    display: grid;
    grid-template-columns: minmax(7rem, 11rem) 1fr;
    gap: 8px;
    align-items: start;
    font-size: 0.73rem;
}
.examlog-settings-grouphead {
    color: var(--bs-teal);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 4px;
}
.examlog-settings-label {
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.65rem;
}
.examlog-settings-value {
    color: rgba(255,255,255,0.8);
    word-break: break-word;
}
.examlog-settings-grid--ui {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
    font-size: 0.72rem;
}
.examlog-settings-row--stack {
    align-items: start;
}
.examlog-settings-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.examlog-settings-line {
    color: rgba(255,255,255,0.75);
    line-height: 1.35;
}

/* Server strip */
.examlog-server-strip {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    margin-bottom: 12px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.04);
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.06);
}
.examlog-server-event {
    display: inline-grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    column-gap: 5px;
    font-size: var(--examlog-row-font-size);
    line-height: var(--examlog-row-line-height);
    font-family: inherit;
    font-weight: 400;
    color: rgba(255,255,255,0.55);
}
.examlog-server-time { color: rgba(255,255,255,0.35); }
.examlog-server-time,
.examlog-server-label,
.examlog-tl-time,
.examlog-tl-label,
.examlog-tl-sep {
    font-size: inherit;
    line-height: inherit;
    font-family: inherit;
    font-weight: inherit;
}
/* Marker row: grid centers empty spans; slight -em shift matches optical center to text cap height */
.examlog-server-dot,
.examlog-tl-dot {
    display: block;
    flex: none;
    width: var(--examlog-marker);
    height: var(--examlog-marker);
    min-width: var(--examlog-marker);
    min-height: var(--examlog-marker);
    max-width: var(--examlog-marker);
    max-height: var(--examlog-marker);
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 50%;
    box-sizing: border-box;
    place-self: center;
    transform: translateY(-0.05em);
}
.sdot-success  { background: var(--bs-success); }
.sdot-danger   { background: var(--bs-danger); }
.sdot-secondary { background: var(--bs-secondary); }

/* Cards grid */
.examlog-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.examlog-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 10px 12px;
}

/* Card header */
.examlog-card-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 4px;
}
.examlog-card-name {
    color: #fff; font-weight: 600; font-size: 0.9rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.examlog-card-badges { display: flex; gap: 4px; flex-shrink: 0; }

/* Card meta */
.examlog-card-meta {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-bottom: 6px;
}
.examlog-meta-item { color: rgba(255,255,255,0.4); font-size: 0.73rem; }
.examlog-meta-sep { color: rgba(255,255,255,0.15); font-size: 0.73rem; }
.examlog-meta-warn { color: var(--bs-warning) !important; cursor: default; }
.examlog-meta-details { color: rgba(255,255,255,0.45); font-size: 0.68rem; }

/* Stats + Timeline share the same 4-column grid so columns align */
.examlog-stats,
.examlog-timeline {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
}
.examlog-stats {
    margin-bottom: 0;
    border-bottom: 1px solid rgba(255,255,255,0.10);
}
.examlog-stat {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 4px 10px 4px 12px;
    border-right: 1px solid rgba(255,255,255,0.06);
}
.examlog-stat:last-child { border-right: none; }
.examlog-stat-label { color: rgba(255,255,255,0.4); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; }
.examlog-stat-value { font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.75); }
.text-teal   { color: var(--bs-teal) !important; }
.text-warning{ color: var(--bs-warning) !important; }

/* Timeline */
.examlog-timeline {
    padding: 4px 0;
    align-items: start;
}
.examlog-timeline-entry {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    align-self: start;
    column-gap: 5px;
    padding: 2px 6px 2px 12px;
    font-size: var(--examlog-row-font-size);
    line-height: var(--examlog-row-line-height);
    font-family: inherit;
    font-weight: 400;
    color: rgba(255,255,255,0.55);
    white-space: nowrap;
   
}
.examlog-timeline-entry:last-child { border-right: none; }
.examlog-tl-time { color: rgba(255,255,255,0.3); }
.dot-success   { background: var(--bs-success); }
.dot-danger    { background: var(--bs-danger); }
.dot-warning   { background: var(--bs-warning); }
.dot-teal      { background: var(--bs-teal); }
.dot-secondary { background: var(--bs-secondary); }
.examlog-tl-sep { color: rgba(255,255,255,0.2); }
.tl-success { color: var(--bs-success); }
.tl-danger  { color: var(--bs-danger); }
.tl-warning { color: var(--bs-warning); }
.tl-teal    { color: var(--bs-teal); }
.tl-white   { color: rgba(255,255,255,0.9); }

/* Print preview */
.examlog-overlay-print {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    z-index: 9100;
    display: flex; align-items: center; justify-content: center;
}
.examlog-modal-print {
    width: 88vw; max-width: 1100px;
    height: 80vh;
    background: rgb(33,37,41);
    border-radius: 10px;
    overflow: hidden;
    display: flex; flex-direction: column;
    box-shadow: 0 8px 40px rgba(0,0,0,0.8);
}
.examlog-print-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px;
    background: rgb(20,23,26);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    color: #fff; font-size: 0.9rem; font-weight: 600;
    flex-shrink: 0;
}
</style>
