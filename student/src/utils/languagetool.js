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

import {SignalBridge} from './signalBridge.js'

// signalBridge centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);



function LTdisable(){
    if (!this.LTactive){ return}
    this.LTactive = false

    this.canvas = document.getElementById('highlight-layer');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // clear previous highlighting
   
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
        this.LTinfo = this.$t('editor.ltNoErrors')
        this.spellcheckFallback = false
        return; 
    }

    //request LanguageTool API
    this.LTinfo = this.$t('editor.ltSearching')

    try {
        const ltStatus = await signalBridge.invoke('isLanguageToolRunning', {
            host: this.LThost,
            port: this.LTport ?? '8088',
        })
        if (!ltStatus?.running) {
            this.LTinfo = this.$t('editor.ltUnreachable')
            console.warn('languagetool.js @ LTcheckAllwords (status check): LT server is not reachable')
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
        this.LTinfo = this.$t('editor.ltUnreachable')
        this.spellcheckFallback = true
        this.ltRunning = false
        this.misspelledWords = []
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        }
        return
    }
    

    try {

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        };
        // Optional custom headers for logging/proxy; only set when available (editor context)
        if (this.servername != null) headers['X-Exam-Name'] = String(this.servername);
        if (this.clientname != null) headers['X-Student-Name'] = String(this.clientname);
        if (this.pincode != null && this.pincode !== '') headers['X-Exam-Pin'] = String(this.pincode);

        const response = await fetch(`${this.LThost}:${this.LTport ?? '8088'}/v2/check`, {
            method: 'POST',
            headers,
            body: new URLSearchParams({
                text: this.text,
                language: this.ltLanguage || this.getEditorExamConfig?.(this.lockedSection)?.spellchecklang || 'de-DE'
            }).toString()
        });


        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);   }
        const data = await response.json();      
        this.spellcheckFallback = false
  
        this.LThandleMisspelled(data.matches)   //prepares the list - removes duplicates
        if (!this.misspelledWords.length) {
            this.LTinfo = this.$t('editor.ltNoErrors')
            return;
        }
            


    } catch (error) {
        console.warn('languagetool.js @ LTcheckAllwords (catch):', error.message)  
        this.LTinfo = this.$t('editor.ltUnreachable')
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
        this.LTinfo = this.$t('editor.ltNoErrors')
        return [];
    }

    // Get current text to track offset positions
    const textForValidation = this.text; // Text that was used for API call
    const currentEditorText = this.editor.getText();

    // Set colors based on issue type (LanguageTool API: typographical, whitespace, misspelling, grammar, style, punctuation, semantics, redundancy, etc.)
    this.misspelledWords.forEach(word => {
        const t = word.rule?.issueType ?? '';
        const onlySpaces = word.wrongWord && word.wrongWord.trim() === '';

        // Alle reinen Leerzeichenfehler (egal ob whitespace oder typographical) gleich behandeln
        if (t === 'whitespace' || (t === 'typographical' && onlySpaces)) {
            word.color = 'rgba(243, 190, 41, 0.5)'; // gelb
            word.whitespace = true;
        }
        else if (t === 'typographical') {
            word.color = 'rgba(146, 43, 33, 0.3)'; // reddish, real typographic errors
        }
        else if (t === 'misspelling') { word.color = 'rgba(211, 84, 0, 0.3)'; }
        else if (t === 'grammar') { word.color = 'rgba(26, 115, 232, 0.35)'; }
        else if (t === 'style') { word.color = 'rgba(0, 128, 128, 0.35)'; }
        else if (t === 'punctuation') { word.color = 'rgba(136, 84, 208, 0.35)'; }
        else if (t === 'semantics') { word.color = 'rgba(180, 80, 180, 0.35)'; }
        else if (t === 'redundancy') { word.color = 'rgba(200, 100, 50, 0.35)'; }
        else { word.color = 'rgba(108, 52, 131, 0.3)'; }
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
            
            // If word doesn't match, it was corrected - remove it.
            // Exception: zero-length words (insertion points) have no text to compare —
            // their range anchors on the neighbouring char, so rangeText never equals "".
            if (word.length > 0 && rangeText !== word.wrongWord) {
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
                // Create regex pattern with safe word boundaries
                const escapedWord = word.wrongWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let pattern;

                // reine Leerzeichen (z.B. doppelte Spaces)
                if (word.wrongWord.trim() === '') {
                    pattern = '\\s\\s+';
                } else {
                    const firstChar = word.wrongWord[0] || '';
                    const lastChar = word.wrongWord[word.wrongWord.length - 1] || '';
                    const startsWithWordChar = /\w/.test(firstChar);
                    const endsWithWordChar = /\w/.test(lastChar);

                    if (startsWithWordChar || endsWithWordChar) {
                        // “regular” words → use word boundaries
                        pattern = `\\b${escapedWord}\\b`;
                    } else {
                        // e.g. “ ,” → no word boundaries, just the sequence
                        pattern = escapedWord;
                    }
                }

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

                // Assign position
                word.position = {
                    left: firstRect.left,
                    top: firstRect.top,
                    width: firstRect.width,
                    height: firstRect.height,
                };
                word.range = range;
                break;
            }
        });
        
        // Remove words that didn't get a position (they don't exist in the text anymore)
        this.misspelledWords = this.misspelledWords.filter(word => word.position !== null);
    }

    // Offset-map fallback: handles zero-length (missing punctuation/char), single spaces,
    // and any word the regex approach failed to locate.
    const remainingWords = this.misspelledWords.filter(word => !word.position)
    if (remainingWords.length > 0) {
        const offsetMap = this.LTbuildOffsetMap()
        remainingWords.forEach(word => {
            this.LTfindByOffsetMap(word, offsetMap)
            // Extract position from range (same way as the regex branch above)
            if (word.range && !word.position) {
                const rects = word.range.getClientRects()
                if (rects.length) {
                    word.position = { left: rects[0].left, top: rects[0].top, width: rects[0].width, height: rects[0].height }
                }
            }
        })
    }

}







// Builds a flat array indexed by editor.getText() offset.
// Entry is { pmPos } for real text chars, null for '\n' block/hardbreak separators.
// Uses doc.nodesBetween() which mirrors ProseMirror's getTextBetween exactly —
// robust to tables, images, nested structures, and any TipTap extension.
function LTbuildOffsetMap() {
    const doc = this.editor.state.doc
    const map = []
    let separated = true   // mirrors the 'separated' flag in ProseMirror's getTextBetween

    doc.nodesBetween(0, doc.content.size, (node, pos) => {
        if (node.isText) {
            for (let i = 0; i < node.text.length; i++) {
                map.push({ pmPos: pos + i })
            }
            separated = false
        } else if (node.type.name === 'hardBreak') {
            // HardBreak contributes '\n' to editor.getText()
            map.push(null)
            separated = false
        } else if (!separated && node.isBlock) {
            // Any block boundary → the '\n' blockSeparator in editor.getText()
            map.push(null)
            separated = true
        }
        // Non-text inline leaves (images etc.) contribute nothing → no map entry
    })

    return map
}


// Offset-map–based position search using ProseMirror's view.domAtPos().
// Handles: length=0 (missing char), whitespace, and anything the regex missed.
function LTfindByOffsetMap(word, offsetMap) {
    const view = this.editor.view

    // Convert a pair of consecutive PM positions to a DOM Range.
    const rangeForPm = (pmStart, pmEnd) => {
        try {
            const s = view.domAtPos(pmStart)
            const e = view.domAtPos(pmEnd)
            const r = document.createRange()
            r.setStart(s.node, s.offset)
            r.setEnd(e.node, e.offset)
            return r.getClientRects().length ? r : null
        } catch (_) { return null }
    }

    if (word.length === 0) {
        // Insertion: anchor on the last real char before the offset,
        // walking backwards over any null (= \n) entries.
        let refIdx = word.offset - 1
        while (refIdx >= 0 && !offsetMap[refIdx]) refIdx--
        if (refIdx < 0) return
        const entry = offsetMap[refIdx]
        const range = rangeForPm(entry.pmPos, entry.pmPos + 1)
        if (!range) return
        word.range = range
        word.isInsertion = true   // → drawn as a vertical bar at the insertion point

    } else {
        // Whitespace / not-found word: map start and end via PM positions.
        const startEntry = offsetMap[word.offset]
        if (!startEntry) return
        let endIdx = word.offset + word.length - 1
        while (endIdx > word.offset && !offsetMap[endIdx]) endIdx--
        const endEntry = offsetMap[endIdx]
        if (!endEntry) return
        const range = rangeForPm(startEntry.pmPos, endEntry.pmPos + 1)
        if (!range) return
        word.range = range
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
//     this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // clear previous highlighting
    
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
//         this.ctx.fillStyle = word.color; // color and transparency of the highlight
//         this.ctx.fillRect(adjustedLeft, adjustedTop+translate, word.position.width, height); // adjusted position and size
//     });
// }
    
function LThighlightWords() {
    const editorCfg = this.getEditorExamConfig?.(this.lockedSection) || null
    const ltEnabled = !!editorCfg?.languagetool
    if (!this.textContainer || (!ltEnabled && !this.privateSpellcheck.activated)) {
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
        if (word.isInsertion) {
            // Missing character: draw a thin vertical bar at the insertion point
            // (right edge of the reference character = where the char should be inserted)
            const xPos = adjustedLeft + adjustedWidth
            this.ctx.fillStyle = word.color
            this.ctx.fillRect(xPos - this.zoom, adjustedTop, 2 * this.zoom, word.position.height)
            if (word === this.currentLTword) {
                this.ctx.globalAlpha = 0.2
                this.ctx.fillRect(xPos - 10 * this.zoom, adjustedTop, 20 * this.zoom, word.position.height)
                this.ctx.globalAlpha = 1
            }
        } else {
            this.ctx.fillStyle = word.color;
            this.ctx.fillRect(adjustedLeft, adjustedTop + translate, adjustedWidth, adjustedHeight);
        }
    });
}



// Lightweight redraw for scroll: only refreshes viewport coords from existing ranges, no regex search.
// Must be called inside a requestAnimationFrame callback for best sync with the browser paint cycle.
function LTredrawHighlights() {
    if (!this.LTactive || !this.textContainer || !this.misspelledWords?.length) return;

    this.misspelledWords.forEach(word => {
        if (!word.range) return;
        try {
            const rects = word.range.getClientRects();
            if (rects.length > 0) {
                const r = rects[0];
                word.position = { left: r.left, top: r.top, width: r.width, height: r.height };
            }
        } catch (e) { /* stale range – will be cleaned up on next full LT check */ }
    });

    this.LThighlightWords();
}

export { LTcheckAllWords, LTfindWordPositions, LThighlightWords, LTredrawHighlights, LTdisable, LThandleMisspelled, LTignoreWord, LTresetIgnorelist, LTbuildOffsetMap, LTfindByOffsetMap }
