/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * 
 * This program is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or any later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>
 */



function LTdisable(){
    if (!this.LTactive){ return}
    this.LTactive = false

    this.canvas = document.getElementById('highlight-layer');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Vorheriges Highlighting löschen
   
    let ltdiv = document.getElementById(`languagetool`)    // the div is not existant if lt is disabled
    let eye = document.getElementById('eye')               // the div is not existant if lt is disabled


    if (ltdiv && ltdiv.style.right == "0px"){
        ltdiv.style.right = "-282px";
        ltdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0)";
    }

    if (eye) {
        eye.classList.add('eyeopen');
        eye.classList.add('darkgreen');
        eye.classList.remove('eyeclose');
        eye.classList.remove('darkred');
    }
   
    this.misspelledWords = []
    this.LTpositions = []
    return 
}


async function LTcheckAllWords(closeLT = true){
    this.textContainer =  document.querySelector('#editorcontent > div');
    this.canvas = document.getElementById('highlight-layer');
    this.ctx = this.canvas.getContext('2d');
    this.text = this.editor.getText();    //get text to check
   

    //check if lt is alread open (toggle button)
    let ltdiv = document.getElementById(`languagetool`)
    let eye = document.getElementById('eye')
   
    if (this.LTactive && closeLT){
        this.LTdisable()
        return 
    }
    else {
        ltdiv.style.right = "0px"
        ltdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0.2)"; 
        eye.classList.remove('eyeopen');
        eye.classList.remove('darkgreen');
        eye.classList.add('eyeclose');
        eye.classList.add('darkred');
        this.LTactive = true;
    }



    if (this.text.length == 0) { 
        this.LTinfo = "keine Fehler gefunden"
        return; 
    }

    //request LanguageTool API
    this.LTinfo = "searching..."

    fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/languagetool/${this.servername}/${this.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: this.text, language: this.serverstatus.spellchecklang })
    })
    .then(response => response.json())
    .then(async (data) => {
        if (data.status == "error" || !Array.isArray(data.data)){
            console.warn('languagetool.js @ LTcheckAllwords: using hunspell fallback')
            // FALLBACK to HUNSPELL if LanguageTool is not reachable
            const hunspelldata = ipcRenderer.sendSync('checktext', this.text);
            this.LThandleMisspelled("hunspell", hunspelldata)  // generiert misspelled object dass ähnlich verarbeitet werden kann wie das lt object
        }
        else {
            this.LThandleMisspelled("languagetool", data)   //bereitet die liste auf - entfernt duplikate
        }

        if (!this.misspelledWords.length) {
            this.LTinfo = "keine Fehler gefunden"
            return;
        }

        this.LTinfo = "closing..."
        let positions = await this.LTfindWordPositions();  //finde wörter im text und erzeuge highlights
        this.LThighlightWords(positions)

    })
    .catch(async (error) => {
        console.warn('languagetool.js @ LTcheckAllwords (catch):', error.message)  
         // FALLBACK to HUNSPELL if LanguageTool (Next-Exam-Teacher) is not reachable
        const hunspelldata = ipcRenderer.sendSync('checktext', this.text);
        this.LThandleMisspelled("hunspell", hunspelldata) 

        this.LTinfo = "closing..."
        let positions = await this.LTfindWordPositions();  //finde wörter im text und erzeuge highlights
        this.LThighlightWords(positions)
    })
}



function LThandleMisspelled(backend, data){
    if (backend == "hunspell"){
        this.hunspellFallback = true;
        this.misspelledWords = []
        if (data.misspelledWords){
            data.misspelledWords.forEach( word => {
                //generate LT like replacements array of objects
                let suggestions = []
                word.suggestions.forEach(sugg =>{
                    suggestions.push({value: sugg})
                } )
               
                this.misspelledWords.push( {
                    wrongWord: word.wrongWord, 
                    rule: {
                        issueType:"misspelling"
                    },
                    color: "rgba( 211, 84, 0, 0.3)",
                    replacements: suggestions
                } )
            })
        }
        else if (data.error){
            console.error("languagetool.js @ LTcheckAllwords: Hunspell backend nicht verfügbar")
            this.LTinfo = "Hunspell nicht verfügbar"
            return
        }
    }

    if (backend == "languagetool"){
        this.hunspellFallback = false;
        // Verarbeiten der Antwort, um das fehlerhafte Wort zu extrahieren und Duplikate zu entfernen
        const uniqueWords = new Set(); // Ein Set, um die Einzigartigkeit der Wörter zu gewährleisten
       
        this.misspelledWords = data.data.filter(match => {
            let wrongWord = this.text.substring(match.offset, match.offset + match.length);
         
            if (!uniqueWords.has(wrongWord)) {
                uniqueWords.add(wrongWord);
                return true; // Behalte dieses Match, da das Wort noch nicht hinzugefügt wurde
            }
            return true; // Entferne dieses Match, da das Wort bereits vorhanden ist
        }).map(match => {
            // Nachdem Duplikate entfernt wurden, füge das fehlerhafte Wort hinzu
            const wrongWord = this.text.substring(match.offset, match.offset + match.length);
            return {
                ...match,
                wrongWord,
            };
        });
    }
}




async function LTfindWordPositions() {
    if (!this.misspelledWords || !this.textContainer || this.misspelledWords.length === 0) {
        return [];
    }

     this.misspelledWords.forEach(word => {
        word.position=null // reset and search again
     })


    // Vorbereiten des Node Iterators
    const nodeIterator = document.createNodeIterator(this.textContainer, NodeFilter.SHOW_TEXT);
    let textNode;


    // Durchlaufe alle Textknoten
    while ((textNode = nodeIterator.nextNode())) {
        const text = textNode.nodeValue;
     
        this.misspelledWords.forEach(word => {
          
            // Setze Farben basierend auf dem Issue Typ
            if (word.rule.issueType === "typographical") { word.color = "rgba(146, 43, 33 , 0.3)"; }
            else if (word.rule.issueType === "whitespace") { word.color = "rgba(243, 190, 41, 0.5)"; word.whitespace = true; }
            else if (word.rule.issueType === "misspelling") { word.color = "rgba(211, 84, 0, 0.3)"; }
            else { word.color = "rgba(108, 52, 131, 0.3)"; }

            // Erstelle Regex für das Wort
            const pattern = word.wrongWord.trim() === '' ? '\\s\\s+' : `${word.wrongWord}`;  // Suche exakt nach dem Wort, ohne Lookbehind oder Lookahead
            const regex = new RegExp(pattern, 'g');

            // Durchsuche den Text der aktuellen (text)Node nach diesem Wort
            let match;
            while ((match = regex.exec(text)) !== null) {
                const range = document.createRange();
                range.setStart(textNode, match.index);
                range.setEnd(textNode, match.index + word.wrongWord.length);
                const rects = range.getClientRects(); // Positionsinformationen des Textes

                Array.from(rects).forEach(rect => {
                    const newPosition = {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                    };
              
                    if (isUnique(newPosition, word, this.misspelledWords)) {  // Prüfe, ob die Position einzigartig ist
                        if (!word.position) {
                            word.position = newPosition;  // Speichere Position, wenn noch keine vorhanden ist
                            word.range = range
                        }
                    }

                });
            }
        });
    }

}

// Check if any word already has this exact position
function isUnique(position, currentWord, allWords) {
    const alreadyTaken = allWords.some(word => 
        word !== currentWord && 
        word.position && 
        word.position.left === position.left && 
        word.position.top === position.top     
    );
    return !alreadyTaken;
}







function LThighlightWords() {
    if (!this.textContainer || this.misspelledWords.length == 0 || (!this.serverstatus.languagetool && !this.privateSpellcheck.activated)){
        console.log(this.privateSpellcheck)
        console.log(this.languagetool)
        this.LTdisable(); 
         return 
    }

    this.canvas.width = this.textContainer.offsetWidth;
    this.canvas.height = this.textContainer.offsetHeight;
    this.canvas.style.top = this.textContainer.offsetTop + 'px';
    this.canvas.style.left = this.textContainer.offsetLeft + 'px';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Vorheriges Highlighting löschen
    
     // Check if the 'position' attribute exists in the 'word' object - if not remove word object from misspelled array -  don't know if that's a good idea????
    // this.misspelledWords = this.misspelledWords.filter(word => {
    //     return word.hasOwnProperty('position') && word.position;
    // });

    this.misspelledWords.forEach(word => {
        if (!word.position){return}  // student could delete word without requesting a new check so it's still in this.misspelled words but nothing to highlight anymore
        let height = 3
        let translate = word.position.height
        if (this.currentLTword && this.currentLTword.position && word.position.top == this.currentLTword.position.top){ 
            if (word === this.currentLTword) {
                height = word.position.height + 3;
                translate = -3;
            }
        }
        const adjustedLeft = word.position.left - this.textContainer.offsetLeft + window.scrollX;
        const adjustedTop = word.position.top - this.textContainer.offsetTop + window.scrollY;
        this.ctx.fillStyle = word.color; // Farbe und Transparenz des Highlights
        this.ctx.fillRect(adjustedLeft, adjustedTop+translate, word.position.width, height); // Angepasste Position und Größe
    });
}
    





export { LTcheckAllWords, LTfindWordPositions, LThighlightWords, LTdisable, LThandleMisspelled }