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
    
    this.misspelledWords = [] // reset misspelled words on every check

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
        this.LTinfo = "Keine Fehler gefunden"
        this.spellcheckFallback = false
        return; 
    }

    //request LanguageTool API
    this.LTinfo = "searching..."

    if (typeof ipcRenderer !== "undefined" && ipcRenderer?.invoke) {
        try {
            const ltStatus = await ipcRenderer.invoke('isLanguageToolRunning')
            if (!ltStatus?.running) {
                this.LTinfo = "Der LT-Server ist nicht erreichbar"
                console.warn('languagetool.js @ LTcheckAllwords (status check): LT-Server ist nicht erreichbar')
                this.spellcheckFallback = true
                this.ltRunning = false
                this.misspelledWords = []
                if (this.ctx && this.canvas) {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
                }
                return
            }
        } catch (statusError) {
            console.warn('languagetool.js @ LTcheckAllwords (status check):', statusError.message)
            this.LTinfo = "Der LT-Server ist nicht erreichbar"
            this.spellcheckFallback = true
            this.ltRunning = false
            this.misspelledWords = []
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
            }
            return
        }
    }

    try {
        const response = await fetch('http://127.0.0.1:8088/v2/check', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({ text: this.text, language: this.serverstatus.examSections[this.serverstatus.activeSection].spellchecklang}).toString() 
        });
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);   }
        const data = await response.json();      
        this.spellcheckFallback = false
  
        this.LThandleMisspelled(data.matches)   //bereitet die liste auf - entfernt duplikate
        if (!this.misspelledWords.length) {
            this.LTinfo = "Keine Fehler gefunden"
            return;
        }
        // this.LTinfo = "closing..."
        let positions = await this.LTfindWordPositions();  //finde wörter im text und erzeuge highlights
        this.LThighlightWords(positions)
            


    } catch (error) {
        console.warn('languagetool.js @ LTcheckAllwords (catch):', error.message)  
        this.LTinfo = "Der LT-Server ist nicht erreichbar"
        this.spellcheckFallback = true
        this.ltRunning = false
        this.misspelledWords = []
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        }
        return
       
    }


}


function LTignoreWord(word) {
    console.log(`Adding '${word.wrongWord}' to ignorelist`)
    this.ignoreList.add(word.wrongWord); // Convert to lowercase to make it case-insensitive
}
function LTresetIgnorelist() {
    this.ignoreList= new Set()
}

function LThandleMisspelled(matches){

    // Process all matches and keep all occurrences (don't remove duplicates)
    // Each match has a unique offset, so we want to keep all of them
    this.misspelledWords = matches.filter(match => {
        let wrongWord = this.text.substring(match.offset, match.offset + match.length);
        
        // Check if the word is in the ignore list
        if (this.ignoreList.has(wrongWord)) {
            return false; // Ignore this word
        }

        return true; // Keep all matches (including duplicates with different offsets)
    }).map(match => {
        // Add the wrongWord to each match
        const wrongWord = this.text.substring(match.offset, match.offset + match.length);
        return {
            ...match,
            wrongWord,
        };
    });
}




async function LTfindWordPositions() {
    if (!this.misspelledWords || !this.textContainer || this.misspelledWords.length === 0) {
        this.LTinfo = "Keine Fehler gefunden"
        return [];
    }

    // Get current text to track offset positions
    const textForValidation = this.text; // Text that was used for API call
    const currentEditorText = this.editor.getText();

    // Set colors based on issue type
    this.misspelledWords.forEach(word => {
        if (word.rule.issueType === "typographical") { word.color = "rgba(146, 43, 33 , 0.3)"; }
        else if (word.rule.issueType === "whitespace") { word.color = "rgba(243, 190, 41, 0.5)"; word.whitespace = true; }
        else if (word.rule.issueType === "misspelling") { word.color = "rgba(211, 84, 0, 0.3)"; }
        else { word.color = "rgba(108, 52, 131, 0.3)"; }
    });

    // First: Validate existing positions - check if words still exist at their positions
    // Words without valid position are considered corrected and will be removed
    this.misspelledWords = this.misspelledWords.filter(word => {
        // If word has no position/range, it's a new word from API - keep it for now
        if (!word.position || !word.range) {
            return true; // Keep it - will be handled by new search below
        }

        try {
            // Check if range is still valid and contains the wrong word
            const rangeText = word.range.toString();
            
            // If word doesn't match, it was corrected - remove it
            if (rangeText !== word.wrongWord) {
                return false; // Remove corrected word
            }
            
            // Word still matches - update position in case DOM changed (e.g. scrolling)
            const rects = word.range.getClientRects();
            if (rects.length > 0) {
                const rect = rects[0];
                word.position = {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                };
                return true; // Keep it
            } else {
                // Range has no visual representation - consider corrected
                return false; // Remove it
            }
        } catch (e) {
            // Range is invalid (DOM changed) - consider corrected
            return false; // Remove it
        }
    });

    // Find word positions using regex search across all nodes (only for words without position)
    const wordsNeedingPosition = this.misspelledWords.filter(word => !word.position);
    
    if (wordsNeedingPosition.length > 0) {
        const nodeIterator = document.createNodeIterator(this.textContainer, NodeFilter.SHOW_TEXT);
        let textNode;
        let textOffset = 0;
        const allPossibleMatches = new Map();

        // Collect all matches for words
        while ((textNode = nodeIterator.nextNode())) {
            const text = textNode.nodeValue;
            const nodeStartOffset = textOffset;
            const nodeEndOffset = textOffset + text.length;

            wordsNeedingPosition.forEach(word => {
                // Create regex pattern with word boundaries
                const escapedWord = word.wrongWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = word.wrongWord.trim() === '' ? '\\s\\s+' : `\\b${escapedWord}\\b`;
                const regex = new RegExp(pattern, 'g');

                let match;
                regex.lastIndex = 0;
                while ((match = regex.exec(text)) !== null) {
                    const matchOffset = nodeStartOffset + match.index;
                    const distance = Math.abs(matchOffset - word.offset);
                    
                    if (!allPossibleMatches.has(word)) {
                        allPossibleMatches.set(word, []);
                    }
                    allPossibleMatches.get(word).push({
                        textNode,
                        match,
                        matchOffset,
                        distance,
                        offsetInNode: match.index
                    });
                }
            });

            textOffset = nodeEndOffset;
        }

        // Assign positions: for each word, find the match closest to its offset
        allPossibleMatches.forEach((matches, word) => {
            // Sort matches by distance to target offset
            matches.sort((a, b) => a.distance - b.distance);

            // Try each match, starting with the closest
            for (const { textNode: matchNode, match, matchOffset, distance, offsetInNode } of matches) {
                // Create range
                const range = document.createRange();
                range.setStart(matchNode, offsetInNode);
                range.setEnd(matchNode, offsetInNode + match[0].length);
                const rects = range.getClientRects();
                
                if (rects.length === 0) continue;
                
                const firstRect = rects[0];
                
                // Check if position already used
                const positionAlreadyUsed = this.misspelledWords.some(w => 
                    w !== word && 
                    w.position && 
                    Math.abs(w.position.left - firstRect.left) < 1 &&
                    Math.abs(w.position.top - firstRect.top) < 1
                );

                if (positionAlreadyUsed) continue;
                
                // Check if another word is closer to this match
                const closerWord = this.misspelledWords.find(w => 
                    w !== word && 
                    !w.position &&
                    Math.abs(w.offset - matchOffset) < Math.abs(word.offset - matchOffset)
                );

                if (closerWord) continue;

                // Assign position
                if (rects.length > 0) {
                    const rect = rects[0];
                    word.position = {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                    };
                    word.range = range;
                }
                break;
            }
        });
        
        // Remove words that didn't get a position (they don't exist in the text anymore)
        this.misspelledWords = this.misspelledWords.filter(word => word.position !== null);
    }

}







// function LThighlightWordsOld() {
//     if (!this.textContainer ||  (!this.serverstatus.languagetool && !this.privateSpellcheck.activated)){
//         console.log(this.privateSpellcheck)
//         this.LTdisable(); 
//          return 
//     }

//     this.canvas.width = this.textContainer.offsetWidth;
//     this.canvas.height = this.textContainer.offsetHeight;
//     this.canvas.style.top = this.textContainer.offsetTop + 'px';
//     this.canvas.style.left = this.textContainer.offsetLeft + 'px';
//     this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Vorheriges Highlighting löschen
    
//      // Check if the 'position' attribute exists in the 'word' object - if not remove word object from misspelled array -  don't know if that's a good idea????
//     // this.misspelledWords = this.misspelledWords.filter(word => {
//     //     return word.hasOwnProperty('position') && word.position;
//     // });

//     this.misspelledWords.forEach(word => {
//         if (!word.position){return}  // student could delete word without requesting a new check so it's still in this.misspelled words but nothing to highlight anymore
//         let height = 3
//         let translate = word.position.height
//         if (this.currentLTword && this.currentLTword.position && word.position.top == this.currentLTword.position.top){ 
//             if (word === this.currentLTword) {
//                 height = word.position.height + 3;
//                 translate = -3;
//             }
//         }
//         const adjustedLeft = word.position.left - this.textContainer.offsetLeft + window.scrollX;
//         const adjustedTop = word.position.top - this.textContainer.offsetTop + window.scrollY;
//         this.ctx.fillStyle = word.color; // Farbe und Transparenz des Highlights
//         this.ctx.fillRect(adjustedLeft, adjustedTop+translate, word.position.width, height); // Angepasste Position und Größe
//     });
// }
    
function LThighlightWords() {
    if (!this.textContainer || (!this.serverstatus.examSections[this.serverstatus.activeSection].languagetool && !this.privateSpellcheck.activated)) {
        console.log(this.privateSpellcheck);
        this.LTdisable(); 
        return;
    }

    // Set canvas dimensions and position, adjusting for zoom
    this.canvas.width = this.textContainer.offsetWidth * this.zoom 
    this.canvas.height = this.textContainer.offsetHeight * this.zoom
    this.canvas.style.width = this.textContainer.offsetWidth * this.zoom + 'px';
    this.canvas.style.height = this.textContainer.offsetHeight * this.zoom + 'px';
    this.canvas.style.top = this.textContainer.offsetTop * this.zoom+ 'px';
    this.canvas.style.left = this.textContainer.offsetLeft * this.zoom+ 'px';

    // Clear the previous highlights
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Iterate over the misspelled words (only highlight those with positions)
    this.misspelledWords.forEach(word => {
        if (!word.position) return; // Skip if no position data available

        let height = 3* this.zoom;
        let translate = word.position.height;

        // Check if the current word is the selected LanguageTool word
        if (this.currentLTword && this.currentLTword.position && word.position.top === this.currentLTword.position.top) {
            if (word === this.currentLTword) {
                height = word.position.height + 3* this.zoom;
                translate = 0;
            }
        }

        // Adjust for zoom, scrolling, and container offset
        const adjustedLeft = (word.position.left - this.textContainer.offsetLeft* this.zoom + window.scrollX) 
        const adjustedTop = (word.position.top - this.textContainer.offsetTop* this.zoom + window.scrollY) 
        const adjustedWidth = word.position.width 
        const adjustedHeight = height 

        // Set highlight color and draw the rectangle
        this.ctx.fillStyle = word.color;
        this.ctx.fillRect(adjustedLeft, adjustedTop + translate, adjustedWidth, adjustedHeight);
    });
}



export { LTcheckAllWords, LTfindWordPositions, LThighlightWords, LTdisable, LThandleMisspelled, LTignoreWord, LTresetIgnorelist}