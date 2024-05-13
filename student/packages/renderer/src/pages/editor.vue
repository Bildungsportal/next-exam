 <template>


    <!-- HEADER START -->
    <exam-header
      :online="online"
      :clientname="clientname"
      :exammode="exammode"
      :servername="servername"
      :pincode="pincode"
      :battery="battery"
      :currenttime="currenttime"
      :timesinceentry="timesinceentry"
      :componentName="componentName"
      @reconnect="reconnect"
      @gracefullyexit="gracefullyexit"
    ></exam-header>
     <!-- HEADER END -->


    <div id="suggestion-menu" style="display:none; position:fixed;"></div>

    <div class="w-100 p-0 m-0 text-white shadow-sm text-center" style=" top: 66px; z-index: 10001 !important; background-color: white;">
        
        <!-- toolbar start -->
        <div v-if="editor" class="m-2" id="editortoolbar" style="text-align:left;"> 
            <button :title="$t('editor.backup')" @click="saveContent(true, 'manual');" class="invisible-button btn btn-outline-success p-1 me-1 mb-1 btn-sm"><img src="/src/assets/img/svg/document-save.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.print')" @click="print();" class="invisible-button btn btn-outline-success p-1 me-1 mb-1 btn-sm"><img src="/src/assets/img/svg/print.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.undo')" @click="editor.chain().focus().undo().run()" class="invisible-button btn btn-outline-warning p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-undo.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.redo')" @click="editor.chain().focus().redo().run()" class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-redo.svg" class="white" width="22" height="22" > </button>
            <button :title="$t('editor.clear')" @click="editor.chain().focus().clearNodes().run();editor.chain().focus().unsetColor().run()" class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/draw-eraser.svg" class="white" width="22" height="22" ></button>

            <button :title="$t('editor.bold')" @click="editor.chain().focus().toggleBold().run()" :class="{ 'is-active': editor.isActive('bold') }" class="invisible-button btn btn-outline-success p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/format-text-bold.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.italic')" @click="editor.chain().focus().toggleItalic().run()" :class="{ 'is-active': editor.isActive('italic') }" class="invisible-button btn btn-outline-success p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/format-text-italic.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.underline')" @click="editor.chain().focus().toggleUnderline().run()" :class="{ 'is-active': editor.isActive('underline') }" class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm "> <img src="/src/assets/img/svg/format-text-underline.svg" class="white" width="22" height="22" ></button>
            
            <button :title="$t('editor.heading2')" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/h2.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading3')" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/h3.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading4')" @click="editor.chain().focus().toggleHeading({ level: 4 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 4 }) }" class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/h4.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading5')" @click="editor.chain().focus().toggleHeading({ level: 5 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 5 }) }" class="invisible-button btn btn-outline-secondary p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/h5.svg" width="22" height="22"></button>
            <button :title="$t('editor.subscript')" @click="editor.chain().focus().toggleSubscript().run()" :class="{ 'is-active': editor.isActive('subscript') }" class="invisible-button btn btn-outline-success p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/format-text-subscript.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.superscript')" @click="editor.chain().focus().toggleSuperscript().run()" :class="{ 'is-active': editor.isActive('superscript') }" class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/format-text-superscript.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.bulletlist')" @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'is-active': editor.isActive('bulletList') }" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/format-list-unordered.svg" class="white" width="22" height="22" > </button>
            <button :title="$t('editor.list')" @click="editor.chain().focus().toggleOrderedList().run()" :class="{ 'is-active': editor.isActive('orderedList') }" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/format-list-ordered.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.codeblock')" @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ 'is-active': editor.isActive('codeBlock') }" class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/dialog-xml-editor.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.code')" @click="editor.chain().focus().toggleCode().run()" :class="{ 'is-active': editor.isActive('code') }" class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1  btn-sm"><img src="/src/assets/img/svg/code-context.svg" class="white" width="22" height="22" > </button>
            <button :title="$t('editor.blockquote')" @click="editor.chain().focus().toggleBlockquote().run()" :class="{ 'is-active': editor.isActive('blockquote') }" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"> <img src="/src/assets/img/svg/format-text-blockquote.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.line')" @click="editor.chain().focus().setHorizontalRule().run()" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/newline.svg" class="white" width="22" height="22" ></button>

            <button :title="$t('editor.left')" @click="editor.chain().focus().setTextAlign('left').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }" class="invisible-button btn btn-outline-info  p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/format-justify-left.svg" class="white" width="22" height="22" ></button> 
            <button :title="$t('editor.center')" @click="editor.chain().focus().setTextAlign('center').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm "><img src="/src/assets/img/svg/format-justify-center.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.right')" @click="editor.chain().focus().setTextAlign('right').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/format-justify-right.svg" class="white" width="22" height="22" ></button>
            <input :title="$t('editor.textcolor')" type="color" @input="editor.chain().focus().setColor($event.target.value).run()" :value="getHexColor || '#000000'" class="invisible-button btn btn-outline-info p-2 me-2 mb-1 btn-sm" style="height: 33.25px; width:32px">
            <button :title="$t('editor.linebreak')"  @click="editor.chain().focus().setHardBreak().run()" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/key-enter.svg" class="white" width="22" height="22" ></button>
            <button :title="$t('editor.copy')"  @click="copySelection()" class="invisible-button btn btn-outline-success p-1 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-copy.svg" class="" width="22" height="22" ></button>
            <button :title="$t('editor.paste')"  @click="pasteSelection()" class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-paste-style.svg" class="" width="22" height="22" ></button>
           
            <button :title="$t('editor.specialchar')"  @click="showInsertSpecial()" class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/sign.svg" class="" width="22" height="22" ></button>


            <button v-if="(serverstatus.spellcheck || allowspellcheck) && spellcheck"  :title="$t('editor.spellcheckdeactivate')"  @click="deactivateSpellcheck()" class="invisible-button btn btn-outline-danger p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/autocorrection.svg" class="" width="22" height="22" ></button>
            <button v-if="(serverstatus.spellcheck || allowspellcheck) && !spellcheck" :title="$t('editor.spellcheck')"  @click="activateSpellcheck()" class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/autocorrection.svg" class="" width="22" height="22" ></button>

            <button :title="$t('editor.more')" id="more" @click="showMore()" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/view-more-horizontal-symbolic.svg" class="white" width="22" height="22" ></button>
            <div id="moreoptions" style="display:none;">
                <button :title="$t('editor.inserttable')" @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/insert-table.svg" width="22" height="22" ></button>
                <button :title="$t('editor.deletetable')" @click="editor.chain().focus().deleteTable().run()" :disabled="!editor.can().deleteTable()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/deletecell.svg" width="22" height="22" ></button>
                <button :title="$t('editor.columnafter')" @click="editor.chain().focus().addColumnAfter().run()" :disabled="!editor.can().addColumnAfter()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-table-insert-column-right.svg" width="22" height="22" ></button>
                <button :title="$t('editor.rowafter')" @click="editor.chain().focus().addRowAfter().run()" :disabled="!editor.can().addRowAfter()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-table-insert-row-below.svg" width="22" height="22" ></button>
                <button :title="$t('editor.delcolumn')" @click="editor.chain().focus().deleteColumn().run()" :disabled="!editor.can().deleteColumn()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-table-delete-column.svg" width="22" height="22" ></button>
                <button :title="$t('editor.delrow')" @click="editor.chain().focus().deleteRow().run()" :disabled="!editor.can().deleteRow()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-table-delete-row.svg" width="22" height="22" ></button>
                <button :title="$t('editor.mergeorsplit')" @click="editor.chain().focus().mergeOrSplit().run()" :disabled="!editor.can().mergeOrSplit()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-table-cell-merge.svg" width="22" height="22" ></button>
                <button :title="$t('editor.headercolumn')" @click="editor.chain().focus().toggleHeaderColumn().run()" :disabled="!editor.can().toggleHeaderColumn()" class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/table-header-left.svg" width="22" height="22" ></button>
                <button :title="$t('editor.headerrow')" @click="editor.chain().focus().toggleHeaderRow().run()" :disabled="!editor.can().toggleHeaderRow()" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/table-header-top.svg" width="22" height="22" ></button>
            </div>
           
            <div id="specialcharsdiv" style="display:none">
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('¿')" style="width:28px; ">¿</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ñ')" style="width:28px; ">ñ</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ç')" style="width:28px; ">ç</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('©')" style="width:28px; ">©</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('™')" style="width:28px; ">™</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('¡')" style="width:28px; ">¡</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('µ')" style="width:28px; ">µ</div>
            </div>


            <br>
           <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
                <div v-if="(file.type == 'bak')" class="btn btn-success p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.name; loadHTML(file.name)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}}     ({{ new Date(this.now - file.mod).toISOString().substr(11, 5) }})</div>
                <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'audio')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="playAudio(file.name)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
            </div>
        
        </div>
        <!-- toolbar end -->
    </div>

    <!-- angabe/pdf preview start -->
    <div id=preview class="fadeinfast p-4">
        <embed src="" id="pdfembed">
    </div>
    <!-- angabe/pdf preview end -->

    <!-- focus warning start -->
    <div v-if="!focus" class="focus-container">
        <div id="focuswarning" class="infodiv p-4 d-block focuswarning" >
            <div class="mb-3 row">
                <div class="mb-3 "> {{$t('editor.leftkiosk')}} <br> {{$t('editor.tellsomeone')}} </div>
                <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32" >
            </div>
        </div>
    </div>
    <!-- focuswarning end  -->





     <!-- AUDIO Player start -->
        <div id="aplayer">
            <audio id="audioPlayer" controls controlsList="nodownload">
                <source :src="audioSource" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <button  id="audioclose" type="button" class="btn-close" style="vertical-align: top;" title="close" ></button> 
        </div>
    <!-- AUDIO Player end -->


    <!-- EDITOR START -->
    <div id="editormaincontainer" style="position: relative; height: 100%; overflow-x:auto; overflow-y: scroll; background-color: #eeeefa;">
        <div id="editorcontainer" class="shadow" style="">
            <editor-content :editor="editor" class='p-0' id="editorcontent" style="background-color: #fff; border-radius:0;" />
        </div>

    </div>
    <div id="statusbar">
        <!-- Statischer Text mit v-once, um das Neurendern zu verhindern da $t offenbar jedesmal performance measures durchführt die zu memory bloat führen -->
            <span v-once>{{ $t("editor.words") }}:</span> <span>{{ wordcount }}</span> | <span v-once>{{ $t("editor.chars") }}:</span> <span>{{ charcount }}</span>  
            &nbsp;
            <span v-once> {{ $t("editor.selected") }}: </span> <span id="editselected"> {{ selectedWordCount }}/{{ selectedCharCount }}</span>
            <img @click="zoomin()" src="/src/assets/img/svg/zoom-in.svg" class="zoombutton">  
            <img @click="zoomout()" src="/src/assets/img/svg/zoom-out.svg" class="zoombutton">
        </div>
    <!-- EDITOR END -->
</template>

<script>
import { Editor, EditorContent, VueNodeViewRenderer } from '@tiptap/vue-3'
import TextAlign from '@tiptap/extension-text-align'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import CodeBlockComponent from '../components/CodeBlockComponent.vue'
import Blockquote from '@tiptap/extension-blockquote'
import BulletList from '@tiptap/extension-bullet-list'
import HardBreak from '@tiptap/extension-hard-break'
import ListItem from '@tiptap/extension-list-item'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Heading from '@tiptap/extension-heading' 
import OrderedList from '@tiptap/extension-ordered-list'
import Bold from '@tiptap/extension-bold'
import Code from '@tiptap/extension-code'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Dropcursor from '@tiptap/extension-dropcursor'
import Gapcursor from '@tiptap/extension-gapcursor'
import CharacterCount from  "@tiptap/extension-character-count"
import History from '@tiptap/extension-history'
import Typography from '@tiptap/extension-typography'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import { SmilieReplacer } from '../components/SmilieReplacer'
import { CharReplacer } from '../components/CharReplacer'
import { lowlight } from "lowlight/lib/common.js";
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import { Node, mergeAttributes } from '@tiptap/core'   //we need this for our custom editor extension that allows to insert span elements
import SpellChecker from '../utils/spellcheck'
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'



// in order to insert <span> elements (used for highlighting misspelled words) we need our own tiptap extenison
const CustomSpan = Node.create({
    name: 'customSpan',
    addOptions: { HTMLAttributes: {},    },
    inline: true,
    group: 'inline',
    atom: false,
    content: 'inline*',
    addAttributes() {
        return {
        id: {
            default: null,
            parseHTML: element => ( element.getAttribute('id')),
            renderHTML: attributes => ({  id: attributes.id }),
        },
        class: {
            default: null,
            parseHTML: element => ( element.getAttribute('class')),
            renderHTML: attributes => ({ class: attributes.class }),
        },
        }
    },
    parseHTML() { return [ { tag: 'span', }, ] },
    renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0] },
})



export default {
    components: {
        EditorContent,
        ExamHeader
    },
    data() {
        return {
            componentName: 'Writer',
            online: true,
            focus: true,
            exammode: false,
            selectedFile:null,
            currentFile:null,
            editor: null,
            saveinterval: null,
            fetchinfointerval: null,
            clockinterval: null,
            loadfilelistinterval: null,
            servername: this.$route.params.servername,
            servertoken: this.$route.params.servertoken,
            serverip: this.$route.params.serverip,
            token: this.$route.params.token,
            clientname: this.$route.params.clientname,
            localfiles: null,
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            config: this.$route.params.config,
            clientinfo: null,
            entrytime: 0,
            timesinceentry: 0,
            currenttime: 0,
            charcount : 0,
            wordcount : 0,
            now : 0,
            pincode : this.$route.params.pincode,
            zoom:1,
            battery: null,
            proseMirrorMargin: '30mm',
            editorWidth: '210mm',
            cmargin: this.$route.params.cmargin ? this.$route.params.cmargin : { side: 'right', size: 3 },
            selectedWordCount:0,
            selectedCharCount:0,
            currentRange:0,
            word:"",
            editorcontentcontainer:null,
            spellcheck: false,
            serverstatus: this.$route.params.serverstatus,
            linespacing: this.$route.params.serverstatus.linespacing ? this.$route.params.serverstatus.linespacing : '2',
            fontfamily:  this.$route.params.serverstatus.fontfamily  ? this.$route.params.serverstatus.fontfamily : "sans-serif", 
            allowspellcheck: false, // this is a per student override (for students with legasthenie)
            individualSpellcheckActivated: false,
            audioSource: null,
            currentpreview: null
        }
    },
    computed: {
        getHexColor() {
            const rgbColor = this.editor?.getAttributes('textStyle')?.color || '';
            return rgbColor.startsWith('rgb') ? this.rgbToHex(rgbColor) : rgbColor;
        },


    },


    methods: {
        checkAllWords:SpellChecker.checkAllWords,
        checkSelectedWords:SpellChecker.checkSelectedWords,  //just checks the selection for mistakes
        highlightMisspelledWords:SpellChecker.highlightMisspelledWords,
        getWord:SpellChecker.getWord,  // get rightklicked word and show suggestions
        showSuggestions:SpellChecker.showSuggestions,     // Function to display suggestions
        replaceWord:SpellChecker.replaceWord,  //replace misspelled word with suggestion - remove highlight
        getSpanIdFromRange:SpellChecker.getSpanIdFromRange,
        removeHighlight:SpellChecker.removeHighlight,
        removeAllHighlightsByClass:SpellChecker.removeAllHighlightsByClass, //searches fer the highlight class and removes every object
        removeElementsByClassFromString:SpellChecker.removeElementsByClassFromString,  // this removes html elements from a string that contains html elements
        hideSpellcheckMenu:SpellChecker.hideSpellcheckMenu, // hides the spellcheck context menu
        checkAllWordsOnSpacebar:SpellChecker.checkAllWordsOnSpacebar,  //does a complete spellcheck after hitting spacebar while writing
   
        async playAudio(file) {
       
            document.querySelector("#aplayer").style.display = 'block';

            try {
                const base64Data = await ipcRenderer.invoke('getfilesasync', file, true);
                if (base64Data) {
                    this.audioSource = `data:audio/mp3;base64,${base64Data}`;
                    audioPlayer.load(); // Lädt die neue Quelle
                    audioPlayer.play().then(() => { console.log('Playback started'); }).catch(e => { console.error('Playback failed:', e); });
                } else { console.error('Keine Daten empfangen'); }
            } catch (error) { console.error('Fehler beim Empfangen der MP3-Datei:', error); }
        },

        showInsertSpecial(){
            let specialCharsDiv = document.querySelector("#specialcharsdiv");
            let display = specialCharsDiv.style.display;
            if (display === "none") {   specialCharsDiv.style.display = 'inline-block';  }
            else { specialCharsDiv.style.display = 'none';  }
        },
  
        insertSpecialchar(character) {
            const sel = window.getSelection();
            // Check if the selection is within a contenteditable element
            const contentEditableParent = sel.anchorNode && sel.anchorNode.parentElement.closest('[contenteditable="true"]');
            if (sel.rangeCount && contentEditableParent) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(character);
                range.insertNode(textNode);

                // Move the caret after the inserted character
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                sel.removeAllRanges(); // Remove all ranges to clear the previous selection
                sel.addRange(range); // Add the new range to set the caret position
            }
         },




        insertSpaceInsteadOfTab(e){
            if (e.key === 'Tab') {
                e.preventDefault();
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                const tabNode = document.createTextNode("    ");
                range.insertNode(tabNode);
                // Cursorposition aktualisieren
                range.setStartAfter(tabNode);
                range.setEndAfter(tabNode);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        },
        rgbToHex(rgb) {
            const [r, g, b] = rgb.match(/\d+/g).map(Number);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        },


        clock(){
            // this.charcount = this.editor.storage.characterCount.characters()   //this also counts blank spaces
            this.charcount = this.editor.getText().replace(/<[^>]*>/g, '').replace(/\s/g, '').length

            this.wordcount = this.editor.storage.characterCount.words()
            this.now = new Date().getTime()
            this.timesinceentry =  new Date(this.now - this.entrytime).toISOString().substr(11, 8)
            this.currenttime = moment().tz('Europe/Vienna').format('HH:mm:ss');
        },
        async fetchInfo() {
            let getinfo = await ipcRenderer.invoke('getinfoasync')  // we need to fetch the updated version of the systemconfig from express api (server.js)
            this.clientinfo = getinfo.clientinfo;
            this.token = this.clientinfo.token
            this.focus = this.clientinfo.focus
            this.clientname = this.clientinfo.name
            this.exammode = this.clientinfo.exammode
            this.pincode = this.clientinfo.pin
            this.allowspellcheck = this.clientinfo.allowspellcheck
            this.serverstatus =  getinfo.serverstatus

            if (!this.focus){  this.entrytime = new Date().getTime()}
            if (this.clientinfo && this.clientinfo.token){  this.online = true  }
            else { this.online = false  }

            this.battery = await navigator.getBattery().then(battery => { return battery })
            .catch(error => { console.error("Error accessing the Battery API:", error);  });

            if (this.serverstatus.spellcheck === false) {  //handle individual spellcheck (only if not globally activated anyways)
                if (!this.individualSpellcheckActivated){ // nur wenn nicht eh schon aktiv
                    if (this.allowspellcheck) {  //this handles individual spellcheck (independend of global spellcheck)
                        let ipcResponse = await ipcRenderer.invoke('activatespellcheck', this.serverstatus.spellchecklang )  // this.allowspellcheck contains an object with spell config
                        if (ipcResponse == false) { this.allowspellcheck = false}  // something went wrong on the backend - do not show spellchecker button
                        if (ipcResponse == true) {this.individualSpellcheckActivated = true}  // setz auf aktiviert (wurde im backend aktiviert 1x reicht)
                    }
                }
                else {
                    if (!this.allowspellcheck) {
                        this.deactivateSpellcheck() 
                        this.individualSpellcheckActivated = false
                    }
                }
            }
        }, 
        reconnect(){
            this.$swal.fire({
                title: this.$t("editor.reconnect"),
                text:  this.$t("editor.info"),
                icon: 'info',
                input: 'number',
                inputLabel: "PIN",
                inputValue: this.pincode,
                inputValidator: (value) => {
                    if (!value) {return this.$t("student.nopin")}
                }
            }).then((input) => {
                this.pincode = input.value
                if (!input.value) {return}
                let IPCresponse = ipcRenderer.sendSync('register', {clientname:this.clientname, servername:this.servername, serverip: this.serverip, pin:this.pincode })
                console.log(IPCresponse)
                this.token = IPCresponse.token  // set token (used to determine server connection status)

                if (IPCresponse.status === "success") {
                        this.$swal.fire({
                            title: "OK",
                            text: this.$t("student.registeredinfo"),
                            icon: 'success',
                            showCancelButton: false,
                        })
                    }
                if (IPCresponse.status === "error") {
                    this.$swal.fire({
                        title: "Error",
                        text: IPCresponse.message,
                        icon: 'error',
                        showCancelButton: false,
                    })
                }
            })
        },
        // disable lock but keep examwindow
        gracefullyexit(){
            this.$swal.fire({
                title: this.$t("editor.exit"),
                text:  this.$t("editor.exitkiosk"),
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true
            })
            .then((result) => {
                if (result.isConfirmed) {
                    ipcRenderer.send('gracefullyexit')
                } 
            }); 
        },
        //get all files in user directory
        async loadFilelist(){
            let filelist = await ipcRenderer.invoke('getfilesasync', null)
            this.localfiles = filelist;
        },
        // get file from local workdirectory and replace editor content with it
        async loadHTML(file){
            this.$swal.fire({
                title: this.$t("editor.replace"),
                html:  `${this.$t("editor.replacecontent1")} <b>${file}</b> ${this.$t("editor.replacecontent2")}`,
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true
            })
            .then(async (result) => {
                if (result.isConfirmed) {
                    let data = await ipcRenderer.invoke('getfilesasync', file )
                    this.editor.commands.clearContent(true)
                    this.editor.commands.insertContent(data)  
                } 
            }); 
        },

        //checks if arraybuffer contains a valid pdf file
        isValidPdf(data) {
            const header = new Uint8Array(data, 0, 5); // Lese die ersten 5 Bytes für "%PDF-"
            // Umwandlung der Bytes in Hexadezimalwerte für den Vergleich
            const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
            for (let i = 0; i < pdfHeader.length; i++) {
                if (header[i] !== pdfHeader[i]) {
                    return false; // Früher Abbruch, wenn ein Byte nicht übereinstimmt
                }
            }
            return true; // Alle Bytes stimmen mit dem PDF-Header überein
        },

        // fetch file from disc - show preview
        async loadPDF(file){
            URL.revokeObjectURL(this.currentpreview);
            let data = await ipcRenderer.invoke('getpdfasync', file )
        
            let isvalid = this.isValidPdf(data)
            if (!isvalid){
                this.$swal.fire({
                    title: this.$t("general.error"),
                    text: this.$t("general.nopdf"),
                    icon: "error",
                    timer: 3000,
                    showCancelButton: false,
                    didOpen: () => { this.$swal.showLoading(); },
                })
                return
            }

            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "application/pdf"})) 

            const pdfEmbed = document.querySelector("#pdfembed");
            pdfEmbed.style.backgroundImage = '';
            pdfEmbed.style.height = "96vh";
            pdfEmbed.style.marginTop = "-48vh";
            pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0`);

            document.querySelector("#preview").style.display = 'block';
        },


        // fetch file from disc - show preview
        async loadImage(file){
            URL.revokeObjectURL(this.currentpreview);
            let data = await ipcRenderer.invoke('getpdfasync', file )
            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"})) 

            const pdfEmbed = document.querySelector("#pdfembed");
            pdfEmbed.style.backgroundImage = `url(${this.currentpreview})`;
            pdfEmbed.style.backgroundSize = 'contain'
            pdfEmbed.style.backgroundRepeat = 'no-repeat'
            pdfEmbed.style.backgroundPosition =  'center'
           
            pdfEmbed.style.height = "80vh";
            pdfEmbed.style.marginTop = "-40vh";
            pdfEmbed.setAttribute("src", "about:blank");

            document.querySelector("#preview").style.display = 'block';     
        },


        // display the table part of the toolbar
        showMore(){
            const moreOptions= document.getElementById('moreoptions')
            if (moreOptions.style.display === "none") {
                moreOptions.style.display = "inline-block";
            } 
            else {
                moreOptions.style.display = "none";
            }
        },
        /** Converts the Editor View into a multipage PDF */
        async saveContent(backup, why) {     
            
         
            let filename = false  // this is set manually... otherwise use clientname
            if (why === "manual"){
                await this.$swal({
                    title: this.$t("math.filename") ,
                    input: 'text',
                    inputPlaceholder: 'Type here...',
                    showCancelButton: true,
                    inputAttributes: {
                        maxlength: 20,
                    },
                    confirmButtonText: 'Ok',
                    cancelButtonText: this.$t("editor.cancel"),
                    inputValidator: (value) => {
                        const regex = /^[A-Za-z0-9]+$/;
                        if (!value.match(regex)) {
                            return  this.$t("math.nospecial") ;
                        }                   
                    },
                }).then((result) => {
                    if (result.isConfirmed) { filename = `${result.value}`}
                    else {return; }
                });
            }
            if (why === "exitexam") { 
                // stop clipboard clear interval
                ipcRenderer.send('restrictions')

                this.$swal.fire({
                    title: this.$t("editor.leaving"),
                    text: this.$t("editor.savedclip"),
                    icon: "info",
                    timer: 3000,
                    showCancelButton: false,
                    didOpen: () => { this.$swal.showLoading(); },
                })

                let text = this.editor.getText(); 
                ipcRenderer.send('clipboard', text)

                
                navigator.clipboard.writeText(text).then(function() {
                    console.log('editor @ savecontent: Text erfolgreich kopiert');
                }).catch(function(err) {
                    console.log('editor @ savecontent: Fehler beim Kopieren des Textes: ', err);
                });
            }
           

            // SAVE AS PDF - inform mainprocess to save webcontent as pdf (see @media css query for adjustments for pdf)
            // printPDF will trigger a reload of the filelist if finished and send files to teacher if reason (why) is "teacherrequest"
            ipcRenderer.send('printpdf', {filename: filename, landscape: false, servername: this.servername, clientname: this.clientname, reason: why })  
            
            // SAVE AS HTML (bak) - also save editorcontent as *html file - used to re-populate the editor window in case something went completely wrong
            let editorcontent = this.editor.getHTML(); 
            ipcRenderer.send('storeHTML', {filename: filename, editorcontent: editorcontent })
            
      
        },
        //send a printrequest to the teacher
        print(){
           //make sure to post print request to teacher for the latest work
           ipcRenderer.sendSync('sendPrintRequest') 
           console.log("editor @ print: sending printrequest")
           this.$swal.fire({
                title: this.$t("editor.requestsent"),
                icon: "info",
                timer: 1500,
                timerProgressBar: true,
                didOpen: () => { this.$swal.showLoading() }
            })
        },
        // display print denied message and reason
        printdenied(why){
            console.log("editor @ printdenied: Print request denied")
            this.$swal.fire({
                title: `${this.$t("editor.requestdenied")}`,
                icon: "info",
                timer: 2000,
                timerProgressBar: true,
                didOpen: () => { this.$swal.showLoading() }
            })
        },
        zoomin(){
            if (this.zoom < 4) this.zoom += 0.1
            document.getElementById(`editorcontainer`).style.zoom = this.zoom
        },
        zoomout(){
            if (this.zoom > 0.5) this.zoom -= 0.1
            document.getElementById(`editorcontainer`).style.zoom = this.zoom
        },
        setCSSVariable(variableName, value){
            document.documentElement.style.setProperty(variableName, value);
        },
        //show wordcount and charcount of selection 
        getSelectedTextInfo() {
            // let selectedText = window.getSelection().toString();
            // this.selectedWordCount = selectedText ? selectedText.split(/\s+/).filter(Boolean).length : 0;
            // this.selectedCharCount = selectedText ? selectedText.length : 0;
            if (!this.editor || !this.editor.state.selection) {
                this.selectedCharCount = 0
            }
            const { from, to } = this.editor.state.selection;
            const textInSelection = this.editor.state.doc.textBetween(from, to, ' ');
            this.selectedCharCount = textInSelection ? textInSelection.replace(/\s/g, '').length : 0;
            return
        },
        // manual copy and paste because we disabled clipboard
        copySelection(){
            //this.selectedText = window.getSelection().toString();

            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const div = document.createElement('div');

            // Fügt den ausgewählten Bereich zum Div-Element hinzu
            div.appendChild(range.cloneContents());

            // Speichert den HTML-Inhalt
            this.selectedText = div.innerHTML;
        },
        pasteSelection(){
            if (!this.selectedText || this.selectedText == "") {return}
            console.log("[pasteSelection] pasted:",this.selectedText)
            //paste previously selected html code
            this.editor.commands.insertContent(this.selectedText)         
        },
        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        // returns a uuid 
        uuidv4() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        activateSpellcheck(){
            if (this.serverstatus.spellcheck || this.allowspellcheck) {
                console.log("[activateSpellcheck] spellcheck activated")
                document.addEventListener('input', this.checkAllWordsOnSpacebar)  // do a spellcheck when the user hits space
                if (this.serverstatus.suggestions || (this.allowspellcheck && this.allowspellcheck.suggestions)){
                    console.log("[activateSpellcheck] suggestions activated")
                    document.addEventListener('click', this.hideSpellcheckMenu); // Hide suggestion menu when clicking elsewhere
                    this.editorcontentcontainer.addEventListener('contextmenu', this.getWord );   // show the context menu
                } 
            }
            this.spellcheck = true
            this.checkAllWords()
        },
        deactivateSpellcheck(){
            this.editorcontentcontainer.removeEventListener('contextmenu', this.getWord );
            document.removeEventListener('input', this.checkAllWordsOnSpacebar)
            this.removeAllHighlightsByClass()
            this.spellcheck = false
        },
        reloadAll(){
            this.$swal.fire({
                title: this.$t("editor.reload"),
                html:  `${this.$t("editor.reloadtext")}
                    <br> <br>
                    <input class="form-check-input" type="checkbox" id="keepcontent" checked>
                    <label class="form-check-label" for="keepcontent"> ${this.$t("editor.reloadcontent")} </label>
                `,
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true
            })
            .then((result) => {
                if (result.isConfirmed) {
                    let keepcontent = document.getElementById('keepcontent').checked;
                    console.log("Reinitializing Editor Component")
                    let content = ""
                    if (keepcontent) {
                        console.log("-> keeping content")
                        content = this.editor.getHTML() //get edtior data and store it  
                    }
                    this.editor.destroy();  // Destroy the current instance
                    this.createEditor();  // Reinitialize
                    //paste editor data
                    if (keepcontent) {
                        this.editor.commands.clearContent(true)  //clear edtior
                        this.editor.commands.insertContent(content) 
                    }
                } 
            }); 

        },
        sendFocuslost(){
            let response = ipcRenderer.send('focuslost')  // refocus, go back to kiosk, inform teacher
            if (!this.config.development && !response.focus){  //immediately block frontend
                this.focus = false 
                const editorcontentcontainer = document.getElementById('editorcontent');
                const editableDiv = editorcontentcontainer.firstElementChild;
                editableDiv.blur()  // remove text cursor (carret)
            }  
        },
        createEditor(){
            this.editor = new Editor({
                extensions: [
                    CustomSpan,
                    Typography,
                    SmilieReplacer,
                    this.charReplacerExtension,
                    Table.configure({
                        resizable: true,
                    }), 
                    TableRow,
                    TableCell,
                    TableHeader,
                    Blockquote,
                    BulletList,
                    Document,
                    HardBreak,
                    Heading,
                    HorizontalRule,
                    ListItem,
                    OrderedList,
                    Paragraph,
                    Text,
                    Bold,
                    Code,
                    Italic,
                    Subscript,
                    Superscript,
                    Underline,
                    Dropcursor,
                    Gapcursor,
                    History,
                    CharacterCount.configure({
                        limit: 60000   //this should be enough for all cases
                    }),
                    Color,
                    TextStyle,
                    TextAlign.configure({
                        types: ['heading', 'paragraph'],
                    }),
                    CodeBlockLowlight
                    .extend({
                        addNodeView() {
                        return VueNodeViewRenderer(CodeBlockComponent)
                        },
                    })
                    .configure({ lowlight }),
                ],
                content: ``,         
            });
        }
    },



    mounted() {
        switch (this.cmargin.size) {
            case 5:       this.proseMirrorMargin = '50mm'; this.editorWidth = '160mm'; break;
            case 4.5:     this.proseMirrorMargin = '45mm'; this.editorWidth = '165mm'; break;
            case 4:       this.proseMirrorMargin = '40mm'; this.editorWidth = '170mm'; break;
            case 3.5:     this.proseMirrorMargin = '35mm'; this.editorWidth = '175mm'; break;
            case 3:       this.proseMirrorMargin = '30mm'; this.editorWidth = '180mm'; break;
            case 2.5:     this.proseMirrorMargin = '25mm'; this.editorWidth = '185mm'; break;
            case 2:       this.proseMirrorMargin = '20mm'; this.editorWidth = '190mm'; break;
            default:      this.proseMirrorMargin = '30mm'; this.editorWidth = '180mm';
        }
        if (this.cmargin.side === "right"){ 
            this.setCSSVariable('--js-margin', `0 ${this.proseMirrorMargin} 0 0`);    
            this.setCSSVariable('--js-borderright', `1px solid #ccc`);
            this.setCSSVariable('--js-borderleft', `0px solid #ccc`);
        }
        else { 
            this.setCSSVariable('--js-margin', `0 0 0 ${this.proseMirrorMargin}`); 
            this.setCSSVariable('--js-borderright', `0px solid #ccc`);
            this.setCSSVariable('--js-borderleft', `1px solid #ccc`); 
        }

        this.setCSSVariable('--js-editorWidth', `${this.editorWidth}`);     
        this.setCSSVariable('--js-linespacing', `${this.linespacing}`); 
        this.setCSSVariable('--js-fontfamily', `${this.fontfamily}`); 


        this.charReplacerExtension = CharReplacer({ language: this.serverstatus.spellchecklang });

        this.createEditor(); // this initializes the editor

       
        ipcRenderer.on('save', (event, why) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
            console.log("editor @ save: Teacher saverequest received")
            this.saveContent(true, why) 
        }); 
        ipcRenderer.on('denied', (event, why) => {  //print request was denied by teacher because he can not handle so much requests at once
            this.printdenied(why)
        }); 
        ipcRenderer.on('backup', (event, filename) => {  
            console.log("editor @ backup: Replace event received ")
            this.loadHTML(filename) 
        }); 
        ipcRenderer.on('loadfilelist', () => {  
            //console.log("editor @ loadfilelist: Reload Files event received ")
            this.loadFilelist() 
        });
        ipcRenderer.on('fileerror', (event, msg) => {
            console.log('editor @ fileerror: writing/deleting file error received');
            this.$swal.fire({
                    title: "Error",
                    html:  `<b> ${msg.message}</b> <br> Bitte löschen sie das 'EXAM-STUDENT Verzeichnis und stellen sie sicher, dass es für Next-Exam schreibbar ist.'`,
                    icon: "error",
                    //timer: 30000,
                    showCancelButton: false,
                    didOpen: () => { this.$swal.showLoading(); },
            })
        });

        // add some eventlisteners once
        document.querySelector("#preview").addEventListener("click", function() {  
            this.style.display = 'none';
            this.setAttribute("src", "about:blank");
            URL.revokeObjectURL(this.currentpreview);
        });

        document.querySelector("#audioclose").addEventListener("click", function(e) {
            audioPlayer.pause();
            console.log('editor @ audioclose: Playback stopped');
            document.querySelector("#aplayer").style.display = 'none';
        });

        const audioPlayer = document.getElementById('audioPlayer');
        if (audioPlayer) { audioPlayer.addEventListener('contextmenu', (e) => { e.preventDefault(); }); }

        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()
   
        // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
        this.fetchinfointerval = new SchedulerService(5000);
        this.fetchinfointerval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
        this.fetchinfointerval.start();

        this.saveContentCallback = () => this.saveContent(true, 'auto');  // wegs 2 parameter muss dieser umweg genommen werden sonst kann ich den eventlistener nicht mehr entfernen
        this.saveinterval = new SchedulerService(20000);
        this.saveinterval.addEventListener('action', this.saveContentCallback );  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
        this.saveinterval.start();

        this.clockinterval = new SchedulerService(1000);
        this.clockinterval.addEventListener('action', this.clock);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
        this.clockinterval.start();
        
        
        this.loadFilelist()
        this.fetchInfo()

        /**
        *   INSERT EVENT LISTENERS
        */
        // show spellchecking context menu
        this.editorcontentcontainer = document.getElementById('editorcontent');        
        this.editorcontentcontainer.addEventListener('mouseup',  this.getSelectedTextInfo );   // show amount of words and characters
        this.editorcontentcontainer.addEventListener('keydown', this.insertSpaceInsteadOfTab)   //this changes the tab behaviour and allows tabstops   
        
        
        document.body.addEventListener('mouseleave', this.sendFocuslost);


    },
    beforeMount(){ },
    beforeUnmount() {
        /**
        *   REMOVE EVENT LISTENERS
        */
        this.editorcontentcontainer.removeEventListener('keydown', this.insertSpaceInsteadOfTab)
        this.editorcontentcontainer.removeEventListener('contextmenu', this.getWord );
        document.removeEventListener('input', this.checkAllWordsOnSpacebar)
        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        document.removeEventListener('click', this.hideSpellcheckMenu);
        this.editorcontentcontainer.removeEventListener('mouseup',  this.getSelectedTextInfo );
        
        this.editor.destroy()

        
        this.saveinterval.removeEventListener('action', this.saveContentCallback);
        this.saveinterval.stop() 

        this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
        this.fetchinfointerval.stop() 

        this.clockinterval.removeEventListener('action', this.clock);
        this.clockinterval.stop() 
    },
}
</script>























<style lang="scss">

@media print {  //this controls how the editor view is printed (to pdf)
    #editortoolbar, #apphead, #editselected, #focuswarning, .focus-container, #specialcharsdiv, #aplayer,  span.NXTEhighlight::after {
        display: none !important;
    }
    #statusbar {
        position: relative !important;
        box-shadow: 0px 0px 0px transparent !important;
        background-color: white !important;
        border-top: 1px solid #c5c5c5 !important;
        //margin-right: var(--js-margin) !important;
        margin-left: 14px !important;
        width: var(--js-editorWidth) !important;
    }
    #editorcontent {
        border: 0px !important;
    }

    #editorcontent div.tiptap {
        line-height: var(--js-linespacing) !important;
        width: var(--js-editorWidth) !important;
    }
    #editorcontainer {
        width: 100% !important;
        margin: 0px !important;
        border-radius:0px !important;
        background-color: white !important;
        overflow: hidden !important;
        zoom: 1 !important;
    }

    #editormaincontainer {
        overflow: hidden !important;
        margin: 0 !important;
        border-radius:0px !important;
        background-color: white !important;
    }
    #vueexambody {
        overflow: hidden !important;
        height: 100% !important;
        border-radius:0px !important;
     
    }

    #app {
        display:block !important;
        height: 100% !important;
        overflow: hidden !important;
    }

    .ProseMirror{
        padding: 5mm 1mm 5mm 8mm !important;
        border-radius: 0 !important; 
        outline: 0 !important;
        overflow: hidden !important;
        margin: var(--js-margin) !important;
        border-right: var(--js-borderright) !important;
        border-left: var(--js-borderleft) !important;
        margin-bottom:4px !important;
    }

    ::-webkit-scrollbar {
                display: none;
            }

   // p { page-break-after: always; }
    .footer { 
        position: fixed; 
        bottom: 0px; 
     }

    .zoombutton, #preview {
       display:none !important;
    }

    .swal2-container, .swal2-center, .swal2-backdrop-show , .swal2-popup, .swal2-modal, .swal2-icon-info, .swal2-show {
        display:none !important;
    }


}

#aplayer{
    display:none;
    background-color: rgb(255, 255, 255);
    z-index:100000;
    width: 100%;
    text-align: center;
}

#audioPlayer {
    position: relative;
    width: 70vw;
    height:24px;
}

audio::-webkit-media-controls-panel {
    background-color: rgb(255, 255, 255);
}

#specialcharsdiv {
    display:none;
    width: 100%;
    background-color: rgb(255, 255, 255);
    z-index:1000000;
}



.invisible-button {
    border-color: transparent !important;
}


/**
NodeHun Custom Spellchecker Styles 
*/
#suggestion-menu{
    z-index:100000;
    padding: 4px;
    background-color: #f3f8fd;
    border: 1px solid #d3e5ff;
    cursor: pointer;
    border-radius: 4px;
    box-shadow: 0px 0px 10px #00000047;
}
#suggestion-menu div {
    font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
    font-size: 0.8em;
    padding: 2px 6px 2px 6px;
    transition:0.2s;
    border-radius:4px;
    
}
#suggestion-menu div:hover {
    box-shadow: 0px 0px 10px inset #bacbe4;
}

span.NXTEhighlight {
    position: relative;
}
/* Create the glowing underline */
span.NXTEhighlight::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: lightcoral; /* Light red color */
    box-shadow: 0 0 5px lightcoral;
}
.menu-separator {
    border-top: 1px solid #ccc;
    margin: 5px 0;
}



/**
Other Styles
*/

#editorcontainer {
    border-radius:0; 
    margin-top:20px; 
    width: 210mm; 
    margin-left: auto;
    margin-right: auto;
    margin-bottom:50px;
    zoom:1;
    font-family: var(--js-fontfamily);
}

#editorcontent {
    border-radius: 0px;
    border:1px solid #c5c5c5;
}

#editorcontent div.tiptap {
    overflow-x: auto;
    overflow-y: hidden;
    line-height: var(--js-linespacing) !important;
    width: var(--js-editorWidth);
    border-radius: 0px;
}

#statusbar {
    position: relative;
    bottom:0px; 
    width:100%; 
    height: 28px; 
    background-color: #eeeefa;
    padding: 2px;
    padding-left:6px;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2);
    font-size:0.9em;
}
.zoombutton {
    height:24px;
    float:right;
    cursor: pointer;
   
}
.zoombutton:hover {
    filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(82%) contrast(119%);
}

.swal2-container.swal2-backdrop-show {
    z-index: 1000000;
}



#preview {
    display: none;
    position: absolute;
    top:0;
    left: 0;
    width:100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
}

#pdfembed { 
    position: absolute;
    top: 50%;
    left: 50%;
    margin-left: -30vw;
    margin-top: -45vh;
    width:60vw;
    height: 90vh;
    padding: 10px;
    background-color: rgba(255, 255, 255, 1);
    border: 0px solid rgba(255, 255, 255, 0.589);
    box-shadow: 0 0 15px rgba(22, 9, 9, 0.589);
    padding: 10px;
    border-radius: 6px;
}


/* Basic editor styles */

.ProseMirror {
    min-height: 60vh;
    padding: 5mm 1mm 5mm 8mm;
    outline: 1px solid rgb(197, 197, 197);
    border-radius: 5px;
}

.ProseMirror:focus-visible{
  outline: 1px solid rgb(197, 197, 197);
}

.ProseMirror {
    > * + * {
        margin-top: 0.75em;
        quotes: "„" "“" "‚" "‘" !important;
    }

    blockquote p{
        quotes: "„" "“" "‚" "‘" !important;
    }
    blockquote p::before {
        content: open-quote;
    }
    blockquote p::after {
        content: close-quote;
    }

    ul,
    ol {
        padding: 0 1rem;
        line-height: 1;
    }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    line-height: 1.1;
  }

  code {
    background-color: rgba(#616161, 0.1);
    color: #616161;
  }
  .code-block {
    width: 95% !important;

  }



  pre {
    background: #0D0D0D;
    color: #FFF;
    font-family: 'JetBrainsMono', monospace;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;

    code {
      color: inherit;
      padding: 0;
      background: none;
      font-size: 0.8rem;
    }
  }

  img {
    max-width: 100%;
    height: auto;
  }

  blockquote {
    padding-left: 1rem;
    border-left: 2px solid rgba(#0D0D0D, 0.1);
  }

  hr {
    border: none;
    border-top: 2px solid rgba(#0D0D0D, 0.1);
    margin: 2rem 0;
  }

    .hljs-comment, .hljs-quote {
      color: #616161;
    }

    .hljs-variable,
    .hljs-template-variable,
    .hljs-attribute,
    .hljs-tag,
    .hljs-name,
    .hljs-regexp,
    .hljs-link,
    .hljs-name,
    .hljs-selector-id,
    .hljs-selector-class {
      color: #F98181;
    }

    .hljs-number,
    .hljs-meta,
    .hljs-built_in,
    .hljs-builtin-name,
    .hljs-literal,
    .hljs-type,
    .hljs-params {
      color: #FBBC88;
    }

    .hljs-string,
    .hljs-symbol,
    .hljs-bullet {
      color: #B9F18D;
    }

    .hljs-title,
    .hljs-section {
      color: #FAF594;
    }

    .hljs-keyword,
    .hljs-selector-tag {
      color: #70CFF8;
    }

    .hljs-emphasis {
      font-style: italic;
    }

    .hljs-strong {
      font-weight: 700;
    }

}


/* Table-specific styling */
.ProseMirror {
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    overflow: hidden;

    td,
    th {
      min-width: 1em;
      border: 2px solid #ced4da;
      padding: 3px 5px;
      vertical-align: top;
      box-sizing: border-box;
      position: relative;

      > * {
        margin-bottom: 0;
      }
    }

    th {
      font-weight: bold;
      text-align: left;
      background-color: #f1f3f5;
    }

    .selectedCell:after {
      z-index: 2;
      position: absolute;
      content: "";
      left: 0; right: 0; top: 0; bottom: 0;
      background: rgba(200, 200, 255, 0.4);
      pointer-events: none;
    }

    .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: -2px;
      width: 4px;
      background-color: #adf;
      pointer-events: none;
    }

    p {
      margin: 0;
    }
  }
}

.tableWrapper {
  overflow-x: auto;
}

.resize-cursor {
  cursor: ew-resize;
  cursor: col-resize;
}


</style>
