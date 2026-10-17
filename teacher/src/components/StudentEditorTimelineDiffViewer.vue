<template>
    <div v-if="visible && normalizedEntries.length" class="etd-overlay" @click.self="$emit('close')">
        <div class="etd-modal" @click.stop>
            <div class="etd-header">
                <div class="etd-header-title">
                    <span>{{ $t('dashboard.editorTimelineDiffTitle') }}</span>
                    <span v-if="studentLabel" class="etd-header-sub">{{ studentLabel }}</span>
                </div>
                <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
            </div>
            <div class="etd-meta" v-if="metaLine">{{ metaLine }}</div>
            <div class="etd-scroll">
                <div ref="paperStage" class="etd-paper-stage">
                    <div ref="paperSheet" class="etd-paper-sheet" :style="paperSheetStyle">
                        <div class="etd-paper-frame">
                            <div class="etd-tiptap-mimic">
                                <div class="etd-prose-mirror" v-html="bodyHtml"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="etd-zoom-fab" @click.stop>
                    <button type="button" class="btn btn-sm btn-dark etd-zoom-btn" :title="$t('dashboard.zoomOut')" @click="paperZoomOut">
                        <img src="/src/assets/img/svg/zoom-out.svg" class="white" width="18" height="18" alt="">
                    </button>
                    <button type="button" class="btn btn-sm btn-dark etd-zoom-btn" :title="$t('dashboard.zoomIn')" @click="paperZoomIn">
                        <img src="/src/assets/img/svg/zoom-in.svg" class="white" width="18" height="18" alt="">
                    </button>
                </div>
            </div>
            <div class="etd-footer">
                <div class="etd-slider-row">
                    <label class="etd-slider-label etd-slider-label-main">{{ sliderLabel }}</label>
                    <span class="etd-slider-stats">{{ wordCountStatsLine }}</span>
                </div>
                <div class="etd-footer-controls">
                    <button
                        type="button"
                        class="btn btn-sm btn-dark etd-play-btn"
                        :title="timelinePlayButtonTitle"
                        :disabled="maxStep < 1"
                        @click="toggleTimelineAutoplay"
                    >
                        <span
                            class="etd-play-glyph"
                            :class="{ 'etd-play-glyph--pause': isTimelinePlaying }"
                            aria-hidden="true"
                        >
                            <template v-if="isTimelinePlaying">
                                <span class="etd-pause-bar"></span>
                                <span class="etd-pause-bar"></span>
                            </template>
                            <template v-else>▶</template>
                        </span>
                    </button>
                    <input
                        class="etd-range form-range etd-timeline-range"
                        type="range"
                        :min="0"
                        :max="maxStep"
                        step="1"
                        v-model.number="stepIndex"
                        @pointerdown="stopTimelineAutoplay"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    escapeHtml,
    diffPlainTextToSegments,
    segmentsToDiffHtml,
} from '../utils/studentEditorTimeline.js'

const PAPER_ZOOM_MIN = 0.45
const PAPER_ZOOM_MAX = 2.8
const PAPER_ZOOM_STEP = 0.1
const PAPER_ZOOM_FALLBACK = 1.6
const TIMELINE_AUTOPLAY_MS = 600

/** Count non-whitespace runs in plain text (same notion as word-level diff tokens). */
function countPlainWordRuns(s) {
    const m = String(s ?? '').match(/\S+/g)
    return m ? m.length : 0
}

export default {
    name: 'StudentEditorTimelineDiffViewer',

    props: {
        visible: { type: Boolean, default: false },
        document: { type: [Object, Array], default: null },
    },

    emits: ['close'],

    data() {
        return {
            stepIndex: 0,
            paperZoom: 1,
            timelineAutoplayTimer: null,
            isTimelinePlaying: false,
            _paperFitResizeHandler: null,
            _paperFitResizeDebounceTimer: null,
        }
    },

    computed: {
        timelinePlayButtonTitle() {
            return this.isTimelinePlaying
                ? this.$t('dashboard.editorTimelineAutoplayPause')
                : this.$t('dashboard.editorTimelineAutoplayPlay')
        },
        paperSheetStyle() {
            return { zoom: this.paperZoom }
        },
        normalizedEntries() {
            const d = this.document
            if (!d) return []
            if (Array.isArray(d)) return d
            if (Array.isArray(d.entries)) return d.entries
            return []
        },

        studentLabel() {
            const d = this.document
            if (d && !Array.isArray(d) && d.studentFolder) return String(d.studentFolder)
            return ''
        },

        metaLine() {
            const d = this.document
            if (!d || Array.isArray(d)) return ''
            const parts = []
            if (d.jsonPath) parts.push(d.jsonPath)
            if (d.generatedAt) parts.push(d.generatedAt)
            return parts.join(' · ')
        },

        maxStep() {
            const n = this.normalizedEntries.length
            return n > 0 ? n - 1 : 0
        },

        sliderLabel() {
            const total = this.normalizedEntries.length
            const base = this.$t('dashboard.editorTimelineDiffState', {
                index: this.stepIndex + 1,
                total,
            })
            const entry = this.normalizedEntries[this.stepIndex]
            const when = this.formatSnapshotDateTimeDe(entry)
            return when ? `${base} · ${when}` : base
        },

        wordCountStatsLine() {
            const entries = this.normalizedEntries
            if (!entries.length) return ''
            const i = Math.min(Math.max(0, this.stepIndex), entries.length - 1)
            const cur = entries[i]?.text ?? ''
            const n = countPlainWordRuns(cur)
            if (i <= 0) {
                const deltaStr = n === 0 ? '+0' : `+${n}`
                return this.$t('dashboard.editorTimelineDiffWordStats', { count: n, delta: deltaStr })
            }
            const prev = entries[i - 1]?.text ?? ''
            const prevN = countPlainWordRuns(prev)
            const d = n - prevN
            const deltaStr = d === 0 ? '+0' : d > 0 ? `+${d}` : String(d)
            return this.$t('dashboard.editorTimelineDiffWordStats', { count: n, delta: deltaStr })
        },

        bodyHtml() {
            const entries = this.normalizedEntries
            if (!entries.length) return ''
            const i = Math.min(Math.max(0, this.stepIndex), entries.length - 1)
            const cur = entries[i]?.text ?? ''
            if (i <= 0) {
                return `<div class="etd-plain">${escapeHtml(cur)}</div>`
            }
            const prev = entries[i - 1]?.text ?? ''
            const { tooLarge, segments } = diffPlainTextToSegments(prev, cur)
            const warn = tooLarge
                ? `<div class="etd-warn">${escapeHtml(this.$t('dashboard.editorTimelineDiffTooLong'))}</div>`
                : ''
            return `${warn}<div class="etd-plain etd-diffroot">${segmentsToDiffHtml(segments)}</div>`
        },
    },

    watch: {
        visible(v) {
            if (v) {
                this.stepIndex = this.maxStep
                this.$nextTick(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            this.fitPaperZoomToViewer()
                        })
                    })
                })
                this.scheduleScrollPaperToBottom()
                this.attachPaperStageResizeListener()
            } else {
                this.stopTimelineAutoplay()
                this.detachPaperStageResizeListener()
            }
        },

        document() {
            if (this.visible) {
                this.stopTimelineAutoplay()
                this.stepIndex = this.maxStep
                this.$nextTick(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            this.fitPaperZoomToViewer()
                        })
                    })
                })
                this.scheduleScrollPaperToBottom()
            }
        },

        stepIndex() {
            this.scheduleScrollPaperToBottom()
        },

        paperZoom() {
            this.scheduleScrollPaperToBottom()
        },
    },

    methods: {
        /** Parse timeline entry backup time to a Date (local components from ISO string or folder name). */
        snapshotEntryToDate(entry) {
            if (!entry) return null
            if (entry.timestamp) {
                const d = new Date(entry.timestamp)
                if (!Number.isNaN(d.getTime())) return d
            }
            const name = entry.timestamp_name
            if (!name) return null
            const m = String(name).match(/^(\d{4})(\d{2})(\d{2})_(\d{2})_(\d{2})_(\d{2})$/)
            if (!m) return null
            return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
        },

        /** Format snapshot date/time as DD.MM.YYYY HH:mm (German numeric, local exam clock). */
        formatSnapshotDateTimeDe(entry) {
            const d = this.snapshotEntryToDate(entry)
            if (!d || Number.isNaN(d.getTime())) return ''
            const dd = String(d.getDate()).padStart(2, '0')
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const yyyy = d.getFullYear()
            const hh = String(d.getHours()).padStart(2, '0')
            const mi = String(d.getMinutes()).padStart(2, '0')
            return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
        },

        /** Scroll paper stage to bottom so latest diff tail is visible after content updates. */
        scrollPaperToBottom() {
            const el = this.$refs.paperStage
            if (el && typeof el.scrollTop === 'number') {
                el.scrollTop = el.scrollHeight
            }
        },

        scheduleScrollPaperToBottom() {
            this.$nextTick(() => {
                this.scrollPaperToBottom()
                requestAnimationFrame(() => this.scrollPaperToBottom())
            })
        },

        /** Set paper zoom so the 210mm sheet fits the paper-stage width (measure at zoom 1). */
        fitPaperZoomToViewer() {
            if (!this.visible) return
            const stage = this.$refs.paperStage
            const sheet = this.$refs.paperSheet
            if (!stage || !sheet) return
            this.paperZoom = 1
            this.$nextTick(() => {
                requestAnimationFrame(() => {
                    if (!this.visible || !sheet.isConnected) return
                    const naturalW = sheet.getBoundingClientRect().width
                    if (!naturalW || naturalW < 4) {
                        this.paperZoom = PAPER_ZOOM_FALLBACK
                        return
                    }
                    const cs = window.getComputedStyle(stage)
                    const padX =
                        parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0')
                    const avail = Math.max(64, stage.clientWidth - padX - 2)
                    let z = avail / naturalW
                    z = Math.round(z * 100) / 100
                    this.paperZoom = Math.min(PAPER_ZOOM_MAX, Math.max(PAPER_ZOOM_MIN, z))
                })
            })
        },

        /** Window resize while viewer open — debounced refit. */
        attachPaperStageResizeListener() {
            this.detachPaperStageResizeListener()
            this._paperFitResizeHandler = () => {
                if (!this.visible) return
                if (this._paperFitResizeDebounceTimer != null) {
                    clearTimeout(this._paperFitResizeDebounceTimer)
                }
                this._paperFitResizeDebounceTimer = setTimeout(() => {
                    this._paperFitResizeDebounceTimer = null
                    this.fitPaperZoomToViewer()
                }, 80)
            }
            window.addEventListener('resize', this._paperFitResizeHandler)
        },

        detachPaperStageResizeListener() {
            if (this._paperFitResizeDebounceTimer != null) {
                clearTimeout(this._paperFitResizeDebounceTimer)
                this._paperFitResizeDebounceTimer = null
            }
            if (this._paperFitResizeHandler) {
                window.removeEventListener('resize', this._paperFitResizeHandler)
                this._paperFitResizeHandler = null
            }
        },

        /** Step paper zoom in/out (manual +/- buttons). */
        adjustPaperZoom(delta) {
            const next = Math.round((this.paperZoom + delta) * 10) / 10
            this.paperZoom = Math.min(PAPER_ZOOM_MAX, Math.max(PAPER_ZOOM_MIN, next))
        },

        paperZoomIn() {
            this.adjustPaperZoom(PAPER_ZOOM_STEP)
        },

        paperZoomOut() {
            this.adjustPaperZoom(-PAPER_ZOOM_STEP)
        },

        /** Stop auto-advance through timeline steps. */
        stopTimelineAutoplay() {
            if (this.timelineAutoplayTimer != null) {
                clearInterval(this.timelineAutoplayTimer)
                this.timelineAutoplayTimer = null
            }
            this.isTimelinePlaying = false
        },

        /** Toggle 600 ms auto-advance to next snapshot step. */
        toggleTimelineAutoplay() {
            if (this.isTimelinePlaying) {
                this.stopTimelineAutoplay()
                return
            }
            if (this.maxStep < 1) return
            if (this.stepIndex >= this.maxStep) {
                this.stepIndex = 0
            }
            this.isTimelinePlaying = true
            this.timelineAutoplayTimer = window.setInterval(() => {
                if (this.stepIndex >= this.maxStep) {
                    this.stopTimelineAutoplay()
                    return
                }
                this.stepIndex += 1
            }, TIMELINE_AUTOPLAY_MS)
        },
    },

    beforeUnmount() {
        this.detachPaperStageResizeListener()
        this.stopTimelineAutoplay()
    },
}
</script>

<style scoped>
.etd-overlay {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.78);
    z-index: 4200; /* above DashboardExplorer overlay (4100) */
    align-items: center;
    justify-content: center;
    padding: 8px;
    box-sizing: border-box;
}
.etd-modal {
    position: relative;
    /* At least 60vw wide; grow with A4+chrome up to 96vw */
    width: min(96vw, max(60vw, calc(210mm + 40px)));
    max-width: min(96vw, max(60vw, calc(210mm + 40px)));
    height: 80vh;
    max-height: 80vh;
    /* Korrekturrand ~30% schmaler als editor size-3 (30mm→21mm); Spalte 189mm → 210mm Blatt */
    --js-editorWidth: 180mm;
    --js-margin: 0 30mm 0 0;
    --js-borderright: 1px solid #ccc;
    --js-borderleft: 0px solid #ccc;
    --js-linespacing: 2;
    --js-fontfamily: sans-serif;
    --js-fontsize: 12pt;
    background-color: rgb(33, 37, 41);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.75);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.etd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgb(20, 23, 26);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
}
.etd-header-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
}
.etd-header-sub {
    font-size: 0.8rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.55);
}
.etd-meta {
    padding: 6px 16px;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.38);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    word-break: break-all;
}
.etd-scroll {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    background-color: #eeeefa;
}
/* Lavender work area + centered sheet (editor.vue #editormaincontainer + #editorcontainer) */
.etd-paper-stage {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: auto;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 20px 12px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    scrollbar-gutter: stable;
}
/* 210mm sheet; zoom from paperSheetStyle (fit-to-width on open) */
.etd-paper-sheet {
    width: 210mm;
    flex-shrink: 0;
    box-shadow: 0 0.35rem 1.1rem rgba(0, 0, 0, 0.16);
}
.etd-zoom-fab {
    position: absolute;
    right: 22px;
    bottom: 10px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    z-index: 4;
}
.etd-zoom-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.etd-zoom-btn img {
    display: block;
    margin: 0;
}
.etd-paper-frame {
    background-color: #fff;
    border: 1px solid #c5c5c5;
    border-radius: 0;
    box-sizing: border-box;
}
/* editor.vue #editorcontent div.tiptap — fixed text column width, no shrinking (stage scrolls) */
.etd-tiptap-mimic {
 
    margin-left: auto;
    margin-right: auto;
    box-sizing: border-box;
    font-size: var(--js-fontsize);
    line-height: var(--js-linespacing);
    font-family: var(--js-fontfamily);
    overflow-x: visible;
    overflow-y: visible;
    border-radius: 0;
}
/* editor.vue .ProseMirror padding + Korrekturrand margin + side border */
.etd-prose-mirror {
    padding: 5mm 1mm 5mm 8mm;
    margin: var(--js-margin);
    border-right: var(--js-borderright);
    border-left: var(--js-borderleft);
    margin-bottom: 4px;
    color: #000;
    background-color: #fff;
    border-radius: 0;
    outline: 0;
    box-sizing: border-box;
}
@media (max-width: 520px) {
    .etd-modal {
        width: min(100vw - 16px, max(60vw, calc(210mm + 40px)));
        max-width: min(100vw - 16px, max(60vw, calc(210mm + 40px)));
        --js-editorWidth: 202mm;
        --js-margin: 0 8mm 0 0;
    }
}
.etd-warn {
    font-size: 0.8rem;
    color: #856404;
    margin-bottom: 10px;
    padding: 0 4px;
}
.etd-footer {
    flex-shrink: 0;
    min-width: 0;
    padding: 10px 16px 14px;
    background: rgb(20, 23, 26);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.etd-footer-controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
}
.etd-play-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.etd-play-glyph {
    font-size: 0.95rem;
    line-height: 1;
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.etd-play-glyph--pause {
    gap: 5px;
    font-size: 0;
}
.etd-pause-bar {
    display: block;
    width: 4px;
    height: 12px;
    background-color: #fff;
    border-radius: 1px;
}
.etd-footer-controls .etd-range {
    flex: 1 1 auto;
    min-width: 0;
}
/* Same thumb as dashboard editor range — Bootstrap teal from app.scss (var --bs-teal) */
.etd-timeline-range::-webkit-slider-thumb {
    background-color: var(--bs-teal, #20c997);
}
.etd-timeline-range::-moz-range-thumb {
    background-color: var(--bs-teal, #20c997);
    border-color: var(--bs-teal, #20c997);
}
.etd-slider-row {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    width: 100%;
    min-width: 0;
}
.etd-slider-label {
    display: block;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
}
.etd-slider-label-main {
    flex: 1 1 auto;
    min-width: 0;
    margin-bottom: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.etd-slider-stats {
    flex: 0 0 auto;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
    text-align: right;
    white-space: nowrap;
}
:deep(.etd-plain) {
    white-space: pre-wrap;
    word-break: break-word;
    font-size: inherit;
    line-height: inherit;
    font-family: inherit;
    color: #000;
}
:deep(.etd-diffroot) {
    color: #000;
}
@keyframes etd-diff-bg-in-ins {
    from {
        background-color: color-mix(in srgb, var(--bs-teal, #20c997) 14%, transparent);
    }
    to {
        background-color: color-mix(in srgb, var(--bs-teal, #20c997) 44%, transparent);
    }
}
@keyframes etd-diff-bg-in-chg {
    from {
        background-color: rgba(255, 146, 43, 0.12);
    }
    to {
        background-color: rgba(255, 146, 43, 0.48);
    }
}
@keyframes etd-diff-bg-in-ins-ws {
    from {
        background-color: color-mix(in srgb, var(--bs-teal, #20c997) 6%, transparent);
    }
    to {
        background-color: color-mix(in srgb, var(--bs-teal, #20c997) 22%, transparent);
    }
}
@keyframes etd-diff-bg-in-chg-ws {
    from {
        background-color: rgba(255, 146, 43, 0.05);
    }
    to {
        background-color: rgba(255, 146, 43, 0.22);
    }
}
:deep(.etd-del),
:deep(.etd-ins),
:deep(.etd-chg-old),
:deep(.etd-chg-new) {
    color: #000;
    border-radius: 5px;
    padding: 0.06em 0.2em;
    margin: 0 0.03em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
}
:deep(.etd-del) {
    background-color: rgba(255, 107, 107, 0.4);
    text-decoration: line-through;
    text-decoration-color: rgba(0, 0, 0, 0.35);
}
:deep(.etd-ins) {
    background-color: color-mix(in srgb, var(--bs-teal, #20c997) 44%, transparent);
    animation: etd-diff-bg-in-ins 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
}
:deep(.etd-chg-old) {
    background-color: rgba(255, 146, 43, 0.3);
    text-decoration: line-through;
    text-decoration-color: rgba(0, 0, 0, 0.35);
}
:deep(.etd-chg-new) {
    background-color: rgba(255, 146, 43, 0.48);
    animation: etd-diff-bg-in-chg 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
}
:deep(.etd-del.etd-token-ws) {
    background-color: rgba(255, 107, 107, 0.16);
}
:deep(.etd-ins.etd-token-ws) {
    background-color: color-mix(in srgb, var(--bs-teal, #20c997) 22%, transparent);
    animation: etd-diff-bg-in-ins-ws 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
}
:deep(.etd-chg-old.etd-token-ws) {
    background-color: rgba(255, 146, 43, 0.14);
}
:deep(.etd-chg-new.etd-token-ws) {
    background-color: rgba(255, 146, 43, 0.22);
    animation: etd-diff-bg-in-chg-ws 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
    :deep(.etd-ins),
    :deep(.etd-chg-new) {
        animation: none;
    }
}
</style>
