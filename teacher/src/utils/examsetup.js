
import CryptoJS from 'crypto-js';
import log from 'electron-log/renderer';
import { ensureQemuAvailableForLocalVmUi, showLocalVmQemuIssueDialog } from 'next-exam-shared/qemuLocalVmDialogs.js';
import { DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION,
    LOCAL_VM_DISPLAY_RESOLUTIONS,
    resolveLocalVmDisplayResolution,
} from 'next-exam-shared/localVmDisplayResolutions.js';
import { DEFAULT_EDITOR_EXAM_CONFIG } from 'next-exam-shared/editorExamConfig.js';
import psl from 'psl';

function ensureGroupsAndExamConfig(section) {
    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};
    return { groupA, groupB };
}

function ensureEditorExamConfig(section) {
    const { groupA, groupB } = ensureGroupsAndExamConfig(section);
    if (!groupA.examConfig.editor || !Object.keys(groupA.examConfig.editor).length) {
        groupA.examConfig.editor = { ...DEFAULT_EDITOR_EXAM_CONFIG };
    }
    if (!groupB.examConfig.editor || !Object.keys(groupB.examConfig.editor).length) {
        groupB.examConfig.editor = { ...DEFAULT_EDITOR_EXAM_CONFIG };
    }
    return { groupA, groupB };
}

/**
 * Website: configure per group (A/B) or for all (AB when groups off).
 * Stores settings in group.examConfig.website and removes legacy section.domainname/blockSub*.
 * @param {'a'|'b'|'all'|undefined} presetGroup
 */
async function configureWebsite(presetGroup) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : whoNorm === 'a' ? 'a' : 'a') : 'all';

    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};

    const currentConfig = activeGroup === 'b' ? (groupB.examConfig.website || {}) : (groupA.examConfig.website || {});
    let savedBlockSubdomains = !!currentConfig.blockSubdomains;
    let savedBlockSubfolders = !!currentConfig.blockSubfolders;

    const result = await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.website"),
        icon: 'question',
        input: 'text',
        inputValue: currentConfig.url || '',
        inputPlaceholder: 'https://www.classtime.com',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `
            <div class="my-content" style="margin-top: 10px; text-align: left; display: inline-block;">
                <label style="display: block; margin-bottom: 4px; font-size: 0.85em; cursor: pointer;" title="${this.$t("dashboard.blockSubdomainsInfo")}">
                    <input type="checkbox" id="websiteBlockSubdomains" style="margin-right: 6px;"${savedBlockSubdomains ? ' checked' : ''}> ${this.$t("dashboard.blockSubdomains")}
                </label>
                <label style="display: block; font-size: 0.85em; cursor: pointer;" title="${this.$t("dashboard.blockSubfoldersInfo")}">
                    <input type="checkbox" id="websiteBlockSubfolders" style="margin-right: 6px;"${savedBlockSubfolders ? ' checked' : ''}> ${this.$t("dashboard.blockSubfolders")}
                </label>
            </div>
            `,
        inputValidator: (value) => {
            if (!isValidFullDomainName(value)) return 'Invalid domain!'
        },
        preConfirm: () => {
            const blockSubdomainsEl = document.getElementById('websiteBlockSubdomains');
            const blockSubfoldersEl = document.getElementById('websiteBlockSubfolders');
            savedBlockSubdomains = blockSubdomainsEl ? blockSubdomainsEl.checked : false;
            savedBlockSubfolders = blockSubfoldersEl ? blockSubfoldersEl.checked : false;
        }
    });

    if (!result.isConfirmed) return;

    const url = String(result.value || '').trim();
    if (!isValidFullDomainName(url)) return;

    const nextConfig = { url, blockSubdomains: savedBlockSubdomains, blockSubfolders: savedBlockSubfolders };

    if (!hasGroups) {
        groupA.examConfig.website = nextConfig;
        groupB.examConfig.website = nextConfig;
    } else if (activeGroup === 'b') {
        groupB.examConfig.website = nextConfig;
    } else {
        groupA.examConfig.website = nextConfig;
    }

    if (Object.prototype.hasOwnProperty.call(section, 'domainname')) delete section.domainname;
    if (Object.prototype.hasOwnProperty.call(section, 'blockSubdomains')) delete section.blockSubdomains;
    if (Object.prototype.hasOwnProperty.call(section, 'blockSubfolders')) delete section.blockSubfolders;

    this.setServerStatus();
}


/**
 * Eduvidual: configure per group (A/B) or for all (AB when groups off).
 * Stores settings in group.examConfig.eduvidual and removes legacy section.moodle* fields.
 * @param {'a'|'b'|'all'|undefined} presetGroup
 */
async function configureEduvidual(presetGroup) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : 'a') : 'all';

    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};

    const currentConfig = activeGroup === 'b' ? (groupB.examConfig.eduvidual || {}) : (groupA.examConfig.eduvidual || {});
    
    let url = undefined;
    let sebConfigFile = undefined;
    let sebConfigPassword = undefined;
    let sebConfigBek = undefined;
    let sebConfig = undefined;

    const result = await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.eduvidualid"),
        icon: 'question',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `
            <div class="my-content" style="font-size: 1em;">
                <select id="typeSelect" class="swal2-input">
                    <option value="url" selected>URL</option>
                    <option value="seb">SEB</option>
                </select>
                <div id="urlConfig">
                    <div class="swal2-input-label">${this.$t("dashboard.eduvidualTestUrlHint")}</div>
                    <input id="url" type="url" class="swal2-input my-custom-input" placeholder="https://www.eduvidual.at/mod/quiz/view.php?id=6153159" style="display: flex;">
                </div>
                <div id="sebConfig" style="display: none;">
                    <div class="swal2-input-label" style="font-weight: bold;">${this.$t("dashboard.sebConfigHint")}</div>
                    <div class="swal2-input-label">${this.$t("dashboard.sebConfigFileHint")}</div>
                    <input id="sebConfigFile" type="file" class="swal2-file my-custom-input" style="display: flex;">
                    <div class="swal2-input-label">${this.$t("dashboard.sebConfigPasswordHint")}</div>
                    <input id="sebConfigPassword" type="text" class="swal2-input my-custom-input" placeholder="${this.$t("dashboard.sebConfigPasswordPlaceholer")}" style="display: flex;">
                    <div class="swal2-input-label">${this.$t("dashboard.sebConfigBekHint")}</div>
                    <input id="sebConfigBek" type="text" class="swal2-input my-custom-input" placeholder="${this.$t("dashboard.sebConfigBekPlaceholer")}" style="display: flex;">
                </div>
            </div>
        `,
        inputValidator: () => {
            const type    = document.getElementById('typeSelect');
            if (type.value === 'url') {
                const urlValue = document.getElementById('url').value;
                if (!urlValue || !isValidMoodleDomainName(urlValue)) return this.$t("dashboard.moodleInvalidDomain");
                const {testid} = extractDomainAndId(urlValue);
                if (!testid) return this.$t("dashboard.moodleInvalidId");
            }
        },
        didOpen: () => {
            const typeSelect    = document.getElementById('typeSelect');
            const urlDiv    = document.getElementById('urlConfig');
            const sebDiv    = document.getElementById('sebConfig');

            typeSelect.addEventListener('change', (e) => {
                //console.log('change');
                if (e.target.value === 'url') {
                    urlDiv.style.display  = 'block';
                    sebDiv.style.display  = 'none';
                } else {
                    urlDiv.style.display  = 'none';
                    sebDiv.style.display  = 'block';
                }
            });
        },
        preConfirm: async () => {
            const type = document.getElementById('typeSelect');
            if (type.value === 'url') {
                url = document.getElementById('url').value;
            } else {
                sebConfigFile = document.getElementById('sebConfigFile').files;
                sebConfigPassword = document.getElementById('sebConfigPassword').value;
                sebConfigBek = document.getElementById('sebConfigBek').value;
    
                if (sebConfigFile.length == 0) {
                    this.$swal.showValidationMessage(this.$t("dashboard.sebConfigNotSelected"));
                    return false;
                }
                const password = sebConfigPassword !== "" ? sebConfigPassword : undefined;
                const bek = sebConfigBek !== "" ? sebConfigBek : undefined;
                const configFile = password != null ?
                    await readFileAsBuffer(sebConfigFile[0]) :
                    await readFileAsText(sebConfigFile[0]);
                sebConfig = await window.ipcRenderer?.invoke?.('loadSEBConfig', configFile, password, bek);
                if (sebConfig == null) {
                    this.$swal.showValidationMessage(this.$t("dashboard.sebConfigReadingFailed"));
                    return false;
                }
                url = sebConfig.sebConfig.startURL;
            }
        }
    });

    if (!result.isConfirmed) return;
    if (!url) return;

    const { moodledomain, testid } = extractDomainAndId(url);
    const nextConfig = { url, moodleDomain: moodledomain, moodleTestId: testid };
    if (sebConfig != null) {
        Object.assign(nextConfig, sebConfig);
    }

    if (!hasGroups) {
        groupA.examConfig.eduvidual = nextConfig;
        groupB.examConfig.eduvidual = nextConfig;
    } else if (activeGroup === 'b') {
        groupB.examConfig.eduvidual = nextConfig;
    } else {
        groupA.examConfig.eduvidual = nextConfig;
    }

    if (Object.prototype.hasOwnProperty.call(section, 'moodleURL')) delete section.moodleURL;
    if (Object.prototype.hasOwnProperty.call(section, 'moodleTestId')) delete section.moodleTestId;
    if (Object.prototype.hasOwnProperty.call(section, 'moodleDomain')) delete section.moodleDomain;

    this.backupinterval.stop();
    this.autobackup = false;
    this.setServerStatus();
}


/**
 * Forms (Google or Microsoft): configure per group (A/B) or for all (AB when groups off).
 * Stores settings in group.examConfig.forms (Google + Microsoft Forms).
 * @param {'a'|'b'|'all'|undefined} presetGroup
 */
async function configureForms(presetGroup){
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : whoNorm === 'a' ? 'a' : 'a') : 'all';

    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};

    const currentConfig = activeGroup === 'b' ? (groupB.examConfig.forms || {}) : (groupA.examConfig.forms || {});

    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.forms"),
        icon: 'question',
        input: 'url',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `
        <div class="my-content" style="text-align:left; max-width: 520px; margin: 0 auto;">
            <p style="margin-bottom:8px;">
                ${this.$t("dashboard.formshint")}
            </p>
            <div style="font-size:0.85em; line-height:1.4; margin-top:4px;">
                <div style="margin-bottom:4px; font-weight:bold;">
                    ${this.$t("dashboard.forms_google_title")}
                </div>
                <div style="margin-left:10px; margin-bottom:8px;">
                    ${this.$t("dashboard.forms_google_hint")}
                </div>
                <div style="margin-bottom:4px; font-weight:bold;">
                    ${this.$t("dashboard.forms_ms_title")}
                </div>
                <div style="margin-left:10px;">
                    ${this.$t("dashboard.forms_ms_hint")}
                </div>
            </div>
        </div>`,
        didOpen: () => {
            const el = document.getElementsByClassName('my-custom-input')[0];
            if (el) el.value = currentConfig.url || '';
        },
        inputValidator: (value) => {
            if (!value) {return this.$t("dashboard.moodleInvalidId")}
            if (!isValidFullDomainName(value)) {return this.$t("dashboard.invalidDomain")}
        }
    }).then((input) => {
        const val = input.value ? input.value.trim() : "";
        if (!val) {
            return;
        }
        else {
            const url = val;
            let provider = 'unknown';
            try {
                const u = new URL(url);
                const host = (u.hostname || '').toLowerCase();
                if (host.includes('google') || host.includes('forms.gle')) provider = 'google';
                if (host.includes('office') || host.includes('microsoft')) provider = 'microsoft';
            } catch (e) {
                provider = 'unknown';
            }
            const nextConfig = { url, provider };

            if (!hasGroups) {
                groupA.examConfig.forms = nextConfig;
                groupB.examConfig.forms = nextConfig;
            } else if (activeGroup === 'b') {
                groupB.examConfig.forms = nextConfig;
            } else {
                groupA.examConfig.forms = nextConfig;
            }
            this.backupinterval.stop();
            this.autobackup = false;
        }
        this.setServerStatus()
    })  
}

async function getFormsID() {
    return configureForms.call(this, 'all');
}


/**
 * Math (GeoGebra)
 */
async function configureMath(){
    
    this.$swal.fire({
        title: this.$t("dashboard.math"),
        text: "OK",
        timer: 1000,
        timerProgressBar: true,
        didOpen: () => { this.$swal.showLoading() }
    });


    
}

/** Returns picked PDF File[] or null if dialog cancelled (native input, no SweetAlert file step). */
function pickPdfFilesFromUser() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,application/pdf';
        input.multiple = true;
        let settled = false;
        const settle = (files) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('focus', onWinFocus);
            input.remove();
            resolve(files && files.length ? files : null);
        };
        const onWinFocus = () => {
            setTimeout(() => {
                if (!settled && (!input.files || input.files.length === 0)) settle(null);
            }, 300);
        };
        input.addEventListener('change', () => {
            settle(input.files?.length ? Array.from(input.files) : null);
        });
        document.body.appendChild(input);
        window.addEventListener('focus', onWinFocus);
        requestAnimationFrame(() => input.click());
    });
}

function activesheetsIsPdfFile(file) {
    return (file.type && file.type.includes('pdf')) || (file.name && file.name.toLowerCase().endsWith('.pdf'));
}

function microsoft365IsTemplateFile(file) {
    const name = (file && file.name) ? String(file.name).toLowerCase() : '';
    return name.endsWith('.docx') || name.endsWith('.xlsx');
}

function editorTemplateIsAllowedFile(file) {
    const name = (file && file.name) ? String(file.name).toLowerCase() : '';
    return name.endsWith('.odt') || name.endsWith('.docx');
}

/** Returns picked .odt/.docx File or null if dialog cancelled (native input, same pattern as activesheets PDF picker). */
function pickEditorTemplateFromUser() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.odt,.docx,application/vnd.oasis.opendocument.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        input.multiple = false;
        let settled = false;
        const settle = (file) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('focus', onWinFocus);
            input.remove();
            resolve(file || null);
        };
        const onWinFocus = () => {
            setTimeout(() => {
                if (!settled && (!input.files || input.files.length === 0)) settle(null);
            }, 300);
        };
        input.addEventListener('change', () => {
            settle(input.files && input.files.length ? input.files[0] : null);
        });
        document.body.appendChild(input);
        window.addEventListener('focus', onWinFocus);
        requestAnimationFrame(() => input.click());
    });
}

/** Returns picked Office template File or null if dialog cancelled (native input). */
function pickOfficeTemplateFromUser() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        input.multiple = false;
        let settled = false;
        const settle = (file) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('focus', onWinFocus);
            input.remove();
            resolve(file || null);
        };
        const onWinFocus = () => {
            setTimeout(() => {
                if (!settled && (!input.files || input.files.length === 0)) settle(null);
            }, 300);
        };
        input.addEventListener('change', () => {
            settle(input.files && input.files.length ? input.files[0] : null);
        });
        document.body.appendChild(input);
        window.addEventListener('focus', onWinFocus);
        requestAnimationFrame(() => input.click());
    });
}

/**
 * Active Sheets (PDF Forms): native file picker; group preset from sidebar or default when opening from exam-type menu.
 * @param {'a'|'b'|'all'|undefined} presetGroup - With groups off, always "all"; with groups on, default "a" if omitted (call from sidebar with explicit preset).
 */
async function configureActivesheets(presetGroup) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    let activeGroup = 'all';
    if (!section.groups) {
        activeGroup = 'all';
    } else if (presetGroup === 'a' || presetGroup === 'b' || presetGroup === 'all') {
        activeGroup = presetGroup;
    } else {
        activeGroup = 'a';
    }

    const files = await pickPdfFilesFromUser();
    if (!files || !files.length) return;

    const bad = files.filter((f) => !activesheetsIsPdfFile(f));
    if (bad.length) {
        await this.$swal.fire({
            customClass: { popup: 'my-popup', title: 'my-title', content: 'my-content', actions: 'my-swal2-actions' },
            title: this.$t("dashboard.invalidpdf"),
            icon: 'error',
            showConfirmButton: true,
        });
        return;
    }

    this.status(this.$t("dashboard.processingfiles"));

    let firstFileBase64 = null;
    let firstFileName = null;
    for (const file of files) {
        try {
            const maxSizeBytes = 8 * 1024 * 1024;
            if (file.size > maxSizeBytes) {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                await this.$swal.fire({
                    customClass: { popup: 'my-popup', title: 'my-title', content: 'my-content', actions: 'my-swal2-actions' },
                    title: this.$t("dashboard.filesizewarning"),
                    html: `<div style="text-align: left;">${this.$t("dashboard.filesizewarningtext", { filename: file.name, size: fileSizeMB })}</div>`,
                    icon: 'warning',
                    showConfirmButton: true,
                    confirmButtonText: 'OK',
                });
            }

            if (!firstFileBase64) {
                firstFileBase64 = await readFileAsBase64(file);
                firstFileName = file.name;
            }

            await addFileAsExamMaterial(
                file,
                null,
                activeGroup,
                this.serverstatus,
                this.serverstatus.activeSection,
                true,
            );
        } catch (error) {
            console.error(`examsetup @ configureActivesheets: Error processing file ${file.name}:`, error);
        }
    }

    this.setServerStatus();

    if (firstFileBase64 && firstFileName && typeof this.showBase64PdfInRenderer === 'function') {
        const previewGroup = activeGroup === 'b' ? 'B' : 'A';
        this.showBase64PdfInRenderer(firstFileBase64, firstFileName, previewGroup);
    }
}

/**
 * Microsoft365: configure Office template per group (A/B) or for all (AB when groups off).
 * Stores template in group.examConfig.microsoft365.template (base64 + name).
 * @param {'a'|'b'|'all'|undefined} presetGroup
 */
async function configureMicrosoft365Template(presetGroup) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : whoNorm === 'a' ? 'a' : 'a') : 'all';

    const groupA = section.groupA;
    const groupB = section.groupB;
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};
    if (!groupA.examConfig.microsoft365) groupA.examConfig.microsoft365 = {};
    if (!groupB.examConfig.microsoft365) groupB.examConfig.microsoft365 = {};

    const file = await pickOfficeTemplateFromUser();
    if (!file) return;
    if (!microsoft365IsTemplateFile(file)) {
        await this.$swal.fire({
            customClass: { popup: 'my-popup', title: 'my-title', content: 'my-content', actions: 'my-swal2-actions' },
            title: this.$t("dashboard.invalid_file"),
            text: this.$t("dashboard.invalid_file_text"),
            icon: 'error',
            showConfirmButton: true,
        });
        return;
    }

    const filecontent = await readFileAsBase64(file);
    const template = { filename: file.name, filecontent, mimetype: file.type || '' };

    if (!hasGroups) {
        groupA.examConfig.microsoft365.template = template;
        groupB.examConfig.microsoft365.template = template;
    } else if (activeGroup === 'b') {
        groupB.examConfig.microsoft365.template = template;
    } else {
        groupA.examConfig.microsoft365.template = template;
    }

    this.setServerStatus();
}

/**
 * Editor exam: optional per-group ODT/DOCX template under examConfig.editor.editorTemplate (same subtree as spellcheck etc.).
 * @param {'a'|'b'|'all'|undefined} presetGroup
 */
async function configureEditorTemplate(presetGroup) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : whoNorm === 'a' ? 'a' : 'a') : 'all';

    const groupA = section.groupA;
    const groupB = section.groupB;
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};
    if (!groupA.examConfig.editor || typeof groupA.examConfig.editor !== 'object') groupA.examConfig.editor = {};
    if (!groupB.examConfig.editor || typeof groupB.examConfig.editor !== 'object') groupB.examConfig.editor = {};

    const file = await pickEditorTemplateFromUser();
    if (!file) return;
    if (!editorTemplateIsAllowedFile(file)) {
        await this.$swal.fire({
            customClass: { popup: 'my-popup', title: 'my-title', content: 'my-content', actions: 'my-swal2-actions' },
            title: this.$t('dashboard.editorTemplateInvalid'),
            text: this.$t('dashboard.editorTemplateInvalidText'),
            icon: 'error',
            showConfirmButton: true,
        });
        return;
    }

    const filecontent = await readFileAsBase64(file);
    const checksum = await calculateMD5(file);
    const filetype = determineFiletype(file, file.name);
    const template = { filename: file.name, filecontent, filetype, checksum };

    if (!hasGroups) {
        groupA.examConfig.editor.editorTemplate = { ...template };
        groupB.examConfig.editor.editorTemplate = { ...template };
    } else if (activeGroup === 'b') {
        groupB.examConfig.editor.editorTemplate = { ...template };
    } else {
        groupA.examConfig.editor.editorTemplate = { ...template };
    }

    this.setServerStatus();
}

function removeEditorTemplate(group) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const clearCfg = (g) => {
        if (!g?.examConfig?.editor || typeof g.examConfig.editor !== 'object') return;
        g.examConfig.editor.editorTemplate = {};
    };
    if (!section.groups || group === 'all') {
        clearCfg(section.groupA);
        clearCfg(section.groupB);
    } else if (group === 'b') {
        clearCfg(section.groupB);
    } else {
        clearCfg(section.groupA);
    }
    this.setServerStatus();
}

function removeMicrosoft365Template(group) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const clearCfg = (g) => {
        if (!g || !g.examConfig) return;
        if (!g.examConfig.microsoft365) g.examConfig.microsoft365 = {};
        g.examConfig.microsoft365.template = {};
    };
    if (!section.groups || group === 'all') {
        clearCfg(section.groupA);
        clearCfg(section.groupB);
    } else if (group === 'b') {
        clearCfg(section.groupB);
    } else {
        clearCfg(section.groupA);
    }
    this.setStudentStatus({ msofficeshare: false }, 'all');
    this.setServerStatus();
}

function removeWebsiteUrl(group) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const clearCfg = (g) => {
        if (!g || !g.examConfig) return;
        g.examConfig.website = {};
    };
    if (!section.groups || group === 'all') {
        clearCfg(section.groupA);
        clearCfg(section.groupB);
    } else if (group === 'b') {
        clearCfg(section.groupB);
    } else {
        clearCfg(section.groupA);
    }
    this.setServerStatus();
}

function removeEduvidualUrl(group) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const clearCfg = (g) => {
        if (!g || !g.examConfig) return;
        g.examConfig.eduvidual = {};
    };
    if (!section.groups || group === 'all') {
        clearCfg(section.groupA);
        clearCfg(section.groupB);
    } else if (group === 'b') {
        clearCfg(section.groupB);
    } else {
        clearCfg(section.groupA);
    }
    this.setServerStatus();
}

function removeRdp(group) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const clearCfg = (g) => {
        if (!g || !g.examConfig) return;
        g.examConfig.rdp = {};
    };
    if (!section.groups || group === 'all') {
        clearCfg(section.groupA);
        clearCfg(section.groupB);
    } else if (group === 'b') {
        clearCfg(section.groupB);
    } else {
        clearCfg(section.groupA);
    }
    this.setServerStatus();
}

function removeFormsUrl(group) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;
    const clearCfg = (g) => {
        if (!g || !g.examConfig) return;
        g.examConfig.forms = {};
    };
    if (!section.groups || group === 'all') {
        clearCfg(section.groupA);
        clearCfg(section.groupB);
    } else if (group === 'b') {
        clearCfg(section.groupB);
    } else {
        clearCfg(section.groupA);
    }
    this.setServerStatus();
}
/**
 * RDP
 */
async function configureRDP(presetGroup){
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : 'a') : 'all';

    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};

    const currentConfig = activeGroup === 'b' ? (groupB.examConfig.rdp || {}) : (groupA.examConfig.rdp || {});
    const currentValue = currentConfig.domain || '';

    const result = await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.rdp"),
        icon: 'question',
        html: `
            <div class="my-content">
                <div>${this.$t("dashboard.rdpconfiginfo")}</div>
                <div style="position:relative; margin-top:10px;">
                    <input id="rdpDomain" class="form-control" value="${currentValue}" placeholder="rdweb.schule.lan">
                    <span id="rdpDomainStatus" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-weight:bold; cursor:help;"></span>
                </div>
            </div>
        `,
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        didOpen: () => {
            const hostEl = document.getElementById('rdpDomain');
            const statusEl = document.getElementById('rdpDomainStatus');
            const confirmBtn = this.$swal.getConfirmButton();
            if (confirmBtn) confirmBtn.disabled = true;
            const setStatus = (state) => {
                if (!statusEl) return;
                if (state === 'ok') {
                    statusEl.textContent = '✓';
                    statusEl.style.color = '#28a745';
                    statusEl.title = this.$t('dashboard.host_ok');
                    if (confirmBtn) confirmBtn.disabled = false;
                } else if (state === 'warn') {
                    statusEl.textContent = '▲';
                    statusEl.style.color = '#ffc107';
                    statusEl.title = this.$t('dashboard.host_warn');
                    if (confirmBtn) confirmBtn.disabled = true;
                } else {
                    statusEl.textContent = '';
                    statusEl.removeAttribute('title');
                    if (confirmBtn) confirmBtn.disabled = true;
                }
            };
            let t = null;
            const scheduleResolve = () => {
                const raw = hostEl?.value || '';
                if (!raw.trim()) {
                    setStatus('none');
                    return;
                }
                if (t) clearTimeout(t);
                t = setTimeout(async () => {
                    try {
                        const rawTrimmed = raw.trim();
                        const asUrl = rawTrimmed.includes('://') ? rawTrimmed : `https://${rawTrimmed}`;
                        const u = new URL(asUrl);
                        const port = u.port ? Number.parseInt(u.port, 10) : (u.protocol === 'http:' ? 80 : 443);
                        const res = await window.ipcRenderer?.invoke?.('checkHostReachable', u.hostname, port, 1500);
                        if (!res || !res.ok) {
                            setStatus('warn');
                            return;
                        }
                        setStatus('ok');
                    } catch (e) {
                        setStatus('warn');
                    }
                }, 600);
            };
            hostEl?.addEventListener('input', scheduleResolve);
            scheduleResolve();
        },
        preConfirm: () => {
            const hostEl = document.getElementById('rdpDomain');
            const raw = String(hostEl?.value || '').trim();
            if (!raw) return this.$t("dashboard.invalidDomain");
            return (async () => {
                try {
                    const asUrl = raw.includes('://') ? raw : `https://${raw}`;
                    const u = new URL(asUrl);
                    const port = u.port ? Number.parseInt(u.port, 10) : (u.protocol === 'http:' ? 80 : 443);
                    const res = await window.ipcRenderer?.invoke?.('checkHostReachable', u.hostname, port, 1500);
                    if (!res || !res.ok) return this.$t('dashboard.host_warn');
                    return raw;
                } catch (e) {
                    return this.$t('dashboard.host_warn');
                }
            })();
        },
    });

    if (!result.isConfirmed) return;

    const raw = String(result.value || '').trim();
    if (!raw) return;

    let domain = raw;
    let protocol = 'https';
    try {
        const asUrl = raw.includes('://') ? raw : `https://${raw}`;
        const u = new URL(asUrl);
        protocol = u.protocol === 'http:' ? 'http' : 'https';
        domain = u.host;
    } catch (e) {
        domain = raw;
    }

    const nextConfig = { domain, protocol };

    if (!hasGroups) {
        groupA.examConfig.rdp = nextConfig;
        groupB.examConfig.rdp = nextConfig;
    } else if (activeGroup === 'b') {
        groupB.examConfig.rdp = nextConfig;
    } else {
        groupA.examConfig.rdp = nextConfig;
    }

    if (Object.prototype.hasOwnProperty.call(section, 'rdpConfig')) delete section.rdpConfig;
    this.setServerStatus();
}


/** IPC probe; false when QEMU / Hypervisor missing (shared swal + actions). */
async function ensureQemuAvailableForLocalVm(vm) {
    if (!window.ipcRenderer) {
        return false;
    }
    return ensureQemuAvailableForLocalVmUi({
        swal: vm.$swal,
        t: vm.$t.bind(vm),
        invoke: (channel, ...args) => window.ipcRenderer.invoke(channel, ...args),
        i18nPrefix: 'dashboard',
        cancelKey: 'cancel',
    });
}

function showQemuMissingWarning(vm, check = {}) {
    return showLocalVmQemuIssueDialog({
        swal: vm.$swal,
        t: vm.$t.bind(vm),
        invoke: (channel, ...args) => window.ipcRenderer?.invoke?.(channel, ...args),
        i18nPrefix: 'dashboard',
        check,
        cancelKey: 'cancel',
    });
}

/** Escape text for Swal HTML fragments built from i18n strings. */
function escapeSwalHtmlText(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

/** Mutable base disk vs immutable overlay — null when cancelled. */
async function promptLocalVmBootMode(vm, diskName) {
    const vmName = String(diskName || '').trim() || 'VM';
    const t = (key) => escapeSwalHtmlText(vm.$t(`dashboard.${key}`));
    const html = `<div style="text-align:left; font-size:0.95em;">
        <div style="padding:10px; border:1px solid rgba(32,201,151,0.55); border-radius:8px; margin-bottom:10px;">
            <div style="font-weight:700; color:#20c997;">${t('localvmBootImmutableBtn')}</div>
            <div style="color:#6c757d; margin-top:4px;">${t('localvmBootImmutableDesc')}</div>
        </div>
        <div style="padding:10px; border:1px solid rgba(255,193,7,0.35); border-radius:8px;">
            <div style="font-weight:700; color:#ffc107;">${t('localvmBootMutableBtn')}</div>
            <div style="color:#6c757d; margin-top:4px;">${t('localvmBootMutableDesc')}</div>
        </div>
        <div style="display:flex; gap:8px; margin-top:14px;">
            <button type="button" class="btn btn-teal" id="qemuBootImmutableBtn" style="flex:1;">${t('localvmBootImmutableBtn')}</button>
            <button type="button" class="btn btn-warning" id="qemuBootMutableBtn" style="flex:1;">${t('localvmBootMutableBtn')}</button>
        </div>
        <div style="margin-top:8px;">
            <button type="button" class="btn btn-cyan" id="qemuBootCancelBtn" style="width:100%;">${t('cancel')}</button>
        </div>
    </div>`;
    return await new Promise((resolve) => {
        let settled = false;
        const finish = (mode) => {
            if (settled) return;
            settled = true;
            try { vm.$swal.close(); } catch (e) {}
            resolve(mode);
        };
        vm.$swal.fire({
            customClass: {
                popup: 'my-popup',
                title: 'my-title',
                content: 'my-content',
                actions: 'd-none',
            },
            title: vm.$t('dashboard.localvmBootTitle', { name: vmName }),
            icon: 'question',
            html,
            showConfirmButton: false,
            showCancelButton: false,
            showDenyButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                document.getElementById('qemuBootImmutableBtn')?.addEventListener('click', () => finish('immutable'));
                document.getElementById('qemuBootMutableBtn')?.addEventListener('click', () => finish('mutable'));
                document.getElementById('qemuBootCancelBtn')?.addEventListener('click', () => finish(null));
            },
        }).then(() => {
            if (!settled) finish(null);
        });
    });
}

/** Boot qcow2; mode dialog then loader (reopens disk picker when presetGroup set). */
async function bootLocalVmDisk(vm, { ipc, diskName, presetGroup = null }) {
    const mode = await promptLocalVmBootMode(vm, diskName);
    if (!mode) {
        if (presetGroup != null) {
            setTimeout(() => { configureLocalVM.call(vm, presetGroup); }, 50);
        }
        return;
    }

    const useOverlay = mode === 'immutable';
    log.info(`examsetup @ bootLocalVmDisk: start disk=${diskName} mode=${mode}`);

    try {
        vm.$swal.fire({
            title: vm.$t('dashboard.localvmTitle'),
            text: useOverlay ? vm.$t('dashboard.localvmBootStartingImmutable') : vm.$t('dashboard.localvmBootStartingMutable'),
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => { vm.$swal.showLoading(); },
        });
    } catch (e) {}

    try {
        const bootRes = await ipc.invoke('qemu-boot-disk', { qcow2Name: diskName, useOverlay });
        try { vm.$swal.close(); } catch (e) {}
        if (bootRes?.qemuMissing) {
            await showQemuMissingWarning(vm, bootRes);
            return;
        }
        if (!bootRes?.ok) {
            await vm.$swal.fire({
                icon: 'error',
                title: vm.$t('dashboard.localvmTitle'),
                text: bootRes?.error || vm.$t('dashboard.localvmBootError'),
            });
            return;
        }
        await vm.$swal.fire({
            icon: 'success',
            title: vm.$t('dashboard.localvmTitle'),
            text: useOverlay ? vm.$t('dashboard.localvmBootSuccessImmutable') : vm.$t('dashboard.localvmBootSuccessMutable'),
            timer: 2800,
            showConfirmButton: false,
        });
        log.info('examsetup @ bootLocalVmDisk: ok');
    } catch (e) {
        try { vm.$swal.close(); } catch (err) {}
        log.error('examsetup @ bootLocalVmDisk', e);
        await vm.$swal.fire({
            icon: 'error',
            title: vm.$t('dashboard.localvmTitle'),
            text: String(e?.message || e),
        });
    } finally {
        if (presetGroup != null) {
            setTimeout(() => { configureLocalVM.call(vm, presetGroup); }, 50);
        }
    }
}

function buildQemuDiskRowsHtml(disks, selectedDisk) {
    return (disks || []).map((d) => {
        const raw = String(d);
        const safeLabel = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const encoded = encodeURIComponent(raw);
        const isActive = raw === selectedDisk;
        return `<div class="qemu-row" style="display:flex; align-items:center; gap:8px; margin:6px 0;">
            <button
                type="button"
                class="btn btn-sm ${isActive ? 'btn-teal' : 'btn-outline-secondary'} qemu-select"
                data-qemu-select="${encoded}"
                title="${safeLabel}"
                style="flex:1; text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
            >
                ${safeLabel}
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-qemu-boot="${encoded}">Boot</button>
        </div>`;
    }).join('');
}

/** List qcow2 names; short retry helps Windows right after copy/link. */
async function listQemuDisksWithRetry(ipc) {
    const attempts = 4;
    for (let i = 0; i < attempts; i += 1) {
        log.info(`examsetup @ listQemuDisksWithRetry: attempt ${i + 1}/${attempts}`);
        try {
            const disks = await ipc.invoke('qemu-list-disks');
            if (Array.isArray(disks) && disks.length > 0) {
                log.info(`examsetup @ listQemuDisksWithRetry: found ${disks.length} disk(s)`);
                return disks;
            }
        } catch (e) {
            log.warn(`examsetup @ listQemuDisksWithRetry: failed (${e?.message || e})`);
        }
        if (i < attempts - 1) {
            await new Promise((resolve) => { setTimeout(resolve, 200); });
        }
    }
    log.warn('examsetup @ listQemuDisksWithRetry: no disks after retries');
    return [];
}

/** File picker + import IPC; refresh disk list in open LocalVM Swal. */
async function pickImportAndRefreshQemuDiskList(ipc, { statusEl, listEl, labelEl, setSelectedDisk } = {}) {
    const setStatus = (msg) => {
        try {
            if (statusEl) statusEl.textContent = msg ?? '';
        } catch (e) {}
    };
    log.info('examsetup @ pickImport: opening file picker…');
    setStatus('Öffne Dateiauswahl…');
    let pick;
    try {
        pick = await ipc.invoke('qemu-pick-disk-file');
    } catch (e) {
        log.error('examsetup @ pickImport: pick failed', e);
        setStatus(String(e?.message || e));
        return null;
    }
    if (pick?.cancelled) {
        log.info('examsetup @ pickImport: cancelled');
        setStatus('');
        return null;
    }
    if (!pick?.ok || !pick.sourcePath) {
        log.warn(`examsetup @ pickImport: pick error ${pick?.error || 'unknown'}`);
        setStatus(pick?.error ? String(pick.error) : 'Dateiauswahl fehlgeschlagen.');
        return null;
    }
    log.info(`examsetup @ pickImport: selected ${pick.sourcePath}`);
    setStatus('Kopiere qcow2… 0%');
    let onImportProgress = null;
    try {
        onImportProgress = (_event, payload) => {
            const phase = payload?.phase || '';
            const pct = typeof payload?.percent === 'number' ? payload.percent : null;
            if (phase === 'skip') {
                setStatus('Bereits im QEMU-Ordner.');
                return;
            }
            if (phase === 'linked') {
                setStatus('Verknüpft (kein Kopieren nötig).');
                return;
            }
            if (pct != null) {
                setStatus(`Kopiere qcow2… ${pct}%`);
            }
        };
        ipc.removeAllListeners?.('qemu-import-progress');
        ipc.on?.('qemu-import-progress', onImportProgress);
    } catch (e) {}
    let importRes;
    try {
        importRes = await ipc.invoke('qemu-import-disk', { sourcePath: pick.sourcePath });
    } catch (e) {
        log.error('examsetup @ pickImport: import failed', e);
        setStatus(String(e?.message || e));
        return null;
    } finally {
        try {
            if (onImportProgress) {
                ipc.removeListener?.('qemu-import-progress', onImportProgress);
            }
        } catch (e) {}
    }
    if (!importRes?.ok || !importRes?.filename) {
        log.warn(`examsetup @ pickImport: import error ${importRes?.error || 'unknown'}`);
        setStatus(importRes?.error ? String(importRes.error) : 'Import fehlgeschlagen.');
        return null;
    }
    log.info(`examsetup @ pickImport: import ok filename=${importRes.filename} skipped=${!!importRes.skipped} linked=${!!importRes.linked}`);
    setStatus('Aktualisiere Liste…');
    const disks = await listQemuDisksWithRetry(ipc);
    if (!disks.length) {
        setStatus('Import fertig, aber qcow2 nicht in QEMU-Ordner sichtbar.');
        return null;
    }
    const selected = disks.includes(importRes.filename) ? importRes.filename : disks[0];
    if (listEl) {
        listEl.innerHTML = buildQemuDiskRowsHtml(disks, selected) || '<div class="text-muted">Keine Disks gefunden.</div>';
    }
    if (labelEl) labelEl.textContent = selected;
    if (setSelectedDisk) setSelectedDisk(selected);
    setStatus(importRes.skipped ? 'Bereits im QEMU-Ordner.' : '');
    log.info(`examsetup @ pickImport: UI refreshed selected=${selected}`);
    return { selected, disks };
}

/**
 * LocalVM (QEMU qcow2 selection in workdir/EXAM-TEACHER/QEMU)
 */
async function configureLocalVM(presetGroup){
    log.info(`examsetup @ configureLocalVM: start presetGroup=${presetGroup}`);
    const ipc = window.ipcRenderer;
    if (!ipc) {
        this.$swal.fire({
            icon: 'error',
            title: 'LocalVM',
            text: 'Local QEMU integration is not available in this environment.'
        });
        return;
    }

    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const hasGroups = !!section.groups;
    const whoNorm = String(presetGroup || 'all').toLowerCase();
    const activeGroup = hasGroups ? (whoNorm === 'b' ? 'b' : 'a') : 'all';
    const groupA = section.groupA || (section.groupA = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    const groupB = section.groupB || (section.groupB = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} });
    if (!groupA.examConfig) groupA.examConfig = {};
    if (!groupB.examConfig) groupB.examConfig = {};
    if (!groupA.examConfig.localvm) groupA.examConfig.localvm = {};
    if (!groupB.examConfig.localvm) groupB.examConfig.localvm = {};

    let disks = [];
    try {
        disks = await ipc.invoke('qemu-list-disks');
        log.info(`examsetup @ configureLocalVM: list-disks count=${Array.isArray(disks) ? disks.length : 0}`);
    } catch (error) {
        log.error('examsetup @ configureLocalVM: qemu-list-disks failed', error);
        disks = [];
    }

    let preferredDisk = null;
    if (!Array.isArray(disks) || disks.length === 0) {
        log.info('examsetup @ configureLocalVM: no disks → empty dialog');
        const firstHtml = `<div style="text-align:left;">
            <div><b>Keine QEMU-VM gefunden</b> im Workdirectory unter <code>EXAM-TEACHER/QEMU</code>.</div>
            <div style="margin-top:8px;">Du kannst jetzt eine VM <b>vollautomatisch installieren</b> (inkl. Download der ISOs). Das kann <b>~10 Minuten</b> dauern.</div>
            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-cyan" id="qemuInstallBtn">Installieren (~10 Min)</button>
                <button type="button" class="btn btn-sm btn-cyan" id="qemuBrowseBtn">Datei wählen…</button>
            </div>
            <div id="qemuHashStatus" style="margin-top:10px; font-size:0.9em; color:#6c757d;"></div>
        </div>`;

        const result = await this.$swal.fire({
            customClass: {
                popup: 'my-popup',
                title: 'my-title',
                content: 'my-content',
                actions: 'my-swal2-actions',
                cancelButton: 'btn btn-cyan',
            },
            title: 'LocalVM',
            icon: 'warning',
            html: firstHtml,
            showCancelButton: true,
            showConfirmButton: false,
            cancelButtonText: this.$t('dashboard.cancel'),
            allowOutsideClick: false,
            didOpen: () => {
                const statusEl = document.getElementById('qemuHashStatus');
                const browseBtn = document.getElementById('qemuBrowseBtn');
                const installBtn = document.getElementById('qemuInstallBtn');

                browseBtn?.addEventListener('click', async () => {
                    log.info('examsetup @ configureLocalVM: browse (empty dialog)');
                    const res = await pickImportAndRefreshQemuDiskList(ipc, { statusEl });
                    if (!res) return;
                    preferredDisk = res.selected;
                    log.info(`examsetup @ configureLocalVM: reopening disk picker preferred=${preferredDisk}`);
                    try { this.$swal.close(); } catch (e) {}
                    setTimeout(() => { configureLocalVM.call(this, presetGroup); }, 50);
                });

                installBtn?.addEventListener('click', async () => {
                    if (!(await ensureQemuAvailableForLocalVm(this))) {
                        return;
                    }
                    let onProgress = null;
                    try {
                        if (statusEl) statusEl.textContent = 'Starte VM-Build…';
                    } catch (e) {}
                    try {
                        onProgress = (_event, payload) => {
                            const el = document.getElementById('qemuHashStatus');
                            if (!el) return;
                            const phase = payload?.phase || '';
                            const file = payload?.file || '';
                            const pct = typeof payload?.percent === 'number' ? payload.percent : null;
                            if (phase === 'skip' && file) {
                                el.textContent = `${file}: bereits vorhanden`;
                                return;
                            }
                            if ((phase === 'downloading' || phase === 'start' || phase === 'done') && file) {
                                el.textContent = pct != null ? `${file}: ${pct}%` : `${file}: …`;
                                return;
                            }
                            if (phase === 'creating-disk') {
                                el.textContent = 'VM-Build: erstelle qcow2-Disk…';
                                return;
                            }
                            if (phase === 'starting-qemu') {
                                el.textContent = 'VM-Build: starte QEMU-Installation…';
                                return;
                            }
                            if (phase === 'start') {
                                el.textContent = 'VM-Build: starte Downloads…';
                                return;
                            }
                            if (phase === 'end') {
                                el.textContent = 'VM-Build: fertig.';
                            }
                        };
                        ipc.removeAllListeners?.('qemu-install-progress');
                        ipc.on?.('qemu-install-progress', onProgress);
                    } catch (e) {}

                    try {
                        const res = await ipc.invoke('qemu-install-default');
                        if (res?.qemuMissing) {
                            await showQemuMissingWarning(this, res);
                            return;
                        }
                        if (!res || res.ok !== true) {
                            await this.$swal.fire({
                                icon: 'error',
                                title: 'LocalVM',
                                text: `VM-Build konnte nicht gestartet werden: ${res?.error || 'unbekannter Fehler'}`,
                            });
                            return;
                        }
                    } catch (e) {
                        await this.$swal.fire({
                            icon: 'error',
                            title: 'LocalVM',
                            text: `VM-Build konnte nicht gestartet werden: ${String(e?.message || e)}`,
                        });
                        return;
                    } finally {
                        try {
                            if (onProgress) {
                                ipc.removeListener?.('qemu-install-progress', onProgress);
                            }
                        } catch (e) {}
                    }

                    try { this.$swal.close(); } catch (e) {}
                    setTimeout(() => { configureLocalVM.call(this, presetGroup); }, 50);
                });
            },
        });

        if (!result.isDismissed) {
            return;
        }

        return;
    }

    const currentDisk =
        activeGroup === 'b'
            ? (groupB.examConfig.localvm.qcow2Name || '')
            : (groupA.examConfig.localvm.qcow2Name || '');
    const currentBlockInternet =
        activeGroup === 'b'
            ? !!groupB.examConfig.localvm.blockInternet
            : !!groupA.examConfig.localvm.blockInternet;
    const currentCalculateSha256 =
        activeGroup === 'b'
            ? (groupB.examConfig.localvm.calculateSha256 === true)
            : (groupA.examConfig.localvm.calculateSha256 === true);
    const currentDisplayResolution =
        activeGroup === 'b'
            ? (groupB.examConfig.localvm.displayResolution || DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION)
            : (groupA.examConfig.localvm.displayResolution || DEFAULT_LOCAL_VM_DISPLAY_RESOLUTION);
    const resolvedDisplay = resolveLocalVmDisplayResolution(currentDisplayResolution);
    const resolutionOptionsHtml = LOCAL_VM_DISPLAY_RESOLUTIONS.map((r) => {
        const selected = r.id === resolvedDisplay.id ? ' selected' : '';
        const label = this.$t(`dashboard.localvmRes${r.id}`);
        return `<option value="${r.id}"${selected}>${label}</option>`;
    }).join('');

    let selectedDisk =
        preferredDisk && disks.includes(preferredDisk)
            ? preferredDisk
            : (currentDisk && disks.includes(currentDisk) ? currentDisk : (disks[0] || ''));

    const rowsHtml = buildQemuDiskRowsHtml(disks, selectedDisk);

    const html = `<div class="my-content" style="text-align:left; padding:0px!important;">
        <div style="padding:0px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:10px;">
                <div>
                    <div style="font-weight:700; margin-bottom:2px;">QEMU Disks</div>
                    <div style="font-size:0.85em; color:#6c757d;"><code>EXAM-TEACHER/QEMU</code></div>
                </div>
                <div style="font-size:0.8em; color:#6c757d;">Auswahl: <span id="qemuSelectedLabel">${selectedDisk ? String(selectedDisk).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') : '-'}</span></div>
            </div>
            <div style="margin-top:10px;" id="qemuDiskList">
                ${rowsHtml || '<div class="text-muted">Keine Disks gefunden.</div>'}
            </div>
        </div>

        <div style="margin:4px 0; height:1px; background:rgba(255,255,255,0.08);"></div>

        <div style="padding:0; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.03);">
            <div style="font-weight:700; margin-bottom:8px;">${this.$t('dashboard.localvmDisplayResolutionLabel')}</div>
            <select id="qemuDisplayResolution" class="form-select form-select-sm" style="max-width:320px;">
                ${resolutionOptionsHtml}
            </select>
        </div>

        <div style="margin:4px 0; height:1px; background:rgba(255,255,255,0.08);"></div>

        <div style="padding:0; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.03);">
            <div style="font-weight:700; margin-bottom:8px;">Erweitert</div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <label for="qemuBlockInternet" style="margin:0; font-size:0.85em;">Internet in der VM blockieren</label>
                <label class="form-check form-switch" style="margin:0;">
                    <input class="form-check-input" type="checkbox" role="switch" id="qemuBlockInternet" ${currentBlockInternet ? 'checked' : ''}>
                </label>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:8px;">
                <label for="qemuCalculateSha256" style="margin:0; font-size:0.85em;">
                    SHA256 Hash überprüfen
                    <span
                        title="Wenn diese Option deaktiviert ist wird die VM Integrität über die Dateigrösse kontrolliert"
                        style="margin-left:6px; color:#6c757d; cursor:help; font-weight:700;"
                    >i</span>
                </label>
                <label class="form-check form-switch" style="margin:0;">
                    <input class="form-check-input" type="checkbox" role="switch" id="qemuCalculateSha256" ${currentCalculateSha256 ? 'checked' : ''}>
                </label>
            </div>
        </div>

        <div style="margin:4px 0; height:1px; background:rgba(255,255,255,0.08);"></div>

        <div style="padding:0; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.03);">
            <div style="font-weight:700; margin-bottom:8px;">Aktionen</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-cyan" id="qemuBrowseBtn">Dateisystem durchsuchen…</button>
                <button type="button" class="btn btn-sm btn-cyan" id="qemuInstallBtn">Neue VM bauen (~10 Min)</button>
            </div>
            <div id="qemuHashStatus" style="margin-top:8px; font-size:0.85em; color:#6c757d;"></div>
        </div>
    </div>`;

    const pick = await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            actions: 'my-swal2-actions'
        },
        title: hasGroups ? `LocalVM – Gruppe ${activeGroup.toUpperCase()}` : 'LocalVM – Gruppe AB',
        icon: 'question',
        html,
        showCancelButton: true,
        cancelButtonText: this.$t('dashboard.cancel'),
        showLoaderOnConfirm: true,
        backdrop: true,
        allowOutsideClick: () => !this.$swal.isLoading(),
        preConfirm: async () => {
            const blockInternet = !!document.getElementById('qemuBlockInternet')?.checked;
            const calculateSha256 = !!document.getElementById('qemuCalculateSha256')?.checked;
            const displayResolution = resolveLocalVmDisplayResolution(
                document.getElementById('qemuDisplayResolution')?.value
            ).id;
            try {
                const statusEl = document.getElementById('qemuHashStatus');
                if (statusEl) statusEl.textContent = calculateSha256 ? 'Berechne SHA-256…' : 'Prüfe Dateigröße…';
            } catch (e) {}
            try {
                const list = document.getElementById('qemuDiskList');
                const activeBtn = list?.querySelector?.('button.btn-teal[data-qemu-select]');
                const enc = activeBtn?.getAttribute?.('data-qemu-select');
                const diskName = enc ? decodeURIComponent(enc) : '';
                if (diskName) {
                    selectedDisk = diskName;
                }
            } catch (e) {}
            if (!selectedDisk) {
                return 'Please select a disk.';
            }
            let sizeBytes = null;
            try {
                const statRes = await ipc.invoke('qemu-stat-disk', { qcow2Name: selectedDisk });
                sizeBytes = statRes && statRes.ok ? statRes.size : null;
            } catch (e) {
                sizeBytes = null;
            }
            if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
                return 'Konnte Dateigröße der qcow2 Disk nicht ermitteln.';
            }
            if (!calculateSha256) {
                return { selectedDisk, sha256: null, sizeBytes, blockInternet, calculateSha256: false, displayResolution };
            }
            try {
                const hashRes = await ipc.invoke('qemu-hash-disk', { qcow2Name: selectedDisk });
                const sha256 = hashRes && hashRes.ok ? hashRes.sha256 : null;
                if (!sha256) {
                    return 'Konnte SHA-256 Hash der qcow2 Disk nicht berechnen.';
                }
                return { selectedDisk, sha256, sizeBytes, blockInternet, calculateSha256: true, displayResolution };
            } catch (e) {
                return 'Konnte SHA-256 Hash der qcow2 Disk nicht berechnen.';
            }
        },
        didOpen: () => {
            const list = document.getElementById('qemuDiskList');
            list?.addEventListener('click', async (ev) => {
                const selBtn = ev?.target?.closest?.('button[data-qemu-select]');
                if (selBtn) {
                    const enc = selBtn.getAttribute('data-qemu-select');
                    const diskName = enc ? decodeURIComponent(enc) : '';
                    if (diskName) {
                        selectedDisk = diskName;
                        const label = document.getElementById('qemuSelectedLabel');
                        if (label) label.textContent = diskName;
                        const all = list.querySelectorAll('button[data-qemu-select]');
                        all.forEach((b) => {
                            b.classList.remove('btn-teal');
                            b.classList.add('btn-outline-secondary');
                        });
                        selBtn.classList.remove('btn-outline-secondary');
                        selBtn.classList.add('btn-teal');
                    }
                    return;
                }
                const btn = ev?.target?.closest?.('button[data-qemu-boot]');
                if (!btn) return;
                const enc = btn.getAttribute('data-qemu-boot');
                const diskName = enc ? decodeURIComponent(enc) : '';
                if (!diskName) return;
                await bootLocalVmDisk(this, { ipc, diskName, presetGroup });
            });
            const browseBtn = document.getElementById('qemuBrowseBtn');
            browseBtn?.addEventListener('click', async () => {
                const statusEl = document.getElementById('qemuHashStatus');
                const listEl = document.getElementById('qemuDiskList');
                const labelEl = document.getElementById('qemuSelectedLabel');
                const res = await pickImportAndRefreshQemuDiskList(ipc, {
                    statusEl,
                    listEl,
                    labelEl,
                    setSelectedDisk: (name) => { selectedDisk = name; },
                });
                if (res?.disks) disks = res.disks;
            });
            const installBtn = document.getElementById('qemuInstallBtn');
            installBtn?.addEventListener('click', async () => {
                if (!(await ensureQemuAvailableForLocalVm(this))) {
                    return;
                }
                try {
                    const statusEl = document.getElementById('qemuHashStatus');
                    if (statusEl) statusEl.textContent = 'Starte VM-Build…';
                } catch (e) {}
                let onProgress = null;
                try {
                    onProgress = (_event, payload) => {
                        const statusEl = document.getElementById('qemuHashStatus');
                        if (!statusEl) return;
                        const phase = payload?.phase || '';
                        const file = payload?.file || '';
                        const pct = typeof payload?.percent === 'number' ? payload.percent : null;
                        if (phase === 'skip' && file) {
                            statusEl.textContent = `${file}: bereits vorhanden`;
                            return;
                        }
                        if ((phase === 'downloading' || phase === 'start' || phase === 'done') && file) {
                            statusEl.textContent = pct != null ? `${file}: ${pct}%` : `${file}: …`;
                            return;
                        }
                        if (phase === 'creating-disk') {
                            statusEl.textContent = 'VM-Build: erstelle qcow2-Disk…';
                            return;
                        }
                        if (phase === 'starting-qemu') {
                            statusEl.textContent = 'VM-Build: starte QEMU-Installation…';
                            return;
                        }
                        if (phase === 'start') {
                            statusEl.textContent = 'VM-Build: starte Downloads…';
                            return;
                        }
                        if (phase === 'end') {
                            statusEl.textContent = 'VM-Build: fertig.';
                        }
                    };
                    ipc.removeAllListeners?.('qemu-install-progress');
                    ipc.on?.('qemu-install-progress', onProgress);
                } catch (e) {}
                try {
                    const res = await ipc.invoke('qemu-install-default');
                    if (res?.qemuMissing) {
                        await showQemuMissingWarning(this, res);
                        return;
                    }
                    if (!res || res.ok !== true) {
                        await this.$swal.fire({
                            icon: 'error',
                            title: 'LocalVM',
                            text: `VM-Build konnte nicht gestartet werden: ${res?.error || 'unbekannter Fehler'}`,
                        });
                        return;
                    }
                } catch (e) {
                    await this.$swal.fire({
                        icon: 'error',
                        title: 'LocalVM',
                        text: `VM-Build konnte nicht gestartet werden: ${String(e?.message || e)}`,
                    });
                    return;
                } finally {
                    try {
                        if (onProgress) {
                            ipc.removeListener?.('qemu-install-progress', onProgress);
                        }
                    } catch (e) {}
                }
                try { this.$swal.close(); } catch (e) {}
                setTimeout(() => { configureLocalVM.call(this, presetGroup); }, 50);
            });
        }
    });
    if (!pick.isConfirmed) return;

    const finalDisk = pick.value?.selectedDisk || selectedDisk;
    const calculateSha256 = pick.value?.calculateSha256 === true;
    const sha256 = calculateSha256 ? (pick.value?.sha256 || null) : null;
    const sizeBytes = pick.value?.sizeBytes ?? null;
    const blockInternet = !!pick.value?.blockInternet;
    if (!finalDisk || (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) || (calculateSha256 && !sha256)) {
        await this.$swal.fire({
            icon: 'error',
            title: 'LocalVM',
            text: calculateSha256 ? 'Konnte SHA-256 Hash der qcow2 Disk nicht berechnen.' : 'Konnte Dateigröße der qcow2 Disk nicht ermitteln.'
        });
        return;
    }

    const displayResolution = resolveLocalVmDisplayResolution(pick.value?.displayResolution).id;
    const nextCfg = {
        qcow2Name: finalDisk,
        vncPort: 5901,
        calculateSha256,
        qcow2Sha256: sha256,
        qcow2SizeBytes: sizeBytes,
        blockInternet,
        displayResolution,
    };
    if (!hasGroups) {
        groupA.examConfig.localvm = nextCfg;
        groupB.examConfig.localvm = { ...nextCfg };
    } else if (activeGroup === 'b') {
        groupB.examConfig.localvm = nextCfg;
    } else {
        groupA.examConfig.localvm = nextCfg;
    }
    this.setServerStatus();
}



function setEditorExamConfigPatch(patch) {
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    if (!section) return;

    const { groupA, groupB } = ensureEditorExamConfig(section);
    const prev = groupA.examConfig.editor || {};
    const next = { ...prev, ...patch };
    if (Object.prototype.hasOwnProperty.call(next, 'cmargin')) {
        next.cmargin = { side: 'right', size: next.cmargin?.size ?? 3 };
    }

    groupA.examConfig.editor = next;
    const templateB = groupB.examConfig.editor?.editorTemplate;
    if (section.groups) {
        groupB.examConfig.editor = { ...next, editorTemplate: templateB !== undefined ? templateB : next.editorTemplate };
    } else {
        groupB.examConfig.editor = { ...next };
    }

    this.backupinterval.stop();
    this.autobackup = false;
    this.setServerStatus();
}

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
            // Swal removes custom html on close; capture values here before DOM teardown
            return { rawHost, rawPort };
        },
    });

    if (!result.isConfirmed || !result.value) return;

    const { rawHost, rawPort } = result.value;
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

// Helper functions

function extractDomainAndId(url) {
    // Extract the full domain including subdomains
    var domainRegex = /^(https?:\/\/)?([^\/]+)/i;
    var match = url.match(domainRegex);
    var fullDomain = match ? match[2] : null;

    // Extract only the domain and TLD
    var domainParts = psl.get(fullDomain);
    var moodledomain = domainParts;

    var idRegex = /id=(\d+)/;
    var idMatch = url.match(idRegex);
    var testid = idMatch ? idMatch[1] : null;
    return { moodledomain, testid };
}


function isValidMoodleDomainName(url) {
    // Improved regex for matching a domain name structure with optional protocol
    var regex = /^(https?:\/\/)(([a-z0-9-]+\.)+[a-z]{2,})(\/.*)?$/i;
    return regex.test(url);
}



function isValidFullDomainName(str) {
    try {
        // const urlString = str.includes('://') ? str : 'https://' + str; // Removed: no automatic prepending of https://
        const urlString = str; // use the string directly
        const url = new URL(urlString); // throws an error if the protocol is missing

        // Check whether the protocol is correct
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        // Check whether host is present and valid
        if (!url.hostname || url.hostname.length < 1) {
            return false;
        }

        // Check whether host contains at least one valid domain part
        const parts = url.hostname.split('.');
        if (parts.length < 2) {
            return false;
        }

        // Check whether every domain part is valid
        const validPart = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        return parts.every(part => 
            part.length > 0 && 
            part.length <= 63 && 
            validPart.test(part)
        );

    } catch (e) {
        // Catches the error from new URL(urlString) when the protocol is missing (e.g. 'classtime.com')
        return false;
    }
}




/**
 * define materials for exam
 * materials can be defined for each exam section that should be available during the exam
 * these are distributed to clients at the start of the exam or at the start of the corresponding section
 * @param {string} who "all" (select group) | "a" | "b" (target group predefined)
 * @returns 
 */
function defineMaterials(who) {
    const hasGroups = !!this.serverstatus.examSections[this.serverstatus.activeSection].groups;
    const whoNorm = String(who || 'all').toLowerCase();
    const presetGroup = whoNorm === 'b' ? 'b' : whoNorm === 'a' ? 'a' : 'all';

    let htmlcontent = `<div class="my-content"> 
        ${this.$t("dashboard.filesendtext")} <br>
        <span style="font-size:0.8em;">(.pdf, .docx, .odt, .htm, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
        </div>`

    if (hasGroups && presetGroup === "all") {
        htmlcontent = `<div class="my-content"> 
            ${this.$t("dashboard.filesendtext")} <br>
            <span style="font-size:0.8em;">(.pdf, .docx, .odt, .htm, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
            <br>  <br> 
            Gruppe<br>
            <button id="fbtnA" class="swal2-button btn btn-cyan m-2" style="width: 42px; height: 42px;">A</button>
            <button id="fbtnB" class="swal2-button btn btn-warning m-2" style="width: 42px; height: 42px;filter: grayscale(90%);">B</button>
            <button id="fbtnC" class="swal2-button btn btn-warning m-2" style="padding:0px;width: 42px; height: 42px;filter: grayscale(90%); background: linear-gradient(-60deg, #0dcaf0 50%, #ffc107 50%);">AB</button>
        </div>`
    }
    
    htmlcontent += `<div class="my-content" style="margin-top: 10px;">
        <h6>${this.$t("dashboard.allowedURL")}</h6>
        <input type="text" id="allowedURL" class="form-control my-custom-input" style="width: 60%!important; margin:4px!important;" placeholder="https://www.example.com">
        <div style="margin-left: 6px; margin-top: 6px; text-align: left; display: inline-block;">
            <label style="display: block; margin-bottom: 4px; font-size: 0.85em; cursor: pointer;" title="${this.$t("dashboard.blockSubdomainsInfo")}">
                <input type="checkbox" id="blockSubdomains" style="margin-right: 6px;"> ${this.$t("dashboard.blockSubdomains")}
            </label>
            <label style="display: block; font-size: 0.85em; cursor: pointer;" title="${this.$t("dashboard.blockSubfoldersInfo")}">
                <input type="checkbox" id="blockSubfolders" style="margin-right: 6px;"> ${this.$t("dashboard.blockSubfolders")}
            </label>
        </div>
    </div>`
         
    let activeGroup = hasGroups ? (presetGroup === "all" ? "a" : presetGroup) : "a"
    let savedAllowedUrl = ''; // Store allowedURL value before dialog closes (Electron 39 compatibility)
    let savedBlockSubdomains = false;
    let savedBlockSubfolders = false;

    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions',
            htmlContainer: 'my-html-container'
        },
        title: this.$t("dashboard.materials"),
        html: htmlcontent,
        icon: "success",
        input: 'file',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        inputAttributes: {
            type: "file",
            name: "files",
            id: "swalFile",
            class: "form-control",
            multiple: "multiple",
            accept: ".pdf, .docx, .odt, .htm, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb"
        },
        didRender: () => {
            const btnA = document.getElementById('fbtnA');
            const btnB = document.getElementById('fbtnB');
            const btnC = document.getElementById('fbtnC');
            if (btnA && !btnA.dataset.listenerAdded) {
                btnA.addEventListener('click', () => {
                    if (btnA) btnA.style.filter = "grayscale(0%)"
                    if (btnB) btnB.style.filter = "grayscale(90%)"
                    if (btnC) btnC.style.filter = "grayscale(90%)"
                    activeGroup = "a"
                });
                btnA.dataset.listenerAdded = 'true';
            }
            if (btnB && !btnB.dataset.listenerAdded) {
                btnB.addEventListener('click', () => {
                    if (btnA) btnA.style.filter = "grayscale(90%)"
                    if (btnB) btnB.style.filter = "grayscale(0%)"
                    if (btnC) btnC.style.filter = "grayscale(90%)"
                    activeGroup = "b"
                });
                btnB.dataset.listenerAdded = 'true';
            }
            if (btnC && !btnC.dataset.listenerAdded) {
                btnC.addEventListener('click', () => {
                    if (btnA) btnA.style.filter = "grayscale(90%)"
                    if (btnB) btnB.style.filter = "grayscale(90%)"
                    if (btnC) btnC.style.filter = "grayscale(0%)"
                    activeGroup = "all"
                });
                btnC.dataset.listenerAdded = 'true';
            }
        },
        inputValidator: (value) => {
            const allowedURLElement = document.getElementById('allowedURL');
            const allowedURL = allowedURLElement ? allowedURLElement.value : '';
            if (allowedURL !== "" && !isValidFullDomainName(allowedURL)) {
                return this.$t('dashboard.invalidDomain'); // invalid domain message
            }
        },
        preConfirm: () => {
            // Save allowedURL value before dialog closes (Electron 39 compatibility)
            const allowedURLElement = document.getElementById('allowedURL');
            savedAllowedUrl = allowedURLElement ? allowedURLElement.value : '';
            const blockSubdomainsEl = document.getElementById('blockSubdomains');
            const blockSubfoldersEl = document.getElementById('blockSubfolders');
            savedBlockSubdomains = blockSubdomainsEl ? blockSubdomainsEl.checked : false;
            savedBlockSubfolders = blockSubfoldersEl ? blockSubfoldersEl.checked : false;
        },
    })
    .then(async (input) => {

        const allowedUrl = savedAllowedUrl; // Use saved value instead of reading from DOM
        if (allowedUrl) {
            const urlEntry = {
                url: allowedUrl,
                blockSubdomains: savedBlockSubdomains,
                blockSubfolders: savedBlockSubfolders
            };

            if (activeGroup === "a" || activeGroup === "all") {
                this.serverstatus.examSections[this.serverstatus.activeSection].groupA.allowedUrls.push(urlEntry);
            }
            if (activeGroup === "b" || activeGroup === "all") {
                this.serverstatus.examSections[this.serverstatus.activeSection].groupB.allowedUrls.push(urlEntry);
            }
        }
      
        if (!input.value) {
            await this.setServerStatus()
            await this.setStudentStatus({getmaterials: true}, 'all')
            return;
        } // no further processing if no files are selected

        this.status(this.$t("dashboard.processingfiles"));
        const files = input.value;

        // Process each file
        for (const file of files) {
            try {
                // Check file size and warn if larger than 8 MB
                const maxSizeBytes = 8 * 1024 * 1024; // 8 MB in bytes
                if (file.size > maxSizeBytes) {
                    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    this.$swal.fire({
                        customClass: {
                            popup: 'my-popup',
                            title: 'my-title',
                            content: 'my-content',
                            actions: 'my-swal2-actions'
                        },
                        title: this.$t("dashboard.filesizewarning"),
                        html: `<div style="text-align: left;">${this.$t("dashboard.filesizewarningtext", { filename: file.name, size: fileSizeMB })}</div>`,
                        icon: 'warning',
                    
                        showConfirmButton: true,
                        confirmButtonText: 'OK'
                    });
                }

                // Use the shared function to add file as exam material (replaces existing file with same name)
                await addFileAsExamMaterial(
                    file,
                    null, // filename not needed when using File object
                    activeGroup,
                    this.serverstatus,
                    this.serverstatus.activeSection
                );
               
            } catch (error) {
                console.error(`exammanagement @ defineMaterials: Error processing file ${file.name}:`, error);
            }
        }
        await this.setServerStatus()
        await this.setStudentStatus({getmaterials: true}, 'all')
    });
}

// Helper function to read file as Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Helper function to calculate MD5 checksum from File
async function calculateMD5(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
            const hash = CryptoJS.MD5(wordArray).toString();
            resolve(hash);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Helper function to calculate MD5 checksum from Base64 string
function calculateMD5FromBase64(base64Content) {
    const commaIndex = base64Content.indexOf(',');
    const pureBase64 = commaIndex >= 0 ? base64Content.slice(commaIndex + 1) : base64Content;
    const binaryString = atob(pureBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const wordArray = CryptoJS.lib.WordArray.create(bytes);
    return CryptoJS.MD5(wordArray).toString();
}

// Helper function to determine filetype from file or filename
function determineFiletype(file, filename) {
    let filetype = "";
    if (file && file.type) {
        if (file.type.includes("pdf")) { filetype = "pdf"; }
        else if (file.type.includes("html")) { filetype = "htm"; }
        else if (file.type.includes("opendocument.text")) { filetype = "odt"; }
        else if (file.type.includes("openxml")) { filetype = "docx"; }
        else if (file.type.includes("ggb")) { filetype = "ggb"; }
        else if (file.type.includes("audio") || file.type.includes("ogg") || file.type.includes("wav")) { filetype = "audio"; }
        else if (file.type.includes("jpg") || file.type.includes("jpeg") || file.type.includes("png") || file.type.includes("gif")) { filetype = "image"; }
    }
    
    // Fallback to filename if filetype not determined from file.type
    if (!filetype && filename) {
        const lowerName = filename.toLowerCase();
        if (lowerName.endsWith('.pdf')) { filetype = "pdf"; }
        else if (lowerName.endsWith('.htm')) { filetype = "htm"; }
        else if (lowerName.endsWith('.odt')) { filetype = "odt"; }
        else if (lowerName.endsWith('.docx')) { filetype = "docx"; }
        else if (lowerName.endsWith('.ggb')) { filetype = "ggb"; }
        else if (lowerName.endsWith('.ogg') || lowerName.endsWith('.wav') || lowerName.endsWith('.mp3')) { filetype = "audio"; }
        else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.gif')) { filetype = "image"; }
    }
    
    // Special case: geogebra does not have a mime type
    if (!filetype && filename && filename.includes("ggb")) { filetype = "ggb"; }
    
    return filetype;
}

/**
 * Add a file as exam material to the specified groups
 * Can work with either a File object or Base64 string + filename
 * @param {File|string} fileOrBase64 - Either a File object or Base64 string
 * @param {string} filename - Filename (required if fileOrBase64 is Base64 string)
 * @param {string} activeGroup - Group to add to: "a", "b", or "all"
 * @param {Object} serverstatus - The serverstatus object
 * @param {number} activeSection - The active section number
 * @returns {Promise<Object>} The created fileObject
 */
async function addFileAsExamMaterial(fileOrBase64, filename, activeGroup, serverstatus, activeSection, isActiveSheet = false) {
    let base64Content;
    let checksum;
    let finalFilename;
    let filetype;
    
    if (fileOrBase64 instanceof File) {
        // Handle File object
        finalFilename = fileOrBase64.name;
        base64Content = await readFileAsBase64(fileOrBase64);
        checksum = await calculateMD5(fileOrBase64);
        filetype = determineFiletype(fileOrBase64, finalFilename);
    } else {
        // Handle Base64 string
        finalFilename = filename || false;
        base64Content = fileOrBase64;
        checksum = calculateMD5FromBase64(base64Content);
        filetype = determineFiletype(null, finalFilename);
    }
    
    // If no filename is provided, don't add anything
    if (!finalFilename || finalFilename === false) {
        return null;
    }
    
    // Check if file with same name already exists and remove it (replace with new version)
    const groupAFiles = serverstatus.examSections[activeSection].groupA.examInstructionFiles;
    const groupBFiles = serverstatus.examSections[activeSection].groupB.examInstructionFiles;
    
    // Remove existing file with same name from groups we're adding to
    if (activeGroup === "a" || activeGroup === "all") {
        const indexA = groupAFiles.findIndex(file => file.filename === finalFilename);
        if (indexA !== -1) {
            groupAFiles.splice(indexA, 1);
        }
    }
    if (activeGroup === "b" || activeGroup === "all") {
        const indexB = groupBFiles.findIndex(file => file.filename === finalFilename);
        if (indexB !== -1) {
            groupBFiles.splice(indexB, 1);
        }
    }
    
    // Create file object
    const fileObject = {
        filename: finalFilename,
        filetype: filetype,
        filecontent: base64Content,
        checksum: checksum
    };

    if (isActiveSheet) {
        // Active Sheet goes to group.examConfig.activeSheets
        if (activeGroup === "a" || activeGroup === "all") {
            serverstatus.examSections[activeSection].groupA.examConfig.activeSheets = { ...fileObject };
        }
        if (activeGroup === "b" || activeGroup === "all") {
            serverstatus.examSections[activeSection].groupB.examConfig.activeSheets = { ...fileObject };
        }
    } else {
        // Regular material goes into examInstructionFiles
        if (activeGroup === "a" || activeGroup === "all") {
            serverstatus.examSections[activeSection].groupA.examInstructionFiles.push(fileObject);
        }
        if (activeGroup === "b" || activeGroup === "all") {
            serverstatus.examSections[activeSection].groupB.examInstructionFiles.push(fileObject);
        }
    }

    return fileObject;
}



function handleAllowedUrlRemove(group, index){


    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            actions: 'my-swal2-actions',
            htmlContainer: 'my-content'
        },
        title: this.$t("dashboard.removeURL"),
        text: this.$t("dashboard.removeURLconfirm"),
        icon: 'warning',
        showCancelButton: true,
       
    }).then(async (result) => {
        if (result.isConfirmed) {


            if (group === "A") {
                this.serverstatus.examSections[this.serverstatus.activeSection].groupA.allowedUrls.splice(index, 1);
            } else {
                this.serverstatus.examSections[this.serverstatus.activeSection].groupB.allowedUrls.splice(index, 1);
            }
            await this.setServerStatus()
            await this.setStudentStatus({getmaterials: true}, 'all')

        }
    })
}

function openAllowedUrl(allowedUrl){
    // Support both object format {url, blockSubdomains, blockSubfolders} and legacy string format
    const url = typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
    this.urlForWebview = url;        // this is used to open the allowed url in the webview pane
    this.webviewVisible = true;             // this is used to show the webview pane

    const pdfPreview = document.querySelector("#pdfpreview");
    if (pdfPreview) pdfPreview.style.display = 'block';
    // Toolbar/renderer nodes are absent until PdfviewPaneRendered / PdfRenderer mount (dashboard v-if).
    for (const sel of ['#openPDF', '#downloadPDF', '#printPDF', '#closePDF', '#pdfrenderer']) {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
    }
}
















export { configureWebsite, configureEduvidual, configureForms, configureMicrosoft365Template, configureEditorTemplate, removeEditorTemplate, removeMicrosoft365Template, removeWebsiteUrl, removeEduvidualUrl, removeRdp, removeFormsUrl, getFormsID, setEditorExamConfigPatch, configureCustomLanguageToolHost, removeCustomLanguageToolHost, configureMath, configureActivesheets, configureRDP, configureLocalVM, extractDomainAndId, isValidMoodleDomainName, isValidFullDomainName, defineMaterials, handleAllowedUrlRemove, openAllowedUrl, addFileAsExamMaterial }
