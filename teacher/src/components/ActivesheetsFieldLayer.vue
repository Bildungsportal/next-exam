<template>
    <div class="activesheets-field-layer">
    <div
        v-for="entry in orderedFieldsForPage"
        v-show="fieldVisible(entry.field.id)"
        :key="entry.field.id"
        :class="wrapperClass(entry.field.id, isCheckboxOverlay(entry))"
        :id="entry.field.id + '_wrapper'"
        :style="entry.field.style"
        @click.stop="onFieldClick(entry.field.id, entry.isCustom)"
    >
        <template v-if="interactive">
            <template v-if="entry.kind === 'form'">
                <input
                    v-if="entry.field.type === 'checkbox'"
                    type="checkbox"
                    :checked="entry.field.checked"
                    :name="entry.field.name"
                    :id="entry.field.id"
                    class="interactive-input checkbox"
                />
                <textarea
                    v-else-if="entry.field.type === 'textarea'"
                    :name="entry.field.name"
                    :id="entry.field.id"
                    class="interactive-input textarea"
                >{{ entry.field.value }}</textarea>
                <input
                    v-else
                    type="text"
                    :value="entry.field.value"
                    :name="entry.field.name"
                    :id="entry.field.id"
                    class="interactive-input text"
                />
            </template>
            <template v-else-if="entry.kind === 'cloze'">
                <input
                    v-if="entry.field.type === 'checkbox'"
                    type="checkbox"
                    :checked="entry.field.checked || false"
                    :name="entry.field.id"
                    :id="entry.field.id"
                    class="interactive-input checkbox"
                />
                <input
                    v-else-if="entry.field.type === 'deselect'"
                    type="checkbox"
                    :checked="entry.field.checked || false"
                    :name="entry.field.id"
                    :id="entry.field.id"
                    class="interactive-input checkbox deselect-checkbox"
                />
                <input
                    v-else
                    type="text"
                    class="interactive-input cloze"
                    :name="entry.field.id"
                    :id="entry.field.id"
                />
            </template>
            <template v-else-if="entry.kind === 'box'">
                <input
                    v-if="entry.field.type === 'checkbox'"
                    type="checkbox"
                    :name="entry.field.id"
                    :id="entry.field.id"
                    class="interactive-input checkbox"
                />
                <textarea
                    v-else-if="entry.field.type === 'textarea' || entry.field.isTextarea"
                    class="interactive-input textarea"
                    :name="entry.field.id"
                    :id="entry.field.id"
                ></textarea>
                <input
                    v-else
                    type="text"
                    class="interactive-input table-cell"
                    :name="entry.field.id"
                    :id="entry.field.id"
                />
            </template>
            <template v-else>
                <textarea
                    v-if="!entry.field.type || entry.field.type === 'textarea'"
                    class="interactive-input textarea"
                    :name="entry.field.id"
                    :id="entry.field.id"
                ></textarea>
                <input
                    v-else-if="entry.field.type === 'textinput'"
                    type="text"
                    class="interactive-input text"
                    :name="entry.field.id"
                    :id="entry.field.id"
                />
                <input
                    v-else-if="entry.field.type === 'checkbox'"
                    type="checkbox"
                    class="interactive-input checkbox"
                    :name="entry.field.id"
                    :id="entry.field.id"
                />
                <input
                    v-else
                    type="checkbox"
                    class="interactive-input checkbox deselect-checkbox"
                    :name="entry.field.id"
                    :id="entry.field.id"
                />
            </template>
        </template>
    </div>
    </div>
</template>

<script>
import { mergePageOverlayFields } from 'next-exam-shared/overlayFieldOrder.js';

export default {
    name: 'ActivesheetsFieldLayer',
    emits: ['deleteField', 'dismissMismatch'],
    props: {
        page: { type: Object, required: true },
        pageIndex: { type: Number, required: true },
        customFields: { type: Array, default: () => [] },
        blacklist: { type: Array, default: () => [] },
        interactive: { type: Boolean, default: true },
        editMode: { type: Boolean, default: false },
        drawMode: { type: String, default: 'textinput' },
        showMismatchOverlay: { type: Boolean, default: false },
        mismatchFieldIds: { type: Array, default: () => [] },
        dismissedMismatchIds: { type: Array, default: () => [] },
        deleteToolActive: { type: Boolean, default: false }, // dismiss mismatches nur wenn Annotation-Delete-Tool aktiv
    },
    computed: {
        orderedFieldsForPage() {
            return mergePageOverlayFields(this.page, this.customFields, this.pageIndex);
        },
    },
    methods: {
        isCheckboxOverlay(entry) {
            if (entry.kind === 'cloze') return entry.field.type === 'checkbox' || entry.field.type === 'deselect';
            if (entry.kind === 'box') return entry.field.type === 'checkbox';
            return false;
        },
        isBlacklisted(id) {
            return (this.blacklist || []).includes(id);
        },
        mismatchVisible(id) {
            return this.showMismatchOverlay
                && (this.mismatchFieldIds || []).includes(id)
                && !(this.dismissedMismatchIds || []).includes(id);
        },
        fieldVisible(id) {
            if (this.isBlacklisted(id)) return false;
            if (this.interactive) return true;
            return this.mismatchVisible(id);
        },
        wrapperClass(id, checkboxOverlay = false) {
            const classes = ['input-overlay'];
            if (checkboxOverlay) classes.push('checkbox-overlay');
            if (this.interactive && this.editMode && this.drawMode === 'delete') classes.push('delete-mode-field');
            if (this.mismatchVisible(id)) {
                classes.push('mismatch-overlay');
                if (this.deleteToolActive) classes.push('mismatch-overlay--deletable');
            }
            return classes;
        },
        onFieldClick(id, isCustom) {
            if (this.mismatchVisible(id) && this.deleteToolActive) {
                this.$emit('dismissMismatch', id);
                return;
            }
            if (this.interactive && this.editMode && this.drawMode === 'delete') {
                this.$emit('deleteField', id, isCustom);
            }
        },
    },
};
</script>

<style scoped>
.activesheets-field-layer {
    display: contents;
}

.input-overlay {
    position: absolute;
    pointer-events: auto;
    box-sizing: border-box;
}

.mismatch-overlay {
    background-color: rgba(220, 53, 69, 0.12);
    border: 1px solid rgba(220, 53, 69, 0.45);
    border-radius: 6px;
    z-index: 15;
}

.mismatch-overlay--deletable {
    cursor: pointer;
}

.delete-mode-field {
    cursor: crosshair !important;
    outline: 2px dashed rgba(220, 53, 69, 0.7);
}

.delete-mode-field:hover {
    outline: 2px solid rgb(220, 53, 69);
    background-color: rgba(220, 53, 69, 0.15) !important;
}

.checkbox-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
}

.interactive-input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    margin: 0;
    background-color: rgba(255, 230, 0, 0.15);
    border: 1px solid transparent;
}

.interactive-input:focus {
    background-color: rgba(255, 255, 255, 0.9);
    border: 2px solid #0d6efd;
    outline: none;
}

.interactive-input.checkbox {
    cursor: pointer;
    appearance: none;
    background-color: rgba(0, 38, 255, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.interactive-input.checkbox:checked {
    background-color: rgba(13, 109, 253, 0.5);
}

.interactive-input.checkbox.deselect-checkbox:checked {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cline x1='0' y1='100' x2='100' y2='0' stroke='%23000' stroke-width='8'/%3E%3C/svg%3E");
    background-size: 100% 100%;
}

.interactive-input.cloze,
.interactive-input.table-cell,
.interactive-input.text,
.interactive-input.textarea {
    background-color: rgba(0, 255, 0, 0.1);
    border: none;
    padding: 5px;
}

.interactive-input.textarea {
    resize: none;
}
</style>
