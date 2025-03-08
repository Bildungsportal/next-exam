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

        input: 'url',
        inputLabel: this.$t("dashboard.eduvidualidhint"),
        inputPlaceholder: 'https://www.eduvidual.at/mod/quiz/view.php?id=6153159',
        html: `                    
            <div  style="text-align: center; width: 150px; margin: auto auto;">
                <img  width="24" height="24" src="data:image/png;base64,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"/>
            </div>
           
        `,
        didOpen: () => {
            document.getElementById('swal2-input').value = this.serverstatus.examSections[this.serverstatus.activeSection].moodleURL
        },
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



async function configureMath(){
    this.$swal.fire({
        title: this.$t("dashboard.math"),
        icon: 'question',
        input: 'text',
        inputLabel: this.$t("dashboard.allowedURL"),
        inputPlaceholder: 'https://www.example.com',
        inputValue: this.serverstatus.examSections[this.serverstatus.activeSection].allowedUrl || '',
        showCancelButton: true,
        inputValidator: (value) => {
            if (value && !isValidFullDomainName(value)) {
                return 'Invalid Domain!';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const allowedURL = result.value;
            const urlString = allowedURL.includes('://') ? allowedURL : 'https://' + allowedURL;  // add https if not provided
            this.serverstatus.examSections[this.serverstatus.activeSection].allowedUrl = allowedURL ? urlString : null;
            this.setServerStatus();
        }
    });
}

async function configureRDP(){
    this.$swal.fire({
        title: this.$t("dashboard.rdp"),
        icon: 'question',
        html: `
        <div class="m-1">
            <h6>${this.$t("dashboard.rdpconfiginfo")}</h6>

            <label>
                <input type="text" id="domain" class="form-control my-select" placeholder="domain">
            </label>

            <label>
                <input type="text" id="username" class="form-control my-select" placeholder="username">
            </label>

            <label>
                <input type="text" id="password" class="form-control my-select" placeholder="password">
            </label>
            
            <label>
                <input type="text" id="ip" class="form-control my-select" placeholder="ip">
            </label>

            <label>
                <input type="text" id="port" value="3389" class="form-control my-select" placeholder="port">
            </label>
            
        </div>
        `,
        showCancelButton: true,
        didOpen: () => {
            if (this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig) {
                document.getElementById('domain').value = this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig.domain
                document.getElementById('username').value = this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig.userName
                document.getElementById('password').value = this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig.password
                document.getElementById('ip').value = this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig.ip
                document.getElementById('port').value = this.serverstatus.examSections[this.serverstatus.activeSection].rdpConfig.port
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {

            const rdpConfig = {
                domain: document.getElementById('domain').value,         
                userName: document.getElementById('username').value,   
                password: document.getElementById('password').value,    
                ip: document.getElementById('ip').value,  
                port: document.getElementById('port').value,          
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
                    <option value="1">1 ${this.$t("dashboard.audiorepeat1")}</option>
                    <option value="2">2 ${this.$t("dashboard.audiorepeat2")}</option>
                    <option value="3">3 ${this.$t("dashboard.audiorepeat2")}</option>
                    <option value="4">4 ${this.$t("dashboard.audiorepeat2")}</option>
                </select>
            </div>
            <hr>
            <div class="m-1">
                <h6>${this.$t("dashboard.allowedURL")}</h6>
                <input type="text" id="allowedURL" class="form-control my-select" placeholder="https://www.example.com">
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

            const defaultFontSize = this.serverstatus.examSections[this.serverstatus.activeSection].fontsize || '12pt';
            const selectElement2 = document.getElementById('fontsize');
            if (selectElement2) {
                setTimeout(() => {
                    selectElement2.value = defaultFontSize;
                }, 100);
            }

            const allowedUrl = this.serverstatus.examSections[this.serverstatus.activeSection].allowedUrl;
            if (allowedUrl) {
                document.getElementById('allowedURL').value = allowedUrl;
            }

            
        },
        willClose: () => {
            const marginValueInput = document.getElementById('marginValue');
            marginValueInput.removeEventListener('input', updateMarginValueDisplay);
        },
        inputValidator: (value) => {
            if (!value) {  return 'You need to choose a language!' }
            const allowedURL = document.getElementById('allowedURL').value;
            if (allowedURL !== "" && !isValidFullDomainName(allowedURL)) {return 'Invalid Domain!'}
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

            const allowedURL = document.getElementById('allowedURL').value;
            
            if  (allowedURL !== ""){
                const urlString = allowedURL.includes('://') ? allowedURL : 'https://' + allowedURL;  // add https if not provided
                this.serverstatus.examSections[this.serverstatus.activeSection].allowedUrl = urlString
            }else{
                this.serverstatus.examSections[this.serverstatus.activeSection].allowedUrl = null
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


export { getTestURL, getTestID, getFormsID, configureEditor, configureMath, configureRDP, extractDomainAndId, isValidMoodleDomainName, isValidFullDomainName,  }