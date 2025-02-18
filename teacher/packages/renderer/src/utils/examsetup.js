/**
 * Website
 */
function getTestURL(){
    this.$swal.fire({
        title: this.$t("dashboard.website"),
        icon: 'question',
        input: 'text',
        html: `
            <div class="row m-4 mt-1">                   
                zB.: https://classtime.com
            </div>
            `,  
        inputValidator: (value) => {
            if (!isValidFullDomainName(value)) {return 'Ungültige Domain!'}
        }  
    })
    .then((input) => {
        let domainname = input.value
        this.serverstatus.examSections[this.serverstatus.activeSection].domainname = isValidFullDomainName(  domainname ) ? domainname : null

        if (!this.serverstatus.examSections[this.serverstatus.activeSection].domainname) { this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math"}
        else { this.abgabeinterval.stop(); this.autoabgabe = false;}  // no autoabgabe in this exam mode
        //console.log( this.serverstatus.domainname )
        this.setServerStatus()
    })  
}


/**
         * Eduvidual
         */
async function getTestID(){
    this.$swal.fire({
        title: this.$t("dashboard.eduvidualid"),
        icon: 'question',
        input: 'number',
        input: 'url',
        inputLabel: this.$t("dashboard.eduvidualidhint"),
        inputPlaceholder: 'https://www.eduvidual.at/mod/quiz/view.php?id=6153159',
        html: `                    
            <div  style="text-align: center; width: 150px; margin: auto auto;">
                <img  width="24" height="24" src="data:image/png;base64,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"/>
                <img  width="24" height="24" src="data:image/png;base64,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"/>
            </div>
            <br>
        `,
        inputValidator: (value) => {
            if (!value || !isValidMoodleDomainName(value) ) {return 'No valid domain given!'}
            let { moodledomain, testid } = extractDomainAndId(value);
            if ( !testid) { return 'No valid ID given!'}
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

        this.abgabeinterval.stop(); 
        this.autoabgabe = false;  // no autoabgabe in this exam mode
        this.setServerStatus()
    })  
}


/**
         * Google Forms
         */
async function getFormsID(){
    this.$swal.fire({
        title: this.$t("dashboard.gforms"),
        icon: 'question',
        input: 'text',
        html: `
        ${this.$t("dashboard.eduvidualidhint")} <br>
        <span style="font-size:0.8em">
            (https://docs.google.com/forms/d/e/<span style="background-color: lightblue; padding:0 3px 0 3px;">1FAIpQLScuTG7yldD0VRhFgOC_2fhbVdgXn95Kf_w2rUbJm79S1kJBnA</span>/viewform)
        </span>`,
        inputValidator: (value) => {
            if (!value) {return 'No ID given!'}
        }
    }).then((input) => {
        if (!input.value) { this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math"}
        else {
            this.serverstatus.examSections[this.serverstatus.activeSection].gformsTestId = input.value
            this.abgabeinterval.stop();
            this.autoabgabe = false;
        }
        this.setServerStatus()
    })  
}




/**
* Text Editor
*/
async function activateSpellcheck(){
    const inputOptions = new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                'de-DE': this.$t("dashboard.de"),
                'en-GB': this.$t("dashboard.en"),
                'fr-FR': this.$t("dashboard.fr"),
                'es-ES': this.$t("dashboard.es"),
                'it-IT': this.$t("dashboard.it"),
                'none':this.$t("dashboard.none"),
            })
        }, 100)
    })

    const updateMarginValueDisplay = () => {
        const marginValueInput = document.getElementById('marginValue');
        const marginValueDisplay = document.getElementById('marginValueDisplay');
        marginValueDisplay.textContent = marginValueInput.value;
    };

    const { value: language } = await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.texteditor"),
        html: `
        <div class="my-content" style="font-size: 0.8em !important; text-align:left; margin-left:10px;">
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
                <select id="fontsize" class="my-select" value="16px">
                    <option value="12px">12 px</option>
                    <option value="14px">14 px</option>
                    <option value="16px">16 px</option>
                    <option value="18px">18 px</option>
                    <option value="20px">20 px</option>
                    <option value="22px">22 px</option>
                </select>
            </div>

            <hr>
            <div>
                <h6>${this.$t("dashboard.audiorepeattitle")}</h6>
                <select id="audiorepeat" class="my-select">
                    <option value="0">${this.$t("dashboard.audioallow")}</option>
                    <option value="1">1 ${this.$t("dashboard.audiorepeat1")}</option>
                    <option value="2">2 ${this.$t("dashboard.audiorepeat2")}</option>
                    <option value="3">3 ${this.$t("dashboard.audiorepeat2")}</option>
                    <option value="4">4 ${this.$t("dashboard.audiorepeat2")}</option>
                </select>
            </div>
           

            <hr>
            <div>
                <h6>${this.$t("dashboard.spellcheck")}</h6>
               
                <input class="form-check-input" type="checkbox" id="checkboxLT">
                <label class="form-check-label" for="checkboxLT"> LanguageTool ${this.$t("dashboard.activate")} </label> <br>
                <input class="form-check-input" type="checkbox" id="checkboxsuggestions">
                <label class="form-check-label" for="checkboxsuggestions"> ${this.$t("dashboard.suggest")} </label><br><br>
               <h6 style="margin-bottom:0px">${this.$t("dashboard.spellcheckchoose")}</h6>
            </div>
             
        </div>`,
        input: 'select',
        inputOptions: inputOptions,
        focusConfirm: false,
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

            const defaultFontSize = this.serverstatus.examSections[this.serverstatus.activeSection].fontsize || '16px';
            const selectElement2 = document.getElementById('fontsize');
            if (selectElement2) {
                setTimeout(() => {
                    selectElement2.value = defaultFontSize;
                }, 100);
            }

            
        },
        willClose: () => {
            const marginValueInput = document.getElementById('marginValue');
            marginValueInput.removeEventListener('input', updateMarginValueDisplay);
        },
        inputValidator: (value) => {
            if (!value) {
            return 'You need to choose something!'
            }
        },
        preConfirm: () => {
            this.serverstatus.examSections[this.serverstatus.activeSection].suggestions = document.getElementById('checkboxsuggestions').checked; 
            this.serverstatus.examSections[this.serverstatus.activeSection].languagetool = document.getElementById('checkboxLT').checked; 

            const radioButtons = document.querySelectorAll('input[name="correction_margin"]');
            const marginValue = document.getElementById('marginValue').value;
            const linespacingradioButtons = document.querySelectorAll('input[name="linespacing"]');
            const fontfamilyradioButtons = document.querySelectorAll('input[name="fontfamily"]');
            const audioRepeat = document.getElementById('audiorepeat').value;
            const fontSize = document.getElementById('fontsize').value;

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
    var regex = /^(https?:\/\/)?(([a-z0-9-]+\.)+[a-z]{2,})(\/.*)?$/i;
    return regex.test(url);
}



function isValidFullDomainName(str) {
    try {
        // Füge https:// hinzu, wenn kein Protokoll angegeben ist
        const urlString = str.includes('://') ? str : 'https://' + str;
        const url = new URL(urlString);
        
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
        return false;
    }
}


export { getTestURL, getTestID, getFormsID, activateSpellcheck, extractDomainAndId, isValidMoodleDomainName, isValidFullDomainName }