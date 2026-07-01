<template>
    <div class="editor-root">

    <!-- HEADER START -->
    <exam-header
        @reconnect="reconnect"
        @gracefullyExit="gracefullyExit"
        @sectionSwitched="fetchInfo"
    ></exam-header>
    <!-- HEADER END -->


    <div class="w-100 p-0 m-0 text-white shadow-sm text-center"
         style="top: 66px; z-index: 10001 !important; background-color: white;">

        <!-- toolbar start -->
        <div v-if="editor" class="m-2" id="editortoolbar" style="text-align:left;">
            <button :title="$t('editor.backup')" @click="saveContent(true, 'manual');"
                    class="invisible-button btn btn-outline-success p-1 me-1 mb-1 btn-sm"><img
                src="/src/assets/img/svg/document-save.svg" class="white" width="22" height="22"></button>
            <!-- <button :title="$t('editor.print')" @click="sendExamToTeacher();" class="invisible-button btn btn-outline-success p-1 me-1 mb-1 btn-sm"><img src="/src/assets/img/svg/print.svg" class="white" width="22" height="22" ></button> -->
            <button :title="$t('editor.undo')" @click="editor.chain().focus().undo().run()"
                    class="invisible-button btn btn-outline-warning p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/edit-undo.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.redo')" @click="editor.chain().focus().redo().run()"
                    class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/edit-redo.svg" class="white" width="22" height="22"></button>

            <button :title="$t('editor.copy')" @click="copySelection()"
                    class="invisible-button btn btn-outline-success p-1 mb-1 btn-sm"><img
                src="/src/assets/img/svg/edit-copy.svg" class="" width="22" height="22"></button>
            <button :title="$t('editor.cut')" @click="cutSelection()"
                    class="invisible-button btn btn-outline-success p-1 mb-1 btn-sm"><img
                src="/src/assets/img/svg/document-replace.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.paste')" @click="pasteSelection()"
                    class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/edit-paste.svg" class="white" width="22" height="22"></button>


            <button :title="$t('editor.clear')"
                    @click="clearFormatting()"
                    class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/draw-eraser.svg" class="white" width="22" height="22"></button>

            <button :title="$t('editor.bold')" @click="editor.chain().focus().toggleBold().run()"
                    :class="{ 'is-active': editor.isActive('bold') }"
                    class="invisible-button btn btn-outline-success p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-text-bold.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.italic')" @click="editor.chain().focus().toggleItalic().run()"
                    :class="{ 'is-active': editor.isActive('italic') }"
                    class="invisible-button btn btn-outline-success p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-text-italic.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.underline')" @click="editor.chain().focus().toggleUnderline().run()"
                    :class="{ 'is-active': editor.isActive('underline') }"
                    class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm "><img
                src="/src/assets/img/svg/format-text-underline.svg" class="white" width="22" height="22"></button>

            <!-- <button :title="$t('editor.heading1')" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
                    :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/h1.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading2')" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
                    :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/h2.svg" width="22" height="22"></button> -->
            <button :title="$t('editor.heading3')" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
                    :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/h3.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading4')" @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
                    :class="{ 'is-active': editor.isActive('heading', { level: 4 }) }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/h4.svg" width="22" height="22"></button>
            <button :title="$t('editor.heading5')" @click="editor.chain().focus().toggleHeading({ level: 5 }).run()"
                    :class="{ 'is-active': editor.isActive('heading', { level: 5 }) }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/h5.svg" width="22" height="22"></button>
            <!-- <button :title="$t('editor.heading6')" @click="editor.chain().focus().toggleHeading({ level: 6 }).run()"
                    :class="{ 'is-active': editor.isActive('heading', { level: 6 }) }"
                    class="invisible-button btn btn-outline-secondary p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/h6.svg" width="22" height="22"></button> -->


            <button :title="$t('editor.subscript')" @click="editor.chain().focus().toggleSubscript().run()"
                    :class="{ 'is-active': editor.isActive('subscript') }"
                    class="invisible-button btn btn-outline-success p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-text-subscript.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.superscript')" @click="editor.chain().focus().toggleSuperscript().run()"
                    :class="{ 'is-active': editor.isActive('superscript') }"
                    class="invisible-button btn btn-outline-success p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-text-superscript.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.bulletlist')" @click="editor.chain().focus().toggleBulletList().run()"
                    :class="{ 'is-active': editor.isActive('bulletList') }"
                    class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-list-unordered.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.list')" @click="editor.chain().focus().toggleOrderedList().run()"
                    :class="{ 'is-active': editor.isActive('orderedList') }"
                    class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-list-ordered.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.codeblock')" @click="editor.chain().focus().toggleCodeBlock().run()"
                    :class="{ 'is-active': editor.isActive('codeBlock') }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/dialog-xml-editor.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.code')" @click="editor.chain().focus().toggleCode().run()"
                    :class="{ 'is-active': editor.isActive('code') }"
                    class="invisible-button btn btn-outline-secondary p-1 me-0 mb-1  btn-sm"><img
                src="/src/assets/img/svg/code-context.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.blockquote')" @click="editor.chain().focus().toggleBlockquote().run()"
                    :class="{ 'is-active': editor.isActive('blockquote') }"
                    class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-text-blockquote.svg" class="white" width="22" height="22"></button>

            <button :title="$t('editor.left')" @click="editor.chain().focus().setTextAlign('left').run()"
                    :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
                    class="invisible-button btn btn-outline-info  p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-justify-left.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.center')" @click="editor.chain().focus().setTextAlign('center').run()"
                    :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
                    class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm "><img
                src="/src/assets/img/svg/format-justify-center.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.right')" @click="editor.chain().focus().setTextAlign('right').run()"
                    :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
                    class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/format-justify-right.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.justify')" @click="editor.chain().focus().setTextAlign('justify').run()" 
                    :class="{ 'is-active': editor.isActive({ textAlign: 'justify' }) }" 
                    class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img 
                src="/src/assets/img/svg/format-justify-fill.svg" class="white" width="22" height="22" ></button>





            <input :title="$t('editor.textcolor')" type="color" @input="handleColorInput"
                   :value="getHexColor || '#000000'" class="invisible-button btn btn-outline-info p-2 me-2 mb-1 btn-sm"
                   style="height: 33.25px; width:32px">



                   

            <button :title="$t('editor.specialchar')" @click="showInsertSpecial();this.LTdisable()"
                    class="invisible-button btn btn-outline-warning p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/sign.svg" class="" width="22" height="22"></button>
            <button :title="$t('editor.insertmug')" @click="showInsertMugshot();this.LTdisable()"
                    class="invisible-button btn btn-outline-warning p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/person-fill.svg" class="" width="22" height="22"></button>
            <button :title="$t('editor.linebreak')" @click="editor.chain().focus().setHardBreak().run()"
                    class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/key-enter.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.line')" @click="editor.chain().focus().setHorizontalRule().run()"
                    class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                src="/src/assets/img/svg/newline.svg" class="white" width="22" height="22"></button>
            <button :title="$t('editor.statsrule')" @click="editor.chain().focus().setStatsRule().run()"
                    class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/statsbreaker.svg" class="" width="22" height="22"></button>

            <button :title="$t('editor.more')" id="more" @click="showMore();this.LTdisable()"
                    class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img
                src="/src/assets/img/svg/view-more-horizontal-symbolic.svg" class="white" width="22" height="22">
            </button>
            <div id="moreoptions" style="display:none;">
                <button :title="$t('editor.inserttable')"
                        @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/insert-table.svg" width="22" height="22"></button>
                <button :title="$t('editor.deletetable')" @click="editor.chain().focus().deleteTable().run()"
                        :disabled="!editor.can().deleteTable()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/deletecell.svg" width="22" height="22"></button>
                <button :title="$t('editor.columnafter')" @click="editor.chain().focus().addColumnAfter().run()"
                        :disabled="!editor.can().addColumnAfter()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/edit-table-insert-column-right.svg" width="22" height="22"></button>
                <button :title="$t('editor.rowafter')" @click="editor.chain().focus().addRowAfter().run()"
                        :disabled="!editor.can().addRowAfter()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/edit-table-insert-row-below.svg" width="22" height="22"></button>
                <button :title="$t('editor.delcolumn')" @click="editor.chain().focus().deleteColumn().run()"
                        :disabled="!editor.can().deleteColumn()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/edit-table-delete-column.svg" width="22" height="22"></button>
                <button :title="$t('editor.delrow')" @click="editor.chain().focus().deleteRow().run()"
                        :disabled="!editor.can().deleteRow()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/edit-table-delete-row.svg" width="22" height="22"></button>
                <button :title="$t('editor.mergeorsplit')" @click="editor.chain().focus().mergeOrSplit().run()"
                        :disabled="!editor.can().mergeOrSplit()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/edit-table-cell-merge.svg" width="22" height="22"></button>
                <button :title="$t('editor.headercolumn')" @click="editor.chain().focus().toggleHeaderColumn().run()"
                        :disabled="!editor.can().toggleHeaderColumn()"
                        class="invisible-button btn btn-outline-info p-1 me-0 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/table-header-left.svg" width="22" height="22"></button>
                <button :title="$t('editor.headerrow')" @click="editor.chain().focus().toggleHeaderRow().run()"
                        :disabled="!editor.can().toggleHeaderRow()"
                        class="invisible-button btn btn-outline-info p-1 me-2 mb-1 btn-sm"><img
                    src="/src/assets/img/svg/table-header-top.svg" width="22" height="22"></button>
            </div>

            <div id="specialcharsdiv" style="display:none">
                <!-- Spanish / French / Italian basics -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('¿')" style="width:28px; ">¿</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('¡')" style="width:28px; ">¡</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ñ')" style="width:28px; ">ñ</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ç')" style="width:28px; ">ç</div>

                <!-- Common symbols -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('–')" style="width:28px; ">–</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('…')" style="width:28px; ">…</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('^')" style="width:28px; ">^</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('€')" style="width:28px; ">€</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('$')" style="width:28px; ">$</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('°')" style="width:28px; ">°</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('§')" style="width:28px; ">§</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('©')" style="width:28px; ">©</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('™')" style="width:28px; ">™</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('µ')" style="width:28px; ">µ</div>

                <!-- Quotes -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('„')" style="width:28px; ">„</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('“')" style="width:28px; ">“</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('‚')" style="width:28px; ">‚</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('‘')" style="width:28px; ">‘</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('«')" style="width:28px; ">«</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('»')" style="width:28px; ">»</div>

                <!-- Accented vowels (Spanish / Italian / French) -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('á')" style="width:28px; ">á</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('é')" style="width:28px; ">é</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('í')" style="width:28px; ">í</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ó')" style="width:28px; ">ó</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ú')" style="width:28px; ">ú</div>

                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('à')" style="width:28px; ">à</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('è')" style="width:28px; ">è</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ì')" style="width:28px; ">ì</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ò')" style="width:28px; ">ò</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ù')" style="width:28px; ">ù</div>

                <!-- French circonflexe vowels -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('â')" style="width:28px; ">â</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ê')" style="width:28px; ">ê</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('î')" style="width:28px; ">î</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ô')" style="width:28px; ">ô</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('û')" style="width:28px; ">û</div>


                <!-- French special chars & ligatures (lowercase) -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('æ')" style="width:28px; ">æ</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ë')" style="width:28px; ">ë</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('ï')" style="width:28px; ">ï</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('œ')" style="width:28px; ">œ</div>

                <!-- Accented vowels and specials (uppercase) -->
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('À')" style="width:28px; ">À</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Â')" style="width:28px; ">Â</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Æ')" style="width:28px; ">Æ</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ç')" style="width:28px; ">Ç</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('É')" style="width:28px; ">É</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('È')" style="width:28px; ">È</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ê')" style="width:28px; ">Ê</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ë')" style="width:28px; ">Ë</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Î')" style="width:28px; ">Î</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ï')" style="width:28px; ">Ï</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ô')" style="width:28px; ">Ô</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ò')" style="width:28px; ">Ò</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Œ')" style="width:28px; ">Œ</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Ù')" style="width:28px; ">Ù</div>
                <div class="btn btn-outline-secondary btn-sm invisible-button" @click="insertSpecialchar('Û')" style="width:28px; ">Û</div>


            </div>


            <div>

                <div :title="$t('editor.splitview')" @click="toggleSplitview()"
                     class="invisible-button btn btn-outline-warning p-0 ms-1 me-1 mb-0 btn-sm"><img
                    src="/src/assets/img/svg/view-split-left-right.svg" class="white" width="22" height="22"></div>

                <div v-if="!localLockdown" id="printfinalexam"
                     class="invisible-button btn btn-outline-success p-0 ms-1 me-1 mb-0 btn-sm pe-2 ps-1" 
                     @click="sendExamToTeacher(false, 'print')" :title="$t('editor.printTooltip')"><img
                    src="/src/assets/img/svg/print.svg" class="white" width="22" height="22"
                    style="vertical-align: top;"> {{ $t('editor.print') }}
                </div>
                <div v-if="!localLockdown" id="sendfinalexam"
                     class="invisible-button btn btn-outline-success p-0 ms-1 me-1 mb-0 btn-sm pe-2 ps-1 "
                     @click="sendExamToTeacher(false, 'send')" :title="$t('editor.sendfinalexam')"><img
                    src="/src/assets/img/svg/document-send.svg" class="white" width="22" height="22"
                    style="vertical-align: top;"> {{ $t('editor.finalsubmit') }}
                </div>


                <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
                <div id="getmaterialsbutton"
                     class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img
                    src="/src/assets/img/svg/games-solve.svg" class="white" width="22" height="22"
                    style="vertical-align: top;"> {{ $t('editor.materials') }}
                </div>

                <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
                    <div v-if="(file.filetype == 'htm')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.filename; loadBase64file(file)"><img
                        src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22"
                        style="vertical-align: top;"> {{ file.filename }}
                    </div>
                    <div v-if="(file.filetype == 'docx')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.filename; loadBase64file(file)"><img
                        src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22"
                        style="vertical-align: top;"> {{ file.filename }}
                    </div>
                    <div v-if="(file.filetype == 'odt')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.filename; loadBase64file(file)"><img
                        src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22"
                        style="vertical-align: top;"> {{ file.filename }}
                    </div>
                    <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.filename; loadBase64file(file)"><img
                        src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                        style="vertical-align: top;"> {{ file.filename }}
                    </div>
                    <div v-if="(file.filetype == 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="loadBase64file(file)"><img src="/src/assets/img/svg/im-google-talk.svg" class=""
                                                            width="22" height="22" style="vertical-align: top;">
                        {{ file.filename }}
                    </div>
                    <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.filename; loadBase64file(file)"><img
                        src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                        style="vertical-align: top;"> {{ file.filename }}
                    </div>
                </div>
                <!-- exam materials end -->


                <div v-if="allowedUrls.length !== 0" v-for="allowedUrl in allowedUrls  "
                     class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button"
                     :title="getUrlDisplay(allowedUrl)" @click="showUrl(getUrlDisplay(allowedUrl))">
                    <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                         style="vertical-align: top;"> {{ getUrlDisplay(allowedUrl) }}
                </div>


                <div
                    class="disabled-btn invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm text-muted">
                    <img src="/src/assets/img/svg/edit-copy.svg" class="" width="22" height="22"
                         style="vertical-align: top;"> {{ $t('editor.localfiles') }}
                </div>





                <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
                 

                    <div v-if="file.type == 'htm'" class="btn btn-mediumlight p-0  pe-2 ps-1 me-1 mb-0 btn-sm" :class="{'bg-warning': file.name == currentFile+'.htm'}" @click="selectedFile=file.name; loadHTML(file.name)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ file.name }}<template v-if="!isActiveLocalHtmFile(file)"> ({{ formatHtmLocalFileAge(file) }})</template></div>


                    <div v-if="(file.type == 'docx')" class="btn btn-mediumlight p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.name; loadDOCX(file.name)"><img
                        src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22"
                        style="vertical-align: top;"> {{ file.name }}
                    </div>

                    <div v-if="(file.type == 'odt')" class="btn btn-mediumlight p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.name; loadODT(file.name)"><img
                        src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22"
                        style="vertical-align: top;"> {{ file.name }}
                    </div>

                    <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                                  class="white" width="22" height="22"
                                                                                  style="vertical-align: top;">
                        {{ file.name }}
                    </div>
                    <div v-if="(file.type == 'audio')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="playAudio(file.name)"><img src="/src/assets/img/svg/im-google-talk.svg" class=""
                                                            width="22" height="22" style="vertical-align: top;">
                        {{ file.name }}
                    </div>
                    <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                         @click="selectedFile=file.name; loadImage(file.name)"><img
                        src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22"
                        style="vertical-align: top;"> {{ file.name }}
                    </div>
                </div>

            </div>

        </div>
        <!-- toolbar end -->
    </div>


    <!-- mugshot preview start -->
    <div id="mugshotpreview">
        <div class="mugshot-container">
            <img @click="insertMugshot('mug1')" id="mug1" src="/src/assets/img/mugshots/1.png" class="mugshot">
            <img @click="insertMugshot('mug2')" id="mug2" src="/src/assets/img/mugshots/2.png" class="mugshot">
            <img @click="insertMugshot('mug3')" id="mug3" src="/src/assets/img/mugshots/3.png" class="mugshot">
            <img @click="insertMugshot('mug4')" id="mug4" src="/src/assets/img/mugshots/4.png" class="mugshot">
            <img @click="insertMugshot('mug5')" id="mug5" src="/src/assets/img/mugshots/5.png" class="mugshot">
            <img @click="insertMugshot('mug6')" id="mug6" src="/src/assets/img/mugshots/6.png" class="mugshot">
            <img @click="insertMugshot('mug7')" id="mug7" src="/src/assets/img/mugshots/7.png" class="mugshot">
            <img @click="insertMugshot('mug8')" id="mug8" src="/src/assets/img/mugshots/8.png" class="mugshot">
            <img @click="insertMugshot('mug9')" id="mug9" src="/src/assets/img/mugshots/9.png" class="mugshot">
            <img @click="insertMugshot('mug10')" id="mug10" src="/src/assets/img/mugshots/10.png" class="mugshot">
            <img @click="insertMugshot('mug11')" id="mug11" src="/src/assets/img/mugshots/11.png" class="mugshot">
            <img @click="insertMugshot('mug12')" id="mug12" src="/src/assets/img/mugshots/12.png" class="mugshot">
        </div>
    </div>
    <!-- mugshot preview end -->


    <!-- focus warning start -->
    <div v-if="!focus" ref="focusWarningOverlay" tabindex="-1"  class="focus-container">
        <div id="focuswarning" class="infodiv p-4 d-block focuswarning">
            <div class="mb-3 row">
                <div class="mb-3 "> {{ $t('editor.leftkiosk') }} <br> {{ $t('editor.tellsomeone') }}</div>
                <div v-if="focusLostMessage || focusLockMessage" class="mb-3 text-dark fw-bold" style="white-space: pre-line">{{ focusLostMessage || focusLockMessage }}</div>
                <div v-if="focusLockReasonLine" class="mb-3 text-dark fw-bold">{{ focusLockReasonLine }}</div>
                <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32">
            </div>
            <div v-if="localLockdown" class="mt-2">
                <div class="input-group">
                    <span class="input-group-text">{{ $t('student.password') }}</span>
                    <input
                        ref="localUnlockInput"
                        v-model="localUnlockPassword"
                        class="form-control"
                        type="password"
                        autocomplete="current-password"
                        :placeholder="$t('student.password')"
                        @input="localUnlockError = false"
                        @keyup.enter="tryUnlockLocalLockdown"
                    >
                    <button class="btn btn-outline-dark" type="button" :disabled="localUnlockBusy" @click="tryUnlockLocalLockdown">
                        {{ $t('editor.unlock') }}
                    </button>
                </div>
                <div v-if="localUnlockError" class="mt-2 text-dark">
                    {{ $t("general.wrongpassword") }}
                </div>
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
        <button id="audioclose" type="button" class="btn-close" style="vertical-align: top;" title="close"></button>
    </div>
    <!-- AUDIO Player end -->


    <!-- NORMAL VIEW START -->
    <!-- PDF Preview Container -->
    <div v-if="!splitview" id="preview" class="p-4 editor-preview-overlay" style="--nx-preview-top-offset: 60px;">
        <WebviewPane
            id="webview"
            :src="urlForWebview"
            :visible="webviewVisible"
            :splitview="splitview"
            :showClose="!splitview"
            :allowed-url="urlForWebview"
            :block-external="true"
            @close="hidepreview"
        />

        <PdfviewPaneRendered
            :localLockdown="localLockdown"
            :examtype="examtype"
            :toolbar="pdfPreviewUi"
            :preview="pdfPreviewState"
            @close="hidepreview"
            @printBase64="(pr) => printBase64(pr, 'manual')"
            @insertImage="insertImage"
        />

    </div>
    <!-- Editor Container -->
    <div v-if="!splitview" id="editormaincontainer"
         style="height: 100%; overflow-x:auto; overflow-y: auto; background-color: #eeeefa;">
        <div id="editorcontainer" class="shadow" style="">
            <!-- Wrapper with dynamic key so EditorContent is not hoisted and ref owner context is preserved -->
            <div v-if="editor" :key="'main-' + (editor ? 'ready' : '')">
                <editor-content :editor="editor" class='p-0' id="editorcontent"
                                style="background-color: #fff; border-radius:0;"/>
            </div>
        </div>
        <canvas id="highlight-layer"></canvas>
    </div>
    <!-- NORMAL VIEW END -->


    <!-- SPLITVIEW START -->
    <div v-if="splitview" class="split-view-container">
        <!-- PDF Preview Container -->
        <div
            id="preview"
            :class="['fadeinfast', 'splitback', 'split-pane', 'split-pane--left', 'p-0', { 'splitback--empty': !pdfPreviewState }]"
            :style="{ flexBasis: splitLeftPct + '%', '--nx-preview-scroll-padding': '6px' }"
        >
            <WebviewPane
                id="webview"
                :src="urlForWebview"
                :visible="webviewVisible"
                :splitview="splitview"
                :showClose="!splitview"
                :allowed-url="urlForWebview"
                :block-external="true"
            />
            <PdfviewPaneRendered
                :localLockdown="localLockdown"
                :examtype="examtype"
                :toolbar="pdfPreviewUi"
                :preview="pdfPreviewState"
                :showClose="false"
                :style="!pdfPreviewState ? 'display:none;' : ''"
                @close="hidepreview"
                @printBase64="(pr) => printBase64(pr, 'manual')"
                @insertImage="insertImage"
            />
        </div>
        <div
            class="split-divider"
            role="separator"
            aria-orientation="vertical"
            :aria-valuenow="Math.round(splitLeftPct)"
            aria-valuemin="20"
            aria-valuemax="80"
            @pointerdown.prevent="startSplitResize"
            title="Drag to resize"
        ></div>
        <!-- Editor Container -->
        <div id="editormaincontainer" class="split-pane split-pane--right"
             style="padding:10px; overflow-x: auto !important; overflow-y: auto !important; background-color: #eeeefa !important;">
            <div id="editorcontainer" class="shadow">
                <!-- Wrapper with dynamic key so EditorContent is not hoisted and ref owner context is preserved -->
                <div v-if="editor" :key="'split-' + (editor ? 'ready' : '')">
                    <editor-content :editor="editor" class="p-0" id="editorcontent"
                                    style="background-color: #fff !important; border-radius: 0 !important;"/>
                </div>
            </div>
            <canvas id="highlight-layer"></canvas>
        </div>
    </div>
    <!-- SPLITVIEW END -->


    <!-- CLIPBOARD SIDEBAR START -->
    <div id="clipboard-sidebar" :class="{ visible: showClipboardSidebar }">
        <div class="clipboard-header">
            <span>{{ $t('editor.clipboard') }}</span>
            <button type="button" class="btn-close btn-close-sm" @click="showClipboardSidebar = false" :title="$t('editor.close')"></button>
        </div>
        <div class="clipboard-list">
            <div v-if="clipboardHistory.length === 0" class="clipboard-empty">{{ $t('editor.clipboardEmpty') }}</div>
            <div v-for="(item, idx) in clipboardHistory" :key="idx" class="clipboard-item" @click="pasteFromClipboard(item)"
                 @mouseenter="clipboardTooltipShow($event, clipboardPreviewFull(item))"
                 @mouseleave="clipboardTooltipHide">
                <span class="clipboard-item-text">{{ clipboardPreview(item) }}</span>
            </div>
        </div>
    </div>
    <!-- CLIPBOARD SIDEBAR END -->

    <Teleport to="body">
        <div v-if="clipboardTooltip.shown" class="clipboard-tooltip-fixed"
             :style="{ left: clipboardTooltip.x + 'px', top: clipboardTooltip.y + 'px' }">
            {{ clipboardTooltip.text }}
        </div>
    </Teleport>


    <!-- LANGUAGE TOOL START -->
    <div id="languagetool"
         v-if="showLanguageToolSidebar">
        <div id="ltcheck" @click="LTcheckAllWordsAndHighlight();">
            <div id="eye" class="darkgreen eyeopen"></div> &nbsp;LanguageTool
        </div>
        <div class="ltscrollarea">

            <div style="display:flex;align-items: center; width:100%; margin-bottom:20px; flex-wrap:wrap; gap:6px;">
                <button type="button" class="btn btn-sm btn-cyan" style="margin-left:10px;"
                        @click="LTcheckAllWordsAndHighlight(false)">{{ $t('editor.update') }}</button>
                <div v-if="ltExternalHost" class="btn-group btn-group-sm" role="group"
                     :aria-label="$t('editor.ltEndpointGroup')">
                    <button type="button" class="btn"
                            :class="!ltUseExternal ? 'btn-teal' : 'btn-outline-secondary'"
                            @click="toggleLtEndpoint(false)">{{ $t('editor.ltLocal') }}</button>
                    <button type="button" class="btn"
                            :class="ltUseExternal ? 'btn-teal' : 'btn-outline-secondary'"
                            @click="toggleLtEndpoint(true)">{{ $t('editor.ltExternal') }}</button>
                </div>
                <div class="" style="flex:1; text-align:right;"
                     @click="LTresetIgnorelist();LTcheckAllWordsAndHighlight(false);" title="Clear ignore list">
                    <span v-if="ignoreList.size > 0" class="text-mini"> ({{ ignoreList.size }}) ignored</span>
                    <img class="white" width=20 height=20 src="/src/assets/img/svg/edit-delete.svg"
                         style=" cursor: pointer; margin-left:3px; vertical-align: middle;">
                </div>
            </div>

            <div style="margin: 0 10px 10px 10px; font-size: 0.8em;">
                <select v-model="ltLanguage" class="form-select form-select-sm">
                    <option v-for="(label, code) in ltLanguageOptions" :key="code" :value="code">
                        {{ label }}
                    </option>
                </select>
            </div>


            <div v-if="misspelledWords.length == 0" style="text-align: left; font-size: 0.8em; margin-left:10px;">
                {{ this.LTinfo }}
            </div>

            <div v-if="spellcheckFallback && !ltUseExternal"
                 style="text-align: left; font-size: 0.8em;margin-left:10px; display:flex; align-items:center; gap:8px;">
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="retryLanguageToolStart"
                        :disabled="ltStartInProgress">
                    LanguageTool starten
                </button>
            </div>

            <div v-for="entry in misspelledWords" :key="entry.wrongWord" class="error-entry" @click="LTshowWord(entry)">

                <div style="display:flex;align-items: center; width:100%; ">
                    <div :style="'background-color:' + entry.color " class="color-circle"
                         style="width: 10px; height: 10px;"></div>
                    <div class="error-word" style="flex:1">{{ entry.wrongWord }} <span v-if="entry.whitespace">' &nbsp;  '</span>
                    </div>
                    <div class="" style=" flex: 0; cursor: not-allowed;  text-align:right; "
                        @click="LTignoreWord(entry);LTcheckAllWordsAndHighlight(false);" title="ignore">
                        <img class="grey" width=18 height=18 src="/src/assets/img/svg/eye-slash-fill.svg">
                    </div>
                </div>

                <div v-if="entry.message" class="fw-bold">{{ entry.rule.category.name }}</div>
                <div
                    v-if="getEditorExamConfig(lockedSection).suggestions || privateSpellcheck.suggestions">
                    <div v-if="entry.message">{{ entry.message }}</div>
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


    <div id="statusbar" style="padding-left:15px;padding-right:8px;">
        <div class="statusbar-left">
            <!-- Static text with v-once to prevent re-rendering since $t apparently performs performance measures each time causing memory bloat -->
            <span ref="statusWordCount">0</span> <span v-once>{{ $t("editor.words") }}</span>,  <span ref="statusCharCount">0</span> <span v-once>{{$t("editor.chars")}}</span>
            &nbsp; 
            <span v-once id="editselectedtext">| &nbsp; {{ $t("editor.selected") }}: </span> <span
                id="editselected"> {{ selectedWordCount }}/{{ selectedCharCount }}</span>
        </div>
        <div class="statusbar-right">
            <span class="caret-context-label" :title="caretContextLabel">{{ caretContextLabel }}</span>
            <img @click="zoomin(); LTupdateHighlights();" src="/src/assets/img/svg/zoom-in.svg" class="zoombutton">
            <img @click="zoomout(); LTupdateHighlights();" src="/src/assets/img/svg/zoom-out.svg" class="zoombutton">
        </div>
    </div>
    <!-- EDITOR END -->
    </div>
</template>

<script>
import {Editor, EditorContent, VueNodeViewRenderer} from '@tiptap/vue-3'
import {NodeSelection} from '@tiptap/pm/state'
import Image from '@tiptap/extension-image';

/** Base Image node drops width/height/style on parse; ODT import and round-tripped HTML need them preserved. */
const ImageWithDimensions = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute('width'),
                renderHTML: (attributes) => {
                    if (!attributes.width) return {};
                    return { width: attributes.width };
                },
            },
            height: {
                default: null,
                parseHTML: (element) => element.getAttribute('height'),
                renderHTML: (attributes) => {
                    if (!attributes.height) return {};
                    return { height: attributes.height };
                },
            },
            style: {
                default: null,
                parseHTML: (element) => element.getAttribute('style'),
                renderHTML: (attributes) => {
                    if (!attributes.style) return {};
                    return { style: attributes.style };
                },
            },
        };
    },
});

/** Paragraph drops inline styles on parse; ODT import uses per-paragraph line-height. */
const ParagraphWithLineHeight = Paragraph.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            lineHeight: {
                default: null,
                parseHTML: (element) => element.style?.lineHeight || null,
                renderHTML: (attributes) => {
                    if (!attributes.lineHeight) return {};
                    return { style: `line-height: ${attributes.lineHeight}` };
                },
            },
        };
    },
});
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
import { StatsRule } from '../components/statsRule.ts'
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
import CharacterCount from "@tiptap/extension-character-count"
import History from '@tiptap/extension-history'
import Typography from '@tiptap/extension-typography'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import {SmilieReplacer} from '../components/SmilieReplacer.ts'
// import { CharReplacer } from '../components/CharReplacer'
import {common, createLowlight} from 'lowlight'
import {Color} from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import ExamHeader from '../components/ExamHeader.vue';
import WebviewPane from '../components/WebviewPane.vue'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'

import {
    LTcheckAllWords,
    LTdisable,
    LTfindWordPositions,
    LThandleMisspelled,
    LThighlightWords,
    LTignoreWord,
    LTresetIgnorelist,
    LTbuildOffsetMap,
    LTfindByOffsetMap,
} from '../utils/languagetool.js'
import {getExamMaterials, loadDOCX, loadHTML, loadImage, loadODT, loadPDF, playAudio, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import {gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'

import {SignalBridge} from '../utils/signalBridge.js'
import {
    attachExamMouseleaveGuardBoolean,
    shouldSkipEdgeFocusLost
} from '../utils/linuxCageKiosk.js'
import { examApiFetch } from 'next-exam-shared/examApiFetch.js'
import {
    applyClientinfoFromFetch,
    applyServerstatusFromFetch,
    applyFocusLostFromIpc,
    resolveLockedSection,
    formatFocusLostTime,
} from '../utils/examFetchInfoSync.js'
import { resolveEditorExamConfig, DEFAULT_EDITOR_EXAM_CONFIG } from 'next-exam-shared/editorExamConfig.js'
import {autoCleanupMixin} from "../mixins/autoCleanupMixin.ts";
import {ref} from "vue";
import {useConfigStore} from "../stores/configStore.ts";
import {useInfoStore} from "../stores/infoStore.ts";
const lowlight = createLowlight(common)

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window)

// Default zoom for #editorcontainer (screen); @media print forces zoom 1 separately.
const EDITOR_ZOOM_INITIAL = 1.6
const EDITOR_ZOOM_MIN = 0.85
const EDITOR_ZOOM_MAX = 2.2

export default {
    components: {
        EditorContent,
        ExamHeader,
        WebviewPane,
        PdfviewPaneRendered
    },
    mixins: [autoCleanupMixin],

    setup() {
      const configStore = useConfigStore();
      let development = ref(configStore.development);
      let serverApiPort = ref(configStore.serverApiPort);
      let electron = ref(configStore.electron);
      let hostip = ref(configStore.hostip);

      const infoStore = useInfoStore();
      infoStore.online = true;
      infoStore.componentName = "Writer";

      let examtype = ref(infoStore.examtype);
      let servername = ref(infoStore.servername);
      let serverip = ref(infoStore.serverip);
      let token = ref(infoStore.token);
      let clientname = ref(infoStore.clientname);
      let serverstatus = ref(infoStore.serverstatus);
      let pincode = ref(infoStore.pincode);
      let localLockdown = ref(infoStore.localLockdown);
      let online = ref(infoStore.online);
      let battery = ref(infoStore.battery);
      let wlanInfo = ref(infoStore.wlanInfo);
      let entrytime = ref(infoStore.entryTime);
      let componentName = ref(infoStore.componentName);

       return { development, serverApiPort, electron, hostip,
        examtype, servername, serverip, token, clientname, serverstatus, pincode, localLockdown, online, battery, wlanInfo, entrytime, componentName};
    },

    data() {
        const status = this.$route.params.serverstatus;
        let activeSection = {};
        if (status?.examSections) {
            // localLockdown: useExamSections === false → section 1 wird verwendet
            if (status.useExamSections === false && status.examSections[1]) {
                activeSection = status.examSections[1];
            } else {
                const examSections = status.examSections;
                const activeSectionIndex = status.activeSection ?? 0;
                activeSection = examSections[activeSectionIndex] || {};
            }
        }
        const initialEditorCfg = resolveEditorExamConfig(activeSection, 'groupA');
        const ltExternalHost = initialEditorCfg.languagetoolhost || null;
        const ltExternalPort = String(initialEditorCfg.languagetoolport || '8088');
        const ltLocalHost = 'http://127.0.0.1';
        const ltLocalPort = '8088';
        const ltUseExternal = !!ltExternalHost;

        return {
            index: 0,
            focus: true,
            focusLostMessage: '',
            focusLockReason: '',
            focusLockMessage: '',
            exammode: false,
            selectedFile: null,
            currentFile: null,
            editor: null,
            localUnlockPassword: '',
            localUnlockError: false,
            localUnlockBusy: false,
            localfiles: null,
            clientinfo: null,
            caretContextLabel: '',
            zoom: EDITOR_ZOOM_INITIAL,
            proseMirrorMargin: '30mm',
            editorWidth: '210mm',
            cmargin: { ...(initialEditorCfg.cmargin || DEFAULT_EDITOR_EXAM_CONFIG.cmargin) },
            selectedWordCount: 0,
            selectedCharCount: 0,
            currentRange: 0,
            word: "",
            editorcontentcontainer: null,
            editorContent: null,
            linespacing: String(initialEditorCfg.linespacing ?? DEFAULT_EDITOR_EXAM_CONFIG.linespacing),
            fontfamily: initialEditorCfg.fontfamily || DEFAULT_EDITOR_EXAM_CONFIG.fontfamily,
            fontsize: initialEditorCfg.fontsize || DEFAULT_EDITOR_EXAM_CONFIG.fontsize,
            privateSpellcheck: {activate: false, activated: false, suggestions: false}, // this is a per student override (for students with legasthenie)
            individualSpellcheckActivated: false,
            audioSource: null,
            currentpreview: null,
            currentpreviewBase64: null,
            audiofiles: [],
            misspelledWords: [],
            textContainer: null,
            canvas: null,
            ctx: null,
            text: null,
            currentLTword: "",
            currentLTwordPos: null,
            LTinfo: "searching...",
            LTactive: false,
            spellcheckFallback: false,
            splitview: false,
            splitLeftPct: 50,
            _splitResizing: false,
            currentPDFZoom: 80,
            currentPDFData: null,
            ignoreList: new Set(),
            ltRunning: false,
            ltStartInProgress: false,
            examMaterials: [],
            submissionnumber: 0,
            webviewVisible: false,
            urlForWebview: null,
            showfileerror: true,
            isMac: false,
            allowedUrls: [],
            lockedSection: 1,
            internetCheckCounter:0,
            ltExternalHost,
            ltExternalPort,
            ltUseExternal,
            ltLocalHost,
            ltLocalPort,
            LThost: ltUseExternal ? ltExternalHost : ltLocalHost,
            LTport: ltUseExternal ? ltExternalPort : ltLocalPort,
            ltLanguage: initialEditorCfg.spellchecklang || "de-DE",
            clipboardHistory: [],
            showClipboardSidebar: false,
            clipboardTooltip: { text: '', shown: false, x: 0, y: 0 },
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
            typingRhythm: { lastTs: 0, deltas: [], lastLogTs: 0 },
            typingRhythmKeydownListener: null,
        }
    },
    computed: {
        getHexColor() {
            const rgbColor = this.editor?.getAttributes('textStyle')?.color || '';
            return rgbColor.startsWith('rgb') ? this.rgbToHex(rgbColor) : rgbColor;
        },
        ltLanguageOptions() {
            return {
                'de-DE': this.$t("editor.lang_de"),
                'en-GB': this.$t("editor.lang_en_gb"),
                'en-US': this.$t("editor.lang_en_us"),
                'fr-FR': this.$t("editor.lang_fr"),
                'es-ES': this.$t("editor.lang_es"),
                'it-IT': this.$t("editor.lang_it"),
                'sl-SI': this.$t("editor.lang_sl"),
            };
        },
        showLanguageToolSidebar() {
            // returns true if LanguageTool sidebar should be visible
            if (this.privateSpellcheck?.activated) return true;
            const cfg = this.getEditorExamConfig();
            return !!cfg?.languagetool;
        },
        focusLockReasonLine() {
            const code = this.focusLockReason;
            if (!code) return '';
            const key = `editor.focusLockReason_${code}`;
            const text = this.$te(key) ? this.$t(key) : code;
            return `${this.$t('editor.focusLockReason')}: ${text}`;
        },
    },


    watch: {
        // Vue calls this when the component's data property "focus" changes; newValue is the new value of this.focus
        focus(newValue) {
            if (!newValue) {
                this.$nextTick(() => this.$refs.focusWarningOverlay?.focus()); // DOM .focus() steals focus from editor
                if (this.localLockdown) {
                    this.$nextTick(() => this.$refs.localUnlockInput?.focus());
                }
                return;
            }
            this.focusLostMessage = '';
            this.focusLockReason = '';
            this.focusLockMessage = '';
        },
    },


    methods: {

        // from filehandler.js
        getExamMaterials: getExamMaterials,
        loadPDF: loadPDF,
        loadHTML: loadHTML,
        loadDOCX: loadDOCX,
        loadODT: loadODT,
        loadImage: loadImage,
        playAudio: playAudio,

        // from commonMethods.js
        gracefullyExit: gracefullyExit,
        showUrl: showUrl,
        reconnect: reconnect,

        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },

        // from languagetool.js
        LTcheckAllWords: LTcheckAllWords,
        LTfindWordPositions: LTfindWordPositions,
        LThighlightWords: LThighlightWords,
        LTdisable: LTdisable,
        LThandleMisspelled: LThandleMisspelled,
        LTignoreWord: LTignoreWord,
        LTresetIgnorelist: LTresetIgnorelist,
        LTbuildOffsetMap: LTbuildOffsetMap,
        LTfindByOffsetMap: LTfindByOffsetMap,


        getEditorExamConfig(sectionIndexIn = null) {
            const status = this.serverstatus;
            if (!status || !status.examSections) return {};
            const allowSwitch = !!status.allowSectionSwitch;
            const sectionIndex = sectionIndexIn != null
                ? sectionIndexIn
                : (status.useExamSections === false
                    ? 1
                    : (allowSwitch
                        ? (this.clientinfo?.lockedSection ?? this.lockedSection ?? status.activeSection ?? 0)
                        : (status.lockedSection ?? status.activeSection ?? 0)));
            const section = status.examSections?.[sectionIndex] || status.examSections?.[1] || null;
            const groupKey = section && section.groups && this.clientinfo?.group === 'b' ? 'groupB' : 'groupA';
            return resolveEditorExamConfig(section, groupKey);
        },

        // Teacher-set ODT/DOCX template under examConfig.editor.editorTemplate (not materials).
        getEditorTemplateFromExamConfig(sectionIndexIn = null) {
            const status = this.serverstatus;
            if (!status || !status.examSections) return null;
            const allowSwitch = !!status.allowSectionSwitch;
            const sectionIndex = sectionIndexIn != null
                ? sectionIndexIn
                : (status.useExamSections === false
                    ? 1
                    : (allowSwitch
                        ? (this.clientinfo?.lockedSection ?? this.lockedSection ?? status.activeSection ?? 0)
                        : (status.lockedSection ?? status.activeSection ?? 0)));
            const section = status.examSections?.[sectionIndex] || status.examSections?.[1] || null;
            if (!section || section.examtype !== 'editor') return null;
            const groupKey = section.groups && this.clientinfo?.group === 'b' ? 'groupB' : 'groupA';
            const tmpl = section[groupKey]?.examConfig?.editor?.editorTemplate;
            if (!tmpl?.filename || !tmpl?.filecontent) return null;
            let ft = tmpl.filetype;
            if (ft !== 'docx' && ft !== 'odt') {
                const n = String(tmpl.filename).toLowerCase();
                if (n.endsWith('.docx')) ft = 'docx';
                else if (n.endsWith('.odt')) ft = 'odt';
                else return null;
            }
            return { ...tmpl, filetype: ft };
        },

        // Wait until TipTap is ready (same readiness as backup restore).
        async waitForEditorReady(maxAttempts = 50, delayMs = 100) {
            for (let attempts = 0; attempts < maxAttempts; attempts++) {
                if (this.editor && this.editor.isEditable !== undefined && this.editor.commands) {
                    return true;
                }
                await this.sleep(delayMs);
            }
            console.error(`editor @ waitForEditorReady: Editor not ready after ${maxAttempts} attempts`);
            return false;
        },

        // Attach paste/drop/keydown guards once ProseMirror DOM exists.
        async attachEditorInputGuards() {
            if (!await this.waitForEditorReady()) return;
            this.editorcontentcontainer = document.getElementById('editorcontent');
            this.editorContent = this.editorcontentcontainer?.querySelector('.ProseMirror');
            if (!this.editorContent) return;
            this.autoEventListener(this.editorContent, 'paste', this.handlePaste, true);
            this.autoEventListener(this.editorContent, 'drop', this.handleDrop, true);
            this.typingRhythmKeydownListener = this.handleTypingRhythmKeydown.bind(this);
            this.autoEventListener(this.editorContent, 'keydown', this.typingRhythmKeydownListener, true);
        },

        // Silent import of teacher template (no replace dialog); runs only after backup was skipped or absent.
        async autoLoadEditorTemplateIfConfigured() {
            const file = this.getEditorTemplateFromExamConfig();
            if (!file) return;
            console.log(`editor @ autoLoadEditorTemplateIfConfigured: Loading template ${file.filename}`);
            this.webviewVisible = false;
            this.selectedFile = file.filename;
            if (file.filetype === 'docx') {
                await this.loadDOCX(file, true, true);
            } else if (file.filetype === 'odt') {
                await this.loadODT(file, true, true);
            }
        },

        // Point LThost/LTport at the student-selected local or external LT endpoint.
        applyLtActiveEndpoint() {
            if (this.ltUseExternal && this.ltExternalHost) {
                this.LThost = this.ltExternalHost;
                this.LTport = this.ltExternalPort || '8088';
            } else {
                this.LThost = this.ltLocalHost;
                this.LTport = this.ltLocalPort;
            }
        },

        async toggleLtEndpoint(useExternal) {
            if (!this.ltExternalHost || this.ltUseExternal === !!useExternal) return;
            this.ltUseExternal = !!useExternal;
            this.applyLtActiveEndpoint();
            if (this.LTactive) {
                this.spellcheckFallback = false;
                await this.LTcheckAllWordsAndHighlight(false);
            }
        },

        syncEditorLanguageSettings() {
            const cfg = this.getEditorExamConfig(this.lockedSection);
            const lang = cfg.spellchecklang || 'de-DE';
            if (lang !== this.ltLanguage) this.ltLanguage = lang;

            const extHost = cfg.languagetoolhost || null;
            const extPort = String(cfg.languagetoolport || '8088');
            const hadExternal = !!this.ltExternalHost;
            this.ltExternalHost = extHost;
            this.ltExternalPort = extPort;
            if (extHost && !hadExternal) {
                this.ltUseExternal = true;
            } else if (!extHost) {
                this.ltUseExternal = false;
            }
            this.applyLtActiveEndpoint();
        },

        // Apply cmargin/fonts/linespacing from examConfig.editor to layout CSS variables.
        applyEditorLayoutCss() {
            switch (Number(this.cmargin?.size)) {
                case 5:
                    this.proseMirrorMargin = '50mm';
                    this.editorWidth = '160mm';
                    break;
                case 4.5:
                    this.proseMirrorMargin = '45mm';
                    this.editorWidth = '165mm';
                    break;
                case 4:
                    this.proseMirrorMargin = '40mm';
                    this.editorWidth = '170mm';
                    break;
                case 3.5:
                    this.proseMirrorMargin = '35mm';
                    this.editorWidth = '175mm';
                    break;
                case 3:
                    this.proseMirrorMargin = '30mm';
                    this.editorWidth = '180mm';
                    break;
                case 2.5:
                    this.proseMirrorMargin = '25mm';
                    this.editorWidth = '185mm';
                    break;
                case 2:
                    this.proseMirrorMargin = '20mm';
                    this.editorWidth = '190mm';
                    break;
                default:
                    this.proseMirrorMargin = '30mm';
                    this.editorWidth = '180mm';
            }
            if (this.cmargin.side === 'right') {
                this.setCSSVariable('--js-margin', `0 ${this.proseMirrorMargin} 0 0`);
                this.setCSSVariable('--js-borderright', `1px solid #ccc`);
                this.setCSSVariable('--js-borderleft', `0px solid #ccc`);
            } else {
                this.setCSSVariable('--js-margin', `0 0 0 ${this.proseMirrorMargin}`);
                this.setCSSVariable('--js-borderright', `0px solid #ccc`);
                this.setCSSVariable('--js-borderleft', `1px solid #ccc`);
            }
            this.setCSSVariable('--js-editorWidth', `${this.editorWidth}`);
            this.setCSSVariable('--js-linespacing', `${this.linespacing}`);
            this.setCSSVariable('--js-fontfamily', `${this.fontfamily}`);
            this.setCSSVariable('--js-fontsize', `${this.fontsize}`);
        },

        syncEditorVisualSettings() {
            const cfg = this.getEditorExamConfig(this.lockedSection);
            const cm = cfg.cmargin || DEFAULT_EDITOR_EXAM_CONFIG.cmargin;
            this.cmargin = { side: cm.side || 'right', size: cm.size ?? 3 };
            this.linespacing = String(cfg.linespacing ?? DEFAULT_EDITOR_EXAM_CONFIG.linespacing);
            this.fontfamily = cfg.fontfamily || DEFAULT_EDITOR_EXAM_CONFIG.fontfamily;
            this.fontsize = cfg.fontsize || DEFAULT_EDITOR_EXAM_CONFIG.fontsize;
            this.applyEditorLayoutCss();
        },




        startSplitResize(e) {
            // Use pointer events to support mouse + touch.
            if (!this.splitview) return;
            this._splitResizing = true;
            this.autoEventListener(window,'pointermove', this.onSplitResizeMove, { passive: false });
            this.autoEventListener(window,'pointerup', this.stopSplitResize, { passive: true });
            this.autoEventListener(window,'pointercancel', this.stopSplitResize, { passive: true });
            this.onSplitResizeMove(e);
        },

        onSplitResizeMove(e) {
            if (!this._splitResizing) return;
            e.preventDefault();
            const container = document.querySelector('.split-view-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            const pct = (x / rect.width) * 100;
            const minLeftPx = 320;
            const minRightPx = 420;
            const minPct = (minLeftPx / rect.width) * 100;
            const maxPct = 100 - (minRightPx / rect.width) * 100;
            const clamped = Math.min(Math.max(pct, minPct), maxPct);
            this.splitLeftPct = Math.min(80, Math.max(20, Math.round(clamped * 10) / 10));
        },

        stopSplitResize() {
            this._splitResizing = false;
            window.removeEventListener('pointermove', this.onSplitResizeMove);
            window.removeEventListener('pointerup', this.stopSplitResize);
            window.removeEventListener('pointercancel', this.stopSplitResize);
        },

        LTshowWord(word) {
            this.currentLTword = word
            this.LTupdateHighlights()
            if (word.range) {
                this.setCursorAtStartOfRange(word.range)
            }

        },
        async LTcheckAllWordsAndHighlight(closeLT = true) {
            await this.LTcheckAllWords(closeLT)
            await this.LTupdateHighlights()
        },
        
        async LTupdateHighlights() {
            if (!this.LTactive) {
                return
            }
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

                // Set the selection to the beginning of the range object
                const selection = window.getSelection();
                selection.removeAllRanges(); // remove all existing ranges from the current selection
                selection.addRange(caretRange); // add the new range that positions the caret

                // Optional: scroll the element into view if needed
                editableElement.focus(); // focus the editable element
                caretRange.startContainer.parentNode.scrollIntoView({
                    block: 'center',
                    inline: 'nearest',
                    behavior: 'smooth'
                });
            }
        },

        isValidFullDomainName(str) {
            try {
                // Add https:// if no protocol is specified
                const urlString = str.includes('://') ? str : 'https://' + str;
                const url = new URL(urlString);

                // Check whether the protocol is correct
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    return false;
                }

                // Check whether host is present and valid
                if (!url.hostname || url.hostname.length < 1) {
                    return false;
                }

                // Check whether host contains at least one valid domain part
                const parts = url.hostname.split('.');
                if (parts.length < 2) {
                    return false;
                }

                // Check whether every domain part is valid
                const validPart = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
                return parts.every(part =>
                    part.length > 0 &&
                    part.length <= 63 &&
                    validPart.test(part)
                );

            } catch (e) {
                return false;
            }
        },


        loadBase64file(file) {

            this.webviewVisible = false
            if (file.filetype == 'pdf') {
                this.loadPDF(file, true)
                return
            } else if (file.filetype == 'image') {
                this.loadImage(file, true)
                return
            } else if (file.filetype == 'docx') {
                this.loadDOCX(file, true)
                return
            } else if (file.filetype == 'odt') {
                this.loadODT(file, true)
                return
            } else if (file.filetype == 'audio') {
                this.playAudio(file, true)
                return
            }
        },

        handleColorInput(event) {
            const color = event.target.value;
            const clampedColor = this.clampColor(color);
            this.editor.chain().focus().setColor(clampedColor).run();
        },
        clampColor(hexColor) {
            const rgb = this.hexToRgb(hexColor);
            const clampedRgb = rgb.map(value => Math.min(value, 230));
            return this.rgbToHex(`rgb(${clampedRgb.join(', ')})`);
        },
        hexToRgb(hex) {
            // Convert hex to RGB
            const bigint = parseInt(hex.slice(1), 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            return [r, g, b];
        },
        rgbToHex(rgb) {
            // Convert RGB to hex
            const rgbValues = rgb.match(/\d+/g).map(Number);
            return `#${rgbValues.map(x => x.toString(16).padStart(2, '0')).join('')}`;
        },


        async fetchInfo() {
            let getinfo = await signalBridge.invoke('getinfoasync')  // we need to fetch the updated version of the systemconfig from express api (server.js)
            applyClientinfoFromFetch(this, getinfo.clientinfo, { trackPrivateSpellcheck: true });

            const serverstatusChanged = getinfo.serverstatus
                ? applyServerstatusFromFetch(this, getinfo.serverstatus)
                : false;

            const sectionIndex = resolveLockedSection(this.serverstatus, this.clientinfo);

            if (sectionIndex !== this.lockedSection) {
                this.lockedSection = sectionIndex;
                this.syncEditorLanguageSettings();
                this.syncEditorVisualSettings();
            } else if (serverstatusChanged) {
                this.syncEditorLanguageSettings();
                this.syncEditorVisualSettings();
            }

            // console.log(this.serverstatus)
            if (this.pincode !== "0000") {
                this.localLockdown = false
            }  // pingcode is 0000 only in localmode

            this.battery = await navigator.getBattery().then(battery => {
                return battery
            }).catch(error => {
                console.error("Error accessing the Battery API:", error);
            });

            //handle individual spellcheck (only if not globally activated anyways)
            if (
                this.serverstatus &&
                this.serverstatus.examSections &&
                this.serverstatus.examSections[this.lockedSection] &&
                this.getEditorExamConfig(this.lockedSection).languagetool === false
            ) {
                if (this.privateSpellcheck.activate == false && this.LTactive) {
                    this.LTdisable()
                    this.privateSpellcheck.activated = false   // this is already set to false in the communication handler for clientinfo and picked up via fetchinfo()
                }
            }

            this.internetCheckCounter++
            if (this.internetCheckCounter % 5 === 0) {
                    this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                    this.hostip = await signalBridge.invoke('checkhostip')
                    this.internetCheckCounter = 0
            }
        },


        showInsertSpecial() {
            let specialCharsDiv = document.querySelector("#specialcharsdiv");
            let display = specialCharsDiv.style.display;
            if (display === "none") {
                specialCharsDiv.style.display = 'inline-block';
            } else {
                specialCharsDiv.style.display = 'none';
            }
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


        insertSpaceInsteadOfTab(e) {
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

            if (this.getEditorExamConfig().languagetool || this.privateSpellcheck) {
                this.LTupdateHighlights()
            }

            // Check whether the cursor is directly inside a <code> element or a code block is being created
            // without this block, German " is also substituted inside code. there is a bug where a new code block
            // gets a German upper quotation mark for no apparent reason when it is the first " in a new line
            // Check whether we might be just creating a code block (also detect the first character)

            if (this.getEditorExamConfig().spellchecklang === 'de-DE') {
                if (e.key === '"') {
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const currentNode = range.startContainer;

                    const isInCodeBlock = () => {
                        const parentCodeBlock = currentNode.nodeType === 3
                            ? currentNode.parentElement.closest("code")
                            : currentNode.closest("code");
                        const codemode = this.editor.isActive('code');
                        if (parentCodeBlock || codemode) return true;
                    };

                    if (isInCodeBlock()) { return; } // keep code unchanged

                    e.preventDefault();
                    const textNode = range.startContainer;
                    const offset = range.startOffset;

                    // text before and after current position
                    const before = textNode.textContent.slice(0, offset);
                    const after = textNode.textContent.slice(offset);

                    // decide between lower or upper double quote
                    const newQuote = before.endsWith(" ") || before === "" || /[\(\[{<]/.test(before.slice(-1)) ? "„" : "“";

                    // update text with new quote
                    const newText = before + newQuote + after;
                    textNode.textContent = newText;

                    // move cursor behind inserted quote
                    range.setStart(textNode, before.length + 1);
                    range.setEnd(textNode, before.length + 1);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } 
                else if (e.key === "'") {
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const currentNode = range.startContainer;

                    const isInCodeBlock = () => {
                        const parentCodeBlock = currentNode.nodeType === 3
                            ? currentNode.parentElement.closest("code")
                            : currentNode.closest("code");
                        const codemode = this.editor.isActive('code');
                        if (parentCodeBlock || codemode) return true;
                    };

                    if (isInCodeBlock()) { return; } // keep code unchanged

                    const textNode = range.startContainer;
                    const offset = range.startOffset;

                    const before = textNode.textContent.slice(0, offset);
                    const after = textNode.textContent.slice(offset);

                    const lastChar = before.slice(-1);
                    const isWordStart = before === "" || /\s|[\(\[{<]/.test(lastChar);
                    if (!isWordStart) { return; } // let browser insert plain '

                    e.preventDefault();

                    const newQuote = "‚"; // lower single German quote

                    const newText = before + newQuote + after;
                    textNode.textContent = newText;

                    range.setStart(textNode, before.length + 1);
                    range.setEnd(textNode, before.length + 1);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }








        },
        rgbToHex(rgb) {
            const [r, g, b] = rgb.match(/\d+/g).map(Number);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        },
        // Status bar word/char counts via DOM refs — no reactive tick on editor.vue.
        updateEditorStatusCounts() {
            if (!this.editor) return;
            const wordEl = this.$refs.statusWordCount;
            const charEl = this.$refs.statusCharCount;
            if (wordEl) {
                wordEl.textContent = String(this.editor.storage.characterCount.words());
            }
            if (charEl) {
                charEl.textContent = String(this.editor.getText().replace(/<[^>]*>/g, '').replace(/\s/g, '').length);
            }
        },

        // Strip marks, color, alignment, paragraph line-height, then normalize block nodes (unsetAllMarks before clearNodes for full-doc selection).
        clearFormatting() {
            if (!this.editor) return
            this.editor.chain().focus()
                .unsetAllMarks()
                .unsetColor()
                .unsetTextAlign()
                .resetAttributes('paragraph', 'lineHeight')
                .clearNodes()
                .run()
        },

        // Refresh status-bar text for block path, alignment, and marks at the selection anchor.
        updateCaretContextLabel() {
            if (!this.editor?.state) {
                this.caretContextLabel = ''
                return
            }
            const {state} = this.editor
            const sel = state.selection
            if (sel instanceof NodeSelection) {
                const fragment = this.caretContextLabelForNode(sel.node)
                this.caretContextLabel = fragment || this.$t('editor.caretCtxUnknown', {type: sel.node.type.name})
                return
            }
            const {$from} = sel
            const parts = []
            for (let d = 1; d <= $from.depth; d++) {
                const fragment = this.caretContextLabelForNode($from.node(d))
                if (fragment) parts.push(fragment)
            }
            const parent = $from.parent
            if ((parent.type.name === 'paragraph' || parent.type.name === 'heading') && parent.attrs.textAlign) {
                const alignKey = {
                    left: 'editor.caretCtxAlignLeft',
                    center: 'editor.caretCtxAlignCenter',
                    right: 'editor.caretCtxAlignRight',
                    justify: 'editor.caretCtxAlignJustify',
                }[parent.attrs.textAlign]
                if (alignKey) parts.push(this.$t(alignKey))
            }
            $from.marks().forEach((mark) => {
                const fragment = this.caretContextLabelForMark(mark)
                if (fragment) parts.push(fragment)
            })
            this.caretContextLabel = parts.join(' · ')
        },
        // Map a document block node to a translated caret-context fragment (empty if omitted from UI).
        caretContextLabelForNode(node) {
            const name = node.type.name
            if (name === 'heading') {
                return this.$t('editor.caretCtxHeading', {level: node.attrs.level ?? ''})
            }
            const keyByName = {
                paragraph: 'editor.caretCtxParagraph',
                blockquote: 'editor.caretCtxBlockquote',
                codeBlock: 'editor.caretCtxCodeBlock',
                bulletList: 'editor.caretCtxBulletList',
                orderedList: 'editor.caretCtxOrderedList',
                listItem: 'editor.caretCtxListItem',
                tableCell: 'editor.caretCtxTableCell',
                tableHeader: 'editor.caretCtxTableHeader',
                horizontalRule: 'editor.caretCtxHorizontalRule',
                statsRule: 'editor.caretCtxStatsRule',
                image: 'editor.caretCtxImage',
            }
            const i18nKey = keyByName[name]
            return i18nKey ? this.$t(i18nKey) : ''
        },
        // Map an active mark to a translated caret-context fragment (supports textStyle color).
        caretContextLabelForMark(mark) {
            const keyByName = {
                bold: 'editor.caretCtxBold',
                italic: 'editor.caretCtxItalic',
                underline: 'editor.caretCtxUnderline',
                code: 'editor.caretCtxCode',
                subscript: 'editor.caretCtxSubscript',
                superscript: 'editor.caretCtxSuperscript',
            }
            const i18nKey = keyByName[mark.type.name]
            if (i18nKey) return this.$t(i18nKey)
            if (mark.type.name === 'textStyle' && mark.attrs?.color) {
                return this.$t('editor.caretCtxColor', {color: mark.attrs.color})
            }
            return ''
        },

        // True when this row is the document that receives the 20s auto-save (.htm).
        isActiveLocalHtmFile(file) {
            return !!(file && file.type === 'htm' && this.currentFile && file.name === `${this.currentFile}.htm`);
        },

        // Seconds/minutes/hours since last filesystem mtime (active .htm omits label in template).
        formatHtmLocalFileAge(file) {
            const t = Date.now();
            const ms = Math.max(0, t - Number(file?.mod || 0));
            const sec = Math.floor(ms / 1000);
            if (sec < 60) return `${sec}s`;
            const min = Math.floor(sec / 60);
            if (min < 60) return `${min} min`;
            const h = Math.floor(min / 60);
            const m = min % 60;
            return `${h}h ${m}m`;
        },

        //get all files in user directory
        async loadFilelist() {
            let filelist = await signalBridge.invoke('getfilesasync', null)
            this.localfiles = filelist;

            // handle audio file objects (playback limitations)
            this.localfiles.forEach(file => {
                if (file.type == "audio") {
                    const existingaudiofile = this.audiofiles.find(obj => obj.name === file.name);
                    if (!existingaudiofile) {
                        this.audiofiles.push({
                            name: file.name,
                            playbacks: Number(this.getEditorExamConfig(this.lockedSection).audioRepeat) || 0
                        })
                    }
                }
            })
        },


        // show mugshot preview panel
        showInsertMugshot() {
            document.querySelector("#mugshotpreview").style.display = 'block';
        },
        // insert mugshot image into editor
        insertMugshot(id) {
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
        async insertImage(file) {
            const imgSrc = `data:image/png;base64,${this.currentpreviewBase64}`;
            // this.editor.chain().focus().setImage({ src: imgSrc }).run()
            const tableHtml = `<table style="width: 100%; height: 100%;"><tr><td style="max-width: 100%; max-height: 100%;"><img src="${imgSrc}" style="max-width: 100%; max-height: 100%;" class="img-max-size" /></td></tr></table>`;
            this.editor.chain().focus().insertContent(tableHtml).run();
        },


        // display the table part of the toolbar
        showMore() {
            const moreOptions = document.getElementById('moreoptions')
            if (moreOptions.style.display === "none") {
                moreOptions.style.display = "inline-block";
            } else {
                moreOptions.style.display = "none";
            }
        },


        /** Converts the Editor View into a multipage PDF */
        async saveContent(backup, why) {

            let filename = this.currentFile  // this can be set manually... otherwise currentFile is used (clientname unless you load another file)

            if (why === "manual") {
                await this.$swal({
                    title: this.$t("math.filename"),
                    icon: "question",
                    input: 'text',
                    inputPlaceholder: 'Type here...',
                    showCancelButton: true,
                    inputAttributes: {
                        maxlength: 20,
                    },
                    confirmButtonText: 'Ok',
                    cancelButtonText: this.$t("editor.cancel"),
                    inputValidator: (value) => {
                        const v = typeof value === 'string' ? value.trim() : '';
                        const regex = /^[A-Za-z0-9]{1,20}$/;
                        if (!v.match(regex)) {
                            return this.$t("math.nospecial");
                        }
                    },
                }).then((result) => {
                    if (result.isConfirmed) {
                        const stem = String(result.value ?? '').trim();
                        filename = `${stem}`
                        this.currentFile = filename
                    }
                    else {return; }
                });
            }
            if (why === "exitexam") {
                // stop clipboard clear interval
                signalBridge.send('restrictions')

                this.$swal.fire({
                    title: this.$t("editor.leaving"),
                    text: this.$t("editor.savedclip"),
                    icon: "info",
                    timer: 3000,
                    showCancelButton: false,
                    didOpen: () => {
                        this.$swal.showLoading();
                    },
                })

                let text = this.editor.getText();
                signalBridge.send('clipboard', text)

                navigator.clipboard.writeText(text).then(function () {
                    console.log('editor @ savecontent: Text erfolgreich kopiert');
                }).catch(function (err) {
                    console.log('editor @ savecontent: Fehler beim Kopieren des Textes: ', err.message);
                });
            } 

            // Klasse entfernen: Verhindert, dass die Keyframe-Animation beim printToPDF neu startet
            const previewElement = document.querySelector("#preview");
            if (previewElement && previewElement.classList.contains('fadeinfast')) {
                previewElement.classList.remove('fadeinfast');
            }

            // SAVE AS HTML (.htm) - also save editorcontent as *html file - used to re-populate the editor window in case something went completely wrong
            let editorcontent = this.editor.getHTML(); 
            signalBridge.send('storeHTML', { filename: filename, editorcontent: editorcontent, reason: why })
            
            // SAVE AS PDF - inform mainprocess to save webcontent as pdf (see @media css query for adjustments for pdf)
            // printPDF will trigger a reload of the filelist if finished and send files to teacher if reason (why) is "teacherrequest"
            signalBridge.send('printpdf', {
                filename: filename,
                landscape: false,
                servername: this.servername,
                clientname: this.clientname,
                reason: why
            })
            
        },


        // Maps getPDFbase64 IPC error payloads to a localized Swal title.
        showPdfGenerationError(response) {
            const msg = typeof response?.message === 'string' ? response.message : ''
            let title = this.$t('editor.pdfGenerationFailed')
            if (msg.includes('timeout') || msg.includes('in progress')) {
                title = this.$t('editor.pdfBusyTimeout')
            } else if (msg.toLowerCase().includes('signing failed')) {
                title = this.$t('editor.pdfSigningFailed')
            }
            this.$swal.fire({ title, icon: 'error' })
        },

        // send direct print request to teacher and append current document as base64
        async printBase64(printrequest = false, saveReason = 'n/a') {
            if (!this.currentpreviewBase64) {
                console.warn('editor @ printBase64: No PDF available to send')
                this.$swal.fire({ title: this.$t('editor.noPdfToSend'), icon: 'error' })
                return
            }

            const endpoint = printrequest ? 'printjob' : 'submission'
            const url = `https://${this.serverip}:${this.serverApiPort}/server/control/${endpoint}/${this.servername}`;
            const sr = typeof saveReason === 'string' ? saveReason : 'n/a'
            const payload = {
                document: this.currentpreviewBase64,
                printrequest: printrequest,
                submissionnumber: this.submissionnumber,
                lockedsection: this.lockedSection,  // this is needed to save the current section files to the correct section folder on the server
                saveReason: sr
            }

            examApiFetch(url, {
                method: "POST",
                cache: "no-store",
                headers: {'Content-Type': 'application/json', Authorization: `Bearer ${this.token}`},
                body: JSON.stringify(payload),
            })
            .then(response => {
                return response.json();
            })
            .then(data => {
                if (data.message == "success") {
                    if (!printrequest) { this.submissionnumber++ }   // successful submission -> increment number
                    let message = this.$t("editor.saved")
                    if (printrequest) {
                        message = this.$t("editor.requestsent")
                    }

                    this.$swal.fire({
                        title: message,
                        icon: "info",
                        // timer: 1500,
                        // timerProgressBar: true,
                        // didOpen: () => { this.$swal.showLoading() }
                    })
                } 
                else {
                    this.$swal.fire({
                        title: data.message,
                        icon: "error",
                    })
                }
            })
            .catch(error => {
                console.log("editor @ printbase64:", error.message)
                this.$swal.fire({ title: this.$t('editor.submissionNetworkFailed'), icon: 'error' })
            });

        },


        async sendExamToTeacher(directsend = false, type = "send") {
            const pdfArgs = {
                landscape: false,
                servername: this.servername,
                clientname: this.clientname,
                submissionnumber: this.submissionnumber,
                sectionname: this.serverstatus.examSections[this.lockedSection].sectionname,
            }
            if (type === 'print') {
                const response = await signalBridge.invoke('getPDFbase64', { ...pdfArgs, reason: 'print' })
                if (response?.status !== 'success') {
                    console.log("editor @ sendExamToTeacher: Error sending exam to teacher")
                    this.showPdfGenerationError(response)
                    return
                }
                this.currentpreviewBase64 = response.base64pdf
                this.loadPDF({
                    filename: `${this.clientname}.pdf`,
                    filetype: "pdf",
                    filecontent: response.dataUrl
                }, true, 100, true, type)
                return
            }

            await this.waitUntilSigningSwalPainted()
            let response
            try {
                response = await signalBridge.invoke('getPDFbase64', { ...pdfArgs, reason: 'previewSigned' })
            } finally {
                this.$swal.close()
            }
            if (response?.status !== 'success') {
                console.log("editor @ sendExamToTeacher: Error sending exam to teacher")
                this.showPdfGenerationError(response)
                return
            }
            this.currentpreviewBase64 = response.base64pdf
            if (directsend) {
                return this.printBase64(false, 'directsend')
            }
            this.loadPDF({
                filename: `${this.clientname}.pdf`,
                filetype: "pdf",
                filecontent: response.dataUrl
            }, true, 100, true, type)
        },


        // Resolves after Swal modal is in DOM and one frame has painted (nextTick alone is too early).
        waitUntilSigningSwalPainted() {
            return new Promise((resolve) => {
                this.$swal.fire({
                    title: this.$t('editor.creatingSigningPdf'),
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => {
                        this.$swal.showLoading()
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => { setTimeout(resolve, 0) })
                        })
                    },
                })
            })
        },

        // display print denied message and reason
        printdenied(why) {
            console.log("editor @ printdenied: Print request denied")
            let message = this.$t("editor.requestdenied")
            if (why == "duplicate") {
                message = this.$t("editor.requestdeniedduplicate")
            }

            this.$swal.fire({
                title: message,
                icon: "info",
                timer: 2000,
                timerProgressBar: true,
                didOpen: () => {
                    this.$swal.showLoading()
                }
            })
        },
        zoomin() {
            if (this.zoom < EDITOR_ZOOM_MAX) this.zoom = Math.min(EDITOR_ZOOM_MAX, this.zoom + 0.1)
            document.getElementById(`editorcontainer`).style.zoom = this.zoom
        },
        zoomout() {
            if (this.zoom > EDITOR_ZOOM_MIN) this.zoom = Math.max(EDITOR_ZOOM_MIN, this.zoom - 0.1)
            document.getElementById(`editorcontainer`).style.zoom = this.zoom
        },
        setCSSVariable(variableName, value) {
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
            const {from, to} = this.editor.state.selection;
            const textInSelection = this.editor.state.doc.textBetween(from, to, ' ');
            this.selectedCharCount = textInSelection ? textInSelection.replace(/\s/g, '').length : 0;
            this.selectedWordCount = textInSelection ? textInSelection.split(/\s+/).filter(Boolean).length : 0;
            return
        },
        // manual copy and paste because we disabled clipboard
        addToClipboardHistory(html) {
            if (!html || html.trim() === '') return;
            this.clipboardHistory = [html, ...this.clipboardHistory.filter(item => item !== html)].slice(0, 10);
        },
        async copySelection() {
            const selection = window.getSelection();
            if (selection?.rangeCount) {
                const range = selection.getRangeAt(0);
                const div = document.createElement('div');
                div.appendChild(range.cloneContents());
                const html = div.innerHTML;
                const text = selection.toString ? selection.toString() : '';
                const hasPayload = (!selection.isCollapsed) && ((html && html.trim()) || (text && text.trim()));
                if (hasPayload) {
                    this.selectedText = html;
                    this.addToClipboardHistory(html);
                    return;
                }
            }

            if (!this.webviewVisible) return;
            const webview = document.getElementById('safebrowser');
            if (!webview || typeof webview.executeJavaScript !== 'function') return;

            try {
                const waitForDomReady = (timeoutMs = 750) => {
                    if (typeof webview.getWebContentsId === 'function') {
                        const id = webview.getWebContentsId();
                        if (id) return Promise.resolve();
                    }
                    return new Promise((resolve) => {
                        let done = false;
                        const cleanup = () => {
                            if (done) return;
                            done = true;
                            try { webview.removeEventListener('dom-ready', onReady); } catch (_) {}
                            resolve();
                        };
                        const onReady = () => cleanup();
                        try { this.autoEventListener(webview,'dom-ready', onReady, { once: true }); } catch (_) { /* ignore */ }
                        setTimeout(cleanup, timeoutMs);
                    });
                };

                const readSelection = () => webview.executeJavaScript(`
                    (() => {
                        const sel = window.getSelection?.();
                        if (!sel || sel.rangeCount === 0) return { html: '', text: '' };
                        const range = sel.getRangeAt(0);
                        const div = document.createElement('div');
                        div.appendChild(range.cloneContents());
                        return { html: div.innerHTML || '', text: sel.toString() || '' };
                    })()
                `, true);

                let result = await readSelection();
                if (!result || (!result.html && !result.text)) {
                    await waitForDomReady();
                    result = await readSelection();
                }

                const html = (result && typeof result.html === 'string') ? result.html : '';
                const text = (result && typeof result.text === 'string') ? result.text : '';
                const payload = html && html.trim() ? html : (text && text.trim() ? `<p>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : '');
                if (!payload) return;

                this.selectedText = payload;
                this.addToClipboardHistory(payload);
            } catch (err) {
                console.log('editor @ copySelection: webview selection failed:', err?.message || err);
            }
        },
        async cutSelection() {
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
            await this.copySelection();
            this.editor.chain().focus().deleteSelection().run();
        },
        toggleClipboardSidebar() {
            this.showClipboardSidebar = !this.showClipboardSidebar;
        },
        pasteFromClipboard(item) {
            this.editor.chain().focus().insertContent(item, {parseOptions: {preserveWhitespace: 'full'}}).run();
            this.showClipboardSidebar = false;
        },
        pasteSelection() {
            this.toggleClipboardSidebar();
        },
        clipboardPreview(html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            const text = div.textContent || div.innerText || '';
            return text.length > 60 ? text.slice(0, 60) + '…' : text;
        },
        clipboardPreviewFull(html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        },
        clipboardTooltipShow(e, text) {
            const textEl = e.currentTarget.querySelector('.clipboard-item-text');
            if (!textEl || textEl.scrollWidth <= textEl.clientWidth) return;
            const rect = e.currentTarget.getBoundingClientRect();
            this.clipboardTooltip = {
                text,
                shown: true,
                x: rect.right + 8,
                y: rect.top
            };
        },
        clipboardTooltipHide() {
            this.clipboardTooltip = { text: '', shown: false, x: 0, y: 0 };
        },
        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        // returns a uuid 
        uuidv4() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        //switch from ovewlay pdf/jpg preview zu splitview mode
        async toggleSplitview() {
            this.splitview = !this.splitview;
            this.webviewVisible = false
            this.LTdisable();  //close lt
            await this.sleep(1000) //wait for re-rendering of #preview div 


            if (this.splitview === false) {
                this.autoEventListener(document.querySelector("#preview"),"click", this.hidepreview);
            }
            if (this.splitview === true) {
                document.querySelector("#preview").removeEventListener("click", this.hidepreview);
            }

            // re-activate eventlisteners on repaint of the editor frame
            const editorcontainer = document.getElementById(`editorcontainer`);
            if (editorcontainer) editorcontainer.style.zoom = this.zoom;
            const editorcontent = document.getElementById('editorcontent');
            if (editorcontent) {
                this.autoEventListener(editorcontent, 'mouseup', this.getSelectedTextInfo);   // show amount of words and characters
                this.autoEventListener(editorcontent, 'keydown', this.insertSpaceInsteadOfTab)   //this changes the tab behaviour and allows tabstops
            }
            const editormaincontainer = document.getElementById('editormaincontainer');
            if (editormaincontainer) {
              this.autoEventListener(editormaincontainer,'scroll', this.LTupdateHighlights, {passive: true});
            }


        },

        hidepreview() {
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            let preview = document.querySelector("#preview")
            preview.style.display = 'none';
            preview.setAttribute("src", "about:blank");
            URL.revokeObjectURL(this.currentpreview);
        },


        reloadAll() {
            let savedKeepcontent = false; // Store checkbox value before dialog closes (Electron 39 compatibility)

            this.$swal.fire({
                title: this.$t("editor.reload"),
                html: `${this.$t("editor.reloadtext")}
                    <br> <br>
                    <input class="form-check-input" type="checkbox" id="keepcontent" checked>
                    <label class="form-check-label" for="keepcontent"> ${this.$t("editor.reloadcontent")} </label>
                `,
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true,
                preConfirm: () => {
                    // Save checkbox value before dialog closes (Electron 39 compatibility)
                    const keepcontentElement = document.getElementById('keepcontent');
                    savedKeepcontent = keepcontentElement ? keepcontentElement.checked : false;
                }
            })
            .then((result) => {
                if (result.isConfirmed) {
                    let keepcontent = savedKeepcontent; // Use saved value instead of reading from DOM
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
        async sendFocuslost(ctrlalt = false, options = {}) {
            const { instantBlock = false, forceBackendLock = false, message = '', source = 'unknown' } = options;
            console.warn(
                `editor @ sendFocuslost: source=${source} ctrlalt=${ctrlalt} hidden=${document.hidden} visibility=${document.visibilityState} swal=${document.body.classList.contains('swal2-shown')}`
            );
            console.trace('editor @ sendFocuslost stack');
            if (!forceBackendLock && await shouldSkipEdgeFocusLost(signalBridge, this.development)) return;
            if (message) this.focusLostMessage = message;
            if (instantBlock && !this.development) {
                if (this.focus) this.entrytime = Date.now();
                this.focus = false;
                const editorcontentcontainer = document.getElementById('editorcontent');
                const editableDiv = editorcontentcontainer?.firstElementChild;
                if (editableDiv) editableDiv.blur(); // remove text cursor (caret)
            }

            const response = forceBackendLock
                ? await signalBridge.invoke('securityFocusLost', { reason: 'typingRhythm', message, ctrlalt })
                : await signalBridge.invoke('focuslost', ctrlalt); // refocus, go back to kiosk, inform teacher

            if (forceBackendLock) {
                if (this.focus) this.entrytime = Date.now();
                this.focus = false;
                const editorcontentcontainer = document.getElementById('editorcontent');
                const editableDiv = editorcontentcontainer?.firstElementChild;
                if (editableDiv) editableDiv.blur(); // remove text cursor (caret)
                return;
            }

            applyFocusLostFromIpc(this, response, this.development);
            if (!this.development && response && !response.focus) {
                const editorcontentcontainer = document.getElementById('editorcontent');
                const editableDiv = editorcontentcontainer?.firstElementChild;
                if (editableDiv) editableDiv.blur(); // remove text cursor (caret)
            }
        },
        async tryUnlockLocalLockdown() {
            if (!this.localLockdown) return;

            const expected = this.serverstatus?.password ?? "";
            const provided = this.localUnlockPassword ?? "";
            if (!expected || provided !== expected) {
                this.localUnlockError = true;
                return;
            }

            this.localUnlockBusy = true;
            try {
                const result = await signalBridge.invoke('restorefocusstateLocal');
                if (result?.ok) {
                    this.localUnlockPassword = '';
                    this.localUnlockError = false;
                    this.focus = true;
                    return;
                }
                this.localUnlockError = true;
            } finally {
                this.localUnlockBusy = false;
            }
        },
        handleCtrlAlt(event) {
            if (event.ctrlKey && event.altKey) {
                this.sendFocuslost(true, { source: 'ctrlalt' });
            }   // too much to prevent switching to tty or windows logon screen?
        },
        handleVisibilityChange() {
            if (document.hidden) {
                this.sendFocuslost(false, { source: 'visibilitychange' });
            }
        },


        formatTime: formatFocusLostTime,

        async startLanguageTool(options = {}) {
            const {silent = false, force = false} = options;
            if (!this.serverstatus || !this.serverstatus.examSections) {
                return false;
            }
            const cfg = this.getEditorExamConfig();
            if (!cfg || !cfg.languagetool) {
                return false;
            }
            if (this.ltRunning && !force) {
                return true;
            }
            try {
                const response = await signalBridge.invoke("startLanguageTool");
                if (response) {
                        if (!silent) {
                            this.$swal.fire({
                                text: "LanguageTool started!",
                                timer: 1000,
                                timerProgressBar: true,
                                didOpen: () => {
                                    this.$swal.showLoading()
                                }
                            });
                        }
                        this.ltRunning = true;
                        return true;
                    }
                if (!silent) {
                    this.$swal.fire({
                        text: "LanguageTool Error!",
                        timer: 1000,
                        timerProgressBar: true,
                        didOpen: () => {
                            this.$swal.showLoading()
                        }
                    });
                }
                this.ltRunning = false;
                return false;
            } 
            catch (error) {
                console.error('editor @ startLanguageTool:', error);
                if (!silent) {
                    this.$swal.fire({
                        text: "LanguageTool Error!",
                        timer: 1000,
                        timerProgressBar: true,
                        didOpen: () => {
                            this.$swal.showLoading()
                        }
                    });
                }
                this.ltRunning = false;
                return false;
            }
        },

        async retryLanguageToolStart() {
            if (this.ltStartInProgress) {
                return;
            }
            this.ltStartInProgress = true;
            this.LTinfo = "LanguageTool wird gestartet...";
            try {
                await this.startLanguageTool({silent: true, force: true});

                this.spellcheckFallback = false;
                this.LTinfo = "LanguageTool started. Checking again...";
                await this.sleep(1000);
                await this.LTcheckAllWords(false);

            } catch (error) {
                console.error('editor @ retryLanguageToolStart:', error);
                this.LTinfo = "LanguageTool konnte nicht gestartet werden";
            } finally {
                this.ltStartInProgress = false;
            }
        },


        createEditor() {
            this.editor = new Editor({
                extensions: [
                    Typography,

                    ImageWithDimensions.configure({
                        inline: true,
                        allowBase64: true,
                    }),
                    SmilieReplacer,
                    // this.charReplacerExtension,
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
                    StatsRule,
                    ListItem,
                    OrderedList,
                    ParagraphWithLineHeight,
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
                            addKeyboardShortcuts() {
                                return {
                                    '"': () => {
                                        // Prevent substitution inside code blocks
                                        if (this.editor.isActive('code')) {
                                            return this.editor.commands.insertContent('"')  // this substitution code ensures that no replacements happen in code blocks together with the keydown event check
                                        }
                                        return false
                                    }
                                }
                            }
                        })
                        .configure({lowlight}),
                ],
                content: ``,
                onCreate: () => {
                    this.$nextTick(() => this.updateCaretContextLabel())
                },
                onTransaction: () => {
                    this.updateCaretContextLabel()
                },
            });
        },
        
        // Silent restore of clientname.htm after exam-section switch (no confirm dialog).
        async loadBackupFileSilent(filename = false) {
            const backupfileName = filename ? filename : `${this.clientname}.htm`;
            try {
                const [backupfileContent, ready] = await Promise.all([
                    signalBridge.invoke('getbackupfile', backupfileName),
                    this.waitForEditorReady(),
                ]);
                if (!ready || !backupfileContent) return;
                this.editor.commands.clearContent(true);
                this.editor.commands.insertContent(backupfileContent);
            } catch (error) {
                console.error(`editor @ loadBackupFileSilent: ${error}`);
            }
        },

        async loadBackupFile(filename = false) {
            // check if there is an htm backup in the exam directory and load it
            // This must run early to read the file before editor overwrites it after 20 seconds
            const backupfileName = filename ? filename : this.clientname + ".htm";
            console.log(`editor @ loadBackupFile: Checking for backup file: ${backupfileName}`);
            try {
                const [backupfileContent, ready] = await Promise.all([
                    signalBridge.invoke('getbackupfile', backupfileName),
                    this.waitForEditorReady(),
                ]);
                if (!ready) return;

                if (backupfileContent) {
                    console.log(`editor @ loadBackupFile: Backup file found, showing dialog`);
                    const result = await this.$swal.fire({
                        title: this.$t("editor.backupfound"),
                        html: `${this.$t("editor.replacecontent1")} <b>${backupfileName}</b> ${this.$t("editor.replacecontent2")}`,
                        icon: "question",
                        showCancelButton: true,
                        cancelButtonText: this.$t("editor.cancel"),
                        reverseButtons: true,
                        allowOutsideClick: false,
                        allowEscapeKey: true,
                    });
                    if (result.isConfirmed) {
                        console.log(`editor @ loadBackupFile: User confirmed, loading backup file`);
                        this.editor.commands.clearContent(true);
                        this.editor.commands.insertContent(backupfileContent);
                        return;
                    }
                    console.log(`editor @ loadBackupFile: User cancelled loading backup file`);
                } else {
                    console.log(`editor @ loadBackupFile: No backup file found or content is empty`);
                }
                await this.autoLoadEditorTemplateIfConfigured();
            } catch (error) {
                console.error(`editor @ loadBackupFile: Error loading backup file: ${error}`);
            }
        },

        handlePaste(event) {
            event.preventDefault()
            event.stopPropagation();
        },
        handleDrop(event) {
            event.preventDefault()
            event.stopPropagation();
        },

        /** Non-text keys that break rhythm stats when tapped in bursts (held keys use e.repeat instead) */
        isTypingRhythmExemptKey(e) {
            const code = e.code;
            if (code === 'Backspace' || code === 'Delete' || code === 'Space') return true;
            if (code === 'Enter' || code === 'NumpadEnter') return true;
            const key = e.key;
            if (key === 'Backspace' || key === 'Delete' || key === 'Enter') return true;
            if (key === ' ') return true;
            return false;
        },

        handleTypingRhythmKeydown(e) {
            if (e.isComposing) return;
            if (e.repeat || this.isTypingRhythmExemptKey(e)) {
                const s = this.typingRhythm;
                s.deltas = [];
                s.lastTs = 0;
                return;
            }
            const now = Date.now();
            const s = this.typingRhythm;
            if (s.lastTs > 0) {
                const dt = now - s.lastTs;
                if (dt >= 0 && dt <= 2000) {
                    s.deltas.push(dt);
                    if (s.deltas.length > 10) s.deltas.shift();
                } else {
                    s.deltas = [];
                }
            }
            s.lastTs = now;

            if (s.deltas.length !== 10) return;
            const mean = s.deltas.reduce((a, b) => a + b, 0) / s.deltas.length;
            const variance = s.deltas.reduce((acc, v) => acc + (v - mean) ** 2, 0) / s.deltas.length;
            const stdev = Math.sqrt(variance);
            const tooFast = mean < 45;
            const tooRegular = stdev < 6;

            if ((tooFast || tooRegular) && now - s.lastLogTs > 2000) {
                s.lastLogTs = now;
                console.log('editor @ typingRhythm: suspicious typing rhythm', { meanMs: mean, stdevMs: stdev, deltasMs: [...s.deltas] });
                if (this.focus) {
                    this.sendFocuslost(false, {
                        instantBlock: true,
                        forceBackendLock: true,
                        source: 'typingRhythm',
                        message: 'Automatisierte Texteingabe erkannt\nDieser Computer ist möglicherweise kompromittiert',
                    });
                }
            }
        },


    },


    async mounted() {

        // Detect platform using navigator.platform (available in renderer process)
        this.isMac = navigator.platform.toLowerCase().includes('mac');
        this.syncEditorVisualSettings();
        this.createEditor(); // this initializes the editor
        // Backup/template Swal must finish before mouseleave/visibility guards — Swal focus trap triggers false positives.
        if (this.$route.query.restore === '1') {
            await this.loadBackupFileSilent();
        } else {
            await this.loadBackupFile();
        }
        this.attachEditorInputGuards()
        this.getExamMaterials()
        setTimeout(() => {
            signalBridge.invoke('prewarmSubmissionSigningP12').catch(() => {})
        }, 400)

      

        signalBridge.on('focusLock', (_event, payload = {}) => {
            this.focusLockReason = payload.reason || '';
            this.focusLockMessage = payload.message || '';
            if (!this.development) this.focus = false;
        });

        signalBridge.on('getmaterials', (event) => {  // get exam materials from teacher
            console.log("editor @ getmaterials: get materials request received")
            this.getExamMaterials()
        });

        signalBridge.on('finalsubmit', (event) => {  // triggered on exit exam mode - send exam to teacher
            console.log("editor @ finalsubmit: submit exam request received")
            this.sendExamToTeacher(true)
        });

        signalBridge.on('submitexam', (event, why) => {  //send current work as base64 to teacher
            console.log("editor @ submitexam: submit exam request received")
            this.printBase64(false, typeof why === 'string' ? why : 'submitexam')
        });

        signalBridge.on('save', (event, why) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
            console.log("editor @ save: Teacher saverequest received")
            this.saveContent(true, why)
        });
        signalBridge.on('denied', (event, why) => {  //print request was denied by teacher because he can not handle so much requests at once
            this.printdenied(why)
        });
        signalBridge.on('backup', (event, filename) => {
            console.log("editor @ backup: Replace event received ")
            this.loadHTML(filename)
        });
        signalBridge.on('loadfilelist', () => {
            //console.log("editor @ loadfilelist: Reload Files event received ")
            this.loadFilelist()
        });
        signalBridge.on('fileerror', (event, msg) => {
            console.log('editor @ fileerror: ', msg.message);

            if (this.showfileerror) {
                this.$swal.fire({
                    title: this.$t("data.fileerror"),
                    html: `${this.$t("data.fileerrorinfo2")}
                    <br><br>
                    <span class="small" style="font-style:italic;">${this.$t("data.fileerrorinfo")}</span>
                    <br><br>
                    <span class="small" style="color:darkred; font-style:italic;">${msg.message}</span>
                    <label>
                    <input type="checkbox" id="dontShowCheckbox"> ${this.$t("data.dontshow")}
                    </label>`,
                    icon: "error",
                    showCancelButton: false,
                    preConfirm: () => {
                        // Falls der Benutzer die Checkbox aktiviert hat, aktualisieren wir die Variable:
                        const dontShowCheckboxElement = document.getElementById('dontShowCheckbox');
                        const dontShow = dontShowCheckboxElement ? dontShowCheckboxElement.checked : false;
                        if (dontShow) {
                            this.showfileerror = false;
                        }
                    }
                });
            }

        });
        


        // add some eventlisteners once
        this.autoEventListener(document.querySelector("#preview"),"click", function () {
            this.style.display = 'none';
            this.setAttribute("src", "about:blank");
            URL.revokeObjectURL(this.currentpreview);
            // this.classList.add('fadeinfast');  // removed once the pdf is visible to avoid flickering, then added back here
        });

        this.autoEventListener(document.querySelector("#mugshotpreview"),"click", function () {
            this.style.display = 'none';
        });

        this.autoEventListener(document.querySelector("#audioclose"),"click", function (e) {
            audioPlayer.pause();
            console.log('editor @ audioclose: Playback stopped');
            document.querySelector("#aplayer").style.display = 'none';
        });

        const audioPlayer = document.getElementById('audioPlayer');
        if (audioPlayer) {
            this.autoEventListener(audioPlayer,'contextmenu', (e) => {
                e.preventDefault();
            });
        }

        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()

        // do not use setInterval() for intervals as it keeps all objects of the callbacks including fetch() responses in memory until the interval is stopped
        this.autoSchedulerService(this.fetchInfo, 5000);
        this.autoSchedulerService(() => this.saveContent(true, 'auto'), 20000);
        this.autoSchedulerService(this.updateEditorStatusCounts, 1000);

        this.$nextTick(() => this.updateEditorStatusCounts());


        this.loadFilelist()
        this.fetchInfo()

        /**
         *   INSERT EVENT LISTENERS
         */
        this.$nextTick(() => {
            this.editorcontentcontainer = document.getElementById('editorcontent');
            if (this.editorcontentcontainer) {
                this.autoEventListener(this.editorcontentcontainer,'mouseup', this.getSelectedTextInfo);   // show amount of words and characters
                this.autoEventListener(this.editorcontentcontainer,'keydown', this.insertSpaceInsteadOfTab)   //this changes the tab behaviour and allows tabstops
            }

            // start language tool locally (if allowed)
            this.startLanguageTool()

        });


        // update LThighlights positions on scroll
        this.autoEventListener(document.getElementById('editormaincontainer'),'scroll', this.LTupdateHighlights, {passive: true});

        // block editor on escape
        if (!this.development) {
            this._onFocusLostMouseleave = () => this.sendFocuslost(false, { source: 'mouseleave' });
            attachExamMouseleaveGuardBoolean(signalBridge, this.development, this._onFocusLostMouseleave);
            this.autoEventListener(window,'visibilitychange', this.handleVisibilityChange);
        }

      
        // get wlan info and host ip for internet check
        this.wlanInfo = await signalBridge.invoke('get-wlan-info')
        this.hostip = await signalBridge.invoke('checkhostip')

    },

    beforeMount() {

    },

    beforeUnmount() {
        /**
         *   REMOVE EVENT LISTENERS
         */

        document.body.removeEventListener('mouseleave', this._onFocusLostMouseleave);

        this.stopSplitResize()

        signalBridge.removeAllListeners('getmaterials')
        signalBridge.removeAllListeners('finalsubmit')
        signalBridge.removeAllListeners('submitexam')
        signalBridge.removeAllListeners('fileerror')
        signalBridge.removeAllListeners('save')
        signalBridge.removeAllListeners('denied')
        signalBridge.removeAllListeners('backup')
        signalBridge.removeAllListeners('loadfilelist')
        this.editor.destroy()
    },
}
</script>


<!-- achtung.. dieser style ist nicht scoped und hat daher auswirkungen auf alle anderen exam modi - testen und scopen oder gleich global arbeiten -->
<style lang="scss">

@media print { //this controls how the editor view is printed (to pdf)


    #editortoolbar, #webview, #mugshotpreview, #apphead, #editselected, #editselectedtext, #focuswarning, .focus-container, #specialcharsdiv, #aplayer, span.NXTEhighlight::after, #highlight-layer, #languagetool, #clipboard-sidebar, #preview, #pdfembed, .pdf-toolbar, .split-divider, .caret-context-label {
        display: none !important;
    }

    html, body, #vuexambody, .editor-root {
        position: relative !important;
        height: auto !important;
        overflow: visible !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
    }
    //body is "fixed" to prevent shifting during auto-scroll - but this limits multi-page print to 1 page

    #statusbar {
        position: relative !important;
        top: -4px !important;
        box-shadow: 0px 0px 0px transparent !important;
        background-color: white !important;
        border-top: 1px solid #c5c5c5 !important;
        margin-left: 30px !important;
        width: calc(var(--js-editorWidth) - 30px) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding-left: 0px !important;
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
        border-radius: 0px !important;
        background-color: white !important;
        overflow: hidden !important;
        zoom: 1 !important;
        box-shadow: 0px 0px 0px transparent !important;
    }

    #editormaincontainer {
        height: auto !important;
        overflow: visible !important;
        margin: 0 !important;
        border-radius: 0px !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
    }

    .stats-rule-block,
    .stats-rule-block .stats-rule-badge,
    .stats-rule-block .stats-rule-hr {
        background-color: #ffffff !important;
    }
    #vueexambody {
        overflow: hidden !important;
        height: 100% !important;
        border-radius: 0px !important;

    }



    .ProseMirror {
        padding: 5mm 1mm 5mm 8mm !important;
        border-radius: 0 !important;
        outline: 0 !important;
        overflow: hidden !important;
        margin: var(--js-margin) !important;
        border-right: var(--js-borderright) !important;
        border-left: var(--js-borderleft) !important;
        margin-bottom: 4px !important;
        caret-color: transparent !important; // hide native text caret in print / PDF capture
    }

    .ProseMirror-gapcursor,
    .prosemirror-dropcursor {
        display: none !important;
    }

    .ProseMirror {
        hr {
            break-before: always;
            page-break-before: always;
            padding-bottom: 0;
            margin-top: 0;
            margin-bottom: 0;
            border-width: 0;
        }
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
        display: none !important;
    }

    .swal2-container, .swal2-center, .swal2-backdrop-show, .swal2-popup, .swal2-modal, .swal2-icon-info, .swal2-show {
        display: none !important;
    }


}

#webview {

    margin: auto auto
}

#aplayer {
    display: none;
    background-color: rgb(255, 255, 255);
    z-index: 100000;
    width: 100%;
    text-align: center;
}

#audioPlayer {
    position: relative;
    width: 70vw;
    height: 24px;
}

audio::-webkit-media-controls-panel {
    background-color: rgb(255, 255, 255);
}

#specialcharsdiv {
    display: none;
    width: 100%;
    background-color: rgb(255, 255, 255);
    z-index: 1000000;
}


.invisible-button {
    border-color: transparent !important;
}


/**
Other Styles
*/

.editor-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
}

#editorcontainer {
    border-radius: 0;
    margin-top: 20px;
    width: 210mm;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 50px;
    zoom: 1.6;
    font-family: var(--js-fontfamily);

}


#editorcontent {
    border-radius: 0px;
    border: 1px solid #c5c5c5;
}

#editorcontent div.tiptap {
    overflow-x: auto;
    overflow-y: hidden;
    font-size: var(--js-fontsize);
    line-height: var(--js-linespacing) !important;
    width: var(--js-editorWidth);
    border-radius: 0px;
}


#editorcontent div.tiptap p {
    font-size: var(--js-fontsize);
    //font-size: 10px;
}

#editormaincontainer {
    box-sizing: border-box;
    width: 100%;
    scrollbar-gutter: stable;
    padding-right: 0px;
    flex: 1 1 auto;
    min-height: 0;
}

.split-view-container #editormaincontainer {
    padding-right: 0px !important;
}


#statusbar {
    position: relative;
    width: 100%;
    height: 28px;
    background-color: #eeeefa;
    padding: 2px;
    padding-left: 6px;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2);
    font-size: 0.9em;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
}

.statusbar-left {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.statusbar-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-shrink: 0;
}

.caret-context-label {
    max-width: min(480px, 38vw);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
}

.zoombutton {
    height: 24px;
    flex-shrink: 0;
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
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 100001;
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
    z-index: 100002;
    transition: .2s;
    cursor: pointer;
}

.mugshot:hover {
    margin: 2px;
    width: 66px;
    box-shadow: inset 0 0 15px white;
}


#preview {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 100001;
    backdrop-filter: blur(2px);

}


.split-pane {
    flex: 0 0 auto;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;
}

.split-pane--right {
    flex: 1 1 auto;
    overflow: visible;
}

.split-pane--left {
    background-repeat: no-repeat;
    background-position: center;
    background-color: transparent;
    position: static;
    top: 0;
    left: auto;
    width: auto;
    height: auto;
    z-index: auto;
    backdrop-filter: none;
    display: block;
}

.split-divider {
    flex: 0 0 10px;
    cursor: col-resize;
    position: relative;
    background: transparent;
    touch-action: none;
}

.split-divider::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 2px;
    background: rgba(255, 255, 255, 0.25);
}

.split-divider:hover::before {
    background: rgba(13, 110, 253, 0.55);
}

.split-view-container {
    user-select: none;
    display: flex ;
    flex-direction: row ;
    flex: 1 1 auto;
    min-height: 0;
    height: 100% ;
    overflow: hidden;
}

/* Splitview must override overlay preview hidden state */
.split-view-container #preview {
    display: block;
    position: relative;
    width: auto;
    height: auto;
    background-color: transparent;
    backdrop-filter: none;
    z-index: auto;
}

.split-view-container #editorcontent,
.split-view-container .pdf-scroll-container {
    user-select: text;
}


.splitinsert {
    border: none;
    border-radius: 0px;
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

.splitinsert img {
    width: 32px;
    height: 52px;
}

.splitprint {
    border: none;
    border-radius: 0px;
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

.splitprint img {
    width: 32px;
    height: 52px;
}

.splitsend {
    border: none;
    border-radius: 0px;
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    padding: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    margin-top: 10px;
}

.splitsend img {
    width: 32px;
    height: 52px;
}


.labelbutton {
    border: none !important;
    border-radius: 0px !important;
    border-top-right-radius: 6px !important;
    border-bottom-right-radius: 6px !important;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) !important;
    padding: 10px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    margin-top: 10px !important;
}

.labelbutton img {
    width: 32px !important;
    height: 52px !important;
}


/* Basic editor styles */

.ProseMirror {
    min-height: 60vh;
    padding: 5mm 1mm 5mm 8mm;
    outline: 1px solid rgb(197, 197, 197);
    border-radius: 5px;
}

.ProseMirror:focus-visible {
    outline: 1px solid rgb(197, 197, 197);
}

.ProseMirror {
    // Collapse UA block margins; single between-block gap scales with exam line-height setting.
    p,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    blockquote,
    pre,
    ul,
    ol,
    li {
        margin-top: 0;
        margin-bottom: 0;
    }

    > * + * {
        margin-top: max(0.25em, calc((var(--js-linespacing) - 1) * 1em));
    }

    ul,
    ol {
        padding: 0 1rem;

        line-height: var(--js-linespacing) !important;
    }

    ul li p {
        margin: 0;
        padding: 0;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        line-height: var(--js-linespacing) !important;
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
        border-top: 2px dashed rgba(#0D0D0D, 0.5);
        margin: 2rem 0;

    }

    hr.ProseMirror-selectednode {
        border-color: #5900ff;
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
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
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


/** CLIPBOARD SIDEBAR STYLES */
#clipboard-sidebar {
    position: fixed;
    z-index: 99999;
    width: 220px;
    max-height: 50vh;
    left: -224px;
    top: 163px;
    background-color: rgba(255, 255, 255, 0.9);
    box-shadow: 2px 1px 15px rgba(0, 0, 0, 0.1);
    transition: left 0.25s ease;
    overflow: hidden;
    border: 1px solid #c5c5c5;
}
#clipboard-sidebar.visible {
    left: 0;
}
#clipboard-sidebar .clipboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--bs-secondary);
    border-bottom: 1px solid var(--bs-border-color);
}
#clipboard-sidebar .clipboard-list {
    max-height: calc(50vh - 44px);
    overflow-y: auto;
    padding: 6px;
}
#clipboard-sidebar .clipboard-empty {
    padding: 12px;
    font-size: 0.8rem;
    color: var(--bs-secondary);
}
#clipboard-sidebar .clipboard-item {
    position: relative;
    padding: 8px 10px;
    font-size: 0.8rem;
    cursor: pointer;
    border-radius: 4px;
}
#clipboard-sidebar .clipboard-item-text {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
#clipboard-sidebar .clipboard-item:hover {
    background-color: rgba(0, 0, 0, 0.06);
}

.clipboard-tooltip-fixed {
    position: fixed;
    max-width: 280px;
    padding: 8px 10px;
    font-size: 0.8rem;
    background: var(--bs-dark);
    color: var(--bs-light);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 100001;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    pointer-events: none;
}

/** LANGUAGE TOOL STYLES */
#highlight-layer {
    position: absolute;
    top: 0px;
    left: 0px;

    margin-left: auto;
    margin-right: auto;
    zoom: 1;
    // width: var(--js-editorWidth) !important;
    width: var(--js-editorWidth);
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
    box-shadow: 1px 2px 2px rgba(0, 0, 0, 0.2);
    width: 160px;
    height: 45px;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    cursor: pointer;
    color: #616161;

    transform: rotate(90deg);
    transform-origin: top left;
}

#ltcheck:hover {
    background-color: var(--bs-gray-200);
}

#ltcheck img {
    vertical-align: bottom;

}

#ltcheck #eye {
    width: 20px;
    height: 20px;
    background-size: cover;
    display: inline-block;
    vertical-align: text-bottom;
}

#ltcheck .eyeopen {
    background-image: url('/src/assets/img/svg/eye-fill.svg');
}

#ltcheck .eyeclose {
    background-image: url('/src/assets/img/svg/eye-slash-fill.svg');
}

//mus integrate images this way otherwise they won't be integrated in the final build
.splitback {
    position: relative;
}
.splitback.splitback--empty::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: url('/src/assets/img/svg/document-replace.svg');
    background-repeat: no-repeat;
    background-position: center;
    background-size: 180px;
    opacity: 0.85;
}
.splitback > * {
    position: relative;
    z-index: 1;
}

.splitzoomin {
    background-image: url('/src/assets/img/svg/zoom-in.svg');

}

.splitzoomout {
    background-image: url('/src/assets/img/svg/zoom-out.svg');
}

.splitinsert {
    background-image: url('/src/assets/img/svg/edit-download-black.svg');
}

.splitprint {
    background-image: url('/src/assets/img/svg/print.svg');
}

.splitsend {
    background-image: url('/src/assets/img/svg/document-send.svg');
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
    background-color: rgb(238, 238, 250);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    font-size: 0.8em;
    cursor: pointer;
}

#languagetool .error-entry:hover {
    background-color: rgba(238, 238, 250, 0.508);
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


.grey {
    filter: invert(92%);
}

.allowed-url-button {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}


</style>

<style>
/**in order to override swal settings the css needs to be global not scoped*/
.swal2-popup {
    opacity: 0.9 !important;
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -webkit-animation: none !important;
}

.swal2-container {
    backdrop-filter: blur(2px);
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -webkit-animation: none !important;
}

.grey {
    filter: invert(66%);
}

.orange {
    filter: invert(66%) sepia(50%) saturate(10000%) brightness(100%);
}

.text-mini {
    font-size: 0.8em;
    color: var(--bs-gray-600);
}
</style>
