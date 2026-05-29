<template>
    <div class="activesheets-field-layer">
    <div
        v-for="field in page.formFields"
        v-show="fieldVisible(field.id)"
        :key="field.id"
        :class="wrapperClass(field.id)"
        :id="field.id + '_wrapper'"
        :style="field.style"
        @click.stop="onFieldClick(field.id, false)"
    >
        <template v-if="interactive">
            <input
                v-if="field.type === 'checkbox'"
                type="checkbox"
                :checked="field.checked"
                :name="field.name"
                :id="field.id"
                class="interactive-input checkbox"
            />
            <textarea
                v-else-if="field.type === 'textarea'"
                :name="field.name"
                :id="field.id"
                class="interactive-input textarea"
            >{{ field.value }}</textarea>
            <input
                v-else
                type="text"
                :value="field.value"
                :name="field.name"
                :id="field.id"
                class="interactive-input text"
            />
        </template>
    </div>

    <div
        v-for="cloze in page.clozeFields"
        v-show="fieldVisible(cloze.id)"
        :key="cloze.id"
        :class="wrapperClass(cloze.id, cloze.type === 'checkbox' || cloze.type === 'deselect')"
        :id="cloze.id + '_wrapper'"
        :style="cloze.style"
        @click.stop="onFieldClick(cloze.id, false)"
    >
        <template v-if="interactive">
            <input
                v-if="cloze.type === 'checkbox'"
                type="checkbox"
                :checked="cloze.checked || false"
                :name="cloze.id"
                :id="cloze.id"
                class="interactive-input checkbox"
            />
            <input
                v-else-if="cloze.type === 'deselect'"
                type="checkbox"
                :checked="cloze.checked || false"
                :name="cloze.id"
                :id="cloze.id"
                class="interactive-input checkbox deselect-checkbox"
            />
            <input
                v-else
                type="text"
                class="interactive-input cloze"
                :name="cloze.id"
                :id="cloze.id"
            />
        </template>
    </div>

    <div
        v-for="box in page.boxFields"
        v-show="fieldVisible(box.id)"
        :key="box.id"
        :class="wrapperClass(box.id, box.type === 'checkbox')"
        :id="box.id + '_wrapper'"
        :style="box.style"
        @click.stop="onFieldClick(box.id, false)"
    >
        <template v-if="interactive">
            <input
                v-if="box.type === 'checkbox'"
                type="checkbox"
                :name="box.id"
                :id="box.id"
                class="interactive-input checkbox"
            />
            <textarea
                v-else-if="box.type === 'textarea' || box.isTextarea"
                class="interactive-input textarea"
                :name="box.id"
                :id="box.id"
            ></textarea>
            <input
                v-else
                type="text"
                class="interactive-input table-cell"
                :name="box.id"
                :id="box.id"
            />
        </template>
    </div>

    <div
        v-for="customField in customFieldsForPage"
        v-show="fieldVisible(customField.id)"
        :key="customField.id"
        :class="wrapperClass(customField.id)"
        :id="customField.id + '_wrapper'"
        :style="customField.style"
        @click.stop="onFieldClick(customField.id, true)"
    >
        <template v-if="interactive">
            <textarea
                v-if="!customField.type || customField.type === 'textarea'"
                class="interactive-input textarea"
                :name="customField.id"
                :id="customField.id"
            ></textarea>
            <input
                v-else-if="customField.type === 'textinput'"
                type="text"
                class="interactive-input text"
                :name="customField.id"
                :id="customField.id"
            />
            <input
                v-else-if="customField.type === 'checkbox'"
                type="checkbox"
                class="interactive-input checkbox"
                :name="customField.id"
                :id="customField.id"
            />
            <input
                v-else
                type="checkbox"
                class="interactive-input checkbox deselect-checkbox"
                :name="customField.id"
                :id="customField.id"
            />
        </template>
    </div>
    </div>
</template>

<script>
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
        customFieldsForPage() {
            return (this.customFields || []).filter((f) => f.pageIndex === this.pageIndex);
        },
    },
    methods: {
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
