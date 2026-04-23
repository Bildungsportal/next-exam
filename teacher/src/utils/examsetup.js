
import CryptoJS from 'crypto-js';

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
            if (!isValidFullDomainName(value)) return 'Ungültige Domain!'
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
        input: 'url',
        inputValue: currentConfig.url || '',
        inputPlaceholder: 'https://www.eduvidual.at/mod/quiz/view.php?id=6153159',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `<div class="my-content">Bitte geben Sie eine gültige Eduvidual Test-URL ein.</div>`,
        inputValidator: (value) => {
            if (!value || !isValidMoodleDomainName(value)) return this.$t("dashboard.moodleInvalidDomain");
            const { testid } = extractDomainAndId(value);
            if (!testid) return this.$t("dashboard.moodleInvalidId");
        }
    });

    if (!result.isConfirmed) return;
    const url = String(result.value || '').trim();
    if (!url) return;

    const { moodledomain, testid } = extractDomainAndId(url);
    const nextConfig = { url, moodleDomain: moodledomain, moodleTestId: testid };

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
 * Forms (Google or Microsoft)
 */
async function getFormsID(){
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
            document.getElementsByClassName('my-custom-input')[0].value = this.serverstatus.examSections[this.serverstatus.activeSection]?.formsUrl
        },
        inputValidator: (value) => {
            if (!value) {return this.$t("dashboard.moodleInvalidId")}
            if (!isValidFullDomainName(value)) {return this.$t("dashboard.invalidDomain")}
        }
    }).then((input) => {
        const val = input.value ? input.value.trim() : "";
        if (!val) {
            this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math"
        }
        else {
            this.serverstatus.examSections[this.serverstatus.activeSection].formsUrl = val
            this.backupinterval.stop();
            this.autobackup = false;
        }
        this.setServerStatus()
    })  
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
            title: this.$t("dashboard.invalidpdf") || "Ungültige PDF-Datei!",
            icon: 'error',
            showConfirmButton: true,
        });
        return;
    }

    this.status(this.$t("dashboard.processingfiles") || "Dateien werden verarbeitet...");

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
        input: 'text',
        inputValue: currentValue,
        inputPlaceholder: 'rdweb.schule.lan',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `<div class="my-content">${this.$t("dashboard.rdpconfiginfo")}</div>`,
        inputValidator: (value) => {
            const raw = String(value || '').trim();
            if (!raw) return "Bitte geben Sie eine gültige Domain ein.";
            return undefined;
        }
    });

    if (!result.isConfirmed) return;

    const raw = String(result.value || '').trim();
    if (!raw) return;

    let domain = raw;
    try {
        const asUrl = raw.includes('://') ? raw : `https://${raw}`;
        domain = new URL(asUrl).host;
    } catch (e) {
        domain = raw;
    }

    const nextConfig = { domain };

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


/**
 * LocalVM (VirtualBox VM selection)
 */
async function configureLocalVM(){
    const ipc = window.ipcRenderer;
    if (!ipc) {
        this.$swal.fire({
            icon: 'error',
            title: 'LocalVM',
            text: 'Local VirtualBox integration is not available in this environment.'
        });
        return;
    }

    let vmNames = [];
    try {
        vmNames = await ipc.invoke('get-vm-list');
    } catch (error) {
        console.error('examsetup @ configureLocalVM: get-vm-list failed', error);
        vmNames = [];
    }

    if (!Array.isArray(vmNames) || vmNames.length === 0) {
        this.$swal.fire({
            icon: 'warning',
            title: 'LocalVM',
            text: 'Keine VirtualBox-VMs gefunden. Bitte prüfen Sie die VBoxManage-Installation.'
        });
        return;
    }

    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    const currentVmName = section.localVMConfig && section.localVMConfig.vmName ? section.localVMConfig.vmName : '';

    const inputOptions = vmNames.reduce((acc, name) => {
        acc[name] = name;
        return acc;
    }, {});

    let selectedVmName = currentVmName || vmNames[0];

    await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input-select',
            actions: 'my-swal2-actions'
        },
        title: 'LocalVM',
        icon: 'question',
        input: 'select',
        inputOptions,
        inputValue: selectedVmName,
        showCancelButton: true,
        cancelButtonText: this.$t('dashboard.cancel'),
        preConfirm: (value) => {
            selectedVmName = value || '';
            if (!selectedVmName) {
                return 'Bitte wählen Sie eine VM aus.';
            }
            return true;
        }
    }).then((result) => {
        if (!result.isConfirmed) {
            return;
        }
        section.localVMConfig = {
            vmName: selectedVmName
        };
        this.setServerStatus();
    });
}


/**
* Text Editor
*/
async function configureEditor(){
    const inputOptions = {
        'de-DE': this.$t("dashboard.de"),
        'en-GB': this.$t("dashboard.en"),
        'en-US': this.$t("dashboard.en_us"),
        'fr-FR': this.$t("dashboard.fr"),
        'es-ES': this.$t("dashboard.es"),
        'it-IT': this.$t("dashboard.it"),
        'sl-SI': this.$t("dashboard.sl"),
        'none':this.$t("dashboard.none"),
    }

    // holds resolved IPv4 for custom LanguageTool host while dialog is open
    let resolvedLtIp = null;

    const updateMarginValueDisplay = () => {
        const marginValueInput = document.getElementById('marginValue');
        const marginValueDisplay = document.getElementById('marginValueDisplay');
        marginValueDisplay.textContent = marginValueInput.value;
    };

    const { value: language } = await this.$swal.fire({
        customClass: {
            popup: 'my-popup-sprachen',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input-select',
            actions: 'my-swal2-actions',
           
        },
        title: this.$t("dashboard.texteditor"),
        html: `
        <div class="my-content" style="font-size: 0.8em !important; text-align:left; margin:0 12px;">
            <div>
                <label >
                    <h6>${this.$t("dashboard.cmargin-value")}</h6>
                    <input style="width:100px" type="range" id="marginValue" name="margin_value" min="2" max="5" step="0.5" value="${this.serverstatus.examSections[this.serverstatus.activeSection].cmargin.size}" />
                    <div style="width:32px; display: inline-block"  id="marginValueDisplay">${this.serverstatus.examSections[this.serverstatus.activeSection].cmargin.size}</div>(cm)
                </label>
                <br>
                <label>
                    <input type="radio" name="correction_margin" value="left"  />
                    ${this.$t("dashboard.cmargin-left")}
                </label>
                <label>
                    <input type="radio" name="correction_margin" value="right" checked/>
                    ${this.$t("dashboard.cmargin-right")}
                </label>
            </div>
            <div> 
                <h6> ${this.$t("dashboard.linespacing")}</h6>
                <label><input type="radio" name="linespacing" value="1"/> 1</label> &nbsp;
                <label><input type="radio" name="linespacing" value="2" checked/> 2</label> &nbsp;
                <label><input type="radio" name="linespacing" value="3"/> 3</label> &nbsp;
            </div>
            <div> 
                <h6>${this.$t("dashboard.fontfamily")}</h6>
                <label><input type="radio" name="fontfamily" value="serif"/> serif</label> &nbsp;
                <label><input type="radio" name="fontfamily" value="sans-serif" checked/> sans-serif</label> &nbsp;
            </div>

            <div style="margin-top:8px;">
                <h6>${this.$t("dashboard.fontsize")}</h6>
                <select id="fontsize" class="my-select" value="12pt" style="width:100%;max-width:100%;">
                    <option value="8pt">8 pt</option>
                    <option value="10pt">10 pt</option>
                    <option value="12pt">12 pt</option>
                    <option value="14pt">14 pt</option>
                    <option value="16pt">16 pt</option>
                    <option value="18pt">18 pt</option>
                    <option value="20pt">20 pt</option>
                </select>
            </div>

            <hr>
            <div style="margin-top:8px;">
                <h6>${this.$t("dashboard.audiorepeattitle")}</h6>
                <select id="audiorepeat" class="my-select" style="width:100%;max-width:100%;">
                    <option value="0">${this.$t("dashboard.audioallow")}</option>
                    <option value="1">1${this.$t("dashboard.audiorepeat1")}</option>
                    <option value="2">2${this.$t("dashboard.audiorepeat2")}</option>
                    <option value="3">3${this.$t("dashboard.audiorepeat2")}</option>
                    <option value="4">4${this.$t("dashboard.audiorepeat2")}</option>
                </select>
            </div>

            <hr>
            <div>
                <h6>${this.$t("dashboard.spellcheck")}</h6>
               
                <input class="form-check-input" type="checkbox" id="checkboxLT">
                <label class="form-check-label" for="checkboxLT"> LanguageTool ${this.$t("dashboard.activate")} </label> <br>
                <input class="form-check-input" type="checkbox" id="checkboxsuggestions">
                <label class="form-check-label" for="checkboxsuggestions"> ${this.$t("dashboard.suggest")} </label><br>
                <input class="form-check-input" type="checkbox" id="checkboxCustomHost">
                <label class="form-check-label" for="checkboxCustomHost"> ${this.$t("dashboard.customhost")} </label><br>
                
                <div style="display:flex; gap:8px; margin-top:4px; width:99%; align-items:center;">
                    <div style="position:relative; flex:1;">
                        <input type="text" id="languagetoolhost" class="form-control" style="width:100%; padding-right:24px; color: #6c757d;" value="https://languagetool" disabled>
                        <span id="languagetoolhostStatus" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-weight:bold; cursor:help; z-index:2;"></span>
                    </div>
                    <input type="text" id="languagetoolport" class="form-control" style="width:90px; color: #6c757d;" value="8088" disabled>
                </div>
                <br><br>
                <h6 style="margin-bottom:0px;">${this.$t("dashboard.spellcheckchoose")}</h6>
            </div>
             
        </div>`,
        input: 'select',
        inputOptions: inputOptions,
        focusConfirm: false,
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        didOpen: () => {
            const marginValueInput = document.getElementById('marginValue');
            marginValueInput.addEventListener('input', updateMarginValueDisplay);
            document.getElementById('checkboxLT').checked = this.serverstatus.examSections[this.serverstatus.activeSection].languagetool
            document.getElementById('checkboxsuggestions').checked = this.serverstatus.examSections[this.serverstatus.activeSection].suggestions
            document.getElementById('audiorepeat').value = this.serverstatus.examSections[this.serverstatus.activeSection].audioRepeat
            
            // Setze den Radio-Button für linespacing
            const linespacing = this.serverstatus.examSections[this.serverstatus.activeSection].linespacing;
            const radioButton = document.querySelector(`input[name="linespacing"][value="${linespacing}"]`);
            if (radioButton) {
                radioButton.checked = true;
            }

            // Setze den Radio-Button für fontfamily
            const fontfamily = this.serverstatus.examSections[this.serverstatus.activeSection].fontfamily;
            const fontfamilyRadioButton = document.querySelector(`input[name="fontfamily"][value="${fontfamily}"]`);
            if (fontfamilyRadioButton) {
                fontfamilyRadioButton.checked = true;
            }

            // Setze den Radio-Button für correction_margin
            const correctionMargin = this.serverstatus.examSections[this.serverstatus.activeSection].cmargin.side;
            const correctionMarginRadioButton = document.querySelector(`input[name="correction_margin"][value="${correctionMargin}"]`);
            if (correctionMarginRadioButton) {
                correctionMarginRadioButton.checked = true;
            }

            // Setze den Wert für die Sprache
            const language = this.serverstatus.examSections[this.serverstatus.activeSection].spellchecklang;
            const selectElement = document.querySelector('.swal2-select');
            if (selectElement) {
                // Verzögerung beim Setzen des Werts
                setTimeout(() => {
                    selectElement.value = language;
                }, 100);
            }

            const defaultFontSize = this.serverstatus.examSections[this.serverstatus.activeSection].fontsize || '12pt';
            // console.log("defaultFontSize:", defaultFontSize)
            const selectElement2 = document.getElementById('fontsize');
            if (selectElement2) {
                setTimeout(() => {
                    selectElement2.value = defaultFontSize;
                }, 100);
            }



            const checkboxLT = document.getElementById('checkboxLT');
            const checkboxSuggestions = document.getElementById('checkboxsuggestions');
            const checkboxCustomHost = document.getElementById('checkboxCustomHost');
            const languagetoolhostInput = document.getElementById('languagetoolhost');
            const languagetoolportInput = document.getElementById('languagetoolport');
            const hostStatus = document.getElementById('languagetoolhostStatus');
            
            // Initialize LanguageTool host and port fields
            const savedHost = this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolhost;
            const savedPort = this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolport;
            
            // Set default values or saved values
            if (savedHost) {
                languagetoolhostInput.value = savedHost;
                checkboxCustomHost.checked = true;
                languagetoolhostInput.disabled = false;
                languagetoolhostInput.style.color = '#000000';
                if (languagetoolportInput) {
                    languagetoolportInput.value = savedPort || '8088';
                    languagetoolportInput.disabled = false;
                    languagetoolportInput.style.color = '#000000';
                }
            } else {
                languagetoolhostInput.value = 'https://languagetool';
                checkboxCustomHost.checked = false;
                languagetoolhostInput.disabled = true;
                languagetoolhostInput.style.color = '#6c757d';
                if (languagetoolportInput) {
                    languagetoolportInput.value = '8088';
                    languagetoolportInput.disabled = true;
                    languagetoolportInput.style.color = '#6c757d';
                }
            }

            // Helper to update status icon
            const setHostStatus = (state) => {
                if (!hostStatus) { return; }
                if (state === 'ok') {
                    hostStatus.textContent = '✓';
                    hostStatus.style.color = '#28a745';
                    hostStatus.title = this.$t('dashboard.host_ok') || 'Host erfolgreich aufgelöst';
                } else if (state === 'warn') {
                    hostStatus.textContent = '▲';
                    hostStatus.style.color = '#ffc107';
                    hostStatus.title = this.$t('dashboard.host_warn') || 'Host konnte nicht aufgelöst werden';
                } else {
                    hostStatus.textContent = '';
                    hostStatus.removeAttribute('title');
                }
            };
            
            // Initial: suggestions and custom host checkboxes deaktivieren, falls LT nicht gecheckt ist
            checkboxSuggestions.disabled = !checkboxLT.checked;
            checkboxCustomHost.disabled = !checkboxLT.checked;
            // Also disable input field if LT is not checked
            if (!checkboxLT.checked) {
                languagetoolhostInput.disabled = true;
                languagetoolhostInput.style.color = '#6c757d';
                if (languagetoolportInput) {
                    languagetoolportInput.disabled = true;
                    languagetoolportInput.style.color = '#6c757d';
                }
            }
            
            // Event Listener für checkboxLT, um den Status von checkboxsuggestions und checkboxCustomHost anzupassen
            checkboxLT.addEventListener('change', () => {
                checkboxSuggestions.disabled = !checkboxLT.checked;
                checkboxCustomHost.disabled = !checkboxLT.checked;
                // Wenn checkboxLT abgewählt wird, sollen suggestions und custom host zusätzlich zurückgesetzt werden:
                if (!checkboxLT.checked) {
                    checkboxSuggestions.checked = false;
                    checkboxCustomHost.checked = false;
                    languagetoolhostInput.disabled = true;
                    languagetoolhostInput.style.color = '#6c757d';
                    if (languagetoolportInput) {
                        languagetoolportInput.disabled = true;
                        languagetoolportInput.style.color = '#6c757d';
                    }
                }
            });
            
            // Event Listener für checkboxCustomHost, um das Textinput zu aktivieren/deaktivieren
            checkboxCustomHost.addEventListener('change', () => {
                const enabled = checkboxCustomHost.checked;
                languagetoolhostInput.disabled = !enabled;
                languagetoolhostInput.style.color = enabled ? '#000000' : '#6c757d';
                if (languagetoolportInput) {
                    languagetoolportInput.disabled = !enabled;
                    languagetoolportInput.style.color = enabled ? '#000000' : '#6c757d';
                }
                if (!enabled) {
                    setHostStatus('none');
                    resolvedLtIp = null;
                }
            });

            // DNS-Check während der Dialog offen ist (debounced)
            let ltResolveTimeout = null;
            const scheduleResolve = () => {
                if (!checkboxCustomHost.checked || languagetoolhostInput.disabled) {
                    setHostStatus('none');
                    resolvedLtIp = null;
                    return;
                }
                const raw = languagetoolhostInput.value || '';
                if (!raw.trim()) {
                    setHostStatus('none');
                    resolvedLtIp = null;
                    return;
                }
                if (ltResolveTimeout) {
                    clearTimeout(ltResolveTimeout);
                }
                ltResolveTimeout = setTimeout(async () => {
                    try {
                        const hostOnly = raw.trim().replace(/^https?:\/\//i, '').split('/')[0];
                        const result = await window.ipcRenderer?.invoke?.('resolveHostToIp', hostOnly);
                        if (!result || !result.ok || !result.ip) {
                            setHostStatus('warn');
                            resolvedLtIp = null;
                            return;
                        }
                        setHostStatus('ok');
                        resolvedLtIp = result.ip;
                    } catch (e) {
                        setHostStatus('warn');
                        resolvedLtIp = null;
                    }
                }, 600);
            };

            if (languagetoolhostInput) {
                languagetoolhostInput.addEventListener('input', scheduleResolve);
                // Initialen Check für Default-Wert nur, wenn Custom Host aktiv ist
                if (checkboxCustomHost.checked) {
                    scheduleResolve();
                }
            }

            
        },
        willClose: () => {
            const marginValueInput = document.getElementById('marginValue');
            if (marginValueInput) {
                marginValueInput.removeEventListener('input', updateMarginValueDisplay);
            }
        },
        inputValidator: (value) => {
            if (!value) {  return 'You need to choose a language!' }

        },
        preConfirm: () => {
            // Save all values before dialog closes (Electron 39 compatibility)
            const checkboxSuggestionsElement = document.getElementById('checkboxsuggestions');
            const checkboxLTElement = document.getElementById('checkboxLT');
            const checkboxCustomHostElement = document.getElementById('checkboxCustomHost');
            const languagetoolhostElement = document.getElementById('languagetoolhost');
            const languagetoolportElement = document.getElementById('languagetoolport');
            const marginValueElement = document.getElementById('marginValue');
            const audioRepeatElement = document.getElementById('audiorepeat');
            const fontSizeElement = document.getElementById('fontsize');

            this.serverstatus.examSections[this.serverstatus.activeSection].suggestions = checkboxSuggestionsElement ? checkboxSuggestionsElement.checked : false; 
            this.serverstatus.examSections[this.serverstatus.activeSection].languagetool = checkboxLTElement ? checkboxLTElement.checked : false;
            
            // Save LanguageTool host (as resolved IP) and port values if custom host checkbox is checked
            if (checkboxCustomHostElement && checkboxCustomHostElement.checked && languagetoolhostElement) {
                const rawHost = languagetoolhostElement.value || 'http://127.0.0.1';
                const protocolMatch = rawHost.match(/^(https?:\/\/)/i);
                const protocol = protocolMatch ? protocolMatch[1] : 'http://';
                const hostForConfig = resolvedLtIp ? `${protocol}${resolvedLtIp}` : rawHost;
                this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolhost = hostForConfig;
                if (languagetoolportElement && languagetoolportElement.value) {
                    this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolport = languagetoolportElement.value;
                } else {
                    this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolport = '8088';
                }
            } else {
                this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolhost = null;
                this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolport = null;
            } 

            const radioButtons = document.querySelectorAll('input[name="correction_margin"]');
            const marginValue = marginValueElement ? marginValueElement.value : '';
            const linespacingradioButtons = document.querySelectorAll('input[name="linespacing"]');
            const fontfamilyradioButtons = document.querySelectorAll('input[name="fontfamily"]');
            const audioRepeat = audioRepeatElement ? audioRepeatElement.value : '';
            const fontSize = fontSizeElement ? fontSizeElement.value : '';

            let selectedMargin = '';
            radioButtons.forEach((radio) => {
                if (radio.checked) {
                    selectedMargin = radio.value;
                }
            });

            let selectedSpacing = '';
            linespacingradioButtons.forEach((radio) => {
                if (radio.checked) {
                    selectedSpacing = radio.value;
                }
            });

            let selectedFont = '';
            fontfamilyradioButtons.forEach((radio) => {
                if (radio.checked) {
                    selectedFont = radio.value;
                }
            });

            if (marginValue && selectedMargin) {
                this.serverstatus.examSections[this.serverstatus.activeSection].cmargin = {
                    side: selectedMargin,
                    size: parseFloat(marginValue)
                }
               // console.log( this.serverstatus.cmargin)
            }


            this.serverstatus.examSections[this.serverstatus.activeSection].linespacing = selectedSpacing
            this.serverstatus.examSections[this.serverstatus.activeSection].fontfamily = selectedFont
            this.serverstatus.examSections[this.serverstatus.activeSection].fontsize = fontSize
            this.serverstatus.examSections[this.serverstatus.activeSection].audioRepeat = audioRepeat
        }
    })
    if (language) {
        this.serverstatus.examSections[this.serverstatus.activeSection].spellchecklang = language
        if (language === 'none'){this.serverstatus.examSections[this.serverstatus.activeSection].languagetool = false}
    }  
    else {
        this.serverstatus.examSections[this.serverstatus.activeSection].spellchecklang = 'de-DE'
    }

    this.setServerStatus()
}   




// Helper functions

function extractDomainAndId(url) {
    // Extract the full domain including subdomains
    var domainRegex = /^(https?:\/\/)?([^\/]+)/i;
    var match = url.match(domainRegex);
    var fullDomain = match ? match[2] : null;

    // Extract only the domain and TLD
    var domainParts = fullDomain.split('.').slice(-2).join('.');
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
        // const urlString = str.includes('://') ? str : 'https://' + str; // Entfernt: Kein automatisches Hinzufügen von https://
        const urlString = str; // Nutzt den String direkt
        const url = new URL(urlString); // Erzeugt einen Fehler, wenn das Protokoll fehlt
        
        // Prüfe ob Protokoll korrekt ist
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        // Prüfe ob Host vorhanden und gültig ist
        if (!url.hostname || url.hostname.length < 1) {
            return false;
        }

        // Prüfe ob Host mindestens einen gültigen Domain-Teil enthält
        const parts = url.hostname.split('.');
        if (parts.length < 2) {
            return false;
        }

        // Prüfe ob jeder Domain-Teil gültig ist
        const validPart = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        return parts.every(part => 
            part.length > 0 && 
            part.length <= 63 && 
            validPart.test(part)
        );

    } catch (e) {
        // Fängt den Fehler der new URL(urlString) ab, wenn das Protokoll fehlt (z.B. bei 'classtime.com')
        return false;
    }
}




/**
 * define materials for exam
 * für jeden prüfungsabschnitt können materialien festgelegt werden die während der prüfung verfügbar sein sollen
 * diese werden bei prüfungsbeginn auf die clients verteilt bzw. beim start des entsprechenden abschnitts auf die clients verteilt
 * @param {string} who "all" (Gruppe wählen) | "a" | "b" (Zielgruppe vorgegeben)
 * @returns 
 */
function defineMaterials(who) {
    const hasGroups = !!this.serverstatus.examSections[this.serverstatus.activeSection].groups;
    const whoNorm = String(who || 'all').toLowerCase();
    const presetGroup = whoNorm === 'b' ? 'b' : whoNorm === 'a' ? 'a' : 'all';

    let htmlcontent = `<div class="my-content"> 
        ${this.$t("dashboard.filesendtext")} <br>
        <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
        </div>`

    if (hasGroups && presetGroup === "all") {
        htmlcontent = `<div class="my-content"> 
            ${this.$t("dashboard.filesendtext")} <br>
            <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
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
            accept: ".pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb"
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
            this.setStudentStatus({getmaterials: true}, 'all'); 
            this.setServerStatus()
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
        this.setStudentStatus({getmaterials: true}, 'all'); 
        this.setServerStatus()
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
        else if (file.type.includes("bak")) { filetype = "bak"; }
        else if (file.type.includes("openxml")) { filetype = "docx"; }
        else if (file.type.includes("ggb")) { filetype = "ggb"; }
        else if (file.type.includes("audio") || file.type.includes("ogg") || file.type.includes("wav")) { filetype = "audio"; }
        else if (file.type.includes("jpg") || file.type.includes("jpeg") || file.type.includes("png") || file.type.includes("gif")) { filetype = "image"; }
    }
    
    // Fallback to filename if filetype not determined from file.type
    if (!filetype && filename) {
        const lowerName = filename.toLowerCase();
        if (lowerName.endsWith('.pdf')) { filetype = "pdf"; }
        else if (lowerName.endsWith('.bak')) { filetype = "bak"; }
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
            this.setServerStatus()

        }
    })
}

function openAllowedUrl(allowedUrl){
    // Support both object format {url, blockSubdomains, blockSubfolders} and legacy string format
    const url = typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
    this.urlForWebview = url;        // this is used to open the allowed url in the webview pane
    this.webviewVisible = true;             // this is used to show the webview pane

    document.querySelector("#pdfpreview").style.display = 'block';
    document.querySelector("#openPDF").style.display = 'none';
    document.querySelector("#downloadPDF").style.display = 'none';
    document.querySelector("#printPDF").style.display = 'none';
    document.querySelector("#closePDF").style.display = 'none';
    document.querySelector("#pdfembed").style.display = 'none';
    document.querySelector("#pdfrenderer").style.display = 'none';
}
















export { configureWebsite, configureEduvidual, getFormsID, configureEditor, configureMath, configureActivesheets, configureRDP, configureLocalVM, extractDomainAndId, isValidMoodleDomainName, isValidFullDomainName, defineMaterials, handleAllowedUrlRemove, openAllowedUrl, addFileAsExamMaterial }
