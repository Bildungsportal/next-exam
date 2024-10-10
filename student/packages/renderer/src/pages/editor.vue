 <template>


    <!-- HEADER START -->
    <exam-header
      :serverstatus="serverstatus"
      :clientinfo="clientinfo"
      :online="online"
      :clientname="clientname"
      :exammode="exammode"
      :servername="servername"
      :pincode="pincode"
      :battery="battery"
      :currenttime="currenttime"
      :timesinceentry="timesinceentry"
      :componentName="componentName"
      :localLockdown="localLockdown"
      @reconnect="reconnect"
      @gracefullyexit="gracefullyexit"
    ></exam-header>
     <!-- HEADER END -->


   
    <div class="w-100 p-0 m-0 text-white shadow-sm text-center" style="top: 66px; z-index: 10001 !important; background-color: white;">
        
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
            <button :title="$t('editor.heading5')" @click="editor.chain().focus().toggleHeading({ level: 5 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 5 }) }" class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/h5.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading6')" @click="editor.chain().focus().toggleHeading({ level: 6 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 6 }) }" class="invisible-button btn btn-outline-secondary p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/h6.svg" width="22" height="22"></button>

            
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
           
            <button :title="$t('editor.specialchar')"  @click="showInsertSpecial();this.LTdisable()" class="invisible-button btn btn-outline-warning p-1 me-0 mb-1 btn-sm"><img src="/src/assets/img/svg/sign.svg" class="" width="22" height="22" ></button>
            <button :title="$t('editor.insertmug')"  @click="showInsertMugshot();this.LTdisable()" class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/person-fill.svg" class="" width="22" height="22" ></button>
           


   
            <button :title="$t('editor.more')" id="more" @click="showMore();this.LTdisable()" class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img src="/src/assets/img/svg/view-more-horizontal-symbolic.svg" class="white" width="22" height="22" ></button>
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
            <button :title="$t('editor.splitview')"  @click="toggleSplitview()" style="vertical-align: top;" class="invisible-button btn btn-outline-warning p-0 ms-1 me-2 mb-0 btn-sm"><img src="/src/assets/img/svg/view-split-left-right.svg" class="white" width="22" height="22" ></button>
            <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
                <div v-if="(file.type == 'bak')" class="btn btn-mediumlight p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.name; loadHTML(file.name)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}}     ({{ new Date(this.now - file.mod).toISOString().substr(11, 5) }})</div>
                <div v-if="(file.type == 'docx')" class="btn btn-success p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.name; loadDOCX(file.name)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}}</div>
                
                <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'audio')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="playAudio(file.name)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
            </div>
        
        </div>
        <!-- toolbar end -->
    </div>



    <!-- mugshot preview start -->
    <div id="mugshotpreview">
        <div class="mugshot-container">
            <img @click="insertMugshot('mug1')" id="mug1" src="/src/assets/img/mugshots/1.png" class="mugshot">
            <img @click="insertMugshot('mug2')" id="mug2" src="/src/assets/img/mugshots/2.png" class="mugshot">
            <img @click="insertMugshot('mug3')" id="mug3" src="/src/assets/img/mugshots/3.png" class="mugshot" >
            <img @click="insertMugshot('mug4')" id="mug4" src="/src/assets/img/mugshots/4.png" class="mugshot" >
            <img @click="insertMugshot('mug5')" id="mug5" src="/src/assets/img/mugshots/5.png" class="mugshot" >
            <img @click="insertMugshot('mug6')" id="mug6" src="/src/assets/img/mugshots/6.png" class="mugshot" >
            <img @click="insertMugshot('mug7')" id="mug7" src="/src/assets/img/mugshots/7.png" class="mugshot" >
            <img @click="insertMugshot('mug8')" id="mug8" src="/src/assets/img/mugshots/8.png" class="mugshot" >
            <img @click="insertMugshot('mug9')" id="mug9" src="/src/assets/img/mugshots/9.png" class="mugshot" >
            <img @click="insertMugshot('mug10')" id="mug10" src="/src/assets/img/mugshots/10.png" class="mugshot" >
            <img @click="insertMugshot('mug11')" id="mug11" src="/src/assets/img/mugshots/11.png" class="mugshot" >
            <img @click="insertMugshot('mug12')" id="mug12" src="/src/assets/img/mugshots/12.png" class="mugshot" >
        </div>
    </div>
    <!-- mugshot preview end -->




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


    <!-- angabe/pdf preview start -->
    <div v-if="!splitview" id="preview" class="fadeinfast p-4">
        <div class="embed-container">
        <embed src="" id="pdfembed"></embed>
        <div class="btn btn-warning shadow " id="insert-button" @click="insertImage(selectedFile)" :title="$t('editor.insert')">
            <img src="/src/assets/img/svg/edit-download.svg" class="white" width="22" height="32">
        </div>
            <div id="pdfZoom" style="display:none; position: absolute; top:20px; right: 100px;">
                <button class="btn btn-warning btn-small" style="width:28px;" id="zoomIn"><img src="/src/assets/img/svg/zoom-in.svg">  </button>
                <button class="btn btn-warning btn-small" style="width:28px;" id="zoomOut"><img src="/src/assets/img/svg/zoom-out.svg"></button>
            </div>
        </div>
    </div>
    <!-- angabe/pdf preview end -->

    <!-- EDITOR START -->
    <div v-if="!splitview" id="editormaincontainer" style="height: 100%; overflow-x:auto; overflow-y: scroll; background-color: #eeeefa;">
        <div id="editorcontainer" class="shadow" style="">
            <editor-content :editor="editor" class='p-0' id="editorcontent" style="background-color: #fff; border-radius:0;" />
            <canvas id="highlight-layer"></canvas>
        </div>
    </div>
    <!-- EDITOR END -->


    <!-- SPLITVIEW START -->
    <div v-if="splitview" class="split-view-container" style="overflow: hidden; display: flex !important; flex-direction: row !important; height: 100% !important;">
        <!-- PDF Preview Container -->
        <div id="preview" class="fadeinfast" style="background-image: url(/src/assets/img/svg/edit-copy-light.svg); background-repeat: no-repeat; background-position: center; flex-grow: 1 !important; display: block !important; position: static !important; top: auto !important; left: auto !important; width: auto !important; height: auto !important; background-color: transparent !important; z-index: auto !important; backdrop-filter: none !important;">
            <div class="embed-container" style="position: relative !important; top: 0 !important; left: 0 !important; transform: none !important; display: block !important; height:100% !important">
                <embed src="" id="pdfembed" style="border-radius:0 !important; background-size:contain; width:100% !important; height: 100% !important; background-color:transparent !important;"></embed>
                <div class="btn btn-warning shadow" id="insert-button" @click="insertImage(selectedFile)" :title="$t('editor.insert')" style="position: absolute; top: 40px; right:20px; z-index:100000; width: 70px; border: none !important; border-radius: 0.2rem !important; box-shadow: 0px -10px 0px rgba(0, 0, 0, 0) !important; padding: 16px !important; cursor: pointer !important; display: none !important; align-items: center !important; justify-content: center !important; margin-top: 0px !important; background-image: url('/src/assets/img/svg/edit-download-black.svg'); background-size: 28px; background-repeat: no-repeat; background-position: center;"></div>
                <div id="pdfZoom" style="display:none; position: absolute; top:40px; right:20px; z-index:100000; height: 100px;">
                    <button class="btn btn-warning btn-small shadow" style="width:70px; height: 32px; margin-bottom:2px; background-image: url(/src/assets/img/svg/zoom-in.svg); background-repeat: no-repeat; background-position: center; " id="zoomIn"></button><br>
                    <button class="btn btn-warning btn-small shadow" style="width:70px; height: 32px; margin-bottom:2px; background-image: url(/src/assets/img/svg/zoom-out.svg); background-repeat: no-repeat; background-position: center;" id="zoomOut"></button>
                </div>

            </div>
        </div>
        <!-- Editor Container -->
        <div id="editormaincontainer" style="min-width:230mm!important;padding:10px; overflow-x: auto !important; overflow-y: scroll !important; background-color: #eeeefa !important;">
            <div id="editorcontainer" class="shadow">
                <editor-content :editor="editor" class="p-0" id="editorcontent" style="background-color: #fff !important; border-radius: 0 !important;" />
                <canvas id="highlight-layer"></canvas>
            </div>
        </div>
    </div>
    <!-- SPLITVIEW END -->






    
    <!-- LANGUAGE TOOL START -->
    <div id="languagetool" v-if="serverstatus.languagetool || privateSpellcheck.activated">
        <div id="ltcheck" @click="LTcheckAllWords();"> <div id="eye" class="darkgreen eyeopen"></div> &nbsp;LanguageTool</div>
        <div class="ltscrollarea"> 
            <div @click="LTcheckAllWords(false);" class="btn btn-sm btn-success center" style="text-align: center;  margin-left:10px;"> {{$t('editor.update')}}</div> 

            <div v-if="hunspellFallback"  style="text-align: center; font-size: 0.8em;"> Hunspell Fallback <br> LanguageTool nicht verfügbar </div> 
            <div v-if="misspelledWords.length == 0"  style="text-align: center; font-size: 0.8em;"> {{this.LTinfo}}</div> 
            <div v-for="entry in misspelledWords" :key="entry.wrongWord" class="error-entry" @click="LTshowWord(entry)">
                <div :style="'background-color:' + entry.color " class="color-circle"></div>
                <div class="error-word">{{ entry.wrongWord }}  <span v-if="entry.whitespace">' &nbsp;  '</span></div>
                <div v-if="entry.message" class="fw-bold">{{ entry.rule.category.name}}</div>
                <div v-if="serverstatus.suggestions || privateSpellcheck.suggestions">
                  <div v-if="entry.message">{{ entry.message}}</div>
                     <div v-if="entry.replacements" class="replacement">
                        <span v-if="entry.replacements[0]">  {{ entry.replacements[0].value }}</span>
                        <span v-if="entry.replacements[1]">, {{ entry.replacements[1].value }}</span>
                        <span v-if="entry.replacements[2]">, {{ entry.replacements[2].value }}</span>
                        <span v-if="entry.replacements[3]">, {{ entry.replacements[3].value }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- LANGUAGE TOOL END -->




    <div id="statusbar">
        <!-- Statischer Text mit v-once, um das Neurendern zu verhindern da $t offenbar jedesmal performance measures durchführt die zu memory bloat führen -->
            <span v-once>{{ $t("editor.words") }}:</span> <span>{{ wordcount }}</span> | <span v-once>{{ $t("editor.chars") }}:</span> <span>{{ charcount }}</span>  
            &nbsp;
            <span v-once id="editselectedtext"> {{ $t("editor.selected") }}: </span> <span id="editselected"> {{ selectedWordCount }}/{{ selectedCharCount }}</span>
            <img @click="zoomin(); LTupdateHighlights();" src="/src/assets/img/svg/zoom-in.svg" class="zoombutton">  
            <img @click="zoomout(); LTupdateHighlights();" src="/src/assets/img/svg/zoom-out.svg" class="zoombutton">
        </div>
    <!-- EDITOR END -->
</template>

<script>
import { Editor, EditorContent, VueNodeViewRenderer } from '@tiptap/vue-3'
import Image from '@tiptap/extension-image';
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


import {common, createLowlight} from 'lowlight'
const lowlight = createLowlight(common)

import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'
import { LTcheckAllWords, LTfindWordPositions, LThighlightWords, LTdisable, LThandleMisspelled } from '../utils/languagetool.js'
import DOMPurify from 'dompurify';

export default {
    components: {
        EditorContent,
        ExamHeader
    },
    data() {
        return {
            index: 0,
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
            localLockdown: this.$route.params.localLockdown,
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
            serverstatus: this.$route.params.serverstatus,
            linespacing: this.$route.params.serverstatus.linespacing ? this.$route.params.serverstatus.linespacing : '2',
            fontfamily:  this.$route.params.serverstatus.fontfamily  ? this.$route.params.serverstatus.fontfamily : "sans-serif", 
            privateSpellcheck: {activate: false, activated: false, suggestions: false}, // this is a per student override (for students with legasthenie)
            individualSpellcheckActivated: false,
            audioSource: null,
            currentpreview: null,
            audiofiles: [],
            misspelledWords:[],
            textContainer : null,
            canvas : null,
            ctx : null,
            text: null,
            currentLTword:"",
            currentLTwordPos:null,
            LTinfo: "searching...",
            LTactive: false,
            hunspellFallback: false,
            splitview: false,
            currentPDFZoom: 80,
            currentPDFData: null
        }
    },
    computed: {
        getHexColor() {
            const rgbColor = this.editor?.getAttributes('textStyle')?.color || '';
            return rgbColor.startsWith('rgb') ? this.rgbToHex(rgbColor) : rgbColor;
        },


    },


    methods: {

        LTcheckAllWords:LTcheckAllWords,
        LTfindWordPositions:LTfindWordPositions,
        LThighlightWords:LThighlightWords,
        LTdisable:LTdisable,
        LThandleMisspelled: LThandleMisspelled,

        LTshowWord(word){
            this.currentLTword = word
            this.LTupdateHighlights()
            if (word.range){  this.setCursorAtStartOfRange(word.range) }
           
        },
        async LTupdateHighlights(){
            if (!this.LTactive){return}
            await this.LTfindWordPositions()
            this.LThighlightWords()
        },

        setCursorAtStartOfRange(range) {
            // Stellen Sie sicher, dass der Bereich in ein editierbares Element gesetzt wird
            const editableElement = range.startContainer.parentNode; // Das sollte das editierbare Element sein
            if (editableElement.isContentEditable) {
                const caretRange = document.createRange();
                caretRange.setStart(range.startContainer, range.startOffset);
                caretRange.setEnd(range.startContainer, range.startOffset);

                // Setze den Auswahlbereich (Selection) auf den Anfang des Range-Objekts
                const selection = window.getSelection();
                selection.removeAllRanges(); // Entferne alle bestehenden Bereiche aus der aktuellen Auswahl
                selection.addRange(caretRange); // Fügt die neue Range hinzu, die den Caret positioniert

                // Optional: Scroll das Element in die Sicht, falls nötig
                editableElement.focus(); // Richtet den Fokus auf das editierbare Element
                caretRange.startContainer.parentNode.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            }
        },


        async fetchInfo() {
            let getinfo = await ipcRenderer.invoke('getinfoasync')  // we need to fetch the updated version of the systemconfig from express api (server.js)
            this.clientinfo = getinfo.clientinfo;
            this.token = this.clientinfo.token
            this.focus = this.clientinfo.focus
            this.clientname = this.clientinfo.name
            this.exammode = this.clientinfo.exammode
            this.pincode = this.clientinfo.pin
            this.privateSpellcheck = this.clientinfo.privateSpellcheck
            this.serverstatus =  getinfo.serverstatus
           
           // console.log(this.serverstatus)
            if (this.pincode !== "0000"){this.localLockdown = false}  // pingcode is 0000 only in localmode
            if (!this.focus){  this.entrytime = new Date().getTime()}
            if (this.clientinfo && this.clientinfo.token){  this.online = true  } else { this.online = false  }

            this.battery = await navigator.getBattery().then(battery => { return battery }).catch(error => { console.error("Error accessing the Battery API:", error);  });

            //handle individual spellcheck (only if not globally activated anyways)
            if (this.serverstatus.languagetool === false) {   
                if (this.privateSpellcheck.activate == false && this.LTactive) {
                    this.LTdisable()
                    this.privateSpellcheck.activated = false   // das wird eigentlich eh im communication handler für clientinfo bereits auf false gesetzt und bei fetchinfo() übernommen
                }
            }
        }, 


        /**
         * plays an audiofile
         * either shows dialog with limited amount of replays or player controls if unlimited
         * @param {*} filename the name of the audiofile to be played
         */
        async playAudio(filename) {
            const audioFile = this.audiofiles.find(obj => obj.name === filename);  // search for file in this.audiofiles - get object
            this.LTdisable()  // close langugagetool
     
       
            if (this.serverstatus.audioRepeat > 0){
                this.$swal.fire({
                    title: audioFile.name,
                    text:  this.$t("editor.reallyplay"),
                    icon: "question",
                    showCancelButton: true,
                    cancelButtonText: this.$t("editor.cancel"),
                    reverseButtons: true,

                    html: audioFile.playbacks > 0 ? `
                       
                        <span class="col-3" style="">${this.$t("editor.audioremaining")} ${audioFile.playbacks} </span> <br>
                        <div id="soundtest" class="btn btn-info btn-sm m-2">Soundtest</div><br>
                        <h6>${this.$t("editor.reallyplay")}</h6>
                    ` : `
                         <div id="soundtest" class="btn btn-info btn-sm m-2">Soundtest</div><br>
                        <span class="col-3" style="">${this.$t("editor.audionotallowed")}</span> 
                    `,
                    didRender: () => {
                        document.getElementById('soundtest').onclick = () => this.soundtest();
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        if (audioFile.playbacks > 0){
                            try {
                                const base64Data = await ipcRenderer.invoke('getfilesasync', filename, true);
                                if (base64Data) {
                                    this.audioSource = `data:audio/mp3;base64,${base64Data}`;
                                    audioPlayer.load(); // Lädt die neue Quelle
                                    audioPlayer.play().then(() => { 
                                        console.log('Playback started');
                                        audioFile.playbacks -= 1
                                    }).catch(e => { console.error('Playback failed:', e); });
                                } else { console.error('Keine Daten empfangen'); }
                            } catch (error) { console.error('Fehler beim Empfangen der MP3-Datei:', error); }   
                        }
                    } 
                }); 
            }
            if (this.serverstatus.audioRepeat == 0){
                document.querySelector("#aplayer").style.display = 'block';
                try {
                    const base64Data = await ipcRenderer.invoke('getfilesasync', filename, true);
                    if (base64Data) {
                        this.audioSource = `data:audio/mp3;base64,${base64Data}`;
                        audioPlayer.load(); // Lädt die neue Quelle
                       
                    } else { console.error('Keine Daten empfangen'); }
                } catch (error) { console.error('Fehler beim Empfangen der MP3-Datei:', error); } 
            }
        },

        async soundtest(){
            try {
                const base64Data = await ipcRenderer.invoke('getAudioFile', 'attention.wav', true);
                if (base64Data) {
                    let soundtest = document.getElementById('soundtest')

                    if (soundtest){
                        soundtest.classList.add('btn-success')
                        soundtest.classList.remove('btn-info')
                    }
                   
                    this.audioSource = `data:audio/mp3;base64,${base64Data}`;
                    audioPlayer.load(); // Lädt die neue Quelle
                    audioPlayer.play().then(async () => { 
                        await this.sleep(2000)
                        if (soundtest){
                            soundtest.classList.remove('btn-success')
                            soundtest.classList.add('btn-info')
                        }
                    }).catch(e => { console.error('Playback failed:', e); });
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

            if(this.serverstatus.languagetool || this.privateSpellcheck){
                this.LTupdateHighlights()
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
                reverseButtons: true,

                html: this.localLockdown ? `
                    <div class="m-2 mt-4"> 
                        <div class="input-group m-1 mb-1"> 
                            <span class="input-group-text col-3" style="width:140px;">Passwort</span>
                            <input class="form-control" type="text" id="localpassword" placeholder='Passwort'>
                        </div>
                    </div>
                ` : '',
            })
            .then((result) => {
                if (result.isConfirmed) {
                    if (this.localLockdown){
                        let password = document.getElementById('localpassword').value; 
                        if (password == this.serverstatus.password){ ipcRenderer.send('gracefullyexit')  }
                    }
                    else {
                        ipcRenderer.send('gracefullyexit')
                    }  
                } 
            }); 
        },


        //get all files in user directory
        async loadFilelist(){
            let filelist = await ipcRenderer.invoke('getfilesasync', null)
            this.localfiles = filelist;
            
            // handle audio file objects (playback limitations)
            this.localfiles.forEach( file =>{
                if (file.type == "audio"){
                    const existingaudiofile = this.audiofiles.find(obj => obj.name === file.name);
                    if (!existingaudiofile){
                        this.audiofiles.push({name: file.name, playbacks: this.serverstatus.audioRepeat})
                    } 
                }
            })
        },

        // get file from local examdirectory and replace editor content with it
        async loadHTML(file){
            this.LTdisable()
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


        // get file from local examdirectory and replace editor content with it
        async loadDOCX(file){
            this.LTdisable()
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
                    let data = await ipcRenderer.invoke('getfilesasync', file, false, true )   //signal, filename, audiofile, docxfile
                    
                    //replace editor content ??? or not ??
                    this.editor.commands.clearContent(true)
            
                    const cleanHtml = DOMPurify.sanitize(data.value);
                    const body = this.parseHTMLString(cleanHtml);
                    
                    this.editor.commands.insertContent(cleanHtml)
                   // body.childNodes.forEach(node => {  this.processNode(node); });
                } 
            }); 
        },
        processNode(node) {           
            let nodestring = node.innerHTML
            let outernodestring = node.outerHTML
           
            if (nodestring.includes("data:image")){
                for (let childnode of node.childNodes){
                    let childnodestring = childnode.outerHTML
                    if (childnodestring.includes("data:image")){
                        let childnodesource = childnode.src 
                       
                        this.editor.commands.insertContent(nodestring)
                        this.editor.chain().focus().setImage({ src:  childnodesource }).run();
                    }
                }
            }
            else if (nodestring.includes("tr")){
                console.log("found table")
                this.editor.commands.insertContent(outernodestring)
            }

            else {
               
                this.editor.commands.insertContent(outernodestring)
            }
        },

        parseHTMLString(htmlString) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');

            doc.querySelectorAll('td').forEach(td => {
                if (!td.innerHTML.trim()) {
                td.innerHTML = '<p></p>'; // Ensure empty cells have a paragraph with a line break
                }
            });
            return doc.body;
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
            pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0`);

            if (this.splitview) {
                this.currentPDFData = data
                this.currentPDFZoom = 80
                const zoomInButton = document.getElementById("zoomIn");
                const zoomOutButton = document.getElementById("zoomOut");
                const pdfZoom = document.getElementById("pdfZoom");
                pdfZoom.style.display = "block"

                // Entferne bestehende Event-Listener, bevor neue hinzugefügt werden
                zoomInButton.removeEventListener('click', this.zoomInHandler);
                zoomOutButton.removeEventListener('click', this.zoomOutHandler);

                // Definiere neue Event-Listener
                this.zoomInHandler = () => {
                    let pdfEmbed = document.querySelector("#pdfembed");
                    this.currentPDFZoom += 10; // Erhöht den Zoom um 10%
                    URL.revokeObjectURL(this.currentpreview);
                    this.currentpreview = URL.createObjectURL(new Blob([this.currentPDFData], { type: 'application/pdf' }));
                    pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=${this.currentPDFZoom}`);
                };
                this.zoomOutHandler = () => {
                    let pdfEmbed = document.querySelector("#pdfembed");
                    this.currentPDFZoom = Math.max(10, this.currentPDFZoom - 10); // Verhindert, dass der Zoom unter 10% geht
                    URL.revokeObjectURL(this.currentpreview);
                    this.currentpreview = URL.createObjectURL(new Blob([this.currentPDFData], { type: 'application/pdf' }));
                    pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=${this.currentPDFZoom}`);
                };

                // Füge die Event-Listener erneut hinzu
                zoomInButton.addEventListener('click', this.zoomInHandler);
                zoomOutButton.addEventListener('click', this.zoomOutHandler);

                // pdf anzeigen
                pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=${this.currentPDFZoom}`);
            }
<<<<<<< HEAD
=======
            
            

>>>>>>> 8407679ed0b6f2883e83c25e860c9bba1f448ca8
            if(!this.splitview){
                pdfEmbed.style.backgroundImage = '';
                pdfEmbed.style.height = "95vh";
                pdfEmbed.style.width = "67vh";  
            }
            document.querySelector("#preview").style.display = 'block';
            document.querySelector("#insert-button").style.display = 'none';
        },


        // fetch file from disc - show preview
        async loadImage(file){
            URL.revokeObjectURL(this.currentpreview);
            let data = await ipcRenderer.invoke('getpdfasync', file )
            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"})) 
            const pdfEmbed = document.querySelector("#pdfembed");
            
            // Create an image element to determine the dimensions of the image
            // always resize the pdfembed div to the same aspect ratio of the given image
            const img = new window.Image();
            img.onload = function() {
                const width = img.width;
                const height = img.height;
                const aspectRatio = width / height;

                const containerWidth = window.innerWidth * 0.8;
                const containerHeight = window.innerHeight * 0.8;
                const containerAspectRatio = containerWidth / containerHeight;

                if(!this.splitview){
                    if (aspectRatio > containerAspectRatio) {
                        pdfEmbed.style.width = '80vw';
                        pdfEmbed.style.height = `calc(80vw / ${aspectRatio})`;
                    } else {
                        pdfEmbed.style.height = '80vh';
                        pdfEmbed.style.width = `calc(80vh * ${aspectRatio})`;
                    }
                }

                pdfEmbed.style.backgroundImage = `url(${this.currentpreview})`;
            }.bind(this);
            img.src = this.currentpreview;

            // clear the pdf viewer
            pdfEmbed.setAttribute("src", "about:blank");
            document.querySelector("#insert-button").style.display = 'flex';
            document.querySelector("#preview").style.display = 'block';  
            document.querySelector("#pdfZoom").style.display = 'none';
<<<<<<< HEAD
=======

>>>>>>> 8407679ed0b6f2883e83c25e860c9bba1f448ca8
        },

        // show mugshot preview panel
        showInsertMugshot(){
            document.querySelector("#mugshotpreview").style.display = 'block'; 
        },
        // insert mugshot image into editor
        insertMugshot(id){
            const img = document.getElementById(id);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            // Base64-String des Bildes erhalten
            const base64String = canvas.toDataURL('image/png');
            const tableHtml = `<table style="width: 100%; height: 100%;"><tr><td style="max-width: 100%; max-height: 100%;"><img src="${base64String}" style="max-width: 100%; max-height: 100%;" class="img-max-size" /></td></tr></table>`;
            this.editor.chain().focus().insertContent(tableHtml).run();
        },

        // insert image from workfolder into editor
        async insertImage(file){
            let data = await ipcRenderer.invoke('getpdfasync', file, true )   //fileurl, image=true > delivers an image as base64string
            const base64String = this.uint8ArrayToBase64(data);
            const imgSrc = `data:image/png;base64,${base64String}`;
           // this.editor.chain().focus().setImage({ src: imgSrc }).run()
            const tableHtml = `<table style="width: 100%; height: 100%;"><tr><td style="max-width: 100%; max-height: 100%;"><img src="${imgSrc}" style="max-width: 100%; max-height: 100%;" class="img-max-size" /></td></tr></table>`;
            this.editor.chain().focus().insertContent(tableHtml).run();
        },
        uint8ArrayToBase64(uint8Array) {
            let binary = '';
            const len = uint8Array.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            return btoa(binary);
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
            div.appendChild(range.cloneContents()); // Fügt den ausgewählten Bereich zum Div-Element hinzu

            this.selectedText = div.innerHTML
           // this.selectedText = div.innerHTML.replace(/<\s*p[^>]*>/gi, '').replace(/<\/\s*p\s*>/gi, '<br>'); // Ersetzt <p> durch <br>

        },
        pasteSelection(){
            if (!this.selectedText || this.selectedText == "") {return}
            console.log("[pasteSelection] pasted:",this.selectedText)
            
            this.editor.commands.insertContent(this.selectedText, { parseOptions: { preserveWhitespace: 'full' } });
            // FIXME:  einfügen in den editor (auch ohne tiptap command) verursacht ein <p> element das nicht
            // als korrekte node erkannt wird und dann auch beim languagetool parsing irgendwie ignoriert wird
            // wenn ich der bewussten textnode ein wort hinzufüge bzw. irgendwas veränder wird das wort auch indieser map
            // aufgeführt
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
        //switch from ovewlay pdf/jpg preview zu splitview mode
        async toggleSplitview(){
            this.splitview = !this.splitview;


            if (this.splitview === false){
                await this.sleep(1000) //wait for re-rendering of #preview div 
                document.querySelector("#preview").addEventListener("click", function() {  
                    this.style.display = 'none';
                    this.setAttribute("src", "about:blank");
                    URL.revokeObjectURL(this.currentpreview);
                });
            }
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
        async sendFocuslost(){
            let response = await ipcRenderer.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
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
                    Typography,
                   
                    Image.configure({
                         inline: true,
                         allowBase64: true,
                    }),
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

        document.querySelector("#mugshotpreview").addEventListener("click", function() {  
            this.style.display = 'none';
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
        
        // update LThighlights positions on scroll
        document.getElementById('editormaincontainer').addEventListener('scroll', this.LTupdateHighlights, { passive: true });

        // block editor on escape
        document.body.addEventListener('mouseleave', this.sendFocuslost);


    },
    beforeMount(){ },
    beforeUnmount() {
        /**
        *   REMOVE EVENT LISTENERS
        */
        this.editorcontentcontainer.removeEventListener('keydown', this.insertSpaceInsteadOfTab)
        this.editorcontentcontainer.removeEventListener('contextmenu', this.getWord );


        //document.removeEventListener('input', this.checkAllWordsOnSpacebar)
        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        document.removeEventListener('click', this.hideSpellcheckMenu);
        this.editorcontentcontainer.removeEventListener('mouseup',  this.getSelectedTextInfo );
        

        document.getElementById('editormaincontainer').removeEventListener('scroll', this.LTupdateHighlights, { passive: true });

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





















<!-- achtung.. dieser style ist nicht scoped und hat daher auswirkungen auf alle anderen exam modi - testen und scopen oder gleich global arbeiten -->
<style lang="scss">

@media print {  //this controls how the editor view is printed (to pdf)
    #editortoolbar, #mugshotpreview, #apphead, #editselected, #editselectedtext, #focuswarning, .focus-container, #specialcharsdiv, #aplayer,  span.NXTEhighlight::after, #highlight-layer, #languagetool  {
        display: none !important;
    }
    body {position: relative  !important;}  //body ist "fixed" um beim autoscrollen nicht zu verscheben - mehrseitiger print wird dadurch aber auf 1seite beschränkt

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



#mugshotpreview {
    display: none;
    position: absolute;
    top:0;
    left: 0;
    width:100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
}

.mugshot-container {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 114px;
  width: 100vw;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #eeeeee;
  padding: 20px;

}

.mugshot {
    width: 56px;
    z-index:100002;
    transition: .2s;
    cursor: pointer;
}
.mugshot:hover{
    margin: 2px;
    width: 66px;
    box-shadow: inset 0 0 15px white;
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
    backdrop-filter: blur(2px);
  
}


#pdfembed {
    background-color: rgba(255, 255, 255, 0.5);
    border: 0px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 15px rgba(22, 9, 9, 0.5);
    border-radius: 6px;
    background-size: 100% 100%;  
    background-repeat: no-repeat;
    background-position: center;
}

.embed-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: flex-start;
}

#insert-button {
  border: none;
  border-radius: 0;
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  padding: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 30px;
}

#insert-button img {
  width: 22px;
  height: 52px;
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

.ProseMirror img {
  max-width: 100%;
  height: auto;
}


.tableWrapper {
  overflow-x: auto;
}

.resize-cursor {
  cursor: ew-resize;
  cursor: col-resize;
}


/** LANGUAGE TOOL STYLES */
#highlight-layer {
    position: absolute; 
    top: 20px ;
    left: 50% ;
    width: var(--js-editorWidth) !important;
    min-height: 60vh;
    pointer-events: none;
}

#languagetool {
    position: fixed;
    z-index: 100000; 
    width: 280px;
    height: 100%;
    right: -282px;
    top: 52px;
    background-color: var(--bs-gray-100);
    box-shadow: -2px 1px 2px rgba(0, 0, 0, 0);
    transition: 0.3s;
    padding: 6px;
    padding-bottom: 100px;
}

#ltcheck {
    position: absolute;
    margin-left: -6px;
    margin-top: 130px;
    padding: 10px;
    background-color: var(--bs-gray-100);
    box-shadow: 1px 2px 2px rgba(0,0,0,0.2);
    width: 160px;
    height: 45px;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    cursor: pointer;
    color:#616161;

    transform: rotate(90deg); 
    transform-origin: top left; 
}
#ltcheck:hover{
    background-color: var(--bs-gray-200);
}
#ltcheck img{
    vertical-align: bottom;

}
#ltcheck #eye {
    width: 20px;
    height: 20px;
    background-size: cover;
    display:inline-block;
    vertical-align: text-bottom;
}

#ltcheck .eyeopen {
    background-image: url('/src/assets/img/svg/eye-fill.svg');
   
}
#ltcheck .eyeclose {
    background-image: url('/src/assets/img/svg/eye-slash-fill.svg');
}

#languagetool .ltscrollarea {
    height: calc(100vh - 52px);
    width: 268px;
    overflow-x: hidden;
    overflow-y: auto;
    position: absolute;
    top: 0px;
    padding-top: 20px;
    padding-bottom: 20px;
}

#languagetool .error-entry {
    margin: 10px;
    padding: 10px;
    border-radius: 8px;
    background-color:   rgb(238, 238, 250);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 0.8em;
    cursor: pointer;
}

#languagetool .error-entry:hover {
  background-color:   rgba(238, 238, 250, 0.508);
}

.darkgreen {
    filter: invert(36%) sepia(100%) saturate(2200%) hue-rotate(95deg) brightness(75%);
}
.darkred {
    filter: invert(28%) sepia(99%) saturate(7476%) hue-rotate(345deg) brightness(65%);

}
#languagetool .error-word {
  padding: 5px;
  border: none;
  background-color: transparent;
  color: var(--bs-info-text-emphasis);
  font-size: 1.1em;
  display: inline-block;
 
}

#languagetool .color-circle {
  height: 10px;
  width: 10px;
  border-radius: 50%;
  display: inline-block;
}

#languagetool .replacement {
    padding: 2px;
    padding-left: 0px;
    margin-top: 4px;
    border-top: 1px solid var(--bs-cyan);
    color: var(--bs-green);
    border-radius: 0px;
}








</style>
