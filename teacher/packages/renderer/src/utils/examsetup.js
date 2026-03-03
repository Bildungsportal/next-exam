
import CryptoJS from 'crypto-js';

/**
 * Website
 */
function getTestURL(){
    this.$swal.fire({
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
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `
            <div class="my-content">                   
                zB.: https://www.classtime.com
            </div>
            `,  
        didOpen: () => {
            document.getElementsByClassName('my-custom-input')[0].value = this.serverstatus.examSections[this.serverstatus.activeSection].domainname || ''
        },
        inputValidator: (value) => {
            if (!isValidFullDomainName(value)) {return 'Ungültige Domain!'}
        }  
    })
    .then((input) => {
        let domainname = input.value
        this.serverstatus.examSections[this.serverstatus.activeSection].domainname = isValidFullDomainName(  domainname ) ? domainname : null

        if (!this.serverstatus.examSections[this.serverstatus.activeSection].domainname) { this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math"}
        else { this.backupinterval.stop(); this.autobackup = false;}  // no auto backup in this exam mode
        //console.log( this.serverstatus.domainname )
        this.setServerStatus()
    })  
}


/**
 * Eduvidual
 */
async function getTestID(){
    
    this.$swal.fire({
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
        input: 'url',
        inputLabel: this.$t("dashboard.eduvidualidhint"),
        inputPlaceholder: 'https://www.eduvidual.at/mod/quiz/view.php?id=6153159',
        html: `                    
            <div class="my-content" style="width: 150px; margin: auto auto;">
                <img  width="24" height="24" src="data:image/png;base64,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"/>
            </div>
           
        `,
        didOpen: () => {
            document.getElementById('swal2-input').value = this.serverstatus.examSections[this.serverstatus.activeSection].moodleURL
        },
        inputValidator: (value) => {
            if (!value || !isValidMoodleDomainName(value) ) {return this.$t("dashboard.moodleInvalidDomain")}
            let { moodledomain, testid } = extractDomainAndId(value);
            if ( !testid) { return this.$t("dashboard.moodleInvalidId")}
        }
    }).then((input) => {
        if (!input.value ) {
            this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math";
            return;
        }

        let { moodledomain, testid } = extractDomainAndId(input.value);

        this.serverstatus.examSections[this.serverstatus.activeSection].moodleTestId = testid
        this.serverstatus.examSections[this.serverstatus.activeSection].moodleDomain = moodledomain
        this.serverstatus.examSections[this.serverstatus.activeSection].moodleURL = input.value

        this.backupinterval.stop(); 
        this.autobackup = false;  // no auto backup in this exam mode
        this.setServerStatus()
    })  
}


/**
 * Google Forms
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
        title: this.$t("dashboard.gforms"),
        icon: 'question',
        input: 'text',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        html: `<div class="m-1 my-content">
        ${this.$t("dashboard.gformshint")} <br>
        <span style="font-size:0.8em">
            (https://docs.google.com/forms/d/e/<span style="background-color: lightblue; padding:0 3px 0 3px;">1FAIpQLScuTG7yldD0VRhFgOC_2fhbVdgXn95Kf_w2rUbJm79S1kJBnA</span>/viewform)
        </span>
        </div>`,
        inputValidator: (value) => {
            if (!value) {return this.$t("dashboard.moodleInvalidId")}
        }
    }).then((input) => {
        if (!input.value) { this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math"}
        else {
            this.serverstatus.examSections[this.serverstatus.activeSection].gformsTestId = input.value
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


/**
 * Active Sheets (PDF Forms)
 * @param {boolean} forceDialog - If true, show dialog even if PDF already exists
 */
async function configureActivesheets(forceDialog = false){
    let htmlcontent = `<div class="my-content"> 
        ${this.$t("dashboard.activesheetshint") || "Bitte wählen Sie eine PDF-Datei aus, die interaktive Formularfelder enthält."} <br>
        <span style="font-size:0.8em;">(.pdf)</span>
        </div>`

    // Show group selection buttons only if groups are enabled
    if (this.serverstatus.examSections[this.serverstatus.activeSection].groups) {
        htmlcontent = `<div class="my-content"> 
            ${this.$t("dashboard.activesheetshint") || "Bitte wählen Sie eine PDF-Datei aus, die interaktive Formularfelder enthält."} <br>
            <span style="font-size:0.8em;">(.pdf)</span>
            <br>  <br> 
            Gruppe<br>
            <button id="fbtnA" class="swal2-button btn btn-info m-2" style="width: 42px; height: 42px;">A</button>
            <button id="fbtnB" class="swal2-button btn btn-warning m-2" style="width: 42px; height: 42px;filter: grayscale(90%);">B</button>
            <button id="fbtnC" class="swal2-button btn btn-warning m-2" style="padding:0px;width: 42px; height: 42px;filter: grayscale(90%); background: linear-gradient(-60deg, #0dcaf0 50%, #ffc107 50%);">AB</button>
        </div>`
    }
         
    let activeGroup = this.serverstatus.examSections[this.serverstatus.activeSection].groups ? "a" : "all"  // Default to group A if groups enabled, otherwise "all"

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
        title: this.$t("dashboard.activesheets") || "Active Sheets",
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
            accept: ".pdf"
        },
        didRender: () => {
            const btnA = document.getElementById('fbtnA');
            const btnB = document.getElementById('fbtnB');
            const btnC = document.getElementById('fbtnC');
            if (btnA && !btnA.dataset.listenerAdded) {
                btnA.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(0%)"
                    btnB.style.filter = "grayscale(90%)"
                    btnC.style.filter = "grayscale(90%)"
                    activeGroup = "a"
                });
                btnA.dataset.listenerAdded = 'true';
            }
            if (btnB && !btnB.dataset.listenerAdded) {
                btnB.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(90%)"
                    btnB.style.filter = "grayscale(0%)"
                    btnC.style.filter = "grayscale(90%)"
                    activeGroup = "b"
                });
                btnB.dataset.listenerAdded = 'true';
            }
            if (btnC && !btnC.dataset.listenerAdded) {
                btnC.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(90%)"
                    btnB.style.filter = "grayscale(90%)"
                    btnC.style.filter = "grayscale(0%)"
                    activeGroup = "all"
                });
                btnC.dataset.listenerAdded = 'true';
            }
        },
        inputValidator: (value) => {
            if (!value) {
                return this.$t("dashboard.nopdfselected") || "Bitte wählen Sie eine PDF-Datei aus!";
            }
            const files = value;
            // Handle FileList (array-like object) or single File
            const fileArray = files.length !== undefined ? Array.from(files) : [files];
            for (const file of fileArray) {
                if (!(file.type && file.type.includes("pdf")) && !file.name.toLowerCase().endsWith('.pdf')) {
                    return this.$t("dashboard.invalidpdf") || "Ungültige PDF-Datei!";
                }
            }
        },
    })
    .then(async (input) => {
        if (!input.value) {   return;   } // no further processing if no files are selected

        this.status(this.$t("dashboard.processingfiles") || "Dateien werden verarbeitet...");
        // Handle FileList (array-like object) or single File or Array
        const files = Array.isArray(input.value) 
            ? input.value 
            : input.value.length !== undefined 
                ? Array.from(input.value) 
                : [input.value];

        // Process each file
        let firstFileBase64 = null;
        let firstFileName = null;
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

                // Convert first file to Base64 for preview
                if (!firstFileBase64) {
                    firstFileBase64 = await readFileAsBase64(file);
                    firstFileName = file.name;
                }

                // Use the shared function to add file as exam material with IsActiveSheet flag
                await addFileAsExamMaterial(
                    file,
                    null, // filename not needed when using File object
                    activeGroup,
                    this.serverstatus,
                    this.serverstatus.activeSection,
                    true // isActiveSheet = true
                );
               
            } catch (error) {
                console.error(`examsetup @ configureActivesheets: Error processing file ${file.name}:`, error);
            }
        }

        this.setServerStatus()
        
        // Show PdfRenderer for the first file if available
        if (firstFileBase64 && firstFileName) {
            // Call showBase64PdfInRenderer if available (it should be available in dashboard.vue context)
            if (typeof this.showBase64PdfInRenderer === 'function') {
                this.showBase64PdfInRenderer(firstFileBase64, firstFileName);
            }
        }
    });    
}

/**
 * RDP
 */
async function configureRDP(){
    let savedDomain = ''; // Store domain value before dialog closes (Electron 39 compatibility)

    this.$swal.fire({
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
            <span class="text">${this.$t("dashboard.rdpconfiginfo")}</span>
            <br> <br>
            <label>
                <input type="text" id="domain" class="form-control my-select" placeholder="rdweb.schule.lan">
            </label>
            
        </div>
        `,
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        didOpen: () => {
            if (this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig) {
                document.getElementById('domain').value = this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig.domain || ''
            }
        },
        preConfirm: () => {
            // Save domain value before dialog closes (Electron 39 compatibility)
            const domainElement = document.getElementById('domain');
            savedDomain = domainElement ? domainElement.value.trim() : '';
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const domain = savedDomain; // Use saved value instead of reading from DOM
            
            if (!domain) {
                this.$swal.fire({
                    title: "Fehler",
                    text: "Bitte geben Sie eine gültige Domain ein.",
                    icon: "error"
                });
                return;
            }

            const rdpConfig = {
                domain: domain
            }

            this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig = rdpConfig;
            this.setServerStatus();
        }
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
        <div class="my-content" style="font-size: 0.8em !important; text-align:left; margin-left:6px;">
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

            <div>
                <h6>${this.$t("dashboard.fontsize")}</h6>
                <select id="fontsize" class="my-select" value="12pt">
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
            <div>
                <h6>${this.$t("dashboard.audiorepeattitle")}</h6>
                <select id="audiorepeat" class="my-select">
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
                
                <input type="text" id="languagetoolhost" class="form-control" style="margin-top:4px; width: 100%; display: block; color: #6c757d;" value="http://127.0.0.1" disabled><br><br>
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
            console.log("defaultFontSize:", defaultFontSize)
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
            
            // Initialize LanguageTool Host field
            const savedHost = this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolhost;
            
            // Set default value or saved value
            if (savedHost) {
                languagetoolhostInput.value = savedHost;
                checkboxCustomHost.checked = true;
                languagetoolhostInput.disabled = false;
                languagetoolhostInput.style.color = '#000000';
            } else {
                languagetoolhostInput.value = 'http://127.0.0.1';
                checkboxCustomHost.checked = false;
                languagetoolhostInput.disabled = true;
                languagetoolhostInput.style.color = '#6c757d';
            }
            
            // Initial: suggestions and custom host checkboxes deaktivieren, falls LT nicht gecheckt ist
            checkboxSuggestions.disabled = !checkboxLT.checked;
            checkboxCustomHost.disabled = !checkboxLT.checked;
            // Also disable input field if LT is not checked
            if (!checkboxLT.checked) {
                languagetoolhostInput.disabled = true;
                languagetoolhostInput.style.color = '#6c757d';
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
                }
            });
            
            // Event Listener für checkboxCustomHost, um das Textinput zu aktivieren/deaktivieren
            checkboxCustomHost.addEventListener('change', () => {
                languagetoolhostInput.disabled = !checkboxCustomHost.checked;
                languagetoolhostInput.style.color = checkboxCustomHost.checked ? '#000000' : '#6c757d';
            });

            
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
            const marginValueElement = document.getElementById('marginValue');
            const audioRepeatElement = document.getElementById('audiorepeat');
            const fontSizeElement = document.getElementById('fontsize');

            this.serverstatus.examSections[this.serverstatus.activeSection].suggestions = checkboxSuggestionsElement ? checkboxSuggestionsElement.checked : false; 
            this.serverstatus.examSections[this.serverstatus.activeSection].languagetool = checkboxLTElement ? checkboxLTElement.checked : false;
            
            // Save LanguageTool Host value if custom host checkbox is checked
            if (checkboxCustomHostElement && checkboxCustomHostElement.checked && languagetoolhostElement) {
                this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolhost = languagetoolhostElement.value || 'http://127.0.0.1';
            } else {
                this.serverstatus.examSections[this.serverstatus.activeSection].languagetoolhost = null;
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
 * @param {*} who ist in diesem fall immer "all"
 * @returns 
 */
function defineMaterials(who) {
    let htmlcontent = `<div class="my-content"> 
        ${this.$t("dashboard.filesendtext")} <br>
        <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
        </div>`

    if (this.serverstatus.examSections[this.serverstatus.activeSection].groups && who == "all") {
        htmlcontent = `<div class="my-content"> 
            ${this.$t("dashboard.filesendtext")} <br>
            <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
            <br>  <br> 
            Gruppe<br>
            <button id="fbtnA" class="swal2-button btn btn-info m-2" style="width: 42px; height: 42px;">A</button>
            <button id="fbtnB" class="swal2-button btn btn-warning m-2" style="width: 42px; height: 42px;filter: grayscale(90%);">B</button>
            <button id="fbtnC" class="swal2-button btn btn-warning m-2" style="padding:0px;width: 42px; height: 42px;filter: grayscale(90%); background: linear-gradient(-60deg, #0dcaf0 50%, #ffc107 50%);">AB</button>
        </div>`
    }
    
    htmlcontent += `<div class="my-content" style="margin-top: 10px;">
        <h6>${this.$t("dashboard.allowedURL")}</h6>
        <input type="text" id="allowedURL" class="form-control my-custom-input" style="width: 60%!important; margin:4px!important;" placeholder="https://www.example.com">
    </div>` 
         
    let activeGroup = "a"  // prinzipiell ist jeder user automatisch in der gruppe a
    let savedAllowedUrl = ''; // Store allowedURL value before dialog closes (Electron 39 compatibility)

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
                    btnA.style.filter = "grayscale(0%)"
                    btnB.style.filter = "grayscale(90%)"
                    btnC.style.filter = "grayscale(90%)"
                    activeGroup = "a"
                });
                btnA.dataset.listenerAdded = 'true';
            }
            if (btnB && !btnB.dataset.listenerAdded) {
                btnB.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(90%)"
                    btnB.style.filter = "grayscale(0%)"
                    btnC.style.filter = "grayscale(90%)"
                    activeGroup = "b"
                });
                btnB.dataset.listenerAdded = 'true';
            }
            if (btnC && !btnC.dataset.listenerAdded) {
                btnC.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(90%)"
                    btnB.style.filter = "grayscale(90%)"
                    btnC.style.filter = "grayscale(0%)"
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
        },
    })
    .then(async (input) => {

        const allowedUrl = savedAllowedUrl; // Use saved value instead of reading from DOM
        if (allowedUrl) {
            //this.serverstatus.examSections[this.serverstatus.activeSection].allowedUrls.push(allowedUrl);

            if (activeGroup === "a" || activeGroup === "all") {
                //TODO:  check if site already exists and do not add if it does
                this.serverstatus.examSections[this.serverstatus.activeSection].groupA.allowedUrls.push(allowedUrl);
            }
            if (activeGroup === "b" || activeGroup === "all") {
                //TODO:  check if site already exists and do not add if it does
                this.serverstatus.examSections[this.serverstatus.activeSection].groupB.allowedUrls.push(allowedUrl);
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
    
    // If this is an Active Sheet, remove all existing Active Sheets from the target groups
    if (isActiveSheet) {
        if (activeGroup === "a" || activeGroup === "all") {
            // Remove all files with IsActiveSheet: true from group A
            serverstatus.examSections[activeSection].groupA.examInstructionFiles = 
                serverstatus.examSections[activeSection].groupA.examInstructionFiles.filter(file => !file.IsActiveSheet);
        }
        if (activeGroup === "b" || activeGroup === "all") {
            // Remove all files with IsActiveSheet: true from group B
            serverstatus.examSections[activeSection].groupB.examInstructionFiles = 
                serverstatus.examSections[activeSection].groupB.examInstructionFiles.filter(file => !file.IsActiveSheet);
        }
    }
    
    // Create file object (same structure as in defineMaterials)
    const fileObject = {
        filename: finalFilename,
        filetype: filetype,
        filecontent: base64Content,
        checksum: checksum
    };
    
    // Add IsActiveSheet flag if specified
    if (isActiveSheet) {
        fileObject.IsActiveSheet = true;
    }
    
    // Add to groups based on activeGroup
    if (activeGroup === "a" || activeGroup === "all") {
        serverstatus.examSections[activeSection].groupA.examInstructionFiles.push(fileObject);
    }
    if (activeGroup === "b" || activeGroup === "all") {
        serverstatus.examSections[activeSection].groupB.examInstructionFiles.push(fileObject);
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
    
    this.urlForWebview = allowedUrl;        // this is used to open the allowed url in the webview pane
    this.webviewVisible = true;             // this is used to show the webview pane

    document.querySelector("#pdfpreview").style.display = 'block';
    document.querySelector("#openPDF").style.display = 'none';
    document.querySelector("#downloadPDF").style.display = 'none';
    document.querySelector("#printPDF").style.display = 'none';
    document.querySelector("#closePDF").style.display = 'none';
    document.querySelector("#pdfembed").style.display = 'none';
    document.querySelector("#pdfrenderer").style.display = 'none';
}
















export { getTestURL, getTestID, getFormsID, configureEditor, configureMath, configureActivesheets, configureRDP, extractDomainAndId, isValidMoodleDomainName, isValidFullDomainName, defineMaterials, handleAllowedUrlRemove, openAllowedUrl, addFileAsExamMaterial }