# Editor/Sprachen Sidebar (Ansatz 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor/Sprachen settings live directly in the sidebar (no big settings dialog), persisted as AB-coupled config under `section.groupA.examConfig.editor` + `section.groupB.examConfig.editor`, with Custom LanguageTool Host configured via Swal2 + DNS/IP resolve check.

**Architecture:** Keep `dashboard.vue` mostly as UI + mapping methods; put editor config logic (ensure/migrate/apply patch + custom LT host dialog) into `teacher/src/utils/examsetup.js`. Migration moves legacy section-level editor fields into `examConfig.editor` when switching to `editor`.

**Tech Stack:** Vue (Options API), SweetAlert2 (`this.$swal`), Electron IPC (`window.ipcRenderer.invoke('resolveHostToIp', host)`), i18n JSON locale files (alphabetical key order).

---

## File Structure (what changes where)

**Modify**
- `teacher/src/utils/examsetup.js`
  - Add editor config helpers:
    - `ensureEditorExamConfig()`
    - `migrateLegacyEditorExamConfig()`
    - `setEditorExamConfigPatch(patch)`
    - `configureCustomLanguageToolHost()`
    - `removeCustomLanguageToolHost()`
- `teacher/src/pages/dashboard.vue`
  - Add `v-if="isExamType('editor')"` sidebar block rendering editor controls
  - Map/import the new examsetup functions
  - Call migration on `selectExamType('editor')`
- `teacher/src/locales/de.json`
- `teacher/src/locales/en.json`

**Do not create new components** (keep changes surgical inside existing `dashboard.vue`).

---

### Task 1: Add canonical editor config storage + migration in `examsetup.js`

**Files:**
- Modify: `teacher/src/utils/examsetup.js`

- [ ] **Step 1: Add helpers to ensure group + examConfig objects exist**

Add near other helpers (keep style consistent with surrounding code):

```js
function ensureGroupsAndExamConfig(section) {
    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};
    return { groupA, groupB };
}

function ensureEditorExamConfig(section) {
    const { groupA, groupB } = ensureGroupsAndExamConfig(section);
    if (!groupA.examConfig.editor) groupA.examConfig.editor = {};
    if (!groupB.examConfig.editor) groupB.examConfig.editor = {};
    return { groupA, groupB };
}
```

- [ ] **Step 2: Implement idempotent legacy migration**

Legacy fields currently live on `section` (confirmed in `configureEditor()`):
- `spellchecklang`
- `suggestions`
- `languagetool`
- `languagetoolhost`
- `languagetoolport`
- `cmargin` (`{side,size}`)
- `linespacing`
- `fontfamily`
- `fontsize`
- `audioRepeat`

Add:

```js
function migrateLegacyEditorExamConfig() {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const { groupA, groupB } = ensureEditorExamConfig(section);

    const legacyKeys = [
        'spellchecklang',
        'suggestions',
        'languagetool',
        'languagetoolhost',
        'languagetoolport',
        'cmargin',
        'linespacing',
        'fontfamily',
        'fontsize',
        'audioRepeat',
    ];

    const hasAnyLegacy = legacyKeys.some((k) => Object.prototype.hasOwnProperty.call(section, k));
    if (!hasAnyLegacy) return;

    // If editor already configured in examConfig, do not overwrite it.
    const alreadyHasEditorCfg =
        (groupA.examConfig.editor && Object.keys(groupA.examConfig.editor).length > 0) ||
        (groupB.examConfig.editor && Object.keys(groupB.examConfig.editor).length > 0);
    if (alreadyHasEditorCfg) {
        // still clean up legacy keys to stop future ambiguity
        for (const k of legacyKeys) {
            if (Object.prototype.hasOwnProperty.call(section, k)) delete section[k];
        }
        this.setServerStatus();
        return;
    }

    const next = {
        spellchecklang: section.spellchecklang ?? 'de-DE',
        suggestions: !!section.suggestions,
        languagetool: !!section.languagetool,
        languagetoolhost: section.languagetoolhost ?? null,
        languagetoolport: section.languagetoolport ?? null,
        cmargin: section.cmargin ?? { side: 'right', size: 3 },
        linespacing: section.linespacing ?? '2',
        fontfamily: section.fontfamily ?? 'sans-serif',
        fontsize: section.fontsize ?? '12pt',
        audioRepeat: section.audioRepeat ?? '0',
    };

    groupA.examConfig.editor = { ...next };
    groupB.examConfig.editor = { ...next };

    for (const k of legacyKeys) {
        if (Object.prototype.hasOwnProperty.call(section, k)) delete section[k];
    }

    this.setServerStatus();
}
```

- [ ] **Step 3: Add AB-coupled patch setter**

```js
function setEditorExamConfigPatch(patch) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const { groupA, groupB } = ensureEditorExamConfig(section);

    const prev = groupA.examConfig.editor || {};
    const next = { ...prev, ...patch };

    groupA.examConfig.editor = next;
    groupB.examConfig.editor = { ...next };

    this.backupinterval.stop();
    this.autobackup = false;
    this.setServerStatus();
}
```

- [ ] **Step 4: Implement Custom LT Host dialog functions**

Goal: mimic current behavior in `configureEditor()` (resolve to IPv4 while dialog open; save resolved IP with protocol).

Add:

```js
async function configureCustomLanguageToolHost() {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const { groupA } = ensureEditorExamConfig(section);
    const cfg = groupA.examConfig.editor || {};

    let resolvedLtIp = null;
    const inputHost = (cfg.languagetoolhost || '').toString();
    const inputPort = (cfg.languagetoolport || '8088').toString();

    const result = await this.$swal.fire({
        title: this.$t('dashboard.customhost'),
        icon: 'question',
        html: `
            <div class="my-content" style="text-align:left; margin:0 12px;">
                <label class="form-label">${this.$t('dashboard.host')}</label>
                <div style="position:relative;">
                    <input id="ltHost" class="form-control" value="${inputHost || ''}" placeholder="http://host-or-ip">
                    <span id="ltHostStatus" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-weight:bold; cursor:help;"></span>
                </div>
                <label class="form-label" style="margin-top:8px;">${this.$t('dashboard.port')}</label>
                <input id="ltPort" class="form-control" value="${inputPort}" placeholder="8088">
            </div>
        `,
        showCancelButton: true,
        cancelButtonText: this.$t('dashboard.cancel'),
        confirmButtonText: this.$t('dashboard.save'),
        didOpen: () => {
            const hostEl = document.getElementById('ltHost');
            const statusEl = document.getElementById('ltHostStatus');
            const setStatus = (state) => {
                if (!statusEl) return;
                if (state === 'ok') {
                    statusEl.textContent = '✓';
                    statusEl.style.color = '#28a745';
                    statusEl.title = this.$t('dashboard.host_ok');
                } else if (state === 'warn') {
                    statusEl.textContent = '▲';
                    statusEl.style.color = '#ffc107';
                    statusEl.title = this.$t('dashboard.host_warn');
                } else {
                    statusEl.textContent = '';
                    statusEl.removeAttribute('title');
                }
            };
            let t = null;
            const scheduleResolve = () => {
                const raw = hostEl?.value || '';
                if (!raw.trim()) {
                    resolvedLtIp = null;
                    setStatus('none');
                    return;
                }
                if (t) clearTimeout(t);
                t = setTimeout(async () => {
                    try {
                        const hostOnly = raw.trim().replace(/^https?:\/\//i, '').split('/')[0];
                        const res = await window.ipcRenderer?.invoke?.('resolveHostToIp', hostOnly);
                        if (!res || !res.ok || !res.ip) {
                            resolvedLtIp = null;
                            setStatus('warn');
                            return;
                        }
                        resolvedLtIp = res.ip;
                        setStatus('ok');
                    } catch (e) {
                        resolvedLtIp = null;
                        setStatus('warn');
                    }
                }, 600);
            };
            hostEl?.addEventListener('input', scheduleResolve);
            scheduleResolve();
        },
        preConfirm: () => {
            const hostEl = document.getElementById('ltHost');
            const portEl = document.getElementById('ltPort');
            const rawHost = (hostEl?.value || '').trim();
            const rawPort = (portEl?.value || '').trim();
            if (!rawHost) return this.$t('dashboard.host_required');
            if (rawPort && !/^\d+$/.test(rawPort)) return this.$t('dashboard.port_invalid');
            return true;
        },
    });

    if (!result.isConfirmed) return;

    const hostEl = document.getElementById('ltHost');
    const portEl = document.getElementById('ltPort');
    const rawHost = (hostEl?.value || '').trim();
    const rawPort = (portEl?.value || '').trim();
    const protocolMatch = rawHost.match(/^(https?:\/\/)/i);
    const protocol = protocolMatch ? protocolMatch[1] : 'http://';
    const hostForConfig = resolvedLtIp ? `${protocol}${resolvedLtIp}` : rawHost;

    setEditorExamConfigPatch.call(this, {
        languagetoolhost: hostForConfig,
        languagetoolport: rawPort || '8088',
    });
}

function removeCustomLanguageToolHost() {
    setEditorExamConfigPatch.call(this, {
        languagetoolhost: null,
        languagetoolport: null,
    });
}
```

- [ ] **Step 5: Export new functions**

At the bottom export list, add:
- `migrateLegacyEditorExamConfig`
- `setEditorExamConfigPatch`
- `configureCustomLanguageToolHost`
- `removeCustomLanguageToolHost`

- [ ] **Step 6: Run formatter/lints (if used) and ensure build still parses**

Run:
- `npm -C teacher run lint` (or the repo’s equivalent if available)

Expected: no syntax errors.

- [ ] **Step 7: Commit**

```bash
git add teacher/src/utils/examsetup.js
git commit -m "refactor(teacher): add editor examConfig helpers"
```

---

### Task 2: Add Editor settings block to sidebar (`dashboard.vue`)

**Files:**
- Modify: `teacher/src/pages/dashboard.vue`

- [ ] **Step 1: Import + map examsetup functions**

In the existing import from `../utils/examsetup.js`, add:
- `migrateLegacyEditorExamConfig`
- `setEditorExamConfigPatch`
- `configureCustomLanguageToolHost`
- `removeCustomLanguageToolHost`

In `methods: { ... }` map them like other `configure*` functions.

- [ ] **Step 2: Ensure migration is called when switching to editor**

In `selectExamType(type)` (confirmed it already calls `this.configureEditor()` for editor), replace that behavior:

```js
if (type === 'editor') {
    this.migrateLegacyEditorExamConfig();
    // editor is now configured via sidebar (except custom host dialog)
}
```

Also ensure `this.configureEditor()` is no longer triggered from the settings gear for editor (if that button currently routes to it).

- [ ] **Step 3: Add the new editor sidebar UI block**

Near the existing “Editor Spellcheck Info” line (currently only shows text), replace/extend with a full block:

```html
<!-- Editor / Sprachen Config -->
<div v-if="isExamType('editor')" class="basematerial-sidebar-block mt-3">
    <div class="basematerial-panel-caption">{{ $t('dashboard.texteditor') }}</div>

    <!-- language -->
    <div class="basematerial-row" style="align-items:center;">
        <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
        <select class="form-select form-select-sm"
                :value="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.spellchecklang || 'de-DE'"
                @change="setEditorExamConfigPatch({ spellchecklang: $event.target.value })">
            <option value="de-DE">{{ $t('dashboard.de') }}</option>
            <option value="en-GB">{{ $t('dashboard.en') }}</option>
            <option value="en-US">{{ $t('dashboard.en_us') }}</option>
            <option value="fr-FR">{{ $t('dashboard.fr') }}</option>
            <option value="es-ES">{{ $t('dashboard.es') }}</option>
            <option value="it-IT">{{ $t('dashboard.it') }}</option>
            <option value="sl-SI">{{ $t('dashboard.sl') }}</option>
            <option value="none">{{ $t('dashboard.none') }}</option>
        </select>
    </div>

    <!-- LT + suggestions -->
    <div class="mt-2" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button"
                class="btn btn-sm"
                :class="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool ? 'btn-teal' : 'btn-outline-secondary'"
                @click="setEditorExamConfigPatch({ languagetool: !serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool })">
            LanguageTool
        </button>
        <button type="button"
                class="btn btn-sm"
                :disabled="!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool"
                :class="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.suggestions ? 'btn-teal' : 'btn-outline-secondary'"
                @click="setEditorExamConfigPatch({ suggestions: !serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.suggestions })">
            {{ $t('dashboard.suggest') }}
        </button>
    </div>

    <!-- custom host -->
    <div class="mt-2">
        <div class="btn-group w-100" role="group">
            <button type="button"
                    class="btn btn-sm btn-outline-secondary"
                    :disabled="!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool"
                    @click="configureCustomLanguageToolHost()">
                {{ $t('dashboard.customhost') }}
            </button>
            <button type="button"
                    class="btn btn-sm btn-secondary"
                    :disabled="!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetoolhost"
                    :title="$t('dashboard.removefile')"
                    @click="removeCustomLanguageToolHost()">
                &times;
            </button>
        </div>
        <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetoolhost"
             class="small text-white-50 mt-1 text-truncate"
             :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolhost">
            {{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolhost }}
        </div>
    </div>

    <!-- margins / spacing / font / audio repeat -->
    <!-- implement each as compact selects or buttons, writing via setEditorExamConfigPatch -->
</div>
```

Then add the remaining controls using existing legacy fields as the authoritative set:
- `cmargin.size` (2..5 step 0.5) and `cmargin.side` (left/right)
- `linespacing` (1/2/3)
- `fontfamily` (serif/sans-serif)
- `fontsize` (8/10/12/14/16/18/20 pt)
- `audioRepeat` (0..4) using existing translations for labels already used in the old dialog

Each control reads from `groupA.examConfig.editor` (AB) and writes using `setEditorExamConfigPatch`.

- [ ] **Step 4: Remove/disable the old editor settings entry points**

Ensure:
- the settings gear does not call `configureEditor()` for editor anymore
- any “Spellcheck info” snippet uses `examConfig.editor.spellchecklang` (not `section.spellchecklang`)

- [ ] **Step 5: Commit**

```bash
git add teacher/src/pages/dashboard.vue
git commit -m "feat(teacher): move editor settings into sidebar"
```

---

### Task 3: i18n additions (only if needed)

**Files:**
- Modify: `teacher/src/locales/de.json`
- Modify: `teacher/src/locales/en.json`

- [ ] **Step 1: Add missing keys used by the new Swal2 dialog (if not already present)**

Potential new keys (only add those actually used):
- `dashboard.host`
- `dashboard.port`
- `dashboard.save`
- `dashboard.host_required`
- `dashboard.port_invalid`

- [ ] **Step 2: Keep keys alphabetically sorted within `dashboard`**

- [ ] **Step 3: Commit**

```bash
git add teacher/src/locales/de.json teacher/src/locales/en.json
git commit -m "chore(i18n): add editor sidebar strings"
```

---

### Task 4: Verification (manual + quick sanity)

**Files:**
- none

- [ ] **Step 1: Run teacher dev build**

Run:
- `npm -C teacher run dev`

Expected:
- app starts
- switching exam mode to “Sprachen” shows the new sidebar block

- [ ] **Step 2: Manual behavior checks**

- Switch to editor: migration runs (legacy keys removed; new `groupA/groupB.examConfig.editor` populated)
- Change each setting: values persist; switching sections preserves config
- Enable groups mode: still AB-coupled (A and B editor configs remain identical)
- Custom host: resolve ok/warn indicator; saved value becomes resolved IP with protocol when possible

---

## Self-Review Checklist (run while implementing)

- Spec coverage: All legacy editor settings moved into sidebar controls; custom host uses Swal2; AB-coupled writes.
- Placeholder scan: no “TODO/TBD”; all referenced functions exist and are exported/imported.
- Consistency: editor config reads from `groupA.examConfig.editor` and writes through `setEditorExamConfigPatch`.

