# Editor/Sprachen Sidebar Redesign (Ansatz 1) — Design Spec

**Status:** draft (ready for review)  
**Date:** 2026-04-24  
**Scope:** `teacher/src/pages/dashboard.vue` sidebar UI + `teacher/src/utils/examsetup.js` editor-config logic helpers + `teacher/src/locales/{de,en}.json` strings

## Goal

Move all Editor/Sprachen settings into a dedicated sidebar block (`v-if="isExamType('editor')"`) and replace inline “Custom LT Host” inputs with a SweetAlert2 dialog that validates and performs a DNS/IP resolve check via IPC. Persist all settings under `section.groupA.examConfig.editor` and `section.groupB.examConfig.editor` while treating Editor settings as AB-coupled (write to both groups always).

## Non-goals

- Do not introduce new “basematerial” for editor (planned later).
- Do not migrate to Vue `<script setup>` or refactor unrelated dashboard code.
- Do not change existing exam modes’ behavior besides editor’s UI placement and persistence model.

## Current Constraints / Invariants

- Vue Options API is used in `teacher/src/pages/dashboard.vue`.
- “Groups mode” (`section.groups`) exists, but **Editor settings are intentionally not group-specific** right now: editing any Editor setting must persist to **both** A and B (AB-coupled).
- Storage location must be consistent with other modes: `section.groupA.examConfig.*` / `section.groupB.examConfig.*`.
- “Custom LT Host” must keep the existing “resolved IP” behavior (host → resolve to IP through IPC) rather than just saving raw hostname silently.

## Data Model

### Canonical storage

Under the active section:

- `section.groupA.examConfig.editor`: object
- `section.groupB.examConfig.editor`: object

These objects must be kept in sync (AB-coupled writes).

### Proposed shape

The exact keys should mirror whatever the app currently uses for Editor settings. The design requirement is:

- **All Editor settings currently adjustable via dialogs must become sidebar controls.**
- **Custom LT Host** is stored inside the same `examConfig.editor` object.

Example (names are illustrative; implementation must map to real existing keys):

- `language`
- `suggestions`
- `margins`
- `lineSpacing`
- `fontFamily`
- `fontSize`
- `audioRepeat`
- `languageTool.enabled`
- `languageTool.host` (string, user input)
- `languageTool.port` (number|string)
- `languageTool.resolvedIp` (string, from IPC resolve)

### AB-coupled write rule

Any update to editor config must apply to both:

- `section.groupA.examConfig.editor = <updated>`
- `section.groupB.examConfig.editor = <updated>`

This is true **even when** `section.groups === true`.

### Migration rule (legacy → examConfig.editor)

On first switch to `editor` exam type (or first time opening the editor sidebar block), migrate legacy section-level Editor fields into `groupA/groupB.examConfig.editor`.

Rules:

- Migration is idempotent (safe to run multiple times).
- When legacy values exist, populate `groupA.examConfig.editor` and `groupB.examConfig.editor` with the same values.
- Do not break existing configs if `examConfig.editor` already exists.
- After a successful migration, remove the legacy fields (only those directly related to editor settings).

## Sidebar UI (dashboard.vue)

### Placement

Add a dedicated block within the sidebar:

- `v-if="isExamType('editor')"` (or existing editor check)
- visually consistent with other basematerial/config blocks (no rounded corners, full width conventions already applied elsewhere)

### Controls

All editor settings must be directly visible and editable in the sidebar, except Custom LT Host input fields.

Controls should use existing UI patterns already present in the sidebar:

- `btn-group` / `btn` variants
- compact (`btn-sm`) where consistent
- `:disabled` / class toggles consistent with existing patterns

### Custom LT Host UX

Replace inline host/port input fields with:

- a checkbox/toggle “Custom LT Host” (or existing phrasing)
- when toggled on (or when clicking “configure”), open a SweetAlert2 dialog:
  - inputs: host, port (optional/required depending on current logic)
  - validation: host non-empty, port numeric if present
  - “DNS check”: call `ipcRenderer.invoke('resolveHostToIp', hostOnly)` and show success/failure inside the dialog (or block confirm until resolved, matching current behavior)
  - on confirm: persist into `examConfig.editor` (AB-coupled) including resolved IP
  - on cancel: do not change config

If the user disables Custom LT Host, clear the custom host settings in `examConfig.editor` (AB-coupled) and fall back to default LT host behavior.

## Logic / Helpers (examsetup.js)

Add/adjust helper functions for Editor configuration to keep `dashboard.vue` thin, consistent with the existing “dashboard imports + maps examsetup functions” approach.

Required helpers:

- `ensureEditorConfig()` (or similar): initialize `section.groupA/groupB` + `examConfig` + `examConfig.editor` objects safely.
- `migrateLegacyEditorConfig()` (idempotent) invoked at appropriate entry point (switch to editor, or open config).
- `setEditorConfigPatch(patch)` which applies a shallow/deep merge patch to both groups’ `examConfig.editor`, then calls `setServerStatus()` and handles backup/autobackup behavior consistent with other configure* functions.
- `configureCustomLanguageToolHost()` opens Swal2 and performs resolve-check via IPC and saves values (AB-coupled).
- `removeCustomLanguageToolHost()` clears custom host values (AB-coupled).

All functions must use **ES module imports** and follow the existing coding style in `teacher/src/utils/examsetup.js`.

## i18n

Add any new strings under `teacher/src/locales/de.json` and `teacher/src/locales/en.json` with keys under `dashboard.*` (or the existing namespace used by the sidebar).

Hard rule: keep keys **alphabetically sorted within each object**.

## Acceptance Criteria

- Editor/Sprachen sidebar shows all existing editor settings directly (no “open settings” dialogs), except Custom LT Host which uses Swal2.
- Toggling/changing any Editor setting updates `section.groupA.examConfig.editor` **and** `section.groupB.examConfig.editor`.
- With `section.groups` enabled, behavior is unchanged: settings are still AB-coupled (both groups required/updated).
- Legacy editor config (section-level) is migrated the first time editor is selected/opened; subsequent opens do not duplicate or overwrite newer `examConfig.editor` values.
- Custom LT Host dialog performs resolve check and persists resolved IP (and host/port) into `examConfig.editor`.
- No unrelated sidebar blocks/styles/logic are changed.

## Manual Test Plan (dev)

- Switch an exam section to `editor` and verify:
  - editor settings render in sidebar
  - changing a value updates both `groupA.examConfig.editor` and `groupB.examConfig.editor` in the in-memory `serverstatus`
- Enable groups mode and repeat: still both A and B update together.
- Configure Custom LT Host:
  - valid hostname resolves → saved
  - invalid hostname fails resolve → dialog blocks/communicates failure, no save
- Disable Custom LT Host → editor config clears custom host fields and default behavior resumes.

