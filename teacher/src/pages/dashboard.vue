<template>


<!-- Header START -->
<div :key="0" class="w-100 p-3 text-white bg-dark text-left " style="position: relative; display: flex; align-items: center; justify-content: space-between; min-width: 1180px; height: 62px; z-index: 100;">
    <span class="text-white m-1" style="flex-shrink: 0;">
        <img src="/src/assets/img/svg/speedometer.svg" class="white me-2  " width="32" height="32" >
        <span style="font-size:23px;" class="align-middle me-1 ">Next-Exam</span>
    </span>

    <div style="flex-shrink: 0; text-align: right;">
        <div class="btn btn-sm btn-cyan m-0 me-1 mt-0" style=" padding:3px; height:32px; width:32px;" @click="showSetup()"  @mouseover="showDescription($t('dashboard.extendedsettings'))" @mouseout="hideDescription" ><img src="/src/assets/img/svg/settings-symbolic.svg" class="white-100" width="22" height="22" > </div>
        <div class="btn btn-sm btn-danger m-0 me-1 mt-0" @click="stopserver()" @mouseover="showDescription($t('dashboard.exitexam'))" @mouseout="hideDescription"  style=" height:32px;"><img src="/src/assets/img/svg/stock_exit.svg" style="vertical-align:text-top;" class="" width="20" height="20" >&nbsp; {{$t('dashboard.stopserver')}}&nbsp; </div>
        <div v-if="!hostip" id="adv" class="btn btn-danger btn-sm m-0  mt-1 me-1 " style="cursor: unset;">{{ $t("general.offline") }}</div>
        <span class="align-middle ms-3" style="font-size:23px;">Dashboard</span>
    </div>
    
    <div v-if="serverstatus.useExamSections && !serverstatus.allowSectionSwitch" style="position: absolute; left:256px; bottom: 0; min-width: 550px; z-index: 0;">
        <div id="section1" v-if="serverstatus.examSections[1]" @click="activateSection(1)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 1 && !serverstatus.examSections[1].locked, 'sectionbuttonactivered': serverstatus.activeSection == 1 && serverstatus.examSections[1].locked, 'btn-secondary': serverstatus.activeSection != 1,'btn-danger': serverstatus.examSections[1].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[1].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(1)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(1) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
        <div id="section2" v-if="serverstatus.examSections[2]" @click="activateSection(2)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 2 && !serverstatus.examSections[2].locked, 'sectionbuttonactivered': serverstatus.activeSection == 2 && serverstatus.examSections[2].locked, 'btn-secondary': serverstatus.activeSection != 2,'btn-danger': serverstatus.examSections[2].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[2].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(2)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(2) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
        <div id="section3" v-if="serverstatus.examSections[3]" @click="activateSection(3)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 3 && !serverstatus.examSections[3].locked, 'sectionbuttonactivered': serverstatus.activeSection == 3 && serverstatus.examSections[3].locked, 'btn-secondary': serverstatus.activeSection != 3,'btn-danger': serverstatus.examSections[3].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[3].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(3)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(3) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
        <div id="section4" v-if="serverstatus.examSections[4]" @click="activateSection(4)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 4 && !serverstatus.examSections[4].locked, 'sectionbuttonactivered': serverstatus.activeSection == 4 && serverstatus.examSections[4].locked, 'btn-secondary': serverstatus.activeSection != 4,'btn-danger': serverstatus.examSections[4].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[4].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(4)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(4) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
    </div>
    <!-- allowSectionSwitch: active tab white (sectionbuttonactive), no red border; tabs only switch dashboard view -->
    <div v-if="serverstatus.useExamSections && serverstatus.allowSectionSwitch" style="position: absolute; left:257px; bottom: 0; min-width: 550px; z-index: 0;">
        <div id="section1" v-if="serverstatus.examSections[1]" @click="activateSection(1)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 1 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[1].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(1)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(1) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
        <div id="section2" v-if="serverstatus.examSections[2]" @click="activateSection(2)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 2 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[2].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(2)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(2) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
        <div id="section3" v-if="serverstatus.examSections[3]" @click="activateSection(3)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 3 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[3].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(3)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(3) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
        <div id="section4" v-if="serverstatus.examSections[4]" @click="activateSection(4)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 4 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[4].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(4)">
                <img src="/src/assets/img/svg/document-edit.svg" :class="isSectionTabActive(4) ? 'white' : ''" width="14" height="14">
            </button>
        </div>
    </div>


    

</div>
<!-- Header END -->


<div id="wrapper" class="w-100 h-100 d-flex"  style="z-index: 100;">
    
    <!-- single student view  -->
    <div :key="1" id="studentinfocontainer" class="fadeinslow p-4">
        <div v-if="activestudent!= null" id="studentinfodiv">
            <div v-cloak><img style="position: absolute; height: 100%" :src="(activestudent.imageurl && now - 20000 < activestudent.timestamp)? `${activestudent.imageurl}`:'user-red.svg'"></div>
            <div style="height:100%">
                <div id="controlbuttons" style="text-align: center;">
                    <button class="btn btn-close  btn-close-white align-right" @click="hideStudentview()"  style="width: 110px"></button>
                    <b>{{truncatedClientName(activestudent.clientname,12)}}</b><br>
                    <div style="font-size: 0.6em; margin-bottom: 0px;">{{activestudent.clientip}}</div>
                    <div style="font-size: 0.6em; margin-top: 0px;">{{activestudent.hostname}}</div>
                    <div class="col d-inlineblock btn btn-info m-1 btn-sm"      @click="sendFiles(activestudent.token)" style="width: 110px">{{$t('dashboard.sendfileSingle')}}</div>
                    <div class="col d-inlineblock btn btn-info m-1 btn-sm"      @click="getFiles(activestudent.token, true)" :class="lockDownload ? 'disabledexam':''" style="width: 110px">{{$t('dashboard.getfileSingle')}}</div>
                    <div class="col d-inlineblock btn btn-dark m-1 btn-sm "     @click="openLatestFolder(activestudent)"  style="width: 110px;">{{$t('dashboard.shownewestfolder')}} </div>
                    <div class="col d-inlineblock btn btn-warning m-1 btn-sm"   @click='kick(activestudent.token,activestudent.clientip);hideStudentview()'  style="width: 110px">{{$t('dashboard.kick')}}</div>
                </div>
            </div>
        </div>
    </div>
    <!-- single student view END -->











    <!-- dashboard EXPLORER start -->
    <div :key="2" id=preview class=" ">
        <div id=workfolder style="overflow-y:hidden">
            <button id="closefilebrowser" type="button" class=" btn-close pt-2 pe-2 float-end" title="close"></button>
            <h4>{{$t('dashboard.filesfolder')}}: </h4> 
            <div class="ms-0 mb-3"><strong>{{currentdirectory}}</strong>  </div> 
            <div class="btn btn-dark pe-3 ps-3 me-1 mb-3 btn-sm" @click="loadFilelist(workdirectory) "><img src="/src/assets/img/svg/go-home.svg" class="" width="22" height="22" > </div>
            
            <!-- top navigation and tools -->
            <div v-if="submissionsNumber == 0" class="btn btn-warning pe-3 ps-3 me-1 mb-3 btn-sm" style="float: right;" @click="fetchSubmissions(true)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" > {{ $t('control.submissions') }}: {{submissionsNumber}} / {{ submissions.length }}</div>
            <div v-if="submissionsNumber > 0" class="btn btn-success pe-3 ps-3 me-1 mb-3 btn-sm" style="float: right;" @click="fetchSubmissions(true)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" > {{ $t('control.submissions') }}: {{submissionsNumber}} / {{ submissions.length }}</div>
            <div :class="lockPdfSummary ? 'disabledexam':''" class="btn btn-primary pe-3 ps-3 me-1 mb-3 btn-sm" style="float: right;" :title="$t('dashboard.summarizepdf')" @click="getLatest() "><img src="/src/assets/img/svg/edit-copy.svg" class="" width="22" height="22" >{{$t('dashboard.summarizepdfshort')}}</div>
            <div  v-if="(currentdirectory !== workdirectory)" class="btn btn-dark pe-3 ps-3 me-1 mb-3 btn-sm" @click="loadFilelist(currentdirectoryparent) "><img src="/src/assets/img/svg/edit-undo.svg" class="" width="22" height="22" >up </div>
            <!-- top navigation and tools END -->


            <div :key="3" style="height: 76vh; overflow-y:auto;">
                <div v-for="file in localfiles" :key="file.path" class="d-inline">
                    <hr v-if="(file.type == 'file' || file.type == 'dir')">
                    
                    <!-- open folder (folder listing on the left side) -->
                    <div v-if="(file.type == 'dir')" class="btn btn-success pe-3 ps-3 me-3 mb-2 btn-sm" @click="loadFilelist(file.path)"><img src="/src/assets/img/svg/folder-open.svg" class="" width="22" height="22" > {{file.name}} </div>
                    <!-- pdf -->
                    <div v-if="(file.type == 'file' && file.ext === '.pdf')" class="btn btn-primary pe-3 ps-3 me-3 mb-2 btn-sm" @click="loadPDF(file.path, file.name)" style="max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><img src="/src/assets/img/svg/document.svg" class="" width="22" height="22" > {{file.name}} </div>
                    <!-- images -->
                    <div v-if="(file.type == 'file' && (file.ext === '.png'|| file.ext === '.jpg'|| file.ext === '.webp'|| file.ext === '.jpeg' ) )" class="btn btn-primary pe-3 ps-3 me-3 mb-2 btn-sm" @click="loadImage(file.path)" style=" max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><img src="/src/assets/img/svg/document.svg" class="" width="22" height="22" > {{file.name}} </div>
                    <!-- other files -->
                    <div v-if="(file.type == 'file' && !(file.ext === '.pdf' || file.ext === '.png'|| file.ext === '.jpg'|| file.ext === '.webp'|| file.ext === '.jpeg' )  )" class="btn btn-info pe-3 ps-3 me-3 mb-2 btn-sm"  style=" max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default;"><img src="/src/assets/img/svg/document.svg" class="" width="22" height="22" > {{file.name}} </div>

                    <!-- delete file -->
                    <div v-if="(file.type == 'file' || file.type == 'dir')" class="btn btn-dark me-1 mb-2 btn-sm" style="float: right;" @click="fdelete(file)" :title="$t('dashboard.delete')"><img src="/src/assets/img/svg/edit-delete.svg" class="" width="22" height="22" ></div>
                    <!-- download file -->
                    <div v-if="(file.type == 'file')" class="btn btn-dark  me-1 mb-2 btn-sm " style="float: right;" @click="downloadFile(file)" :title="$t('dashboard.download')"><img src="/src/assets/img/svg/edit-download.svg" class="" width="22" height="22" ></div>
                    <!-- send file -->
                    <div v-if="(file.type == 'file')" :class="lockSendFile ? 'disabledexam':''"    class="btn btn-dark  me-1 mb-2 btn-sm " style="float: right;" @click="dashboardExplorerSendFile(file)" :title="$t('dashboard.send')"><img src="/src/assets/img/svg/document-send.svg" class="" width="22" height="22" ></div>
                    <!-- preview pdf -->
                    <div v-if="(file.type == 'file' && file.ext === '.pdf')" class="btn btn-dark me-1 mb-2 btn-sm" style="float: right;" @click="loadPDF(file.path, file.name)" :title="$t('dashboard.preview')"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" ></div>
                    <!-- preview image -->
                    <div v-if="(file.type == 'file' && (file.ext === '.png'|| file.ext === '.jpg'|| file.ext === '.webp'|| file.ext === '.jpeg' ))" class="btn btn-dark me-1 mb-2 btn-sm" style="float: right;" @click="loadImage(file.path)" :title="$t('dashboard.preview')"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" ></div>
                    
                    <!-- download folder -->
                    <div v-if="(file.type == 'dir')" class="btn btn-dark  me-1 mb-2 btn-sm " style="float: right;" @click="downloadFile(file)" :title="$t('dashboard.download')"><img src="/src/assets/img/svg/edit-download.svg" class="" width="22" height="22" ></div>
                
                </div>
           </div>
        </div>
    </div>
    <!-- dashboard EXPLORER end -->




    <!-- pdf preview start -->
    <div :key="4" id="pdfpreview" class="fadeinfast p-4">
        <WebviewPane
            id="webview"
            :src="urlForWebview"
            :visible="webviewVisible"
            :allowed-url="urlForWebview"
            :block-external="true"
            @close="hidepreview"
        />
        <PdfviewPane
            :src=currentpreview
            :currentpreviewPath=currentpreviewPath
            :currentpreviewBase64=currentpreviewBase64
            @close="hidepreview"
            @printBase64="printBase64"
            @downloadFile="downloadFile"
            @openFileExternal="openFileExternal"
        />
        <PdfRenderer
            :pdfBase64="activesheetsPreviewPdf"
            :loading="false"
            :customFields="activesheetsPreviewCustomFields"
            :blacklist="activesheetsPreviewBlacklist"
            @close="discardActivesheetsPdf"
            @save-custom-fields="saveCustomFields"
        />
    </div>
    <!-- pdf preview end -->
   





    <!-- SIDEBAR start -->
    <div :key="5" class=" text-white bg-dark d-flex flex-column sidebar-root mt-3" style="width: 240px; min-width: 240px;">
        <div class="sidebar-info-strip">
        <div class="btn btn-light text-start infobutton" @click="showinfo()">{{$t('dashboard.name')}} <br><b> {{$route.params.servername}}</b> </div>
        <div class="btn btn-light text-start infobutton" @click="showinfo()">{{$t('dashboard.pin')}}<br><b> {{ serverstatus.pin }} </b>  </div>
        <div class="btn btn-light  text-start infobutton" @click="showinfo()" style="margin-bottom: 0.7rem;">{{$t('dashboard.server')}} <br><b>{{serverip}}</b> </div>
        </div>

        
        <div class="sidebar-scroll">
        <div class="dropdown-section" :class="lockInExammode ? 'disabledexam-dropdown' : ''">
            <div class="sidebar-dropdown-inset">
            <div class="mb-1">{{$t("dashboard.exammode")}}</div>

            <div class="sidebar-exammode-row">
            <div class="dropdown sidebar-exammode-dropdown-wrap">
            <button class="btn btn-sm btn-secondary dropdown-toggle d-flex justify-content-between align-items-center sidebar-exammode-toggle w-100" style="text-align: left;" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-bs-popper="static">
                 <span>{{ getSelectedExamTypeLabel() }}</span>
            </button>
            <ul class="dropdown-menu" style="cursor: pointer;">
                <li v-if="config.exammodes && config.exammodes.math"><a class="dropdown-item" @click="selectExamType('math')" :class="{ active: isExamType('math') }">{{$t('dashboard.math')}}</a></li>
                <li v-if="config.exammodes && config.exammodes.editor"><a class="dropdown-item" @click="selectExamType('editor')" :class="{ active: isExamType('editor') }">{{$t('dashboard.lang')}}</a></li>
                <li v-if="config.exammodes && config.exammodes.eduvidual"><a class="dropdown-item" @click="selectExamType('eduvidual')" :class="{ active: isExamType('eduvidual') }">{{$t('dashboard.eduvidual')}}</a></li>
                <li v-if="config.exammodes && config.exammodes.forms"><a class="dropdown-item" @click="selectExamType('forms')" :class="{ active: isExamType('forms') }">{{$t('dashboard.forms')}}</a></li>
                <li v-if="config.exammodes && config.exammodes.website"><a class="dropdown-item" @click="selectExamType('website')" :class="{ active: isExamType('website') }">Website</a></li>
                <li v-if="config.exammodes && config.exammodes.activesheets"><a class="dropdown-item" @click="selectExamType('activesheets')" :class="{ active: isExamType('activesheets') }">Active Sheets</a></li>
                <li v-if="config.exammodes && config.exammodes.microsoft365"><a class="dropdown-item" @click="selectExamType('microsoft365')" :class="{ active: isExamType('microsoft365') }">Microsoft365</a></li>
                <li v-if="config.exammodes && config.exammodes.rdp"><a class="dropdown-item" @click="selectExamType('rdp')" :class="{ active: isExamType('rdp') }">RDP</a> </li>
                <li v-if="config.exammodes && config.exammodes.localvm"><a class="dropdown-item" @click="selectExamType('localvm')" :class="{ active: isExamType('localvm') }">LocalVM</a> </li>
            </ul>
            </div>
            <button v-if="!isExamType('activesheets') && !isExamType('math') && !isExamType('website') && !isExamType('eduvidual') && !isExamType('rdp') && !isExamType('microsoft365')" class="btn btn-sm btn-secondary p-0 sidebar-exammode-settings" :class="lockSettings ? 'disabledexam' : ''" style="width: 31px; height: 31px; display: inline-flex; vertical-align: middle; justify-content: center; align-items: center;" @click="selectExamType(serverstatus.examSections[serverstatus.activeSection].examtype)"  @mouseover="showDescription($t('dashboard.extendedsettings_mode'))"  @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" class="white-100" width="22" height="22">
            </button>
            </div>
            </div>

            <div class="mt-2">
                <!-- Editor / Sprachen Config -->
                <div v-if="isExamType('editor')" class="basematerial-sidebar-block basematerial-sidebar-block--optional mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.texteditor') }}</div>

                    <div class="basematerial-row">
                        <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                        <select class="form-select form-select-sm"
                                :value="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.spellchecklang || 'de-DE'"
                                @change="setEditorExamConfigPatch({ spellchecklang: $event.target.value })">
                            <option value="de-DE">{{ $t('dashboard.de') }}</option>
                            <option value="en-GB">{{ $t('dashboard.en') }}</option>
                            <option value="en-US">{{ $t('dashboard.en_us') }}</option>
                            <option value="fr-FR">{{ $t('dashboard.fr') }}</option>
                            <option value="es-ES">{{ $t('dashboard.es') }}</option>
                            <option value="it-IT">{{ $t('dashboard.it') }}</option>
                            <option value="sl-SI">{{ $t('dashboard.sl') }}</option>
                            <option value="none">{{ $t('dashboard.none') }}</option>
                        </select>
                    </div>

                    <div class="mt-2" style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button"
                                class="btn btn-sm"
                                :class="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool ? 'btn-teal' : 'btn-outline-secondary'"
                                @click="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool ? setEditorExamConfigPatch({ languagetool: false, languagetoolhost: null, languagetoolport: null, suggestions: false }) : setEditorExamConfigPatch({ languagetool: true })">
                            LanguageTool
                        </button>
                        <button type="button"
                                class="btn btn-sm"
                                :disabled="!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool"
                                :class="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.suggestions ? 'btn-teal' : 'btn-outline-secondary'"
                                @click="setEditorExamConfigPatch({ suggestions: !serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.suggestions })">
                            {{ $t('dashboard.suggest') }}
                        </button>
                    </div>

                    <div class="mt-2">
                        <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetoolhost">
                            <div class="btn-group basematerial-filegroup w-100" role="group">
                                <button type="button"
                                        class="btn btn-sm btn-teal basematerial-filename text-truncate"
                                        :title="`${serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolhost}${(serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetoolport && !String(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolhost).match(/:\\d+$/)) ? `:${serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolport}` : ''}`"
                                        @click="configureCustomLanguageToolHost()">
                                    <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolhost }}{{ (serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetoolport && !String(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolhost).match(/:\d+$/)) ? `:${serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.languagetoolport}` : '' }}</span>
                                </button>
                                <button type="button"
                                        class="btn btn-sm btn-secondary basematerial-remove"
                                        :title="$t('dashboard.removefile')"
                                        @click="removeCustomLanguageToolHost()">
                                    &times;
                                </button>
                            </div>
                        </template>
                        <button v-else type="button"
                                class="btn btn-sm btn-outline-secondary sidebar-pick-btn w-100"
                                :disabled="!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool"
                                @click="configureCustomLanguageToolHost()">
                            <span class="sidebar-pick-btn__label">{{ $t('dashboard.customhost') }}</span>
                            <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                        </button>
                    </div>

                    <div class="mt-2">
                        <div class="smalltext text-white-50 mb-0">{{ $t('dashboard.cmargin-value') }}</div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="range" class="form-range editor-cmargin-range"
                                   min="2" max="5" step="0.5"
                                   :value="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.cmargin?.size ?? 3"
                                   @input="setEditorExamConfigPatch({ cmargin: { side: 'right', size: parseFloat($event.target.value) } })" />
                            <div class="smalltext text-white-50" style="min-width:44px;">
                                {{ (serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.cmargin?.size ?? 3) }}cm
                            </div>
                        </div>
                    </div>

                    <div class="mt-1">
                        <div class="smalltext text-white-50 mb-0">{{ $t('dashboard.linespacing') }}</div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="range" class="form-range editor-linespacing-range"
                                   min="1" max="3" step="1"
                                   :value="Number(serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.linespacing || 2)"
                                   @input="setEditorExamConfigPatch({ linespacing: String($event.target.value) })" />
                            <div class="smalltext text-white-50" style="min-width:44px;">
                                {{ String(serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.linespacing || '2') }}x
                            </div>
                        </div>
                    </div>

                    <div class="mt-1">
                        <div class="smalltext text-white-50 mb-0">{{ $t('dashboard.fontfamily') }}</div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="btn btn-sm"
                                    :class="(serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.fontfamily || 'sans-serif') === 'serif' ? 'btn-teal' : 'btn-outline-secondary'"
                                    @click="setEditorExamConfigPatch({ fontfamily: 'serif' })">serif</button>
                            <button type="button" class="btn btn-sm"
                                    :class="(serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.fontfamily || 'sans-serif') === 'sans-serif' ? 'btn-teal' : 'btn-outline-secondary'"
                                    @click="setEditorExamConfigPatch({ fontfamily: 'sans-serif' })">sans-serif</button>
                        </div>
                    </div>

                    <div class="mt-1">
                        <div class="smalltext text-white-50 mb-0">{{ $t('dashboard.fontsize') }}</div>
                        <select class="form-select form-select-sm"
                                :value="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.fontsize || '12pt'"
                                @change="setEditorExamConfigPatch({ fontsize: $event.target.value })">
                            <option value="8pt">8 pt</option>
                            <option value="10pt">10 pt</option>
                            <option value="12pt">12 pt</option>
                            <option value="14pt">14 pt</option>
                            <option value="16pt">16 pt</option>
                            <option value="18pt">18 pt</option>
                            <option value="20pt">20 pt</option>
                        </select>
                    </div>

                    <div class="mt-1 mb-2">
                        <div class="smalltext text-white-50 mb-0">{{ $t('dashboard.audiorepeattitle') }}</div>
                        <select class="form-select form-select-sm"
                                :value="String(serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.audioRepeat ?? '0')"
                                @change="setEditorExamConfigPatch({ audioRepeat: $event.target.value })">
                            <option value="0">{{ $t('dashboard.audioallow') }}</option>
                            <option value="1">1{{ $t('dashboard.audiorepeat1') }}</option>
                            <option value="2">2{{ $t('dashboard.audiorepeat2') }}</option>
                            <option value="3">3{{ $t('dashboard.audiorepeat2') }}</option>
                            <option value="4">4{{ $t('dashboard.audiorepeat2') }}</option>
                        </select>
                    </div>
                </div>

                <!-- Website Config -->
                <div v-if="isExamType('website')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.website') }}</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.website?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.url" @click="openAllowedUrl(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website)">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.url }}</span>
                                    </button>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.blockSubdomains" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubdomainsInfo')"><span class="sd-sf-stack">SD</span></div>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.blockSubfolders" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubfoldersInfo')"><span class="sd-sf-stack">SF</span></div>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeWebsiteUrl('a')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureWebsite('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.chooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.website?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.website.url" @click="openAllowedUrl(serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.website)">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.website.url }}</span>
                                    </button>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.website.blockSubdomains" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubdomainsInfo')"><span class="sd-sf-stack">SD</span></div>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.website.blockSubfolders" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubfoldersInfo')"><span class="sd-sf-stack">SF</span></div>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeWebsiteUrl('b')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureWebsite('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.chooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.website?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.url" @click="openAllowedUrl(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website)">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.url }}</span>
                                    </button>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.blockSubdomains" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubdomainsInfo')"><span class="sd-sf-stack">SD</span></div>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.website.blockSubfolders" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubfoldersInfo')"><span class="sd-sf-stack">SF</span></div>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeWebsiteUrl('all')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureWebsite('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.chooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>

                <!-- Eduvidual Config -->
                <div v-if="isExamType('eduvidual')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.testUrl') }}</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.eduvidual?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.eduvidual.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.eduvidual.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.eduvidual.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEduvidualUrl('a')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureEduvidual('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.testUrlChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.eduvidual?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.eduvidual.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.eduvidual.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.eduvidual.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEduvidualUrl('b')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureEduvidual('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.testUrlChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.eduvidual?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.eduvidual.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.eduvidual.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.eduvidual.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEduvidualUrl('all')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureEduvidual('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.testUrlChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>

                <!-- Forms Config -->
                <div v-if="isExamType('forms')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.formsUrl') }}</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.gforms?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.gforms.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.gforms.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.gforms.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeFormsUrl('a')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureForms('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.formsChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.gforms?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.gforms.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.gforms.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.gforms.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeFormsUrl('b')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureForms('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.formsChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.gforms?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.gforms.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.gforms.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.gforms.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeFormsUrl('all')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureForms('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.formsChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>

                <!-- RDP Config -->
                <div v-if="isExamType('rdp')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.rdp') }}</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.rdp?.domain">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.rdp.domain">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.rdp.domain }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeRdp('a')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureRDP('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.rdpChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.rdp?.domain">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.rdp.domain">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.rdp.domain }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeRdp('b')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureRDP('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.rdpChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.rdp?.domain">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.rdp.domain">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.rdp.domain }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeRdp('all')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureRDP('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.rdpChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>


                <!-- Active Sheets: panel with group pills, filename, remove -->
                <div v-if="isExamType('activesheets')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.activesheetsPanelCaption') }}</div>
                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.activeSheets?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filename" @click="showBase64PdfInRenderer(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filecontent, serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filename, 'A')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeActiveSheet('A')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureActivesheets('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.activesheetsNoPdf') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.activeSheets?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.activeSheets.filename" @click="showBase64PdfInRenderer(serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.activeSheets.filecontent, serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.activeSheets.filename, 'B')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.activeSheets.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeActiveSheet('B')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureActivesheets('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.activesheetsNoPdf') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.activeSheets?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filename" @click="showBase64PdfInRenderer(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filecontent, serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filename, 'A')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.activeSheets.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeActiveSheet('A')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureActivesheets('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.activesheetsNoPdf') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>

                <!-- Microsoft365 Buttons -->
                <div v-if="isExamType('microsoft365')" class="sidebar-dropdown-inset mt-2">
                    <div class="d-flex flex-column gap-2">
                    <!-- Connect Button -->
                    <button v-if="!config.accessToken" @click="openAuthWindow()" class="btn btn-sm btn-primary">
                        <img src="/src/assets/img/svg/win.svg" width="24" height="24">
                        <span class="ms-1">{{ $t('dashboard.connect') }}</span>
                    </button>

                    <!-- Logout Button -->
                    <button v-if="config.accessToken" @click="logout365()" class="btn btn-sm btn-warning">
                        <img src="/src/assets/img/svg/win.svg" width="24" height="24">
                        <span class="ms-1">{{ $t('dashboard.logout') }}</span>
                    </button>
                    </div>
                </div>

                <!-- Microsoft365 Template (docx/xlsx) -->
                <div v-if="isExamType('microsoft365') && config.accessToken" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.microsoft365') }}</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.microsoft365?.template?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.microsoft365.template.filename" @click="configureMicrosoft365Template('a')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.microsoft365.template.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeMicrosoft365Template('a')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureMicrosoft365Template('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.templateChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.microsoft365?.template?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.microsoft365.template.filename" @click="configureMicrosoft365Template('b')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.microsoft365.template.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeMicrosoft365Template('b')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureMicrosoft365Template('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.templateChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.microsoft365?.template?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.microsoft365.template.filename" @click="configureMicrosoft365Template('all')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.microsoft365.template.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeMicrosoft365Template('all')">&times;</button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureMicrosoft365Template('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.templateChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>
            </div>
        </div>


        <!-- Files Section START -->
        <div class="materials-sidebar-block mt-3 mb-2">
            <div class="materials-sidebar-header">
                <div class="materials-panel-caption">{{ $t('dashboard.materials') }}</div>
            </div>
            <MaterialsList
                class="materials-sidebar-list"
                :examSection="serverstatus.examSections[serverstatus.activeSection]"
                :exammode="serverstatus.exammode"
                @remove-file="handleFileRemove"
                @choose-materials="handleChooseMaterialsGroup"
                @show-preview="(base64, filename) => showBase64FilePreview.call(this, base64, filename)"
                @show-pdf-in-renderer="(base64, filename) => showBase64PdfInRenderer.call(this, base64, filename)"
                @show-image-preview="showBase64ImagePreview"
                @play-audio-file="playAudioFile"
                @remove-allowed-url="handleAllowedUrlRemove"
                @open-allowed-url="openAllowedUrl"
            />
        </div>
        <!-- Files Section END -->


        <!-- Section name: moved to tabs (pencil icon) -->
        


        <!-- BIP Section START -->
        <div v-if="bipToken && this.serverstatus.bip" class="mb-4">
            <span class="small m-1">{{$t("dashboard.bildungsportal")}}</span><span v-if="bipToken" class="small m-1 me-0 text-secondary">(verbunden)</span>
            <div id="biploginbutton" @click="showBipInfo()" class="disabledbutton btn btn-success m-1" style="padding:0;">
                <img id="biplogo" style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span v-if="bipUsername" id="biploginbuttonlabel" style="padding:2px; font-size:0.9em;">{{bipUsername}}</span><span style="padding:2px; font-size:0.9em;" v-else id="biploginbuttonlabel">Login</span>
            </div> 
        </div>
        <!-- BIP Section END -->
        
        <div v-if="showDesc" id="description" class="btn sidebar-message w-100" style="white-space: pre-line;" v-html="currentDescription"></div>
        <div id="statusdiv" class="btn btn-warning sidebar-message w-100"> {{$t('dashboard.connected')}}  </div>

        </div>

        <span @click="showCopyleft()" class="sidebar-footer mt-auto">
            <span style=" display:inline-block; transform: scaleX(-1);font-size:1.2em; ">&copy; </span> 
            <span style="vertical-align: text-bottom;">&nbsp;{{version}} {{ info }}</span>
        </span>
       
    </div>
    <!-- SIDEBAR END -->





     <!-- AUDIO Player start -->
     <div id="aplayer" >
            <div style="text-align: left; margin-left: 40px;">{{ audioFilename }} </div>
            <audio id="audioPlayer" controls controlsList="nodownload noplaybackrate" >
                <source :src="audioSource" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <button  id="audioclose" type="button" class="btn-close" style="" title="close" ></button> 
        </div>
    <!-- AUDIO Player end -->




    <!-- SETUP DIALOG START -->
    <div :key="6" id="setupoverlay" class="" @click="hideSetup()">
        <div id="setupdiv">
            <!-- <div class="swal2-icon swal2-question swal2-icon-show" style="display: flex;"><div class="swal2-icon-content">?</div></div> -->
            <div class="mb-3"><h5 style="display: inline">{{ $t('dashboard.extendedsettings') }}</h5></div>
            <div class="m-1 mb-2">
                <label for="backupintervalSlider" class="form-check-label"> {{$t('dashboard.autoget')}} </label>
                <span v-if="serverstatus.backupintervalPause > 0" class="ms-2 text-black-50">| {{serverstatus.backupintervalPause}}min </span>
                <span v-else class="ms-2 text-black-50">| {{$t('dashboard.disabled')}}</span>
                <input id="backupintervalSlider" type="range" 
                    v-model="serverstatus.backupintervalPause" 
                    :title="$t('dashboard.backupautoquestion')"
                    :min="0" :max="20" step="1" 
                    class="form-range custom-slider" 
                    @input="updateBackupInterval">
            </div>
            <div class="m-1 mb-2">
                <label for="screenshotIntervalSlider" class="form-check-label"> {{$t('dashboard.screenshot')}} </label>
                <span v-if="serverstatus.screenshotinterval > 0" class="ms-2 text-black-50">| {{serverstatus.screenshotinterval}}s</span>
                <span v-else class="ms-2 text-black-50">| {{$t('dashboard.disabled')}}</span>
                <div class="d-flex align-items-center">
                    <input id="screenshotIntervalSlider" type="range"
                        v-model="serverstatus.screenshotinterval"
                        :title="$t('dashboard.screenshotquestion')"
                        :min="0" :max="60" step="2"
                        class="form-range custom-slider"
                        @input="updateScreenshotInterval">
                </div>
            </div>
            <div class="form-check form-switch m-1 mb-2">
                <input id="screenshotOcr" type="checkbox" :title="$t('dashboard.ocrinfo')" v-model="serverstatus.screenshotocr" class="form-check-input" @change="updateScreenshotInterval">
                <label for="screenshotOcr" class="form-check-label">{{$t('dashboard.ocr')}}</label>
            </div>
            <div class="form-check form-switch  m-1 mb-2">
                <input v-model=serverstatus.useExamSections @change="onToggleExamSections" :disabled="sectionsLocked" :title="sectionsLocked ? $t('dashboard.sectionslocked') : $t('dashboard.activatesections')" checked=false class="form-check-input" type="checkbox" id="activatesections">
                <label class="form-check-label" :class="{'text-muted': sectionsLocked}">{{$t('dashboard.activatesections')}}   </label><br>
            </div>
            <div v-if="serverstatus.useExamSections" class="form-check form-switch  m-1 mb-2 ms-3">
                <input v-model=serverstatus.allowSectionSwitch @click="" :title="$t('dashboard.allowsectionswitch')" checked=false class="form-check-input" type="checkbox" id="allowsectionswitch">
                <label class="form-check-label">{{$t('dashboard.allowsectionswitchshort')}}   </label><br>
            </div>
            <div class="form-check form-switch  m-1 mb-2">
                <input v-model=serverstatus.examSections[serverstatus.activeSection].groups @click="setupGroups()" :title="$t('dashboard.groupinfo')" checked=false class="form-check-input" type="checkbox" id="activategroups">
                <label class="form-check-label">{{$t('dashboard.groups')}}   </label><br>
            </div>

            <div class="form-check form-switch  m-1 mb-2">
                <input v-model=muteAudio @click="" :title="$t('dashboard.muteaudiointro')" checked=false class="form-check-input" type="checkbox" id="muteaudio">
                <label class="form-check-label">{{$t('dashboard.muteaudio')}}   </label><br>
            </div>


            <div v-if="config.bipIntegration && bipToken" class="form-check form-switch  m-1 mb-2" >
                <input v-model=serverstatus.requireBiP :title="$t('control.biprequired')" checked=false class="form-check-input" type="checkbox" id="activatebip">
                <label class="form-check-label">{{$t('dashboard.bildungsportal')}}   </label><br>
            </div>
            <div class="form-check form-switch  m-1 mb-2">
                <input v-model="serverstatus.directPrintAllowed" @change="checkforDefaultprinter(); setServerStatus()" :title="$t('dashboard.allowdirectprint')" checked=false class="form-check-input" type="checkbox" id="directprint">
                <label class="form-check-label">{{$t('dashboard.directprint')}}   </label><br>
                <div v-if="defaultPrinter" class="ellipsis text-black-50"> {{ defaultPrinter }}</div>
                <div v-if="!defaultPrinter" class="ellipsis text-black-50" style="max-width: 300px!important;"> {{$t('dashboard.noprinterChosen')}}</div>
            </div>
            <hr>
            <span><h6 style="display: inline">{{ $t('dashboard.defaultprinter') }}</h6></span>
            <div v-if="(availablePrinters.length < 1)">
                <button class="btn btn-secondary mt-1 mb-0"><img src="/src/assets/img/svg/print.svg" class="" width="22" height="22" >  no printer found </button>
            </div>
            <div v-for="printer in availablePrinters" :key="printer.printerName" style="position: relative;">
                <button @click="selectPrinter(printer)" :class="{'btn-cyan': defaultPrinter === printer.printerName}" class="printerbutton btn btn-secondary mt-1 mb-0" @mouseenter="visiblePrinter = printer" @mouseleave="visiblePrinter = null"><img src="/src/assets/img/svg/print.svg" alt="print" width="22" height="22" /> {{ printer.printerName }} </button>
                <div v-if="visiblePrinter === printer" class="tooltip-content"> {{ printer.printerName }} </div>
                <!-- Icon für den Standarddrucker -->
                <img v-if="printer.printerName === defaultPrinter" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" />
            </div>

       
       



            <div v-if="currentpreviewPath && defaultPrinter">
                <button id="printButton" class="btn btn-dark mt-1 mb-0" @click="printBase64();hideSetup()"><img src="/src/assets/img/svg/print.svg" class="" width="22" height="22" > Print: {{ currentpreviewname }} </button>
            </div> 
            <div>  <!-- ok button resets currentpreviewPath / print button only appears if currentpreviewPath is set and defaultprinter is set -->
                <div id="okButton" class="btn mt-3 btn-success" @click="hideSetup(); this.currentpreviewPath=null;">{{$t('general.ok')}}</div> 
        <!-- ok button resets currentpreviewPath / print button only appears if currentpreviewPath is set and defaultprinter is set -->
                <div id="cancelButton" class="btn mt-3 ms-1 btn-danger" @click="hideSetup(false); this.currentpreviewPath=null;">{{$t('dashboard.cancel')}}</div>
            </div>
        </div>
       
    </div>
    <!-- SETUP DIALOG END -->

   
    <div :key="7" id="content" class="fadeinslow p-3">
       

        <!-- CONTROL BUTTONS START -->
       <div class="control-buttons-container">
        <div v-if="(serverstatus.exammode && numberOfConnections == 1)" class="btn btn-danger m-1 mt-0 text-start ms-0 " style="width:128px; height:62px; display:inline-flex" @click="endExam();hideDescription();"  @mouseover="showDescription($t('dashboard.exitkiosk'))" @mouseout="hideDescription"  >
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;"> {{numberOfConnections}} {{$t('dashboard.stopexamsingle')}} </div>
        </div>
        <div v-if="(serverstatus.exammode && numberOfConnections != 1)" class="btn btn-danger m-1 mt-0 text-start ms-0 " style="width:128px; height:62px; display:inline-flex" @click="endExam();hideDescription();"  @mouseover="showDescription($t('dashboard.exitkiosk'))" @mouseout="hideDescription"  >
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;"> {{numberOfConnections}} {{$t('dashboard.stopexam')}} </div>
        </div>

        <div v-if="(!serverstatus.exammode && numberOfConnections == 1)" class="btn btn-teal m-1 mt-0 text-start ms-0"  @click="startExam();hideDescription();"  @mouseover="showDescription($t('dashboard.startexamdesc'))" @mouseout="hideDescription" :class="!hasMandatoryBasematerialReady ? 'disabledgreen':''" style="width:128px; height:62px; display:inline-flex">
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;">{{numberOfConnections}} {{$t('dashboard.startexamsingle')}}</div>
        </div>

        <div v-if="(!serverstatus.exammode && numberOfConnections != 1)" class="btn btn-teal m-1 mt-0 text-start ms-0"  @click="startExam();hideDescription();"  @mouseover="showDescription($t('dashboard.startexamdesc'))" @mouseout="hideDescription" :class="!hasMandatoryBasematerialReady ? 'disabledgreen':''" style="width:128px; height:62px; display:inline-flex">
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;">{{numberOfConnections}} {{$t('dashboard.startexam')}}</div>
        </div>

        <div class="btn btn-cyan m-1 mt-0 text-start ms-0" @click="getFiles('all', true); hideDescription();"  @mouseover="showDescription($t('dashboard.getfile'))" @mouseout="hideDescription"  :class="lockDownload ? 'disabledexam':''"  style="width:128px; height:62px;display:inline-flex" >
            <img src="/src/assets/img/svg/edit-download.svg" class="mt-2" width="32" height="32" style="vertical-align: top;">
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;">{{$t('dashboard.getfiles')}}</div>
        </div>
        <div class="btn btn-cyan m-1 mt-0 text-start ms-0" @click="fetchSubmissions(); loadFilelist(workdirectory);hideDescription();"  @mouseover="showDescription($t('dashboard.showworkfolder'))" @mouseout="hideDescription"  style="width: 128px; height:62px; display:inline-flex">
            <img src="/src/assets/img/svg/folder-open.svg" class="mt-2" width="32" height="32" style="vertical-align: top;" >
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;">{{$t('dashboard.workfolder')}}</div>
        </div>
        <div v-if="bipToken && serverstatus.bip" @mouseover="showDescription($t('dashboard.bipinfo'))" @mouseout="hideDescription" class="btn m-1 mt-0 ms-0 text-start p-1 pt-2 ps-2" :class="bipStatus === 'closed' ? 'btn-warning' : 'btn-teal'" @click="toggleBipStatus" style="width:128px; height:62px; display:inline-flex">
            <img src="/src/assets/img/svg/globe.svg" class=" mt-1" width="32" height="32" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;" class="">BiP-Status {{bipStatus}}</div>
        </div>       
        </div>  

 

        <div class="tab-buttons-container">
            <div class="btn btn-dark tab-button" 
                @click="sendFiles('all');hideDescription();" 
                @mouseover="showDescription($t('dashboard.sendfile'))" 
                @mouseout="hideDescription">
                <img src="/src/assets/img/svg/document-send.svg" width="24" height="24">
            </div>

            <div v-if="serverstatus.screenslocked" 
                class="btn btn-danger tab-button" 
                @click="lockscreens(false);hideDescription();">
                <img src="/src/assets/img/svg/eye-fill.svg" class="white" width="24" height="24">
            </div>

            <div v-else 
                class="btn btn-dark tab-button" 
                @click="lockscreens(true);hideDescription();" 
                @mouseover="showDescription($t('dashboard.lock'))" 
                @mouseout="hideDescription">
                <img src="/src/assets/img/svg/eye-slash-fill.svg" class="white" width="24" height="24">
            </div>

            <div class="btn btn-dark tab-button" 
                @mouseover="showDescription($t('dashboard.del'))" 
                @mouseout="hideDescription" 
                @click="delfolderquestion">
                <img src="/src/assets/img/svg/edit-delete.svg" width="24" height="24">
            </div>
        </div>
        <!-- CONTROL BUTTONS END -->


        <!-- LOG START -->
        <div id="loginfo">
            <div id="logcheck" @click="fetchLOG();"> <div id="eye" class="darkgreen eyeopen"></div> &nbsp;Server Log</div>
            
            <div class="logscrollarea" id="logscrollarea">     
                
                <div v-if="serverlog.length == 0"  style="text-align: left; font-size: 0.8em; margin-left:10px;"> ... </div> 
                <div v-for="entry in serverlog" class="logentry">
                    <div style="display:flex;align-items: center; width:100%; ">
                        <div :style="'background-color:' + entry.color "  class="color-circle" style="width: 10px; height: 10px;"></div>&nbsp;
                        <div class="error-word" style="flex:1" :style="'color:' + entry.color "> {{ entry.source }} </div>
                    </div>   
                    <div v-if="entry.text">{{ entry.text}}</div>
                    <div class="date"> <span>  {{ entry.date }}</span> </div>
                </div> 
            </div>

            <div id="logrefresh" class="form-check form-switch" style="position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); width: 60px; margin:auto auto"> 
                <input type="checkbox" id="logrefreshcheckbox" v-model="serverlogReload" class="form-check-input" title="Refresh Log" style="width: 50px; height: 15px;"> 
             </div>
        </div>
        <!-- LOG END -->







        <!-- studentlist start -->
        <div id="studentslist" class="pt-1">        
            <draggable v-model="studentwidgets" :move="handleMoveItem" @end="handleDragEndItem" ghost-class="ghost">
                <div v-for="student in studentwidgets" :key="student.token" style="cursor:auto" v-bind:class="(!student.focus)?'focuswarn':''" class="studentwidget btn rounded-3 btn-block">
                    <div v-if="student.clientname">
                        <div class="studentimage rounded" style="position: relative; height:128px;">  
                             
                            <button v-if="serverstatus.examSections[serverstatus.activeSection].examtype === 'editor' && !serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool && serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.spellchecklang !== 'none'" 
                                @mouseover="showDescription($t('dashboard.allowspellcheck'))" 
                                @mouseout="hideDescription" @click='activateSpellcheckForStudent(student.token,student.clientname)' 
                                type="button" 
                                class="btn btn-sm pt-0 mt-0 pe-0 float-end" 
                                style="z-index:100; position:relative;">
                                <img src="/src/assets/img/svg/autocorrection.svg" class="widgetbutton" width="22" height="22" >
                            </button> 
     
                            <div v-cloak :id="student.token" style="position: relative;background-size: cover; height: 128px;" v-bind:style="(student.imageurl && now - 20000 < student.timestamp)? `background-image: url('${student.imageurl}')`:'background-image: url(user-red.svg)'"></div>
                            <div v-if="student.virtualized && now - 20000 < student.timestamp" class="virtualizedinfo" @mouseover="showDescription($t('dashboard.virtualizedinfo'), { vmFindings: student.vmFindings, webglFindings: student.webglFindings })" @mouseout="hideDescription">{{$t("dashboard.virtualized")}}</div>
                            <div v-if="!student.focus && now - 20000 < student.timestamp" class="kioskwarning" @mouseover="showDescription($t('dashboard.leftkioskinfo'))" @mouseout="hideDescription">{{$t("dashboard.leftkiosk")}}</div>
                            <div v-if="student.status.sendexam && now - 20000 < student.timestamp" class="examrequest" @mouseover="showDescription($t('dashboard.examrequestinfo'))" @mouseout="hideDescription">{{$t("dashboard.examrequest")}}</div>
                            <div v-if="student.remoteassistant && now - 20000 < student.timestamp" class="remoteassistant" @mouseover="showDescription($t('dashboard.remoteassistantinfo'), student.remoteassistant)" @mouseout="hideDescription">{{$t("dashboard.remoteassistant")}}</div>
                            <span class="rounded">   
                                <div v-if="now - 20000 < student.timestamp" style="display: inline-block; overflow: hidden; width: 140px; height: 22px" @mouseover="showDescription($t('dashboard.documentsinfo') + student.files)" @mouseout="hideDescription"> 
                                    <img v-for="file in student.files" style="width:22px; margin-left:-4px; position: relative; filter: sepia(10%) hue-rotate(306deg) brightness(0.3) saturate(75);" class="" src="/src/assets/img/svg/document.svg">
                                </div>
                                <div v-if="now - 20000 < student.timestamp" style="display: inline-block; margin: 0px; position: absolute; right: 4px;" >
                                    <img src="/src/assets/img/svg/edit-delete.svg" width="22" height="22" class="delfolderstudent" @click="delfolderquestion(student.token)"  @mouseover="showDescription($t('dashboard.delsingle'))" @mouseout="hideDescription" >
                                </div>
                                <br>
                                {{ truncatedClientName(student.clientname) }}  
                                <button  @click='kick(student.token,student.clientip)'  @mouseover="showDescription($t('dashboard.kick'))" @mouseout="hideDescription" type="button" class=" btn-close  btn-close-white pt-1 pe-2 float-end"></button> 
                            </span>
                        </div>

                        <!-- bottom buttons START-->
                        <div class="btn-group pt-0" role="group" style="">
                            <button v-if="(now - 20000 < student.timestamp)" @click="showStudentview(student)" @mouseover="showDescription(getStudentInfoText(student), false, true)" @mouseout="hideDescription" type="button" :class="['btn btn-sm', isVersionMismatch(student) ? 'btn-warning' : 'btn-cyan']" style="border-top:0px; border-top-left-radius:0px; border-top-right-radius:0px; ">
                                <img :src="isVersionMismatch(student) ? '/src/assets/img/svg/exclamation-triangle-fill.svg' : '/src/assets/img/svg/eye-fill.svg'" :class="isVersionMismatch(student) ? 'text-dark' : 'white'" width="18" height="18" >
                            </button>
                            <button v-if="(now - 20000 > student.timestamp)" type="button" class="btn btn-outline-danger btn-sm " style="border-top:0px; border-top-left-radius:0px; border-top-right-radius:0px; ">{{$t('dashboard.offline')}} </button>
                            <button v-if="(now - 20000 < student.timestamp) && student.exammode && student.focus" @mouseover="showDescription($t('dashboard.secureinfo'))" @mouseout="hideDescription"  @click='' type="button" 
                                class="btn btn-danger btn-sm" style=" cursor:default; border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px; border-bottom-right-radius: 5px;" >
                                <img src="/src/assets/img/svg/shield-lock.svg" class="white" width="18" height="18" >
                            </button>
                            <button v-if="(now - 20000 < student.timestamp) && !student.focus" @mouseover="showDescription($t('dashboard.resumeinfo'))" @mouseout="hideDescription"   @click='restore(student.token)' type="button" class="btn btn-warning btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px; border-bottom-right-radius: 5px;"> {{$t('dashboard.restore')}} </button>
                            
                            <!-- group buttons START -->
                            <button v-if="(now - 20000 < student.timestamp) && serverstatus.examSections[serverstatus.activeSection].groups && student.status.group == 'a' "   @click='quickSetGroup(student)' type="button" class="btn-click-feedback2 btn btn-info btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> A  </button>
                            <button v-if="(now - 20000 < student.timestamp) && serverstatus.examSections[serverstatus.activeSection].groups && student.status.group == 'b' "  @click='quickSetGroup(student)' type="button" class="btn-click-feedback1 btn btn-warning btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> B  </button>
                            <!-- group buttons END -->
                        </div>
                       

                        <button v-if="submissions.find(s => s.studentName === student.clientname)?.sections[serverstatus.activeSection]?.path"  
                            @click='getSpecificSubmissionBase64(submissions.find(s => s.studentName === student.clientname).sections[serverstatus.activeSection].path)' 
                            @mouseover="showDescription($t('dashboard.showsubmission'))" 
                            @mouseout="hideDescription" 
                            type="button" 
                            class="btn btn-teal btn-sm " 
                            style="float:right; border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px; border-bottom-right-radius:5px; border-bottom-left-radius:5px;"> 
                            <img src="/src/assets/img/icons/next-exam.png" class="white-100" width="18" height="18" > 
                        </button>
                        <!-- bottom buttons END -->
                    </div>
                </div> 
            </draggable>  
        </div>
        <!-- studentlist end -->



    </div>
 









    <!-- sort student widgets button -->
    <div style="position: fixed; bottom:20px; right: 20px; filter:opacity(50%)" class="col d-inlineblock btn " @click="sortStudentWidgets()">
        <img src="/src/assets/img/svg/view-sort-ascending-name.svg" class="white" title="sort" width="24" height="24" >  
    </div>
    <!-- sort student widgets button end -->
</div>
</template>









<script lang="ts">
import { VueDraggableNext } from 'vue-draggable-next'
import { v4 as uuidv4 } from 'uuid'
import {SchedulerService} from '../utils/schedulerservice.js'
import MaterialsList from '../components/materialsList.vue'
import WebviewPane from '../components/WebviewPane.vue'
import PdfviewPane from '../components/PdfviewPane.vue'
import PdfRenderer from '../components/PdfRenderer.vue'

import { uploadselect, onedriveUpload, onedriveUploadSingle, uploadAndShareFile, createSharingLink, fileExistsInAppFolder, downloadFilesFromOneDrive} from '../msalutils/onedrive'
import { handleDragEndItem, handleMoveItem, sortStudentWidgets, initializeStudentwidgets} from '../utils/dragndrop'
import { loadFilelist, getLatest, processPrintrequest,  loadImage, loadPDF, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete,  openLatestFolder, printBase64, showBase64FilePreview, showBase64ImagePreview, showBase64PdfInRenderer } from '../utils/filemanager'
import { activateSpellcheckForStudent, delfolderquestion, stopserver, sendFiles, lockscreens, getFiles, startExam, endExam, kick, restore } from '../utils/exammanagement.js'
import { configureWebsite, configureEduvidual, configureForms, configureMicrosoft365Template, removeMicrosoft365Template, removeWebsiteUrl, removeEduvidualUrl, removeRdp, removeFormsUrl, setEditorExamConfigPatch, configureCustomLanguageToolHost, removeCustomLanguageToolHost, configureActivesheets, configureRDP, configureLocalVM, defineMaterials, handleAllowedUrlRemove, openAllowedUrl, addFileAsExamMaterial } from '../utils/examsetup.js'
import { Exam } from '../types/api'

class EmptyWidget {
    constructor() {
        this.clientname = false
        this.token = uuidv4()   //generate new id for every new instance
        this.imageurl="user-black.svg"    
    }
}

export default {
    components: {
        draggable: VueDraggableNext,
        MaterialsList: MaterialsList,
        WebviewPane: WebviewPane,
        PdfviewPane: PdfviewPane,
        PdfRenderer: PdfRenderer
    },
    data() {
        return {
            version: this.$route.params.version,
            info: config.info,
            title: document.title,
            fetchinterval: null,
            backupinterval: null,
            buildDate: this.$route.params.config.buildDate,
            studentlist: [],
            workdirectory: `${this.$route.params.workdirectory}/${this.$route.params.servername}`,
            currentdirectory: this.$route.params.workdirectory,
            currentdirectoryparent: '',
            servername: this.$route.params.servername,
            servertoken: this.$route.params.servertoken,
            serverip: this.$route.params.serverip,
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            hostname: window.location.hostname,
            config :this.$route.params.config,
            hostip: this.$route.params.config.hostip,
            now : null,
            files: null,
            autobackup: true,
            autoscreenshot: true,
            activestudent: null,
            localfiles: null,
            currentpreview: null,
            currentpreviewname: null,
            currentpreviewPath: null,
            currentpreviewBase64: null,
            currentpreviewType: 'pdf',
            numberOfConnections: 0,
            studentwidgets: [],
            originalIndex: 20,
            futureIndex: 20,
            freeDiscspace: 1000,
            replaceMSOfile: false,
            printrequest: false,
            showDesc: false,
            currentDescription: '',
            defaultPrinter: false,
            availablePrinters: [],
            visiblePrinter: null,
            audioSource:'',
            audioFilename: '',
            muteAudio: false,
            submissions: [],
            submissionsNumber: 0,
            urlForWebview: null,
            webviewVisible: true,
            activesheetsPreviewPdf: null,
            activesheetsPreviewFilename: null,
            activesheetsPreviewCustomFields: [],
            activesheetsPreviewBlacklist: [],
            activesheetsPreviewGroup: null,
            activesheetsPreviewFileIndex: -1,
            
            serverlog: [],
            serverlogActive: false,
            serverlogReload: true,

            bipToken:this.$route.params.bipToken === 'false' ?  false : this.$route.params.bipToken,   // parameter werden immer als string "false" übergeben, convert to bool
            bipuserID: this.$route.params.bipuserID === 'false' ?  false : this.$route.params.bipuserID,
            bipUsername:this.$route.params.bipUsername === 'false' ?  false : this.$route.params.bipUsername,
            bipStatus: "closed", // "open" or "closed" or "offline"
            bipPhase: "ready",
            biptest:this.$route.params.biptest,

            serverstatus:{   // this object contains all neccessary information for students about the current exam settings
                bip: false,
                id: this.$route.params.id,
                nextexamVersion: this.$route.params.version,
                examName: this.$route.params.servername,
                examPassword: this.$route.params.passwd,
                examDate: new Date().toISOString().slice(0, 19),
                examDurationMinutes: 100, 
                pin: this.$route.params.pin,
                backupdirectory: false,
                requireBiP: false,
                exammode: false,
                delfolderonexit: true,
                screenshotinterval: 4,
                backupintervalPause:6,
                screenslocked: false,
                screenshotocr: false,
                directPrintAllowed: false,
                examTeachers: [],
                examSecurityKey: "oI9xGzHkUFe7Lg2iTXHkYp4pDab3Nvj4kFEOqA93cZE=",
                useExamSections: false, //if false exam section 1 is used and no tabs are displayed
                allowSectionSwitch: false, //allow students to switch between exam sections
                activeSection: 1,
                lockedSection: 1,
                examSections: {
                    1: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,  // if true, the current section is locked and no changes can be made - this means its currently active for students
                        sectionname: "Abschnitt 1",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        cmargin: { side: 'right', size: 3 }, 

                        formsUrl: null,
                        
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '12pt',
                        audioRepeat: 0,
                        localVMConfig: null,

                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    },
                    2: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,
                        sectionname: "Abschnitt 2",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        cmargin: { side: 'right', size: 3 }, 

                        formsUrl: null,
                        
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '12pt',
                        audioRepeat: 0,
                        localVMConfig: null,

                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    },
                    3: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,
                        sectionname: "Abschnitt 3",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        cmargin: { side: 'right', size: 3 }, 

                        formsUrl: null,
                        
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '12pt',
                        audioRepeat: 0,
                        localVMConfig: null,

                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    },
                    4: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,
                        sectionname: "Abschnitt 4",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        cmargin: { side: 'right', size: 3 }, 

                        formsUrl: null,
                        
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '12pt',
                        audioRepeat: 0,
                        localVMConfig: null,
                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor:{}, eduvidual:{}, gforms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    }
                },                
            } as Exam
        };
    },

computed: {
    hasMicrosoft365TemplateReady() {
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        if (!section) return false;
        const hasA = !!section.groupA?.examConfig?.microsoft365?.template?.filename;
        const hasB = !!section.groupB?.examConfig?.microsoft365?.template?.filename;
        return section.groups ? (hasA && hasB) : hasA;
    },
    hasMandatoryBasematerialReady() {
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        if (!section) return false;
        const examType = section.examtype;
        if (examType === 'microsoft365') {
            return !!this.config.accessToken && this.hasMicrosoft365TemplateReady;
        }
        if (examType === 'activesheets') {
            return this.hasActiveSheetsPdf;
        }
        if (examType === 'website') {
            const hasA = !!section.groupA?.examConfig?.website?.url;
            const hasB = !!section.groupB?.examConfig?.website?.url;
            return section.groups ? (hasA && hasB) : hasA;
        }
        if (examType === 'eduvidual') {
            const hasA = !!section.groupA?.examConfig?.eduvidual?.url;
            const hasB = !!section.groupB?.examConfig?.eduvidual?.url;
            return section.groups ? (hasA && hasB) : hasA;
        }
        if (examType === 'rdp') {
            const hasA = !!section.groupA?.examConfig?.rdp?.domain;
            const hasB = !!section.groupB?.examConfig?.rdp?.domain;
            return section.groups ? (hasA && hasB) : hasA;
        }
        if (examType === 'forms') {
            const hasA = !!section.groupA?.examConfig?.gforms?.url;
            const hasB = !!section.groupB?.examConfig?.gforms?.url;
            return section.groups ? (hasA && hasB) : hasA;
        }
        return true;
    },
    lockInExammode() {
        //if sections are disabled, return true if exammode is active
        if (!this.serverstatus.useExamSections) {
            return this.serverstatus.exammode;
        }


        if (this.serverstatus.allowSectionSwitch) {  //students decide which section to use - do not change them anymore once locked
            return this.serverstatus.exammode 
        }
        else { // allow reconfiguration of sections that are noch active yet
            return this.serverstatus.exammode && this.serverstatus.examSections[this.serverstatus.activeSection].locked;
        }
    },

    // disable sections toggle when exammode is active and any section is locked
    sectionsLocked() {
        return this.serverstatus.exammode && Object.values(this.serverstatus.examSections).some(s => s.locked)
    },

    lockDownload() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        return examType === 'eduvidual' || examType === 'forms' || examType === 'website' || (examType === 'microsoft365' && !this.hasMicrosoft365TemplateReady);
    },
    
    lockPdfSummary() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return examType === 'eduvidual' || examType === 'website' || examType === 'math' || examType === 'microsoft365';
    },
    
    lockSendFile() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return this.studentlist.length === 0 || examType === 'eduvidual' || examType === 'microsoft365';
    },

    lockSettings() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return examType === 'math' ;
    },

    hasActiveSheetsPdf() {
        if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype !== 'activesheets') {
            return true;
        }
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        if (section.groups) {
            return !!(section.groupA?.examConfig?.activeSheets?.filename && section.groupB?.examConfig?.activeSheets?.filename);
        }
        return !!section.groupA?.examConfig?.activeSheets?.filename;
    },

    activeSheetsPdfFilename() {
        if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype !== 'activesheets') {
            return null;
        }
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        return section.groupA?.examConfig?.activeSheets?.filename || null;
    }

},
    methods: {
        isSectionTabActive(sectionIndex) {
            return this.serverstatus?.activeSection === sectionIndex;
        },

        async editSectionName(sectionIndex) {
            const section = this.serverstatus?.examSections?.[sectionIndex];
            if (!section) return;

            const result = await this.$swal.fire({
                title: this.$t('dashboard.sectionname'),
                html: `<div class="my-content">${this.$t('dashboard.sectionnameinfo')}</div>`,
                input: 'text',
                inputValue: section.sectionname || '',
                showCancelButton: true,
                cancelButtonText: this.$t('dashboard.cancel'),
                confirmButtonText: this.$t('dashboard.save'),
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    input: 'my-custom-input',
                    actions: 'my-swal2-actions'
                }
            });

            if (!result.isConfirmed) return;
            const nextName = String(result.value || '').trim();
            if (!nextName) return;

            section.sectionname = nextName;
            this.setServerStatus();
        },

        getMicrosoft365TemplateForStudent(student) {
            const section = this.serverstatus.examSections[this.serverstatus.activeSection];
            if (!section) return null;
            if (!section.groups) return section.groupA?.examConfig?.microsoft365?.template || null;
            const isB = student?.status?.group === 'b';
            return (isB ? section.groupB?.examConfig?.microsoft365?.template : section.groupA?.examConfig?.microsoft365?.template) || null;
        },

        base64ToUint8Array(base64) {
            const cleaned = String(base64 || '').includes(',') ? String(base64).split(',')[1] : String(base64 || '');
            const binary = atob(cleaned);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        },

        materializeMicrosoft365TemplateFile(template) {
            if (!template || !template.filename || !template.filecontent) return null;
            const bytes = this.base64ToUint8Array(template.filecontent);
            const type = template.mimetype || (String(template.filename).toLowerCase().endsWith('.docx')
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return new File([bytes], template.filename, { type });
        },

        removeMicrosoft365Template: removeMicrosoft365Template,
        removeWebsiteUrl: removeWebsiteUrl,
        removeEduvidualUrl: removeEduvidualUrl,
        removeRdp: removeRdp,
        removeFormsUrl: removeFormsUrl,
        /**
         * Microsoft OneDrive API Authentication and File Handling
         */
        openAuthWindow(){ ipcRenderer.send('openmsauth'); this.setServerStatus()  },
        onedriveUploadselect: uploadselect,
        onedriveUpload: onedriveUpload,
        onedriveUploadSingle : onedriveUploadSingle,
        uploadAndShareFile: uploadAndShareFile,
        createSharingLink: createSharingLink,
        fileExistsInAppFolder: fileExistsInAppFolder,
        downloadFilesFromOneDrive: downloadFilesFromOneDrive,

        /**
         * Drag & Drop Methods
         */
        handleDragEndItem:handleDragEndItem,
        handleMoveItem:handleMoveItem,
        sortStudentWidgets:sortStudentWidgets,
        initializeStudentwidgets:initializeStudentwidgets,

        /**
         * Dashboard Explorer (Filemanager)
         */
        loadFilelist:loadFilelist,                  // load all files in a specific folder
        print:print,                                // check for default printer and trigger print operation
        printBase64: printBase64,                   // print the base64pdf via webcontens print
        getLatest:getLatest,                        // get latest files from all students and concatenate all pdf files
        processPrintrequest:processPrintrequest,  // handles a print request and first fetches the latest version from a specific student
        loadImage:loadImage,                        // displays an image in the preview panel
        loadPDF:loadPDF,                            // displays a pdf in the preview panel
        dashboardExplorerSendFile:dashboardExplorerSendFile,        // sends a given file to the selected student
        downloadFile:downloadFile,                                  // store the selected file to a local folder
        showWorkfolder:showWorkfolder,                              // makes the dashboard explorer visible
        fdelete:fdelete,                                            // deletes a file
        openLatestFolder:openLatestFolder,                          // opens the newest folder that belongs to the current visible student
        showBase64FilePreview:showBase64FilePreview,                // displays a base64 encoded pdf in the preview panel
        showBase64ImagePreview:showBase64ImagePreview,              // displays a base64 encoded image in the preview panel
        showBase64PdfInRenderer:showBase64PdfInRenderer,            // displays a base64 encoded pdf in PdfRenderer component

        /**
         * Exam Managment functions
         */
        startExam:startExam,                         // enable exam mode 
        endExam:endExam,                             // disable exammode 
        kick: kick,                                  //remove student from exam
        restore: restore,                            //restore focus state for specific student -- we tell the client that his status is restored which will then (on the next update) update it's focus state on the server 
        getFiles:getFiles,                           // get backup from students
        lockscreens:lockscreens,                     // temporarily lock screens
        sendFiles:sendFiles,                         //upload files to all students
        stopserver:stopserver,                       //Stop and Exit Exam Server Instance
        delfolderquestion: delfolderquestion,         // delete contents of studentfolder on student pc
        activateSpellcheckForStudent: activateSpellcheckForStudent,  // activate spellcheck for specific student only
        
   
        /**
         * Exam Setup Functions
         */
        configureWebsite: configureWebsite,
        configureEduvidual: configureEduvidual,
        configureForms: configureForms,
        configureMicrosoft365Template: configureMicrosoft365Template,
        setEditorExamConfigPatch: setEditorExamConfigPatch,
        configureCustomLanguageToolHost: configureCustomLanguageToolHost,
        removeCustomLanguageToolHost: removeCustomLanguageToolHost,
        configureActivesheets: configureActivesheets,
        configureRDP: configureRDP,
        configureLocalVM: configureLocalVM,
        defineMaterials: defineMaterials,             // define materials for exam

        handleAllowedUrlRemove: handleAllowedUrlRemove,
        openAllowedUrl: openAllowedUrl,




        
        /**
         * Runs every 4 seconds and fetches the current stundentlist from the backend
         * Handles Student-Widgets (create, delete, update)
         * Checks Screenshots and MSO Share Links
         */
        async fetchInfo() {

            this.fetchSubmissions()

          
            if (!this.config.accessToken &&  this.isExamType("microsoft365")){
                this.config = await ipcRenderer.invoke('getconfigasync')  // this is only needed in order to get the accesstoken from the backend for MSAuthentication
            }
            this.now = new Date().getTime()

            this.hostip = ipcRenderer.sendSync('checkhostip')
            if (!this.hostip) return;

            if (this.bipToken && this.serverstatus.bip) {
                this.updateBiPServerInfo(this.bipStatus);
            }
            
            if (this.serverlogActive && this.serverlogReload){
                this.serverlog = await ipcRenderer.invoke('getlog')
                this.$nextTick(() => {
                let logscroll = document.getElementById('logscrollarea');
                if (logscroll) {
                    logscroll.scrollTop = logscroll.scrollHeight;
                }
                });

            }

            let result = await ipcRenderer.invoke('studentlist', this.servername)

     
            // Studentenliste aus der Antwort zuweisen
            this.studentlist = result.studentlist;
            this.numberOfConnections = this.studentlist.length

            if (this.numberOfConnections >= this.studentwidgets.length){ //check if there are more students connected than empty widgets available. 
                this.studentwidgets.push(new EmptyWidget); 
                this.studentwidgets.push(new EmptyWidget); 
            } 

            if (this.studentlist && this.studentlist.length > 0){
                this.studentlist.forEach( student => { 
                    
                    // update active student (for student-details) and student image
                    if (this.activestudent && student.token === this.activestudent.token) { this.activestudent = student}  // on studentlist-receive update active student (for student-details)
                    if (!student.imageurl){ student.imageurl = "user-black.svg"  }            

                    // if the chosen exam mode is OFFICE and everything is Setup already check if students already got their share link (re-connect, late-connect)
                    if ( this.isExamType("microsoft365") && this.config.accessToken && this.hasMicrosoft365TemplateReady){
                        if (!student.status.msofficeshare) {  // this one is late to the party
                            console.log("dashboard @ fetchInfo: this student has no sharing link yet")
                            const template = this.getMicrosoft365TemplateForStudent(student);
                            const file = this.materializeMicrosoft365TemplateFile(template);
                            if (file) this.onedriveUploadSingle(student, file)   // upload template, create sharelink
                        }
                    }
                    if (student.printrequest){  // student sent a printrequest to the teacher
                        //printrequest sollte am client auch sofort auf false gesetzt werden sobald abgeschickt jedoch könnte der client genau hier ja disconnecten
                        if (student.clientname !== this.printrequest)  {  //this.printrequest contains the name of the student who requested
                            this.processPrintrequest(student) //do not trigger twice from same student
                        } 
                        this.setStudentStatus({removeprintrequest:true}, student.token)  //request received.. remove it from the servers student object
                    }   
                });

                //update widgets list here - we keep our own independent widgetlist (aka studentlist) for drag&drop 
                for (let student of this.studentlist) {
                    let studentWidget = this.studentwidgets.filter( el => el.token ===  student.token)  // get widget with the same token
                    if ( studentWidget.length > 0){  //studentwidget exists -> update it
                        for (let i = 0; i < this.studentwidgets.length; i++){  // we cant use (for .. of) or forEach because it creates a workingcopy of the original object
                            if (student.token == this.studentwidgets[i].token){ 
                                //now update the entry in the original widgets object and check if the student is online
                                if (this.now - 20000 > student.timestamp){
                                    if (this.studentwidgets[i].online && !this.muteAudio){ // play short soundfile on the first time the student timestamp is older than 20 seconds
                                        console.log(`dashboard @ fetchInfo: student ${student.clientname} just went offline`)
                                        const audio = new Audio('dialog-warning.oga');
                                        audio.play();
                                    }
                                    else { student.online = false }  // set online status on student object
                                }
                                else {student.online = true }  // set online status on student object

                                // play sound once when student loses focus for the first time
                                if (!student.focus && this.studentwidgets[i].focus && !this.muteAudio) {
                                    console.log(`dashboard @ fetchInfo: student ${student.clientname} lost focus`)
                                    const focusAudio = new Audio('dialog-warning.oga');
                                    focusAudio.play();
                                }

                                // Überschreibe das studentwidget, aber korrigiere die Gruppenzugehörigkeit basierend auf der aktuellen Section
                                this.studentwidgets[i] = student;
                                
                                // Korrigiere die Gruppenzugehörigkeit basierend auf der aktuellen Section
                                if (this.serverstatus.examSections[this.serverstatus.activeSection].groups) {
                                    const groupA = this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users;
                                    const groupB = this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users;
                                    
                                    if (groupB.includes(student.clientname)) {
                                        this.studentwidgets[i].status.group = "b";
                                    } else if (groupA.includes(student.clientname)) {
                                        this.studentwidgets[i].status.group = "a";
                                    }
                                }
                            }  
                        }
                    }
                    else {
                        //replace empty widget with student
                        for (let i = 0; i < this.studentwidgets.length; i++){  // we cant use (for .. of) or forEach because it creates a workingcopy of the original object
                            if (!this.studentwidgets[i].clientname){ //clientname == false in an emptyWidget so we found one
                                this.studentwidgets[i] = student; // replace emptywidget
                                
                                // Korrigiere die Gruppenzugehörigkeit basierend auf der aktuellen Section
                                if (this.serverstatus.examSections[this.serverstatus.activeSection].groups) {
                                    const groupA = this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users;
                                    const groupB = this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users;
                                    
                                    if (groupB.includes(student.clientname)) {
                                        this.studentwidgets[i].status.group = "b";
                                    } else if (groupA.includes(student.clientname)) {
                                        this.studentwidgets[i].status.group = "a";
                                    }
                                }
                                break;
                            } 
                        }
                    }
                }
            }
                
            //remove studentwidget from widgetslist if student was removed
            for (let widget of this.studentwidgets) { //find student in studentwidgets list  
                let studentExists = this.studentlist.filter( el => el.token ===  widget.token).length === 0 ? false : true  // now check if a widget has a student in studentlist otherwise remove it
                if (!studentExists && widget.token.includes('csrf')){ //if the student the widget belongs to does not exist (and the widget actually represents a student - token starting with csrf)
                    for (let i = 0; i < this.studentwidgets.length; i++){  // we cant use (for .. of) or forEach because it creates a workingcopy of the original object
                            if (widget.token == this.studentwidgets[i].token){ 
                            this.studentwidgets[i] = new EmptyWidget // replace studentwidget with emptywidget
                        } 
                    }
                } 
            }
           
        }, 


        async getLatestBakFile(studentName) {
            const result = await ipcRenderer.invoke('getLatestBakFile', this.servername, studentName)
            return result
        },

        async getSpecificSubmissionBase64(filepath) {
            const result = await ipcRenderer.invoke('getSpecificSubmissionBase64', filepath)
            if (result.status === "success") {
                this.showBase64FilePreview(result.submission, filepath.split('/').pop())
            }
            else {
                this.$swal.fire({
                    title: this.$t("dashboard.submissions"),
                    text: this.$t("data.fileerror"),
                    icon: "error"
                })
            }
        },

        handleChooseMaterialsGroup(group) {
            this.defineMaterials(group);
            this.hideDescription();
        },

        // remove file from group a or b
        handleFileRemove({ group, index }) {
            this.$swal.fire({
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    actions: 'my-swal2-actions'
                },
                title: this.$t("dashboard.removefile"),
                text: this.$t("dashboard.removefileconfirm"),
                icon: 'warning',
                showCancelButton: true,
                
            }).then(async (result) => {
                if (result.isConfirmed) {
                    if (group === 'A') { this.serverstatus.examSections[this.serverstatus.activeSection].groupA.examInstructionFiles.splice(index, 1); } 
                    else {               this.serverstatus.examSections[this.serverstatus.activeSection].groupB.examInstructionFiles.splice(index, 1); }
                    this.setStudentStatus({getmaterials: true}, 'all'); 
                    this.setServerStatus()
                }
            })

        },

        // check if the current exam type is the same as the given type
        isExamType(type) {
            return this.serverstatus.examSections[this.serverstatus.activeSection].examtype === type;
        },

        // select exam type and trigger methods based on type
        selectExamType(type) {
            if (this.lockInExammode) return;
            this.serverstatus.examSections[this.serverstatus.activeSection].examtype = type;
            // Call existing methods based on type
            if (type === 'eduvidual') {/* configured via sidebar */}
            if (type === 'forms') {/* configured via sidebar */}
            if (type === 'website') {/* configured via sidebar */}
            if (type === 'math') {/* no dialog */}
            if (type === 'rdp') {/* configured via sidebar */}
            if (type === 'localvm') this.configureLocalVM();
        },

        // get label for the current exam type
        getSelectedExamTypeLabel() {
            const type = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
            switch(type) {
            case 'math': return this.$t('dashboard.math');
            case 'editor': return this.$t('dashboard.lang');
            case 'eduvidual': return this.$t('dashboard.eduvidual');
            case 'forms': return this.$t('dashboard.forms');
            case 'website': return 'Website';
            case 'activesheets': return 'Active Sheets';
            case 'microsoft365': return this.$t('dashboard.microsoft365');
            case 'rdp': return 'RDP';
            case 'localvm': return 'LocalVM';
            default: return 'Select Type';
            }
        },

        // when exam sections are toggled off, reset activeSection to 1
        onToggleExamSections(){
            if (!this.serverstatus.useExamSections && this.serverstatus.activeSection > 1) {
                this.serverstatus.activeSection = 1
            }
        },

        // activate section: when allowSectionSwitch only switch view; else optionally lock section for all students (confirm dialog)
        activateSection(section){
            this.serverstatus.activeSection = section
            this.setServerStatus()

            // Zeige die für diese Section konfigurierten Gruppen an (ohne Schüler zu informieren)
            this.restoreGroupAssignments(false)

            if (this.serverstatus.allowSectionSwitch) return
            if (this.serverstatus.exammode && !this.serverstatus.examSections[this.serverstatus.activeSection].locked) {
                this.$swal.fire({
                    customClass: {
                        popup: 'my-popup',
                        title: 'my-title',
                        content: 'my-content',
                        input: 'my-custom-input',
                        inputLabel: 'my-input-label',
                        actions: 'my-swal2-actions'
                    },
                    title: this.$t("dashboard.examsections"),
                    icon: 'warning',
                    html: `<div class="my-content">${this.$t("dashboard.examsectionsinfo")}</div>`,
                    showCancelButton: true,
                    cancelButtonText: this.$t("dashboard.no"),
                    confirmButtonText: this.$t("dashboard.yes"),
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        //inform all students to save current work
                        //inform all students to archive/send current work
                        //wait for all students to finish
                        //activate new section for all student
                        Object.values(this.serverstatus.examSections).forEach(section => {   section.locked = false    })
                        this.serverstatus.examSections[this.serverstatus.activeSection].locked = true
                        this.serverstatus.lockedSection = section

                        //check if groups are activated and if NOT put every student into group a
                        if (!this.serverstatus.examSections[this.serverstatus.activeSection].groups) {  
                            // prepopulate group A on the server
                            this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users = this.studentlist.map(student => student.clientname)
                            // set studentstatus for every student to group a for the clients
                            this.setStudentStatus({group:"a"}, 'all')
                        } else {
                            // Gruppen sind aktiviert - informiere Schüler über ihre Gruppenzugehörigkeit
                            this.restoreGroupAssignments(true)
                        }


                        // set msofficeshare to false for every student to trigger a new upload of the msOfficeFile
                        this.setStudentStatus({msofficeshare:false}, 'all')


                        this.setServerStatus()
                    }
                })    
            }
        },

        /**
         * triggered when backup slider is used in settings dialog
         * starts or stops the autofetch feature
         */
        updateBackupInterval() {
            const interval = parseInt(this.serverstatus.backupintervalPause, 10); // Ensure it's an integer
            if (interval === 0) {
                console.info("dashboard @ updateBackupInterval: stopping backup interval");
                this.backupinterval.stop();
            } else {
                console.info("dashboard @ updateBackupInterval: setting backup interval to", interval);
                this.backupinterval.stop(); // Stop any ongoing interval
                this.backupinterval.interval = 60000 * interval; // Convert minutes to milliseconds
                this.backupinterval.start();
            }
            this.setServerStatus();
        },


        updateScreenshotInterval() {
            const interval = parseInt(this.serverstatus.screenshotinterval, 10); // Integer sicherstellen

            if (interval === 0) { // Screenshots deaktivieren
                console.log("dashboard @ updateScreenshotInterval: deactivating screenshots");
                this.serverstatus.screenshotinterval = 0;
                this.serverstatus.screenshotocr = false;
                this.autoscreenshot = false;
            } else {
                console.log("dashboard @ updateScreenshotInterval: setting screenshot interval to", interval);
                this.autoscreenshot = true; // Screenshots aktivieren
            }
            this.setServerStatus(); // Änderungen speichern
        },
      
        async showDescription(description, info=false, isHtml=false) {
            if (info) {
                description += '\n';
                // remoteassistant: keywords and ports
                if (info.keywords?.length > 0) {
                    description += '\n';
                    description += `Keywords: ${info.keywords.join(', ')}`;
                }
                if (info.ports?.length > 0) {
                    description += '\n';
                    description += `Ports: ${info.ports.join(', ')}`;
                }
                // virtualized: vmFindings (backend) and webglFindings (frontend)
                const vm = info.vmFindings;
                const webgl = info.webglFindings;
                if (vm?.isVM && vm?.reasons?.length > 0) {
                    description += '\n\n' + this.$t('dashboard.vmFindingsBackend') + '\n';
                    description += vm.reasons.map(r => '• ' + r).join('\n');
                    if (vm.vendor) description += '\n' + this.$t('dashboard.vmFindingsVendor') + ': ' + vm.vendor;
                }
                if (webgl?.detected) {
                    description += '\n\n' + this.$t('dashboard.vmFindingsWebgl');
                    if (webgl.vendor) description += '\n• Vendor: ' + webgl.vendor;
                    if (webgl.renderer) description += '\n• Renderer: ' + webgl.renderer;
                }
            }
            this.currentDescription = isHtml ? description : description.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            this.showDesc = true;
        },
        hideDescription() {
            this.showDesc = false;
        },

        visualfeedback(message, timeout=1000){
             this.$swal.fire({
                text: message,
                timer: timeout,
                timerProgressBar: true,
                didOpen: () => { this.$swal.showLoading() }
            });
        },

        // show visual feedback for microsoft office files uploading
        visualfeedbackClosemanually(message){
            const closeWhenFinished = async () => {
                while (!this.hasMicrosoft365TemplateReady) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                this.$swal.close();
            };
            // Your existing Swal configuration
            this.$swal.fire({
                text: message,
                timerProgressBar: true,
                didOpen: () => {
                    this.$swal.showLoading();
                    closeWhenFinished();
                },
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false,
            });
        },
        // compare teacher vs student version (major.minor.patch)
        isVersionMismatch(student) {
            if (!student?.version) return true;
            const vteacher = (this.version || '').split('.').slice(0, 3).join('.');
            const vstudent = String(student.version).split('.').slice(0, 3).join('.');
            return vteacher !== vstudent;
        },
        getStudentInfoText(student) {
            const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const name = escape(student?.clientname ?? '?');
            const v = escape(student?.version ?? '?');
            const ip = escape(student?.clientip ?? '?');
            const docs = student?.files ?? 0;
            const versionSuffix = this.isVersionMismatch(student) ? ` (->${escape(this.version)})` : '';
            return `<b>${name}</b><br>Version: ${v}${versionSuffix}<br>IP: ${ip}<br>Documents: ${docs}`;
        },
        //display student specific actions
        showStudentview(student) {
            document.querySelector("#studentinfocontainer").style.display = 'block';
            this.activestudent = student
        },
        hideStudentview() {
            document.querySelector("#studentinfocontainer").style.display = 'none';
            this.activestudent = false
        },
        // hide pdf preview
        hidepreview() {
            document.querySelector("#pdfpreview").style.display = 'none';
        },
        // discard activesheets PDF
        discardActivesheetsPdf() {
            this.activesheetsPreviewPdf = null;
            this.activesheetsPreviewFilename = null;
            this.activesheetsPreviewCustomFields = [];
            this.activesheetsPreviewBlacklist = [];
            this.activesheetsPreviewGroup = null;
            this.hidepreview();
        },
        // save customFields and blacklist to group.examConfig.activeSheets
        saveCustomFields(customFields, blacklist = []) {
            console.log('[saveCustomFields] group:', this.activesheetsPreviewGroup, 'count:', customFields.length);
            if (this.activesheetsPreviewGroup) {
                const section = this.serverstatus.examSections[this.serverstatus.activeSection];
                const group = this.activesheetsPreviewGroup === 'A' ? section.groupA : section.groupB;
                if (group && group.examConfig?.activeSheets?.filename) {
                    group.examConfig.activeSheets.customFields = JSON.parse(JSON.stringify(customFields));
                    group.examConfig.activeSheets.blacklist = [...blacklist];
                    this.activesheetsPreviewCustomFields = JSON.parse(JSON.stringify(customFields));
                    this.activesheetsPreviewBlacklist = [...blacklist];
                }
            }
        },

        removeActiveSheet(group) {
            const section = this.serverstatus.examSections[this.serverstatus.activeSection];
            if (group === 'A') section.groupA.examConfig.activeSheets = {};
            else section.groupB.examConfig.activeSheets = {};
        },
        //show pincode 
        showinfo(){
            let info = `<span> IP: <strong>${this.serverip}</strong> \nName: ${this.servername}  \nPin: ${this.serverstatus.pin} </span>`
            this.$swal.fire({ 
                title: `<div style="justify-content: center;""><div style="display:inline-block; text-align: right; margin-right: 10px; font-weight:normal; font-size: 1.1em;">${this.$t("dashboard.name")}:
                                ${this.$t("dashboard.server")}:
                                ${this.$t("dashboard.pin")}:
                                
                            </div><div style="display:inline-block; text-align: left;font-size: 1.1em;">${this.servername}
                                ${this.serverip}
                                ${this.serverstatus.pin} 

                            </div>
                        </div>`,
                icon: "info",
                customClass: {
                    popup: 'custom-swal2-popup-info',
                },
            })
        },

        //show status message
        async status(text){  
            const statusDiv = document.querySelector("#statusdiv");
            statusDiv.textContent = text;
            statusDiv.style.visibility = "visible";
            this.fadeIn(statusDiv);
            await this.sleep(2000);
            this.fadeOut(statusDiv)
        },

        // Function to add fade-in effect
        fadeIn(element) {
            element.classList.add('fade-in');
            element.classList.remove('fade-out');
        },

        // Function to add fade-out effect
        fadeOut(element) {
            element.classList.add('fade-out');
            element.classList.remove('fade-in');
        },

        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        async checkDiscspace(){   // achtung: custom workdir spreizt sich mit der idee die teacher instanz als reine webversion laufen zulassen - wontfix?
            this.freeDiscspace = await ipcRenderer.invoke('checkDiscspace')
            //console.log(this.freeDiscspace)
            if (this.freeDiscspace < 0.5) {
                this.status(this.$t("dashboard.freespacewarning")) 
            }
        }, 

        async openFileExternal(filepath){
            let result = await ipcRenderer.invoke('openfile', filepath)
            
        },

        async logout365(){
            this.$swal.fire({
                title: this.$t("dashboard.logout"),
                icon: 'question',
                text: this.$t("dashboard.logoutConfirm"),
                showCancelButton: true,
                cancelButtonText: this.$t("dashboard.cancel"),
                reverseButtons: true,
            }).then(async (result) => {
                if (result.isConfirmed) {
                    this.config = await ipcRenderer.invoke('resetToken')   //reset and update config
                }
            })    
        },


        truncatedClientName(value, len=18) {
            if (!value) return
            return value.length > len ? value.substr(0, len) + '...' : value;
        },

        // Strip last ".ext" segment for labels (same behavior as materialsList.vue).
        getFilenameWithoutExtension(filename) {
            if (!filename || typeof filename !== 'string') {
                return filename || '';
            }
            const parts = filename.split('.');
            return parts.length > 1 ? parts.slice(0, -1).join('.') : filename;
        },

        migrateServerStatus() {
            const status = this.serverstatus;
            if (!status || typeof status !== 'object') return;
            if (!status.examSections || typeof status.examSections !== 'object') status.examSections = {};
            if (typeof status.directPrintAllowed !== 'boolean') status.directPrintAllowed = false;

            for (const section of Object.values(status.examSections)) {
                if (!section || typeof section !== 'object') continue;

                for (const groupKey of ['groupA', 'groupB']) {
                    if (!section[groupKey] || typeof section[groupKey] !== 'object') {
                        section[groupKey] = { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: {} };
                    }

                    const group = section[groupKey];
                    if (!Array.isArray(group.users)) group.users = [];
                    if (!Array.isArray(group.examInstructionFiles)) group.examInstructionFiles = [];
                    if (!Array.isArray(group.allowedUrls)) group.allowedUrls = [];
                    if (!group.examConfig || typeof group.examConfig !== 'object') group.examConfig = {};
                    if (!group.examConfig.activeSheets || typeof group.examConfig.activeSheets !== 'object') group.examConfig.activeSheets = {};
                    if (!group.examConfig.website || typeof group.examConfig.website !== 'object') group.examConfig.website = {};
                    if (!group.examConfig.eduvidual || typeof group.examConfig.eduvidual !== 'object') group.examConfig.eduvidual = {};
                    if (!group.examConfig.rdp || typeof group.examConfig.rdp !== 'object') group.examConfig.rdp = {};
                    if (!group.examConfig.microsoft365 || typeof group.examConfig.microsoft365 !== 'object') group.examConfig.microsoft365 = {};
                    if (!group.examConfig.editor || typeof group.examConfig.editor !== 'object') group.examConfig.editor = {};
                }
            }
        },

        // we save serverstatus everytime we start an exam - therefore exams can be resumed easily by the teacher if something wicked happens
        getPreviousServerStatus(){
            let result = fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/getserverstatus/${this.servername}/${this.servertoken}`, { method: 'POST', headers: {'Content-Type': 'application/json' },})
            .then( res => res.json())
            .then( async (response) => {
                if (response.serverstatus === false) {
                    this.serverstatus.backupdirectory = this.config.backupdirectory || false
                    this.migrateServerStatus()
                    this.setServerStatus()  // there is no serverstatus - we need to set it to default
                    return
                }
                this.serverstatus = response.serverstatus // we slowly move things over to a centra serverstatus object
                this.migrateServerStatus()
                if (!this.serverstatus.backupdirectory) {  // preserve backupdirectory set in UI if not in saved status
                    this.serverstatus.backupdirectory = this.config.backupdirectory || false
                }
                           

                if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype === "microsoft365"){  // unfortunately we can't automagically reconnect the teacher without violating privacy
                    this.serverstatus.exammode = false
                    if (this.serverstatus.examSections[this.serverstatus.activeSection].groupA?.examConfig?.microsoft365) this.serverstatus.examSections[this.serverstatus.activeSection].groupA.examConfig.microsoft365.template = {}
                    if (this.serverstatus.examSections[this.serverstatus.activeSection].groupB?.examConfig?.microsoft365) this.serverstatus.examSections[this.serverstatus.activeSection].groupB.examConfig.microsoft365.template = {}
                    Object.values(this.serverstatus.examSections).forEach(section => { section.locked = false }) // crash recovery must unlock every ms365 section
                    this.serverstatus.lockedSection = this.serverstatus.activeSection
                    this.$swal.fire({
                        title: this.$t("dashboard.attention"),
                        text: this.$t("dashboard.msoWarn"),
                        icon: "info"
                    })
                }

                this.setServerStatus()  //  we fetched a backup of serverstatus and now we make sure the backend has the updated settings for the students to fetch
                return true
            })
            .catch(err => { console.warn(err) })
            return result
        },


        showCopyleft(){
            this.$swal.fire({
                customClass: {
                    'icon': 'custom-swal2-icon'
              
                },
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle;'>&copy;</span> <span style='font-size:0.8em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
        <a href="https://www.bmb.gv.at/Themen/schule/zrp/dibi/foss.html" target="_blank"><img style="width: 230px; opacity:1;" src="./BMB_Logo_srgb.png"></a>
                <br>
                <br>
                <a href="https://linux-bildung.at" target="_blank"><img style="width: 50px; opacity:0.7;" src="./osos.svg"></a>   <br>
                <span style="font-size:0.8em"> <a href="https://next-exam.at" target="_blank">next-exam.at</a> </span> <br>
                <span style="font-size:0.8em">Version: ${this.version} ${this.info}</span> <br>
                <span style="font-size:0.8em">Build: ${this.buildDate}</span>
                `,
            })
        },

        /**
         * store the current serverstatus object in the backend
         * this should be the goTo function from now on to update the backend in a single request
        */
        setServerStatus(){
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setserverstatus/${this.servername}/${this.servertoken}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ serverstatus: this.serverstatus })
            })
            .then( res => res.json())
            .then( response => { /*console.log(response.message)*/  })
            .catch(err => { console.warn(err) })
        },

        // setup groups
        // every user is automatically in group a (see control /registerclient) - this function resets group arrangement and pushes every user into group a
        async setupGroups(){
            this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users = []
            this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users = []
            // prepopulate group A
            for (let student of this.studentlist) {
                student.status.group = "a"
                if (!this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.includes(student.clientname)) {
                    this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.push(student.clientname)
                } 
            } 
            await this.sleep(1000)
            this.setServerStatus()
        },

        // Stelle Gruppenzuordnungen aus den gespeicherten Arrays wieder her
        // informStudents: wenn true, werden die Schüler über ihre Gruppenzugehörigkeit informiert
        restoreGroupAssignments(informStudents = false) {
            // Prüfe ob Gruppen für diese Section aktiviert sind
            if (!this.serverstatus.examSections[this.serverstatus.activeSection].groups) {
                return;
            }

            const groupA = this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users;
            const groupB = this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users;

            if (!informStudents) {
                // Nur lokale Anzeige aktualisieren, Schüler nicht informieren
                for (let widget of this.studentwidgets) {
                    if (widget.clientname && widget.status) {
                        if (groupB.includes(widget.clientname)) {
                            widget.status.group = "b";
                        } else if (groupA.includes(widget.clientname)) {
                            widget.status.group = "a";
                        }
                    }
                }
                return;
            }

            // Schüler über ihre Gruppenzugehörigkeit informieren
            for (let student of this.studentlist) {
                if (groupB.includes(student.clientname)) {
                    this.setStudentStatus({group:"b"}, student.token);
                } else {
                    this.setStudentStatus({group:"a"}, student.token);
                }
            }
        },

        // push user from one group to the other
        quickSetGroup(student){
            // Remove student from groups if present
            const indexA = this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.indexOf(student.clientname);
            const indexB = this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users.indexOf(student.clientname);
            if (indexA > -1) { this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.splice(indexA, 1);  }
            if (indexB > -1) { this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users.splice(indexB, 1);  }
            
            let studentWidget = this.studentwidgets.find(el => el.token === student.token);

            // Prüfe ob Schüler informiert werden sollen:
            // - Wenn keine Sections aktiviert sind (immer informieren)
            // - Wenn die aktuelle Section die locked Section ist (Schüler sind in dieser Section)
            const shouldInformStudents = !this.serverstatus.useExamSections || 
                                       this.serverstatus.activeSection === this.serverstatus.lockedSection;

            if (student.status.group == "a"){
                //Add and Set         
                this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users.push(student.clientname)  //update group arrays
                if (shouldInformStudents) {
                    this.setStudentStatus({group:"b"}, student.token)  //set student object (and inform student about group)
                }
                this.setServerStatus()
                if(studentWidget){ studentWidget.status.group = "b"}                          
            }
            else {
                //Add and Set
                this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.push(student.clientname)
                if (shouldInformStudents) {
                    this.setStudentStatus({group:"a"}, student.token) 
                }
                this.setServerStatus()
                if(studentWidget){ studentWidget.status.group = "a"}
            }
        },

        /**
         * set student.studentstatus or student attributes serverside
         * @param {*} bodyobject an object that contains the studentstatus or student attibute that needs to be set in the servers student representation
         * @param studenttoken  the unique token to identify a student
         */
        setStudentStatus(bodyobject, studenttoken){
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${studenttoken}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify(bodyobject )
            })
            .then( res => res.json() )
            .then( result => { console.log("dashboard @ setStudentStatus:", result.message)})
            .catch(err => { console.error(err)});
        },

        selectPrinter(printer){
            this.defaultPrinter = printer.printerName
            console.log(`dashboard: selected default printer: ${this.defaultPrinter}`)
            console.log(`dashboard: allow direct print: ${this.serverstatus.directPrintAllowed}`)
        },

        checkforDefaultprinter(){
            if (!this.defaultPrinter){ document.getElementById('directprint').checked = false }
        },

        async hideSetup(save=true){
            if (!this.defaultPrinter){ document.getElementById('directprint').checked = false  }
            document.getElementById("setupoverlay").style.opacity = 0;
            document.getElementById('setupdiv').classList.remove('scaleIn');
            //document.getElementById('setupdiv').classList.add('scaleOut');
           // await this.sleep(200)  //the transition setting is set to .3s
            document.getElementById("setupoverlay").style.display = "none";
            if (save){ this.setServerStatus() }
        },

        async showSetup(){
            this.availablePrinters = await ipcRenderer.invoke("getprinters")
            this.availablePrinters.forEach(printer => {   //deprecated in electron 36 - only native methods available to get default printer for win,lin,mac
                if (printer.isDefault){
                    console.log(`dashboard @ mounted: found and set default printer: ${printer.printerName}`)
                    this.defaultPrinter = printer.printerName
                }
            })
            document.getElementById("setupoverlay").style.display = "flex";
            document.getElementById("setupoverlay").style.opacity = 1;
            document.getElementById('setupdiv').classList.remove('scaleOut');
            document.getElementById('setupdiv').classList.add('scaleIn'); 
        },



        showBipInfo(){
            let message = "Bildungsportal"
            let html = `
            <div style="font-size:0.9em; text-align:left">
                <div><b>Bip-Token: </b>${this.bipToken}</div>
                <div><b>Bip-Username: </b>${this.bipUsername}</div>
                <div><b>Bip-UserID: </b>${this.bipuserID}</div><br>
                <div><b>Bip-Exam-Status: </b></div>
                <button id="fbtnA" class="swal2-button btn ${this.bipStatus === 'closed' ? 'btn-warning' : 'btn-teal'} mt-2" style="width: 100px; height: 42px;">
                    ${this.bipStatus}
                </button>
            </div>
            `
            this.$swal.fire({
                title: message,
                html: html,
                cancelButtonText: this.$t("dashboard.cancel"),
                reverseButtons: true,
                width: '600px',
                didRender: () => {
                    const btnA = document.getElementById('fbtnA');
                
                    if (btnA && !btnA.dataset.listenerAdded) {
                        btnA.addEventListener('click', () => {
                            const newStatus = this.bipStatus === 'closed' ? 'open' : 'closed';
                            const oldClass = this.bipStatus === 'closed' ? 'btn-warning' : 'btn-teal';
                            const newClass = this.bipStatus === 'closed' ? 'btn-teal' : 'btn-warning';
                            
                            btnA.classList.remove(oldClass);
                            btnA.classList.add(newClass);
                            btnA.textContent = newStatus;

                            //call api and update bip data
                            if (this.bipToken && this.serverstatus.bip) {
                                this.updateBiPServerInfo(newStatus);
                            }
                            this.bipStatus = newStatus;
                        });
                        btnA.dataset.listenerAdded = 'true';
                    }
                }
            });
        },


        toggleBipStatus() {
            const newStatus = this.bipStatus === 'closed' ? 'open' : 'closed';
            if (this.bipToken && this.serverstatus.bip) {
                this.updateBiPServerInfo(newStatus);
            }
            this.bipStatus = newStatus;
        },

        getBiPUrl(): string {
            if (this.config.bipDemo) {
                return this.config.bipApiUrl;
            } else if (this.biptest) {
                return `https://q.bildung.gv.at`;
            } else {
                return `https://bildung.gv.at`;
            }
        },

        // Überprüfen, ob der String Base64-codiert ist
        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (err) {
                return false;
            }
        },
        
        // Base64-String dekodieren und mögliche Tokens extrahieren
        decodeBase64AndExtractTokens(base64Str) {
            if (base64Str == null || !this.isBase64(base64Str)) {
                return null;
            }
            const decodedStr = atob(base64Str);
            const tokens = decodedStr.split(/[:\s,]+/); // Trennzeichen anpassen, falls nötig
            return tokens;
        },

         /** 
         * if this is a bip exam configured online that needs students to login into bip too
         * update exam info on server via api
         */
        async updateBiPServerInfo(status){
            let token = this.decodeBase64AndExtractTokens(this.bipToken)?.[1];
            if (!token || !this.serverstatus.bip) {
                console.error("dashboard @ updateBiPServerInfo: cannot fetch from bip api without valid token")
            }

            //console.log("bip exam - updating server info")
            let payload = {
                teacherIP: this.serverip,
                pin: this.serverstatus.pin,
                status: status,
                examID: this.serverstatus.id,
                phase: this.bipPhase
            }

            const url= this.getBiPUrl()+"/webservice/rest/server.php?wstoken="+token+"&wsfunction=local_dpu_update_exam_status_teacher&moodlewsrestformat=json"
       
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(payload).toString()
            })
            .then(response => { return response.json(); } )                  
            .then(data => { 
               // console.log(data.message, data.data);
            })
            .catch(error => {
                console.error("Fehler beim API-Aufruf:", error.message);
                if (this.bipPhase === 'completed') {
                    this.$swal.fire({
                        title: this.$t("dashboard.attention"),
                        text: `Bildungsportal aktuell nicht erreichbar, bitte setzen Sie selbst zu einem späteren Zeitpunkt die Prüfungsphase im Bildungsportal auf Abgeschlossen!`,
                        icon: "warn"
                    })
                }
            });
        },

        playAudioFile(filecontent, filename){
            document.querySelector("#aplayer").style.display = 'block';
            this.audioSource = filecontent;
            this.audioFilename = filename
            audioPlayer.load(); // Lädt die neue Quelle

        },


        async fetchLOG(){
     
            let logdiv = document.getElementById(`loginfo`)    // the div is not existant if lt is disabled
            let eye = document.getElementById('eye')               // the div is not existant if lt is disabled

            if (this.serverlogActive){
                if (logdiv && logdiv.style.right == "0px"){
                    logdiv.style.right = "-582px";
                    logdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0)";
                }
                eye.classList.add('eyeopen');
                eye.classList.add('darkgreen');
                eye.classList.remove('eyeclose');
                eye.classList.remove('darkred');
                this.serverlogActive = false; 
            }
            else {
                logdiv.style.right = "0px"
                logdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0.2)"; 
                eye.classList.remove('eyeopen');
                eye.classList.remove('darkgreen');
                eye.classList.add('eyeclose');
                eye.classList.add('darkred');
                this.serverlogActive = true;

                let log = await ipcRenderer.invoke('getlog');
                if (log.length == 0){ this.serverlog = [] }
                else { this.serverlog = log }

         
                this.$nextTick(() => {
                let logscroll = document.getElementById('logscrollarea');
                if (logscroll) {
                    logscroll.scrollTop = logscroll.scrollHeight;
                }
                });

            }
        },

        /**
         * fetch submissions from the server and update the submissionsNumber
         * for every student there are 4 sections (1-4) so there can be up to 4 submissions per student
         * 
         * @param show if true, show the submissions in a popup
         */


        async fetchSubmissions(show = false){
            let submissions = await ipcRenderer.invoke('getSubmissions', this.servername, JSON.stringify(this.serverstatus))
            this.submissions = submissions
            this.submissionsNumber = 0


          
            for (let student of submissions){
                // iterate over sections 1-4
                for (let section = 1; section <= 4; section++) {
                    if (student.sections[section].path){
                        this.submissionsNumber++
                        break    // at this moment we only need to know if the student has at least one submission in any section
                    }
                }   
            }

            if (show){
                // build table rows: one row per student section with submission
                let tableRows = []
                for (let student of submissions){
                    let firstSection = true // track if this is the first section for this student
                    for (let section = 1; section <= 4; section++) {
                        if (student.sections[section].path) {
                            let sectionName = student.sections[section].sectionname
                            let studentNameCell = firstSection 
                                ? `<td style="padding: 6px; white-space: nowrap; font-size: 0.9em;"><b>${student.studentName}</b></td>`
                                : `<td style="padding: 6px; white-space: nowrap; font-size: 0.9em;"></td>`
                            let borderTopStyle = firstSection 
                                ? "border-top: 1px solid #ccc;"
                                : "border-top: 1px dashed #ddd;"
                            tableRows.push(`
                                <tr style="border-bottom: 1px dashed #eee; ${borderTopStyle}">
                                    ${studentNameCell}
                                    <td style="padding: 6px; white-space: nowrap; font-size: 0.9em;">${sectionName}</td>
                                    <td style="padding: 6px; word-break: break-word; font-size: 0.9em;">${student.sections[section].filename}</td>
                                    <td style="padding: 6px; white-space: nowrap; font-size: 0.9em;">${student.sections[section].date ? new Date(student.sections[section].date).toLocaleString('de-DE') : ''}</td>
                                </tr>
                            `)
                            firstSection = false
                        }
                    }
                    // Add row for students without any submissions
                    if (firstSection) {
                        tableRows.push(`
                            <tr style="border-bottom: 1px dashed #eee; border-top: 1px solid #ccc;">
                                <td style="padding: 6px; white-space: nowrap; font-size: 0.9em; color: #999;"><b>${student.studentName}</b></td>
                                <td style="padding: 6px; white-space: nowrap; font-size: 0.9em;"></td>
                                <td style="padding: 6px; word-break: break-word; font-size: 0.9em;"></td>
                                <td style="padding: 6px; white-space: nowrap; font-size: 0.9em;"></td>
                            </tr>
                        `)
                    }
                }
                
                this.$swal.fire({
                    title: this.$t("control.submissions"),
                    text: `${submissions.length} / ${this.numberOfConnections}`,
                    width: '80%',
                    html: `
                    <div style="font-size:0.9em; text-align:left">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #ccc;">
                                    <th style="text-align: left; padding: 8px; white-space: nowrap;">Student</th>
                                    <th style="text-align: left; padding: 8px; white-space: nowrap;">Abschnitt</th>
                                    <th style="text-align: left; padding: 8px;">Datei</th>
                                    <th style="text-align: left; padding: 8px; white-space: nowrap;">Datum</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows.join('')}
                            </tbody>
                        </table>
                    </div>
                    `
                })
            }
        },
    },



    async mounted() {  // when ready
        this.$nextTick( async function () { // Code that will run only after the entire view has been rendered
       
            document.querySelector("#statusdiv").style.visibility = "hidden";
            
        
            await this.getPreviousServerStatus()

            this.fetchInfo()
            this.initializeStudentwidgets()

            if (this.bipToken && this.serverstatus.bip) {
                this.updateBiPServerInfo(this.bipStatus);
            }

            // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
            this.fetchinterval = new SchedulerService(4000);
            this.fetchinterval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.fetchinterval.start();

            this.backupintervalCallback = () => this.getFiles('all');  //selbst wenn 'all' default ist.. über den eventlistener wird das erste attribut zu "event"
            this.backupinterval = new SchedulerService(60000 * this.serverstatus.backupintervalPause);
            this.backupinterval.addEventListener('action',  this.backupintervalCallback);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.backupinterval.start();

            if (this.backupintervalPause == 0 ) { this.backupinterval.stop() }

            this.pdfPreviewEventlisterenCallback = () => { document.querySelector("#pdfpreview").style.display = 'none';  document.querySelector("#pdfembed").setAttribute("src", "about:blank"); URL.revokeObjectURL(this.currentpreview);  } //unload pdf
            this.fileBrowserEventlistenerCallback = () => { document.querySelector("#preview").style.display = "none"; }

            // Add event listener to #closefilebrowser  (only once - do not accumulate event listeners)
            document.querySelector("#closefilebrowser").addEventListener("click", this.fileBrowserEventlistenerCallback);
            document.querySelector('#workfolder').addEventListener("click", function(e) { e.stopPropagation(); }); // Prevent event propagation for clicks on #workfolder
            document.getElementById('setupdiv').addEventListener('click', function(e) { e.stopPropagation();});
            document.querySelector("#pdfpreview").addEventListener("click", this.pdfPreviewEventlisterenCallback); // Set the event listener for #pdfpreview

            document.querySelector("#audioclose").addEventListener("click", function(e) {
                audioPlayer.pause();
                document.querySelector("#aplayer").style.display = 'none';
            });

        })

      
        this.hostname = "localhost"
        this.currentdirectory = ipcRenderer.sendSync('getCurrentWorkdir')  //in case user changed it to different location
        this.workdirectory= `${this.currentdirectory}/${this.servername}`

        this.availablePrinters = await ipcRenderer.invoke("getprinters")
        this.availablePrinters.forEach(printer => {   //deprecated in electron 36 - only native methods available to get default printer for win,lin,mac
            if (printer.isDefault){
                console.log(`dashboard @ mounted: found and set default printer: ${printer.printerName}`)
                this.defaultPrinter = printer.printerName
            }
        })
       
        
  

        ipcRenderer.on('reconnected', async (event, student) => {  
            //lookup latest bak file of reconnected student
            const bakResult = await this.getLatestBakFile(student.clientname)
            
            if (bakResult.status === "success") {
                // BAK file found - show dialog with option to send
                const fileName = bakResult.filepath.split('/').pop()
                const filePath = bakResult.filepath
                
                this.$swal.fire({
                    customClass: {
                        popup: 'my-popup',
                        title: 'my-title',
                        content: 'my-content',
                        actions: 'my-swal2-actions',
                        htmlContainer: 'my-html-container'
                    },
                    title: this.$t("dashboard.attention"),
                    html: `<div class="my-content">
                        <p><b>${student.clientname}</b> hat sich neu verbunden!</p>
                        <p>Backup-Datei gefunden: <b>${fileName}</b></p>
                    </div>`,
                    icon: "info",
                    showCancelButton: true,
                    confirmButtonText: this.$t("dashboard.sendfileSingle"),
                    cancelButtonText: this.$t("dashboard.cancel"),
                })
                .then((sendResult) => {
                    if (sendResult.isConfirmed) {
                        // Send the BAK file to the student
                        fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/sendtoclient/${this.servername}/${this.servertoken}/${student.token}`, { 
                            method: 'POST',
                            headers: {'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                files: [{ 
                                    name: fileName, 
                                    path: filePath 
                                }] 
                            })
                        })
                        .then(res => res.json())
                        .then(result => { 
                            console.log("dashboard @ ipcRenderer.on('reconnected'):", result.message)
                        })
                        .catch(err => { 
                            console.error("dashboard @ ipcRenderer.on('reconnected'):", err)
                        })
                    }
                })
                .catch(err => { console.error("dashboard @ ipcRenderer.on('reconnected'):", err) })
            } else {
                // No BAK file found - show simple reconnect message
                this.$swal.fire({
                    title: this.$t("dashboard.attention"),
                    text: `${student.clientname} hat sich neu verbunden!`,
                    icon: "info"
                })
            }
        }); 





    },
    beforeUnmount() {  //when leaving
        this.fetchinterval.removeEventListener('action', this.fetchInfo);
        this.fetchinterval.stop() 
        this.backupinterval.removeEventListener('action', this.backupintervalCallback);
        this.backupinterval.stop() 
        document.querySelector("#pdfpreview").removeEventListener("click", this.pdfPreviewEventlisterenCallback);
        document.querySelector("#closefilebrowser").removeEventListener("click", this.fileBrowserEventlistenerCallback);
    }

}
</script>





















<style scoped>

#wrapper {
    height: calc(100vh - 63px);
}

#aplayer {
    display: none;
    position: absolute;
    top: 40%;
    left: -300px;
    margin-left: 50%;
    width: 600px;
    /* background-color:rgba(0, 0, 0, 0.1); */
    text-align:center;

}
#aplayer audio {
    box-shadow: 0px 0px 10px rgba(0,0,0,0.6);
    border-radius: 8px;
    width: 500px;
}

#audioclose {
    vertical-align: top;
    margin-left: 6px;
}

.tab-buttons-container {
    position: fixed;
    right: 0;
    top: 244px;
   
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 1000;
   
}

.tab-button {
    width: 42px;
    height: 42px;
    padding: 15px 15px;
    border-radius: 8px 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    margin: 0;
    box-shadow: -2px 2px 5px rgba(0,0,0,0.2);
    margin-left: auto; /* Button wird rechts im Container ausgerichtet */
}

.tab-button:hover {
    width: 52px;
    box-shadow: -3px 3px 8px rgba(0,0,0,0.3);
}

.tab-button img {
    margin: 0;
}



.plusbutton {
    box-sizing: border-box;
    font-size:1.1em; 
    font-weight:bold;
    color:white;
    height:28px; 
    text-align: center;
    padding-top: 0px !important;
   
    width: 30px;
    height: 30px;
    position: absolute;
    right: 0;
    top:10px;
}


.sectionbutton {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    width: 128px;
    box-sizing: border-box;
    border-bottom-right-radius: 0px;
    border-bottom-left-radius: 0px;
    color: white;
    font-weight: normal;
    margin-right:4px;
    cursor: pointer;
    height: 22px;
    font-size: 0.8em;
    padding: 2px !important;
}

.sectionbutton-label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sectionbutton-edit {
    flex: 0 0 auto;
    margin-left: auto;
    background: transparent;
    border: 0;
    padding: 0;
    line-height: 1;
    cursor: pointer;
    width: 14px;
    height: 14px;
   
}

.sectionbutton-edit img {
    display: block;
}

.sectionbuttonactive {
    background-color: rgb(245, 245, 245);
    color: black;
    border-color: rgb(245, 245, 245);
}
.sectionbuttonactive:hover {
    background-color: rgb(245, 245, 245);
    color: black;
    border-color: rgb(245, 245, 245);
}



.sectionbuttonactivered {
    background-color: rgb(245, 245, 245);
    color: rgb(176,42,55);
    border-color: rgb(176,42,55);
    border-bottom: 0px;

}

.dropdown-toggle::after {
    margin-left: auto !important;
    margin-right: 4px;
}



#statusdiv {
    display: block !important;
    cursor: help;
}


#setupdiv {
    position: absolute;        /* Fixiert den div über allem anderen */
    top: 50%;               /* Zentriert vertikal */
    left: 50%;              /* Zentriert horizontal */
    display: flex;          /* Flex-Container für die Buttons */
    flex-direction: column; /* Buttons vertikal anordnen */
    align-items: flex-start;    /* Zentriert die Buttons im Container */
    padding: 20px;          /* Innenabstand */
    border-radius: 5px;    /* Abgerundete Ecken */
    background-color: white;
    box-shadow: 0 0 1em rgba(0, 0, 0, 0.5);
    width: 400px;
    max-height: 700px;      /* limit dialog height */
    overflow-y: auto;       /* enable scrolling if content is taller */
    overflow-x: hidden;     /* prevent horizontal scrolling */
    z-index: 1000000;
}


@keyframes clickFeedback1 {
  0% { transform: scale(1); background-color: #0dcaf0;      border-color: #0dcaf0; }
  50% { transform: scale(1.4); background-color: #ffffff; border-radius:5px; border-color: #fff;}
  100% { transform: scale(1); background-color: #ffcd39;   }
}

.btn-click-feedback1 {
  animation: clickFeedback1 0.5s ease-in-out;
}

@keyframes clickFeedback2 {
  0% { transform: scale(1); background-color: #ffcd39;   border-color: #ffcd39; }
  50% { transform: scale(1.4); background-color: #ffffff; border-radius:5px; border-color: #fff;}
  100% { transform: scale(1); background-color:  #0dcaf0;}
}

.btn-click-feedback2 {
  animation: clickFeedback2 0.5s ease-in-out;;
}

.fade-enter-active {
  transition: opacity 1.5s ease;
}



@keyframes swalIn {
    from {
        transform: translate(-50%, -50%) scale(0.3);
        opacity: 0;
    }
    to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }
}
@keyframes swalOut {
    from {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }
    to {
        transform: translate(-50%, -50%) scale(0.3);
        opacity: 0;
    }
}
.scaleOut {
    transform: translate(-50%, -50%);
    transform-origin: center;
    animation: swalOut 0.2s; 
}
.scaleIn {
    transform: translate(-50%, -50%);
    transform-origin: center;
    animation: swalIn 0.2s; 
}

#setupdiv button {
    display: inline-block;
    max-width: 320px; /* oder eine gewünschte feste Breite */
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    white-space: nowrap;
    margin-bottom: 10px; /* Abstand zwischen den Buttons */
    border:0;
}

#setupdiv span {
    width: 100%;
    margin-bottom:6px;
    margin-top: 10px;
}
#setupdiv .printercheck {
    margin-left:4px;
    filter: brightness(0) saturate(100%) hue-rotate(90deg) brightness(1.2) contrast(0.2);

}

#setupoverlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4); /* Abdunkeln des Hintergrunds */
    backdrop-filter: blur(2px); /* Unscharf-Effekt */
    z-index: 111999; /* Unter dem Dialog */
    display: none; /* Standardmäßig nicht angezeigt */
   transition: 0.3s;
}







.studentwidget {
    width: 194px;
    height: 172px;
    white-space: nowrap;
    text-overflow:    ellipsis; 
    overflow: hidden; 
    padding: 0;
    text-align: left; 
    padding-top:0px;
    border: 0px solid #5f5f5f46;
    margin: 0 !important;;
    margin-right: 4px!important;
    background-color: transparent;
    transition: 0.5s;
}


.studentwidget span {
    margin:0;
    backdrop-filter: blur(1px);
    display: inline-block; 
    width:100%; 
    color: white; 
    font-size: 1em; 
    background: linear-gradient(0deg,rgba(0, 0, 0, 0.808) 0%,  rgba(0, 0, 0, 0.5) 31%, rgba(0, 0, 0, 0.1) 77%,rgba(255,255,255,0) 100% );
    padding: 2px;
    padding-left:6px;
    position: absolute;
    bottom: 0;
    right: 0;
    font-size:0.9em;
}

.studentimage {
    background-color:transparent!important;
}

.delfolderstudent {
    cursor: pointer;
}
.delfolderstudent:hover {
    filter: brightness(150%);
}



.ghost {
   opacity: 0.3;
}


[v-cloak] { display: none; }
.virtualizedinfo {
    position: absolute;
    top:30px;
    left:0;
    background-color: #ffc107c7;
    font-size: 0.7em;
    padding: 2px;
    padding-left: 4px;
    padding-right: 10px;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
}

.kioskwarning {
    position: absolute;
    top:6px;
    left:0;
    background-color: #dc3545c7;
    color:white;
    font-size: 0.7em;
    padding: 2px;
    padding-left: 4px;
    padding-right: 10px;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
}

.examrequest {
    position: absolute;
    top:54px;
    left:0;
    background-color: #0dcaf0;
    font-size: 0.7em;
    padding: 2px;
    padding-left: 4px;
    padding-right: 10px;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
}

.remoteassistant {
    position: absolute;
    top:78px;
    left:0;
    background-color: #b96118;
    color:white;
    font-size: 0.7em;
    padding: 2px;
    padding-left: 4px;
    padding-right: 10px;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
    z-index: 100;
}

.widgetbutton {
    background-color: transparent;
}
.widgetbutton:hover {
    filter: brightness(120%);
}

#content {
    background-color: whitesmoke;
    padding-right: 0px !important;
    padding-bottom: 0px !important;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.sidebar-info-strip {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.sidebar-root {
    position: relative;
    height: calc(100vh - 63px);
    min-height: 0;
}

.sidebar-root.mt-3 {
    height: calc(100vh - 63px - 1rem);
}

.sidebar-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.35) transparent;

    margin-right: -10px;
}


.sidebar-scroll::-webkit-scrollbar {
    width: 6px;
}

.sidebar-scroll::-webkit-scrollbar-track {
    background: transparent;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.25);
    border-radius: 6px;
}

.sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.35);
}

.sidebar-footer {
    margin-top: 6px;
    font-size: 0.8em;
    cursor: pointer;
    user-select: none;
    padding-left: 6px;
    padding-right: 6px;
}

.sidebar-narrow {
    width: 140px;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 1rem;
    position: relative;
}

.sidebar-narrow--btn {
    white-space: normal;
    text-align: center;
}

.sidebar-message {
    margin-bottom: 0.5rem;
    border-radius: 0 !important;
}

.sidebar-dropdown-inset {
    padding-left: var(--bs-btn-padding-x, 0.75rem);
    padding-right: var(--bs-btn-padding-x, 0.75rem);
    box-sizing: border-box;
}

.sidebar-exammode-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
}

.sidebar-exammode-dropdown-wrap {
    flex: 1 1 auto;
    min-width: 0;
}

.sidebar-exammode-toggle {
    min-width: 0;
}

.sidebar-exammode-settings {
    flex: 0 0 auto;
}

.infobutton{
    width: 100%;
    min-width: 0;
    max-width: none;
    border-radius: 0 !important;
    background-color: whitesmoke;
    cursor: help;
}

#studentslist{
    border-radius: 5px;
    width: 100%;
    flex: 1;
    /* border: 1px solid rgb(99, 187, 175); */
    padding-bottom:100px;
    padding-right: 30px;
    transition:0.1s;
    overflow-y:auto;
}

.disabledblue {
    filter: contrast(140%) grayscale(80%) brightness(150%) blur(0.9px);
    pointer-events: none;
    color: #adebff;
}

.disabledgreen {
    filter: contrast(140%) grayscale(80%) brightness(150%) blur(0.9px);
    pointer-events: none;
    color: #d6ffe1
}

.disabledexam {
    filter: contrast(100%) grayscale(100%) brightness(80%) blur(0.6px);
    pointer-events: none;
}

.disabledexam-dropdown {
    filter: contrast(100%) grayscale(100%) brightness(60%) blur(0.8px);
    pointer-events: none;
}


#pdfpreview {
    display: none;
    position: absolute;
    top:0;
    left: 0;
    width:100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
    backdrop-filter: blur(3px);
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

.insert-button {
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
  margin-top: 10px;
}

.insert-button img {
  width: 22px;
  height: 52px;
}

#previewbuttons {
    display: flex;
    align-items: flex-start;
    flex-direction: column; 
}









#description {
    font-size: 0.8em;
    border-bottom-left-radius:5px;
    border-bottom-right-radius:5px;
    border-radius: 5px;
    text-align: left !important;
}




#preview {
    display: none;
    position: absolute;
    top:0;
    left: 0;
    width:100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index:1002;
}
#workfolder { 
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    padding: 20px;
    background-color: rgba(255, 255, 255, 0.8);
    z-index:1003;
    backdrop-filter: blur(3px);
    overflow-y: auto;
}



#studentinfocontainer {
    display: none;
    position: absolute;
    top:0;
    left: 0;
    width:100vw;
    height: 100vh;
    z-index:1001;
}
#studentinfodiv {
    position: absolute;
    top: 0;
    left: 0;
    width:100%;
    height: 100vh;
    background-size:cover;
    background-repeat: no-repeat;
    overflow:hidden;
    background-color: #343a40;
 
}
#controlbuttons {
    backdrop-filter: blur(3px);
    position: absolute;
    right: 0px;
    width: 132px; 
    height: 100%; 
    top: 0px;  
    background:  rgba(97, 97, 97, 0.693);
    color: white; 
    font-size: 1.4em; 
    padding: 2px;
}


hr {
    margin: 0.2em 0.9em 0.5em 0.3em;
   
    background-color: #b3b3b3;
    border: 0;
    opacity: 0.25;
}


/* CSS classes for fade-in and fade-out */
.fade-in {
    animation: fadeInAnimation 2s;
}


.fade-out {
    animation: fadeOutAnimation 2s forwards; /* 'forwards' keeps the final state after the animation */
}

@keyframes fadeInAnimation {
    from { opacity: 0; }
    to { opacity: 1; }
}


@keyframes fadeOutAnimation {
    from { opacity: 1; }
    to { opacity: 0; visibility: hidden; }
}

.ellipsis {
    display: inline-block;
    white-space: nowrap; /* Verhindert Zeilenumbrüche */
    overflow: hidden;    /* Versteckt überlaufenden Text */
    text-overflow: ellipsis; /* Fügt "..." am Ende des überlaufenden Texts hinzu */
    max-width: 170px;    /* Maximale Breite, anpassbar nach Ihren Bedürfnissen */
}


.custom-slider {
    width: 345px; /* Feste Breite des Sliders */
    margin-right: 10px; /* Abstand zu anderen Elementen */
}

.editor-cmargin-range,
.editor-linespacing-range {
    flex: 1 1 auto;
    min-width: 0;
}

.smalltext {
    font-size: 0.825rem;
}

.editor-cmargin-range::-webkit-slider-thumb,
.editor-linespacing-range::-webkit-slider-thumb {
    background-color: #20c997;
}

.editor-cmargin-range::-moz-range-thumb,
.editor-linespacing-range::-moz-range-thumb {
    background-color: #20c997;
    border-color: #20c997;
}


#loginfo {
    position: fixed;
    z-index: 1000; 
    width: 580px;
    height: 100%;
    right: -582px;
    top: 66px;
    background-color: var(--bs-gray-100);
    box-shadow: -2px 1px 2px rgba(0, 0, 0, 0);
    transition: 0.3s;
    padding: 6px;
    padding-bottom: 100px;
  
}

#logcheck {
    position: absolute;
    margin-left: -6px;
    margin-top: 311px;
    padding: 10px;
    background-color: var(--bs-gray-900);
    box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
    width: 135px;
    height: 44px;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    cursor: pointer;
    color:var(--bs-gray-100);

    text-align: left;

    transform: rotate(90deg); 
    transform-origin: top left; 
    transition: all 0.3s ease;
}
#logcheck:hover{  
    height: 52px;
    background-color: var(--bs-gray-800);
    box-shadow: -3px 3px 8px rgba(0,0,0,0.3);
    padding-top: 16px;
}




#logcheck img{
    vertical-align: bottom;

}
#logcheck #eye {
    width: 20px;
    height: 20px;
    background-size: cover;
    display:inline-block;
    vertical-align: text-bottom;
}

#logcheck .eyeopen {
    background-image: url('/src/assets/img/svg/eye-fill.svg');
}
#logcheck .eyeclose {
    background-image: url('/src/assets/img/svg/eye-slash-fill.svg');
}

#loginfo .logscrollarea {
    height: calc(100vh - 52px);
    width: 568px;
    overflow-x: hidden;
    overflow-y: auto;
    position: absolute;
    top: 0px;
    padding-top: 20px;
    padding-bottom: 20px;
}

#loginfo .color-circle {
  height: 10px;
  width: 10px;
  border-radius: 50%;
  display: inline-block;
  background-color: #0dcaf0;
}


#loginfo .logentry {
    margin: 10px;
    padding: 10px;
    border-radius: 8px;
    color: var(--bs-gray-700);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 0.8em;
    cursor: pointer;
}
#loginfo .logentry:hover {
  background-color:   rgba(238, 238, 250, 0.508);
}
.darkgreen {
    filter: invert(36%) sepia(100%) saturate(2200%) hue-rotate(95deg) brightness(75%);
}
.darkred {
    filter: invert(28%) sepia(99%) saturate(7476%) hue-rotate(345deg) brightness(65%);
}
#loginfo .error-word {
  padding: 5px;
  border: none;
  background-color: transparent;
  font-size: 1.1em;
  display: inline-block;
 
}
#loginfo .date {
    padding: 2px;
    padding-left: 0px;
    margin-top: 4px;
    border-top: 1px solid var(--bs-cyan);
    color: var(--bs-gray-500);
    border-radius: 0px;
}















</style>


<style>
/**in order to override swal settings the css needs to be global not scoped*/
.swal2-popup{
    opacity: 0.9 !important; 
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -webkit-animation: none !important;
}

.swal2-container {
    backdrop-filter: blur(2px); 
    z-index: 100000 !important;
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -webkit-animation: none !important;
} 



.my-html-container {
    width: 90% !important;
}


.my-select{
    font-size: 1.125em;
    margin: 0em 0em 3px;
    min-height: 1.2em;
    height: 38px !important;
    padding: .375em .625em;
    color: #545454;
    width: 99% !important;
}

.swal2-icon{
    margin-left: 2.5em !important;
}

.my-title {
    text-align: left;
    font-size: 1.5em;
}

.my-content {
   
    margin-bottom: 0px;
    overflow:hidden;
    padding-left: 4px !important;
    display: block !important;
    text-align: left !important;
}

.my-content h5 {
    font-size: 1em;
    margin-bottom: 0px;
}

.my-content h6 {
   
    margin-bottom: 1px;
    margin-top:8px;
}
.my-popup {
    justify-content: flex-start !important;
    justify-items: flex-start !important;

}
.my-popup-sprachen {
    justify-content: flex-start !important;
    justify-items: flex-start !important;
    width: unset !important;
}

.my-input-label {    
    justify-content: flex-start !important;
    justify-items: flex-start !important; 
    width: -webkit-fill-available !important;
    margin: 1em 2em 3px !important;
}

.my-custom-input {
    margin-top: 0px !important;
    width: -webkit-fill-available !important;
    margin: 1em 2em 3px !important;
}  

.my-custom-input-select {
    margin-top: 0px !important;
    width: -webkit-fill-available !important;
    margin: 0px 44px 0px 44px !important;
}  
.my-swal2-actions {
    margin-top: 10px !important;
    width: 80% !important;
    margin-left: 1.9em !important;
    margin-right: 1.9em !important;
    justify-content: flex-start !important; /* Richtet die Buttons linksbündig aus */
}


.custom-swal2-popup-info {
    width: 700px !important;
}







.printerbutton {
    position: relative;
}

.tooltip-content {
  display: block; /* hidden by default */
  position: absolute; /* use absolute to position relative to .custom-tooltip */
  top: 105%; /* position below the tooltip container */
  right: 0px; 
  background: #20c996dc;
  color: #fff; 
  padding: 6px; 
  border-radius: 4px;
  white-space: normal; 
  max-width: 300px; /* wraps text */
  z-index: 99999999;
  pointer-events: none;
  font-size: 0.8em;

}

.white-100 {    
    filter: brightness(0) saturate(100%) invert(100%);
}


.custom-swal2-icon {
    margin: 3em auto 1em auto !important
}

.extension-button-sidebar {
    width: 14px;
    height: 31px;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}

.vertical-text-sidebar {
    writing-mode: vertical-rl;
    font-size: 0.7em;
    color: whitesmoke;
    text-align: center;
    transform: translateX(-10%);
}

.filename-button {
    max-width: 158px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.materials-sidebar-block {
    width: 100%;
    max-width: none;
    box-sizing: border-box;
    padding: 0.5rem var(--bs-btn-padding-x, 0.75rem);
    border-width: 1px 0;
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.14);
    border-radius: 0;
    background: rgba(90, 90, 90, 0.22);
}

.materials-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 0.5rem;
}

.materials-panel-caption {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.055em;
    color: rgba(255, 255, 255, 0.52);
    line-height: 1.1;
    min-width: 0;
}

.materials-plus {
    flex: 0 0 auto;
    margin: 0 !important;
}

.materials-sidebar-list {
    margin: 0 !important;
}

/* Pick-row dashed buttons: activesheets + MaterialsList; flex aligns label/+ identically (grid+inline spans differed by subtree/font metrics) */
.sidebar-pick-btn.btn {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    display: flex !important;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    height: 32px;
    min-height: 32px;
    max-height: 32px;
    padding: 0 0.5rem !important;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.55);
    border: 1px dashed rgba(255, 255, 255, 0.28) !important;
    border-radius: 0.25rem;
    text-align: left;
}

.sidebar-pick-btn .sidebar-pick-btn__label {
    display: flex;
    align-items: center;
    align-self: stretch;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sidebar-pick-btn .sidebar-pick-btn__plus {
    display: flex;
    align-items: center;
    align-self: stretch;
    flex: 0 0 auto;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.68);
    
}

.sidebar-pick-btn.btn-outline-secondary:hover,
.sidebar-pick-btn.btn-outline-secondary:focus,
.sidebar-pick-btn.btn-outline-secondary:active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.22) !important;
    color: rgba(255, 255, 255, 0.72);
    box-shadow: none;
}

.sidebar-pick-btn.btn-outline-secondary:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.25);
    outline-offset: 1px;
}

.basematerial-sidebar-block {
    margin-top: 0.35rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0.5rem var(--bs-btn-padding-x, 0.75rem);
    border-width: 1px 0;
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.14);
    border-radius: 0;
    background: rgba(90, 90, 90, 0.22);
}

.basematerial-sidebar-block .sidebar-pick-btn.btn {
    border-color: rgba(205, 53, 69, 0.9) !important;
}

.basematerial-sidebar-block--optional .sidebar-pick-btn.btn {
    border-color: rgba(255, 255, 255, 0.28) !important;
}

.basematerial-sidebar-block .sidebar-pick-btn.btn-outline-secondary:hover,
.basematerial-sidebar-block .sidebar-pick-btn.btn-outline-secondary:focus,
.basematerial-sidebar-block .sidebar-pick-btn.btn-outline-secondary:active {
    border-color: rgba(220, 53, 69, 0.75) !important;
}

.basematerial-sidebar-block--optional .sidebar-pick-btn.btn-outline-secondary:hover,
.basematerial-sidebar-block--optional .sidebar-pick-btn.btn-outline-secondary:focus,
.basematerial-sidebar-block--optional .sidebar-pick-btn.btn-outline-secondary:active {
    border-color: rgba(255, 255, 255, 0.22) !important;
}

.basematerial-panel-caption {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.055em;
    color: rgba(255, 255, 255, 0.52);
    margin-bottom: 0.5rem;
}

.basematerial-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}

.basematerial-row:last-of-type {
    margin-bottom: 0;
}

.basematerial-group-pill {
    flex: 0 0 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(165deg, #0dcaf0 0%, #0a9cb8 100%);
    border-radius: 5px;
    user-select: none;
}

.basematerial-group-pill--b {
    background: linear-gradient(165deg, #ffc107 0%, #d39e00 100%);
    color: #212529;
}

.basematerial-group-pill--ab {
    background: linear-gradient(135deg, var(--bs-info) 0 50%, var(--bs-warning) 50% 100%);
    color: var(--bs-dark);
    border: 0px solid rgba(255, 255, 255, 0.12);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
}

.basematerial-filename {
    flex: 1 1 0%;
    min-width: 0;
    text-align: left;
}

.basematerial-filegroup {
    flex: 1 1 auto;
    min-width: 0;
    align-items: stretch;
}

.basematerial-filegroup .basematerial-filename {
    flex: 1 1 0%;
    min-width: 0;
}

.basematerial-filegroup > .basematerial-filename.btn {
    --bs-btn-line-height: 1;
    flex: 1 1 0%;
    min-width: 0;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start;
    min-height: 32px;
    height: 32px;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    line-height: 1 !important;
}

.basematerial-filegroup > .basematerial-filename.btn .basematerial-filename-truncate {
    display: block;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
}

.basematerial-filegroup > .basematerial-remove.btn {
    flex: 0 0 20px;
    width: 20px;
    min-width: 20px;
    max-width: 20px;
    min-height: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-size: 1.05rem;
    font-weight: 300;
}

.sd-sf-btn {
    width: 14px;
    min-width: 14px;
    max-width: 14px;
    padding: 0;
    font-size: 0.6rem;
    min-height: 32px;
    height: 32px;
    max-height: 32px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: default;
}

.sd-sf-stack {
    display: block;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    line-height: 1;
    text-align: center;
    font-size: 1em;
    transform: translateX(-10%);
}


</style>
