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

// /**
// NodeHun Custom Spellchecker Styles 
// */
// #suggestion-menu{
//     z-index:100000;
//     padding: 4px;
//     background-color: #f3f8fd;
//     border: 1px solid #d3e5ff;
//     cursor: pointer;
//     border-radius: 4px;
//     box-shadow: 0px 0px 10px #00000047;
// }
// #suggestion-menu div {
//     font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
//     font-size: 0.8em;
//     padding: 2px 6px 2px 6px;
//     transition:0.2s;
//     border-radius:4px;
    
// }
// #suggestion-menu div:hover {
//     box-shadow: 0px 0px 10px inset #bacbe4;
// }

// span.NXTEhighlight {
//     position: relative;
// }
// /* Create the glowing underline */
// span.NXTEhighlight::after {
//     content: "";
//     position: absolute;
//     left: 0;
//     bottom: 0;
//     width: 100%;
//     height: 1px;
//     background: lightcoral; /* Light red color */
//     box-shadow: 0 0 5px lightcoral;
// }
// .menu-separator {
//     border-top: 1px solid #ccc;
//     margin: 5px 0;
// }



class SpellChecker {
    constructor () {
      this.currentRange = 0
      this.word = ""
    }

    async checkAllWords(){
        const numberOfWords = this.editor.storage.characterCount.words()
        let text = ""
        if (numberOfWords > 3000) {  // 
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let currentNode = range.startContainer;

                // Traverse up the DOM tree to find the surrounding <p> element
                while (currentNode && currentNode.nodeName !== 'P') {
                    currentNode = currentNode.parentNode;
                }
                if (currentNode && currentNode.nodeName === 'P') {
                    text = currentNode.textContent;
                   // console.log(`Surrounding <p> text: ${text}`);
                } 
                else {
                    text = this.editor.getText();  // Fall back to fetching all text
                }
            }
        }
        else {
            text = this.editor.getText()
        }
       
        const response = ipcRenderer.sendSync('checktext', text);
        const misspelledWords = response.misspelledWords;
  
        if (!misspelledWords.length) {  // no misspelled words .. make sure to remove all markers
                this.removeAllHighlightsByClass()
                return;
        }
        this.highlightMisspelledWords(misspelledWords)
    }


    async checkSelectedWords() {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const div = document.createElement('div');
        div.appendChild(fragment);
        const selectedText = div.textContent || div.innerText;
        // Send to backend if text is selected
        if (selectedText) {
            let response = ipcRenderer.sendSync('checktext', selectedText);
            const misspelledWords = response.misspelledWords;
            if (!misspelledWords.length) {  // no misspelled words .. make sure to remove all markers 
                this.removeAllHighlightsByClass()
                return;
            }
            this.highlightMisspelledWords(misspelledWords)
        }
    }
    
    async highlightMisspelledWords(misspelledWords) {
        // get current editor content
        let html = this.editor.getHTML()  
        // Remove all previous highlights
        html = this.removeElementsByClassFromString(html, ".NXTEhighlight")
        misspelledWords.forEach(word => {
            const regex = new RegExp(`(?<=^|[^a-zA-ZäöüÄÖÜßéèêëôûüÔÛÜáíóúñÁÍÓÚÑàèéìòùÀÈÉÌÒÙçÇ])${word}(?=$|[^a-zA-ZäöüÄÖÜßéèêëôûüÔÛÜáíóúñÁÍÓÚÑàèéìòùÀÈÉÌÒÙçÇ])`, 'g');
    
            let insideTag = false;
            html = html.replace(regex, (match, offset, fullString) => {
                const prefix = fullString.lastIndexOf('<', offset);
                const suffix = fullString.indexOf('>', offset);
                // Check if we're inside an HTML tag (some real words are also html tags - we need to capture that edge case)
                for(let i = offset; i >= 0; i--){
                    if (fullString[i] === '<') { insideTag = true;  break;  }
                    if (fullString[i] === '>') { insideTag = false; break;  }
                }
                // If inside a tag this is not a word we need to correct or highlight, skip this match
                if (insideTag) return match;
                //  If within a tag with an id that starts with NXTEhighlight... skip
                if (prefix > -1 && suffix > -1 && prefix < suffix) {
                    const tagContent = fullString.substring(prefix + 1, suffix);
                    // Check if 'span' and 'id=NXTEhighlight' appear within the same opening tag
                    if (/^span[^>]*id=['"]NXTEhighlight-/.test(tagContent)) { return match; }   //this is already highlighted - return match only without additional span elements
                }
                return `<span class='NXTEhighlight' id='NXTEhighlight-${this.uuidv4()}'>${match}</span>`;
            });
        });
        const editorMainContainer = document.getElementById("editormaincontainer");
        const scrollTop = editorMainContainer.scrollTop;
        this.editor.commands.clearContent(true)  //clear edtior
        this.editor.commands.insertContent(html)  // set editor content - with our span elements that highlight errors  (we use insertContent instead of setContent because setContent removes spaces)
        editorMainContainer.scrollTop = scrollTop;
    }
    
    getWord(event) {
        event.preventDefault(); // Prevent default context menu
        const tmpRange = document.caretRangeFromPoint(event.clientX, event.clientY);  // Temporary range for getting caret position
        const offset = tmpRange.startOffset;
        const textNode = tmpRange.startContainer;

        const nodeText = textNode.textContent || "";
        // Regex to match word characters and adjacent punctuation
   
        const wordWithPunctRegex = /[a-zA-ZäöüÄÖÜßéèêëôûüÔÛÜáíóúñÁÍÓÚÑàèéìòùÀÈÉÌÒÙçÇ]+[\.,;!?]?$/;

        // Extract the word surrounding the caret position with punctuation
        const leftTextMatch = nodeText.slice(0, offset).match(wordWithPunctRegex);
        const leftText = leftTextMatch ? leftTextMatch[0] : "";
        const rightText = nodeText.slice(offset).split(/\s|[\.,;!?]/)[0];
        this.word = leftText + rightText;

        // Update the currentRange to include adjacent punctuation
        const startOffset = Math.max(offset - leftText.length, 0);
        const endOffset = Math.min(offset + rightText.length, nodeText.length);
    
        this.currentRange = document.createRange();
        this.currentRange.setStart(textNode, startOffset);
        this.currentRange.setEnd(textNode, endOffset);
        
        if (this.word) {
            let response = ipcRenderer.sendSync('checkword', this.word);
            if (response.suggestions === null) {
                console.log(`no suggestions for >>${this.word}<<`);
                this.hideSpellcheckMenu()
                return;
            }
            this.showSuggestions(event.clientX, event.clientY, response.suggestions, this.word);
            console.log(response);
        }
    }
    
    
 
    
     // Function to display suggestions
     showSuggestions(x, y, suggestions, targetWord) {
        const menu = document.getElementById("suggestion-menu");
        menu.style.display = "block";
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        // Clear existing menu items
        menu.innerHTML = '';
        // Populate new suggestions
        suggestions.forEach(suggestion => {
            const item = document.createElement("div");
            item.innerHTML = suggestion;
            item.onclick = () => { 
                // Do something with the clicked suggestion
                console.log(`Clicked suggestion: ${suggestion}`);
                this.replaceWord(suggestion);
                menu.style.display = "none"; // Hide menu after selection
            };
            menu.appendChild(item);
        });
        // Create separator
        const separator = document.createElement("div");
        separator.className = "menu-separator";
        menu.appendChild(separator);
        // Create AddWord 
        const addItem = document.createElement("div");
        addItem.innerHTML = "Wort hinzufügen";
        addItem.onclick = () => {
            console.log("adding word to dictionary:", targetWord)
            ipcRenderer.send('add-word-to-dictionary', targetWord); // Sending word to the main process
            menu.style.display = "none"; // Hide menu
            this.checkAllWords()
        };
        menu.appendChild(addItem);
    }
    
    
    replaceWord(suggestion) {
        if (this.currentRange) {
            const { startContainer, startOffset, endOffset } = this.currentRange;
            // Extract word boundaries using regex to consider special characters
            const regex = /(?<=^|\W)[a-zA-ZäöüÄÖÜßéèêëôûüÔÛÜáíóúñÁÍÓÚÑàèéìòùÀÈÉÌÒÙçÇ]+(?=\W|$)/g;
    
            let match;
            let startWordOffset = 0, endWordOffset = 0;
    
            while (match = regex.exec(startContainer.textContent)) {
                if (startOffset <= match.index + match[0].length && endOffset >= match.index) {
                    startWordOffset = match.index;
                    endWordOffset = match.index + match[0].length;
                    break;
                }
            }
            // Replace the word
            const beforeWord = startContainer.textContent.substring(0, startWordOffset);
            const afterWord = startContainer.textContent.substring(endWordOffset);
            startContainer.textContent = beforeWord + suggestion + afterWord;
            // Update the range to select the newly inserted word
            this.currentRange.setStart(startContainer, startWordOffset);
            this.currentRange.setEnd(startContainer, startWordOffset + suggestion.length);
            // Try to locate the highlight span by its unique ID
            const wordRange = document.createRange();
            wordRange.setStart(this.currentRange.startContainer, this.currentRange.startOffset);
            wordRange.setEnd(this.currentRange.startContainer, this.currentRange.endOffset);
            const spanId = this.getSpanIdFromRange(wordRange);
            if (spanId) {
                this.removeHighlight(spanId);
            }
        }
    }
    
    
    getSpanIdFromRange(range) {
        let node = range.startContainer;
        while (node && node.nodeType !== 1) { node = node.parentNode; }
        if (node && node.id && node.id.startsWith("NXTEhighlight-")) { return node.id;  }
        return null;
    }
    
    removeHighlight(id) {
        const span = document.getElementById(id);
        if (span) {
            const parent = span.parentNode;
            while (span.firstChild) { parent.insertBefore(span.firstChild, span);  }
            parent.removeChild(span);
        }
    }
    
    removeAllHighlightsByClass() {
        const editor = document.getElementById("editorcontent");
        const elements = editor.querySelectorAll('.NXTEhighlight');
        elements.forEach(element => {
            const parent = element.parentNode;
            while (element.firstChild) { parent.insertBefore(element.firstChild, element); }
            parent.removeChild(element);
        });
    }
    
    
    removeElementsByClassFromString(html, classname) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const editor = doc.body;
        const elements = editor.querySelectorAll(classname);
        elements.forEach(element => {
            const parent = element.parentNode;
            while (element.firstChild) { parent.insertBefore(element.firstChild, element);  }
            parent.removeChild(element);
        });
        return editor.innerHTML;
    }
    
    // hides the spellcheck context menu
    hideSpellcheckMenu(){
        const menu = document.getElementById("suggestion-menu");
        menu.style.display = "none";
    }
    
    async checkAllWordsOnSpacebar(event){
        if (event.data === " " || event.data === "\u00A0") { // if spacebar is hit
            try {
                const selection = window.getSelection();  // Get current selection and range
                if (selection.rangeCount == 0) { return; } 
                const range = selection.getRangeAt(0);
                const startNode = range.startContainer; // Start-Knoten des Ranges ermitteln
                // Überprüfen, ob der Start-Knoten oder ein Vorfahre ein <code>-Element ist // do not check inside of a code element
                if (startNode.closest && startNode.closest('code')) { return; } 
                else if (startNode.parentNode.closest('code')) { return; }

                const marker = document.createElement('span'); // Insert marker element at cursor position
                marker.id = 'NXTEmarker';
                range.insertNode(marker);
                await new Promise(resolve => setTimeout(resolve, 0)); // wait for next tick so the node is already inserted when we check html/text for spellingmistakes
                await this.checkAllWords();  //recheck the whole text  // this funtion removes all spaces.. why?
                const newMarker = document.getElementById('NXTEmarker');
                const newRange = document.createRange(); // Create a new range object
                newRange.setStartAfter(newMarker); // Set the start and end positions to the end of the marker span
                newRange.setEndAfter(newMarker);
                newMarker.remove();// Remove the marker span
                selection.removeAllRanges(); // Remove all ranges from the selection object
                selection.addRange(newRange); // Add the new range to the selection object
            } catch (e) { console.log(e)}
        }
    }
}






export default new SpellChecker()