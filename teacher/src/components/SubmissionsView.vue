<template>
    <div v-if="visible" class="sv-overlay" @click.self="$emit('close')">
        <div class="sv-modal" @click.stop>

            <!-- Header -->
            <div class="sv-header">
                <div class="sv-title">
                    <img src="/src/assets/img/svg/eye-fill.svg" class="white" width="18" height="18" style="vertical-align: -3px; margin-right: 6px;">
                    {{ $t('submissionsview.title') }}
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button
                        class="btn btn-sm btn-teal d-flex align-items-center gap-1"
                        :class="lockPdfSummary ? 'disabledexam' : ''"
                        :title="$t('dashboard.summarizepdf')"
                        @click="$emit('get-latest')">
                        <img src="/src/assets/img/svg/edit-copy.svg" width="15" height="15">
                        {{ $t('dashboard.summarizepdfshort') }}
                    </button>
                    <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
                </div>
            </div>

            <!-- Info bar -->
            <div class="sv-infobar">
                <div class="sv-chip">
                    <span class="sv-chip-label">{{ $t('submissionsview.total') }}</span>
                    <span class="sv-chip-value">{{ submissionsNumber }} / {{ submissions.length }}</span>
                </div>
            </div>

            <!-- Empty state -->
            <div v-if="!submissions || submissions.length === 0" class="sv-empty">
                {{ $t('submissionsview.nodata') }}
            </div>

            <!-- Table -->
            <div v-else class="sv-content">
                <table class="sv-table">
                    <thead>
                        <tr>
                            <th>{{ $t('submissionsview.student') }}</th>
                            <th>{{ $t('submissionsview.section') }}</th>
                            <th>{{ $t('submissionsview.file') }}</th>
                            <th>{{ $t('submissionsview.date') }}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-for="student in submissions" :key="student.studentName">
                            <template v-for="(sectionData, sectionIdx) in sectionsWithSubmission(student)" :key="sectionIdx">
                                <tr :class="sectionIdx === 0 ? 'sv-row-first' : 'sv-row-cont'">
                                    <td v-if="sectionIdx === 0" :rowspan="sectionsWithSubmission(student).length || 1" class="sv-td-name">
                                        <b>{{ student.studentName }}</b>
                                    </td>
                                    <td class="sv-td sv-td-section">{{ sectionData.sectionname }}</td>
                                    <td class="sv-td sv-td-file">
                                        <span class="sv-file-link" @click="$emit('open-pdf', { path: sectionData.path, name: sectionData.filename })">{{ sectionData.filename }}</span>
                                    </td>
                                    <td class="sv-td sv-td-date">{{ sectionData.date ? new Date(sectionData.date).toLocaleString('de-DE') : '' }}</td>
                                    <td class="sv-td sv-td-check">
                                        <img src="/src/assets/img/icon-checkmark.png" width="18" height="18" class="sv-checkmark">
                                    </td>
                                </tr>
                            </template>
                            <!-- Student without any submission -->
                            <tr v-if="sectionsWithSubmission(student).length === 0" class="sv-row-first sv-row-nosub">
                                <td class="sv-td-name"><b>{{ student.studentName }}</b></td>
                                <td class="sv-td" colspan="4"></td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

        </div>
    </div>
</template>

<script>
export default {
    name: 'SubmissionsView',

    props: {
        visible:           { type: Boolean, default: false },
        submissions:       { type: Array,   default: () => [] },
        submissionsNumber: { type: Number,  default: 0 },
        lockPdfSummary:    { type: Boolean, default: false },
    },

    emits: ['close', 'get-latest', 'open-pdf'],

    methods: {
        sectionsWithSubmission(student) {
            const result = []
            for (let s = 1; s <= 4; s++) {
                if (student.sections[s]?.path) {
                    result.push({ ...student.sections[s], sectionIdx: s })
                }
            }
            return result
        },
    },
}
</script>

<style scoped>
.sv-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 4000;
    display: flex; align-items: center; justify-content: center;
}
.sv-modal {
    width: 88vw; max-width: 1100px;
    max-height: 88vh;
    background: rgb(33, 37, 41);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    display: flex; flex-direction: column;
}
.sv-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: rgb(20, 23, 26);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
}
.sv-title { color: #fff; font-weight: 600; font-size: 1.05rem; }

.sv-infobar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    padding: 8px 16px;
    background: rgb(27, 30, 33);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
}
.sv-chip {
    display: inline-flex; align-items: baseline; gap: 5px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
    padding: 3px 8px;
}
.sv-chip-label {
    color: rgba(255,255,255,0.45);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.sv-chip-value {
    color: #fff;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
}
.sv-empty {
    padding: 24px 16px;
    color: rgba(255,255,255,0.5);
}
.sv-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.15) transparent;
}
.sv-content::-webkit-scrollbar {
    width: 6px;
}
.sv-content::-webkit-scrollbar-track {
    background: transparent;
}
.sv-content::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}
.sv-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.28);
}
.sv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    color: rgba(255,255,255,0.85);
}
.sv-table thead th {
    text-align: left;
    padding: 6px 10px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255,255,255,0.4);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
}
.sv-td-name {
    padding: 8px 10px;
    vertical-align: top;
    border-top: 1px solid rgba(255,255,255,0.08);
    white-space: nowrap;
    color: #fff;
    font-size: 0.9rem;
}
.sv-td {
    padding: 6px 10px;
    vertical-align: top;
}
.sv-td-section {
    color: rgba(255,255,255,0.55);
    font-size: 0.8rem;
    white-space: nowrap;
}
.sv-td-file { word-break: break-word; }
.sv-file-link {
    color: var(--bs-info);
    cursor: pointer;
    text-decoration: none;
    transition: color 0.15s;
}
.sv-file-link:hover {
    color: #fff;
}
.sv-td-date {
    white-space: nowrap;
    color: rgba(255,255,255,0.35);
    font-size: 0.78rem;
}
.sv-td-check {
    text-align: center;
    width: 36px;
    padding: 4px 8px;
}
.sv-checkmark {
    display: block;
    margin: 0 auto;
}
.sv-row-first td { border-top: 1px solid rgba(255,255,255,0.08); }
.sv-row-cont td { border-top: 1px dashed rgba(255,255,255,0.05); }
.sv-row-nosub .sv-td-name { color: rgba(255,255,255,0.3); }
.disabledexam { opacity: 0.4; pointer-events: none; }
</style>
