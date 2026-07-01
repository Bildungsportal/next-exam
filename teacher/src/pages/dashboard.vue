<template>


<!-- Header START -->
<div :key="0" class="w-100 p-3 text-white bg-dark text-left " style="position: relative; display: flex; align-items: center; justify-content: space-between; min-width: 1180px; height: 62px; z-index: 100;">
    <span class="text-white m-1" style="flex-shrink: 0;">
        <img src="/src/assets/img/svg/speedometer.svg" class="white me-2  " width="32" height="32" >
        <span style="font-size:23px;" class="align-middle me-1 ">Next-Exam</span>
    </span>

    <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
        <button type="button" class="btn btn-sm btn-gray-dark m-0 me-1 mt-0" style="height:32px;" @click="openEncryptedPdfPreview" @mouseover="showDescription($t('dashboard.openEncryptedPdfTooltip'))" @mouseout="hideDescription"><img src="/src/assets/img/svg/rotation-locked-landscape.svg" style="vertical-align:text-top;" class="white" width="20" height="20" alt="">&nbsp; {{ $t('dashboard.openEncryptedPdf') }}&nbsp;</button>
        <div class="btn btn-sm btn-danger m-0 me-1 mt-0" @click="stopserver()" @mouseover="showDescription($t('dashboard.exitexam'))" @mouseout="hideDescription"  style=" height:32px;"><img src="/src/assets/img/svg/stock_exit.svg" style="vertical-align:text-top;" class="" width="20" height="20" >&nbsp; {{$t('dashboard.stopserver')}}&nbsp; </div>
        <div v-if="!hostip?.hostip" id="adv" class="btn btn-danger btn-sm m-0  mt-1 me-1 " style="cursor: unset;">{{ $t("general.offline") }}</div>
        <div class="btn btn-sm btn-cyan m-0 me-1 mt-0" style=" padding:3px; height:32px; width:32px;" @click="showSetup()"  @mouseover="showDescription($t('dashboard.extendedsettings'))" @mouseout="hideDescription" ><img src="/src/assets/img/svg/settings-symbolic.svg" class="white-100" width="22" height="22" > </div>
        <span class="align-middle ms-3" style="font-size:23px;">Dashboard</span>
    </div>
    
    <div v-if="serverstatus.useExamSections && !serverstatus.allowSectionSwitch" style="position: absolute; left:256px; bottom: 0; min-width: 550px; z-index: 0;">
        <div id="section1" v-if="serverstatus.examSections[1]" @click="activateSection(1)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 1 && !serverstatus.examSections[1].locked, 'sectionbuttonactivered': serverstatus.activeSection == 1 && serverstatus.examSections[1].locked, 'btn-secondary': serverstatus.activeSection != 1,'btn-danger': serverstatus.examSections[1].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[1].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(1)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(1) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
        <div id="section2" v-if="serverstatus.examSections[2]" @click="activateSection(2)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 2 && !serverstatus.examSections[2].locked, 'sectionbuttonactivered': serverstatus.activeSection == 2 && serverstatus.examSections[2].locked, 'btn-secondary': serverstatus.activeSection != 2,'btn-danger': serverstatus.examSections[2].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[2].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(2)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(2) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
        <div id="section3" v-if="serverstatus.examSections[3]" @click="activateSection(3)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 3 && !serverstatus.examSections[3].locked, 'sectionbuttonactivered': serverstatus.activeSection == 3 && serverstatus.examSections[3].locked, 'btn-secondary': serverstatus.activeSection != 3,'btn-danger': serverstatus.examSections[3].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[3].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(3)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(3) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
        <div id="section4" v-if="serverstatus.examSections[4]" @click="activateSection(4)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 4 && !serverstatus.examSections[4].locked, 'sectionbuttonactivered': serverstatus.activeSection == 4 && serverstatus.examSections[4].locked, 'btn-secondary': serverstatus.activeSection != 4,'btn-danger': serverstatus.examSections[4].locked}">
            <span class="sectionbutton-label">{{ serverstatus.examSections[4].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(4)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(4) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
    </div>
    <!-- allowSectionSwitch: active tab white (sectionbuttonactive), no red border; tabs only switch dashboard view -->
    <div v-if="serverstatus.useExamSections && serverstatus.allowSectionSwitch" style="position: absolute; left:257px; bottom: 0; min-width: 550px; z-index: 0;">
        <div id="section1" v-if="serverstatus.examSections[1]" @click="activateSection(1)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 1 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[1].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(1)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(1) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
        <div id="section2" v-if="serverstatus.examSections[2]" @click="activateSection(2)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 2 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[2].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(2)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(2) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
        <div id="section3" v-if="serverstatus.examSections[3]" @click="activateSection(3)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 3 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[3].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(3)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(3) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
        <div id="section4" v-if="serverstatus.examSections[4]" @click="activateSection(4)" class="sectionbutton btn btn-sm" :class="serverstatus.activeSection == 4 ? 'sectionbuttonactive' : 'btn-secondary'">
            <span class="sectionbutton-label">{{ serverstatus.examSections[4].sectionname }}</span>
            <button type="button" class="sectionbutton-edit" :title="$t('dashboard.sectionname')" @click.stop="editSectionName(4)" @mouseover="showDescription($t('dashboard.sectionSettingsDesc'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/settings-symbolic.svg" :class="isSectionTabActive(4) ? '' : 'white'" width="14" height="14">
            </button>
        </div>
    </div>

    <!-- when sections are disabled, tabs are hidden (legacy behavior) -->


    

</div>
<!-- Header END -->





<div id="wrapper" class="w-100 h-100 d-flex"  style="z-index: 100;">
    
    <StudentView
        :visible="showStudentView && !!activestudent"
        :student="activestudent"
        :reachable="!!(activestudent && isStudentReachable(activestudent, now))"
        :screenshot-sidebar-hint="screenshotSidebarHint"
        @close="hideStudentview()"
        @send-files="(token) => sendFiles(token)"
        @get-files="({ token, force }) => getFiles(token, force)"
        @download-screenshot="(student) => downloadStudentScreenshot(student)"
        @open-latest-folder="(student) => openLatestFolder(student)"
        @kick="({ token, ip }) => kick(token, ip)"
    />











    <!-- dashboard EXPLORER -->
    <DashboardExplorer
        :visible="showExplorer"
        :localfiles="localfiles"
        :currentdirectory="currentdirectory"
        :workdirectory="workdirectory"
        :currentdirectoryparent="currentdirectoryparent"
        :lockSendFile="lockSendFile"
        :backupdirectory="serverstatus.backupdirectory || ''"
        @close="showExplorer = false"
        @load-filelist="(path) => loadFilelist(path)"
        @load-pdf="({ path, name }) => showPDFPreview({ filepath: path, filename: name })"
        @load-image="(path) => loadImage(path)"
        @load-text="({ path, name }) => loadTextFile(path, name)"
        @load-html="({ path, name }) => loadHtmlFile(path, name)"
        @send-file="(file) => dashboardExplorerSendFile(file)"
        @download-file="(file) => downloadFile(file)"
        @delete-file="(file) => fdelete(file)"
        @timeline-diff="(file) => openStudentEditorTimelineDiff(file)"
    />

    <StudentEditorTimelineDiffViewer
        :visible="showEditorTimelineViewer"
        :document="editorTimelineViewerDoc"
        @close="showEditorTimelineViewer = false"
    />





   





    <!-- SIDEBAR start -->
    <div :key="5" class=" text-white bg-dark d-flex flex-column sidebar-root mt-3" style="width: 240px; min-width: 240px;">
        <div class="sidebar-overlays">
        </div>
        <div class="sidebar-info-strip">
        <div class="text-start infobutton d-flex align-items-start">
            <div class="flex-grow-1 min-w-0">{{$t('dashboard.name')}} <br><b> {{$route.params.servername}}</b></div>
            <button type="button" class="sectionbutton-edit flex-shrink-0 ms-1 me-1" :title="$t('dashboard.online')" @click.stop="showinfo()" @mouseover="showDescription($t('dashboard.showcredentials'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/eye-fill.svg" alt="" width="22" height="22">
            </button>
        </div>
        <div class="text-start infobutton d-flex align-items-start">
            <div class="flex-grow-1 min-w-0">{{$t('dashboard.pin')}}<br><b> {{ serverstatus.pin }} </b></div>
            <button type="button" class="sectionbutton-edit flex-shrink-0 ms-1 me-1" :title="$t('dashboard.pin')" @click.stop="editPin()" @mouseover="showDescription($t('dashboard.changepin'))" @mouseout="hideDescription">
                <img src="/src/assets/img/svg/document-edit.svg" class="white" alt="" width="22" height="22">
            </button>
        </div>
        <div class="text-start infobutton" style="margin-bottom: 0.7rem;">{{$t('dashboard.server')}} <br><b>{{serverip}}</b></div>
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
                <li v-if="config.exammodes && config.exammodes.activesheets"><a class="dropdown-item" @click="selectExamType('activesheets')" :class="{ active: isExamType('activesheets') }">Active Sheets</a></li>
                <li v-if="config.exammodes && config.exammodes.eduvidual"><a class="dropdown-item" @click="selectExamType('eduvidual')" :class="{ active: isExamType('eduvidual') }">{{$t('dashboard.eduvidual')}}</a></li>
                <li v-if="config.exammodes && config.exammodes.forms"><a class="dropdown-item" @click="selectExamType('forms')" :class="{ active: isExamType('forms') }">{{$t('dashboard.forms')}}</a></li>
                <li v-if="config.exammodes && config.exammodes.website"><a class="dropdown-item" @click="selectExamType('website')" :class="{ active: isExamType('website') }">Website</a></li>
                <li v-if="config.exammodes && config.exammodes.microsoft365"><a class="dropdown-item" @click="selectExamType('microsoft365')" :class="{ active: isExamType('microsoft365') }">Microsoft365</a></li>
                <li v-if="config.exammodes && config.exammodes.rdp"><a class="dropdown-item" @click="selectExamType('rdp')" :class="{ active: isExamType('rdp') }">RDP</a> </li>
                <li v-if="config.exammodes && config.exammodes.localvm"><a class="dropdown-item" @click="selectExamType('localvm')" :class="{ active: isExamType('localvm') }">LocalVM</a> </li>
            </ul>
            </div>
     
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

                    <div class="mt-2">
                        <div class="form-check form-switch m-0">
                            <input id="sidebar-languagetool"
                                   class="form-check-input"
                                   type="checkbox"
                                   :checked="!!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool"
                                   @change="$event.target.checked ? setEditorExamConfigPatch({ languagetool: true }) : setEditorExamConfigPatch({ languagetool: false, languagetoolhost: null, languagetoolport: null, suggestions: false })">
                            <label class="form-check-label" for="sidebar-languagetool">LanguageTool</label>
                        </div>
                        <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool"
                             class="form-check form-switch m-0 mt-1">
                            <input id="sidebar-lt-suggestions"
                                   class="form-check-input"
                                   type="checkbox"
                                   :checked="!!serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.suggestions"
                                   @change="setEditorExamConfigPatch({ suggestions: $event.target.checked })">
                            <label class="form-check-label" for="sidebar-lt-suggestions">{{ $t('dashboard.suggest') }}</label>
                        </div>
                    </div>

                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.languagetool" class="mt-2">
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
                                    <span class="remove-x">&times;</span>
                                </button>
                            </div>
                        </template>
                        <button v-else type="button"
                                class="btn btn-sm btn-outline-secondary sidebar-pick-btn w-100"
                                @click="configureCustomLanguageToolHost()">
                            <span class="sidebar-pick-btn__label">{{ $t('dashboard.customhost') }}</span>
                            <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                        </button>
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

                    <button type="button"
                            class="sidebar-advanced-toggle"
                            @click="editorAdvancedOpen = !editorAdvancedOpen">
                        <span class="sidebar-advanced-chevron" :class="editorAdvancedOpen ? 'open' : ''">›</span>
                        <span class="sidebar-advanced-label">{{ $t('dashboard.advanced') }}</span>
                    </button>

                    <template v-if="editorAdvancedOpen">
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
                    </template>
                </div>

                <div v-if="isExamType('editor')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">{{ $t('dashboard.editorTemplateCaption') }}</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.editorTemplate?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.editorTemplate.filename" @click="configureEditorTemplate('a')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.editorTemplate.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEditorTemplate('a')"><span class="remove-x">&times;</span></button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureEditorTemplate('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.templateChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.editor?.editorTemplate?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.editor.editorTemplate.filename" @click="configureEditorTemplate('b')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.editor.editorTemplate.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEditorTemplate('b')"><span class="remove-x">&times;</span></button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureEditorTemplate('b')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.templateChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.editor?.editorTemplate?.filename">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.editorTemplate.filename" @click="configureEditorTemplate('all')">
                                        <span class="basematerial-filename-truncate">{{ truncatedClientName(getFilenameWithoutExtension(serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.editor.editorTemplate.filename), 22) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEditorTemplate('all')"><span class="remove-x">&times;</span></button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureEditorTemplate('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.templateChoose') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeWebsiteUrl('a')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeWebsiteUrl('b')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeWebsiteUrl('all')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEduvidualUrl('a')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEduvidualUrl('b')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeEduvidualUrl('all')"><span class="remove-x">&times;</span></button>
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
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.forms?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.forms.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.forms.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.forms.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeFormsUrl('a')"><span class="remove-x">&times;</span></button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureForms('a')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.formsChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.forms?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.forms.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.forms.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.forms.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeFormsUrl('b')"><span class="remove-x">&times;</span></button>
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
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.forms?.url">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate" :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.forms.url" @click="openAllowedUrl({ url: serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.forms.url, blockSubdomains: false, blockSubfolders: false })">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.forms.url }}</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeFormsUrl('all')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeRdp('a')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeRdp('b')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeRdp('all')"><span class="remove-x">&times;</span></button>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureRDP('all')">
                                <span class="sidebar-pick-btn__label">{{ $t('dashboard.rdpChooseUrl') }}</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>
                </div>

                <div v-if="isExamType('localvm')" class="basematerial-sidebar-block mt-3">
                    <div class="basematerial-panel-caption">LocalVM (QEMU)</div>

                    <template v-if="serverstatus.examSections[serverstatus.activeSection].groups">
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill">A</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.localvm?.qcow2Name">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate"
                                        :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.qcow2Name"
                                        @click="configureLocalVM('a')">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.qcow2Name }}</span>
                                    </button>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.blockInternet" class="btn btn-sm btn-warning sd-sf-btn" title="Internet in der VM blockiert"><span class="sd-sf-stack">WEB</span></div>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.calculateSha256" class="btn btn-sm btn-warning sd-sf-btn" title="SHA256 Hash überprüfen aktiviert"><span class="sd-sf-stack">SHA</span></div>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureLocalVM('a')">
                                <span class="sidebar-pick-btn__label">QEMU VM wählen</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>

                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--b">B</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupB?.examConfig?.localvm?.qcow2Name">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate"
                                        :title="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.localvm.qcow2Name"
                                        @click="configureLocalVM('b')">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.localvm.qcow2Name }}</span>
                                    </button>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.localvm.blockInternet" class="btn btn-sm btn-warning sd-sf-btn" title="Internet in der VM blockiert"><span class="sd-sf-stack">WEB</span></div>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupB.examConfig.localvm.calculateSha256" class="btn btn-sm btn-warning sd-sf-btn" title="SHA256 Hash überprüfen aktiviert"><span class="sd-sf-stack">SHA</span></div>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureLocalVM('b')">
                                <span class="sidebar-pick-btn__label">QEMU VM wählen</span>
                                <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div class="basematerial-row">
                            <span class="basematerial-group-pill basematerial-group-pill--ab" aria-label="A/B">AB</span>
                            <template v-if="serverstatus.examSections[serverstatus.activeSection].groupA?.examConfig?.localvm?.qcow2Name">
                                <div class="btn-group basematerial-filegroup" role="group">
                                    <button type="button" class="btn btn-sm btn-teal basematerial-filename text-truncate"
                                        :title="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.qcow2Name"
                                        @click="configureLocalVM('all')">
                                        <span class="basematerial-filename-truncate">{{ serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.qcow2Name }}</span>
                                    </button>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.blockInternet" class="btn btn-sm btn-warning sd-sf-btn" title="Internet in der VM blockiert"><span class="sd-sf-stack">WEB</span></div>
                                    <div v-if="serverstatus.examSections[serverstatus.activeSection].groupA.examConfig.localvm.calculateSha256" class="btn btn-sm btn-warning sd-sf-btn" title="SHA256 Hash überprüfen aktiviert"><span class="sd-sf-stack">SHA</span></div>
                                </div>
                            </template>
                            <button v-else type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="configureLocalVM('all')">
                                <span class="sidebar-pick-btn__label">QEMU VM wählen</span>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeActiveSheet('A')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeActiveSheet('B')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeActiveSheet('A')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeMicrosoft365Template('a')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeMicrosoft365Template('b')"><span class="remove-x">&times;</span></button>
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
                                    <button type="button" class="btn btn-sm btn-secondary basematerial-remove" :title="$t('dashboard.removefile')" @click="removeMicrosoft365Template('all')"><span class="remove-x">&times;</span></button>
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
                @show-preview="(base64, filename) => showPDFPreview.call(this, { base64, filename })"
                @show-pdf-in-renderer="(base64, filename) => showBase64PdfInRenderer.call(this, base64, filename)"
                @show-image-preview="showBase64ImagePreview"
                @play-audio-file="playAudioFile"
                @remove-allowed-url="handleAllowedUrlRemove"
                @open-allowed-url="openAllowedUrl"
            />
        </div>
        <!-- Files Section END -->



        <!-- BIP Section START -->
        <div v-if="bipToken && this.serverstatus.bip" class="mb-4">
            <span class="small m-1">{{$t("dashboard.bildungsportal")}}</span><span v-if="bipToken" class="small m-1 me-0 text-secondary">(verbunden)</span>
            <div id="biploginbutton" @click="showBipInfo()" class="disabledbutton btn btn-success m-1" style="padding:0;">
                <img id="biplogo" style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span v-if="bipUsername" id="biploginbuttonlabel" style="padding:2px; font-size:0.9em;">{{bipUsername}}</span><span style="padding:2px; font-size:0.9em;" v-else id="biploginbuttonlabel">Login</span>
            </div> 
        </div>
        <!-- BIP Section END -->
        
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
            <div class="setup-header">
                <div class="setup-title">{{ $t('dashboard.extendedsettings') }}</div>
            </div>

            <div class="setup-scroll">
                <div class="setup-grid">
                    <div class="setup-card">
                        <div class="setup-row">
                            <div class="form-check form-switch m-0">
                                <input v-model="serverstatus.useExamSections" @change="onToggleExamSections" :disabled="sectionsLocked" class="form-check-input" type="checkbox" id="activatesections" @mouseenter="setSetupStatus(sectionsLocked ? $t('dashboard.sectionslocked') : $t('dashboard.activatesections'))" @mouseleave="clearSetupStatus">
                                <label class="form-check-label" :class="{'text-muted': sectionsLocked}" for="activatesections">{{$t('dashboard.activatesections')}}</label>
                            </div>
                        </div>

                        <div class="setup-row" v-if="serverstatus.useExamSections">
                            <div class="form-check form-switch m-0">
                                <input v-model="serverstatus.allowSectionSwitch" class="form-check-input" type="checkbox" id="allowsectionswitch" @mouseenter="setSetupStatus($t('dashboard.allowsectionswitch'))" @mouseleave="clearSetupStatus">
                                <label class="form-check-label" for="allowsectionswitch">{{$t('dashboard.allowsectionswitchshort')}}</label>
                            </div>
                        </div>
                    </div>

                    <div class="setup-card">
                        <div
                            class="setup-row setup-row-split"
                            :class="(serverstatus.useExamSections && !serverstatus.allowSectionSwitch) ? 'setup-row-disabled' : ''"
                            @mouseenter="(serverstatus.useExamSections && !serverstatus.allowSectionSwitch) ? setSetupStatus($t('dashboard.sectionSettingsRequiredHint')) : null"
                            @mouseleave="(serverstatus.useExamSections && !serverstatus.allowSectionSwitch) ? clearSetupStatus() : null">
                            <div class="setup-field-label">{{$t('dashboard.timelimit')}}</div>
                            <div class="setup-inline">
                                <input
                                    id="timelimitInput"
                                    type="number"
                                    min="1"
                                    step="1"
                                    v-model.number="serverstatus.examSections[1].timelimit"
                                    class="form-control form-control-sm setup-timelimit"
                                    :disabled="serverstatus.useExamSections && !serverstatus.allowSectionSwitch"
                                    @mouseenter="(serverstatus.useExamSections && !serverstatus.allowSectionSwitch) ? setSetupStatus($t('dashboard.sectionSettingsRequiredHint')) : setSetupStatus($t('dashboard.timelimitInfo'))"
                                    @mouseleave="clearSetupStatus"
                                    @change="(serverstatus.useExamSections && !serverstatus.allowSectionSwitch) ? null : setServerStatus()">
                                <span class="setup-unit">min</span>
                            </div>
                        </div>
                    </div>

                    <div class="setup-card">
                        <div class="setup-row">
                            <div class="setup-field-label">{{$t('dashboard.screenshot')}}</div>
                            <div class="setup-inline setup-inline-fill">
                                <input id="screenshotIntervalSlider" type="range"
                                    v-model="serverstatus.screenshotinterval"
                                    :min="0" :max="60" step="2"
                                    class="form-range custom-slider setup-range"
                                    @input="updateScreenshotInterval"
                                    @mouseenter="setSetupStatus($t('dashboard.screenshotquestion'))"
                                    @mouseleave="clearSetupStatus">
                                <span class="setup-value text-black-50" v-if="serverstatus.screenshotinterval > 0">{{serverstatus.screenshotinterval}}s</span>
                                <span class="setup-value text-black-50" v-else>{{$t('dashboard.disabled')}}</span>
                            </div>
                        </div>
                        <div class="setup-divider"></div>
                        <div class="setup-row">
                            <div class="setup-field-label">{{$t('dashboard.autoget')}}</div>
                            <div class="setup-inline setup-inline-fill">
                                <input id="backupintervalSlider" type="range"
                                    v-model="serverstatus.backupintervalPause"
                                    :min="0" :max="20" step="1"
                                    class="form-range custom-slider setup-range"
                                    @input="updateBackupInterval"
                                    @mouseenter="setSetupStatus($t('dashboard.backupautoquestion'))"
                                    @mouseleave="clearSetupStatus">
                                <span class="setup-value text-black-50" v-if="serverstatus.backupintervalPause > 0">{{serverstatus.backupintervalPause}}min</span>
                                <span class="setup-value text-black-50" v-else>{{$t('dashboard.disabled')}}</span>
                            </div>
                        </div>
                    </div>

                    <div class="setup-card">
                        <div
                            class="setup-row"
                            :class="serverstatus.useExamSections ? 'setup-row-disabled' : ''"
                            @mouseenter="serverstatus.useExamSections ? setSetupStatus($t('dashboard.sectionSettingsRequiredHint')) : setSetupStatus($t('dashboard.groupinfo'))"
                            @mouseleave="clearSetupStatus">
                            <div class="form-check form-switch m-0">
                                <input
                                    id="activategroups"
                                    class="form-check-input"
                                    type="checkbox"
                                    v-model="serverstatus.examSections[1].groups"
                                    :disabled="serverstatus.useExamSections"
                                    @change="serverstatus.useExamSections ? null : (serverstatus.examSections[1].groups ? setupGroups(1) : setServerStatus())">
                                <label class="form-check-label" for="activategroups">{{$t('dashboard.groups')}}</label>
                            </div>
                        </div>
                        <div class="setup-divider"></div>
                        <div class="setup-row">
                            <div class="form-check form-switch m-0">
                                <input v-model="muteAudio" class="form-check-input" type="checkbox" id="muteaudio" @mouseenter="setSetupStatus($t('dashboard.muteaudiointro'))" @mouseleave="clearSetupStatus">
                                <label class="form-check-label" for="muteaudio">{{$t('dashboard.muteaudio')}}</label>
                            </div>
                        </div>
                        <div class="setup-divider"></div>
                        <div class="setup-row">
                            <div class="form-check form-switch m-0">
                                <input v-model="serverstatus.directPrintAllowed" @change="checkforDefaultprinter(); setServerStatus()" class="form-check-input" type="checkbox" id="directprint" @mouseenter="setSetupStatus($t('dashboard.allowdirectprint'))" @mouseleave="clearSetupStatus">
                                <label class="form-check-label" for="directprint">{{$t('dashboard.directprint')}}</label>
                            </div>
                            <div class="setup-switch-details ellipsis text-black-50 setup-hint" v-if="defaultPrinter">{{ defaultPrinter }}</div>
                            <div class="setup-switch-details ellipsis text-black-50 setup-hint" v-if="!defaultPrinter">{{$t('dashboard.noprinterChosen')}}</div>
                        </div>
                    </div>
                </div>

                <div v-if="config.bipIntegration && bipToken" class="setup-card mt-2">
                    <div class="setup-row">
                        <div class="form-check form-switch m-0">
                            <input v-model="serverstatus.requireBiP" class="form-check-input" type="checkbox" id="activatebip" @mouseenter="setSetupStatus($t('control.biprequired'))" @mouseleave="clearSetupStatus">
                            <label class="form-check-label" for="activatebip">{{$t('dashboard.bildungsportalLoginEnforce')}}</label>
                        </div>
                    </div>
                </div>

                <div class="setup-divider"></div>
                <div class="setup-field-label">{{ $t('dashboard.defaultprinter') }}</div>
            <div v-if="(availablePrinters.length < 1)">
                <button class="btn btn-secondary mt-1 mb-0"><img src="/src/assets/img/svg/print.svg" class="" width="22" height="22" >  no printer found </button>
            </div>
            <div v-for="printer in availablePrinters" :key="printer.printerName" style="position: relative;">
                <button @click="selectPrinter(printer)" :class="{'btn-cyan': defaultPrinter === printer.printerName}" class="printerbutton btn btn-secondary mt-1 mb-0" @mouseenter="visiblePrinter = printer" @mouseleave="visiblePrinter = null"><img src="/src/assets/img/svg/print.svg" alt="print" width="22" height="22" /> {{ printer.printerName }} </button>
                <!-- Icon for the default printer -->
                <img v-if="printer.printerName === defaultPrinter" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" />
            </div>

            </div>

            <div class="setup-status-fixed">
                {{ setupStatusText || visiblePrinter?.printerName || '' }}
            </div>

            <div class="setup-footer">
                <button v-if="currentpreviewPath && defaultPrinter" id="printButton" class="btn btn-dark" @click="printBase64();hideSetup()">
                    <img src="/src/assets/img/svg/print.svg" width="22" height="22"> Print: {{ currentpreviewname }}
                </button>
                <div class="setup-footer-right">
                    <div class="setup-footer-actions">
                        <button id="okButton" class="btn btn-cyan" @click="hideSetup(); this.currentpreviewPath=null;">{{$t('general.ok')}}</button>
                        <button id="cancelButton" class="btn btn-teal text-white" @click="hideSetup(false); this.currentpreviewPath=null;">{{$t('dashboard.cancel')}}</button>
                    </div>
                </div>
            </div>
        </div>
       
    </div>
    <!-- SETUP DIALOG END -->

   
    <div :key="7" id="content" class="fadeinslow p-3">
       

        <!-- CONTROL BUTTONS START -->
       <div class="control-buttons-container">
        <div v-if="(serverstatus.exammode && reachableConnections == 1)" class="btn btn-danger control-button m-1 mt-0 text-start ms-0" @click="endExam();hideDescription();" @mouseover="showDescription($t('dashboard.exitkiosk'))" @mouseout="hideDescription">
            <img src="/src/assets/img/svg/shield-lock.svg" class="white control-button-icon" width="28" height="28"> 
            <div class="control-button-label"> {{reachableConnections}} {{$t('dashboard.stopexamsingle')}} </div>
        </div>
        <div v-if="(serverstatus.exammode && reachableConnections != 1)" class="btn btn-danger control-button m-1 mt-0 text-start ms-0" @click="endExam();hideDescription();" @mouseover="showDescription($t('dashboard.exitkiosk'))" @mouseout="hideDescription">
            <img src="/src/assets/img/svg/shield-lock.svg" class="white control-button-icon" width="28" height="28"> 
            <div class="control-button-label"> {{reachableConnections}} {{$t('dashboard.stopexam')}} </div>
        </div>

        <div v-if="(!serverstatus.exammode && reachableConnections == 1)" class="btn btn-teal control-button m-1 mt-0 text-start ms-0" @click="startExam();hideDescription();" @mouseover="showDescription($t('dashboard.startexamdesc'))" @mouseout="hideDescription" :class="!hasMandatoryBasematerialReady ? 'disabledgreen':''">
            <img src="/src/assets/img/svg/shield-lock.svg" class="white control-button-icon" width="28" height="28"> 
            <div class="control-button-label">{{reachableConnections}} {{$t('dashboard.startexamsingle')}}</div>
        </div>

        <div v-if="(!serverstatus.exammode && reachableConnections != 1)" class="btn btn-teal control-button m-1 mt-0 text-start ms-0" @click="startExam();hideDescription();" @mouseover="showDescription($t('dashboard.startexamdesc'))" @mouseout="hideDescription" :class="!hasMandatoryBasematerialReady ? 'disabledgreen':''">
            <img src="/src/assets/img/svg/shield-lock.svg" class="white control-button-icon" width="28" height="28"> 
            <div class="control-button-label">{{reachableConnections}} {{$t('dashboard.startexam')}}</div>
        </div>

        <div class="btn btn-cyan control-button m-1 mt-0 text-start ms-0" @click="fetchSubmissions(); loadFilelist(workdirectory); showExplorer = true; hideDescription();" @mouseover="showDescription($t('dashboard.showworkfolder'))" @mouseout="hideDescription">
            <img src="/src/assets/img/svg/folder-open.svg" class="control-button-icon me-1" width="32" height="32">
            <div class="control-button-label">{{$t('dashboard.workfolder')}}</div>
        </div>
        <div @mouseover="showDescription($t('examlog.buttondesc'))" @mouseout="hideDescription" class="btn btn-gray-dark control-button m-1 mt-0 ms-0 text-start" @click="showExamLog = true">
            <img src="/src/assets/img/icons/log.png" class="white control-button-icon me-1" width="32" height="32">
            <div class="control-button-label">{{ $t('examlog.button') }}</div>
        </div>
        <div @mouseover="showDescription($t('submissionsview.buttondesc'))" @mouseout="hideDescription" class="btn btn-gray-dark control-button m-1 mt-0 ms-0 text-start" @click="showSubmissionsView = true">
            <img src="/src/assets/img/svg/dialog-ok-apply.svg" class="control-button-icon me-1" width="32" height="32" style="filter: invert(55%) sepia(40%) saturate(300%) hue-rotate(140deg) brightness(1.1)">
            <div class="control-button-label">{{ $t('submissionsview.buttoncontrol') }}</div>
        </div>
        <div v-if="bipToken && serverstatus.bip" @mouseover="showDescription($t('dashboard.bipinfo'))" @mouseout="hideDescription" class="btn control-button control-button-bip-access m-1 mt-0 ms-0 text-start" :class="bipStatus === 'closed' ? 'btn-warning' : 'btn-teal'" @click="toggleBipStatus">
            <img src="/src/assets/img/svg/globe.svg" class="control-button-icon me-1" width="32" height="32">
            <div class="control-button-label">{{ bipJoinStatusLabel() }}</div>
        </div>
        </div>

 

        <div class="tab-buttons-container">
            <div class="btn btn-dark tab-button" 
                @click="sendFiles('all');hideDescription();" 
                @mouseover="showDescription($t('dashboard.sendfile'))" 
                @mouseout="hideDescription">
                <img src="/src/assets/img/svg/document-send.svg" width="24" height="24">
            </div>

            <div class="btn btn-dark tab-button"
                @click="getFiles('all', true, false, true); hideDescription();"
                @mouseover="showDescription($t('dashboard.getfile'))"
                @mouseout="hideDescription">
                <img src="/src/assets/img/svg/edit-download.svg" width="24" height="24">
            </div>

            <div v-if="serverstatus.screenslocked" 
                class="btn btn-danger tab-button" 
                @mouseover="showDescription($t('dashboard.unlock'))"
                @mouseout="hideDescription"
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
            <div id="logcheck" @click="fetchLOG();" @mouseover="showDescription($t('dashboard.serverlogdesc'))" @mouseout="hideDescription"> <div id="eye" class="darkgreen eyeopen"></div> &nbsp;Server Log</div>
            
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

            <div id="logrefresh" class="form-check form-switch" style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 60px; margin:auto auto">
                <input type="checkbox" id="logrefreshcheckbox" v-model="serverlogReload" class="form-check-input" title="Refresh Log" style="width: 50px; height: 15px;"> 
             </div>
        </div>
        <!-- LOG END -->







        <!-- studentlist start -->
        <div id="studentslist">        
            <div class="studentslist-zoom" :style="studentsZoomStyle">
                <draggable v-model="studentwidgets" :move="handleMoveItem" @end="handleDragEndItem" ghost-class="ghost">
                    <div v-for="student in studentwidgets" :key="student.token" style="cursor:auto" v-bind:class="[(!student.focus)?'focuswarn':'', (!student.clientname)?'studentwidget-empty':'']" class="studentwidget btn rounded-3 btn-block">
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
         
                                <div v-cloak :id="student.token" style="position: relative;background-size: cover; height: 128px;" v-bind:style="(student.imageurl && isStudentReachable(student, now))? `background-image: url('${student.imageurl}')`:'background-image: url(user-red.svg)'"></div>
                                <div v-if="student.virtualized && isStudentReachable(student, now)" class="virtualizedinfo" @mouseover="showDescription($t('dashboard.virtualizedinfo'), { vmFindings: student.vmFindings, webglFindings: student.webglFindings })" @mouseout="hideDescription">{{$t("dashboard.virtualized")}}</div>
                                <div v-if="!student.focus && isStudentReachable(student, now)" class="kioskwarning" @mouseover="showDescription($t('dashboard.leftkioskinfo'))" @mouseout="hideDescription">{{$t("dashboard.leftkiosk")}}</div>
                                <div v-if="student.status.sendexam && isStudentReachable(student, now)" class="examrequest" @mouseover="showDescription($t('dashboard.examrequestinfo'))" @mouseout="hideDescription">{{$t("dashboard.examrequest")}}</div>
                                <div v-if="student.remoteassistant?.languagetoolFake && isStudentReachable(student, now)" class="languagetoolfake" @mouseover="showDescription(languageToolFakeDescription(student))" @mouseout="hideDescription">{{$t("dashboard.languagetoolfake")}}</div>
                                <div v-if="student.remoteassistant && !student.remoteassistant.languagetoolFake && isStudentReachable(student, now)" class="remoteassistant" @mouseover="showDescription($t('dashboard.remoteassistantinfo'), student.remoteassistant)" @mouseout="hideDescription">{{$t("dashboard.remoteassistant")}}</div>
                                <span >   
                                    <div v-if="isStudentReachable(student, now)" style="display: inline-block; overflow: hidden; width: 140px; height: 22px" @mouseover="showDescription($t('dashboard.documentsinfo') + student.files)" @mouseout="hideDescription"> 
                                        <img v-for="file in student.files" style="width:22px; margin-left:-4px; position: relative; filter: sepia(10%) hue-rotate(306deg) brightness(0.3) saturate(75);" class="" src="/src/assets/img/svg/document.svg">
                                    </div>
                                    <div v-if="isStudentReachable(student, now)" style="display: inline-block; margin: 0px; position: absolute; right: 4px;" >
                                        <img src="/src/assets/img/svg/edit-delete.svg" width="22" height="22" class="delfolderstudent" @click="delfolderquestion(student.token)"  @mouseover="showDescription($t('dashboard.delsingle'))" @mouseout="hideDescription" >
                                    </div>
                                    <br>
                                    <img v-if="(student.isRunningInCage || student.isAssessmentMode) && isStudentReachable(student, now)"
                                        src="/src/assets/img/svg/shield-lock-fill.svg"
                                        width="14"
                                        height="14"
                                        class="white me-1"
                                        style="vertical-align: text-bottom; display: inline-block;"
                                        alt=""
                                        @mouseover="showDescription($t(student.isAssessmentMode ? 'dashboard.assessmentModeInfo' : 'dashboard.cageKioskInfo'))"
                                        @mouseout="hideDescription">
                                    {{ truncatedClientName(student.clientname) }}  
                                    <button  @click='kick(student.token,student.clientip)'  @mouseover="showDescription($t('dashboard.kick'))" @mouseout="hideDescription" type="button" class=" btn-close  btn-close-white pt-1 pe-2 float-end"></button> 
                                </span>
                            </div>

                            <!-- bottom buttons START-->
                            <div class="btn-group pt-0" role="group" style="">
                                <button v-if="isStudentReachable(student, now)" @click="showStudentview(student)" @mouseover="showDescription(getStudentInfoText(student), false, true)" @mouseout="hideDescription" type="button" :class="['btn btn-sm', isVersionMismatch(student) ? 'btn-warning' : 'btn-cyan']" style="border-top:0px; border-top-left-radius:0px; border-top-right-radius:0px; ">
                                    <img :src="isVersionMismatch(student) ? '/src/assets/img/svg/exclamation-triangle-fill.svg' : '/src/assets/img/svg/eye-fill.svg'" :class="isVersionMismatch(student) ? 'text-dark' : 'white'" width="18" height="18" >
                                </button>
                                <button v-if="!isStudentReachable(student, now)" type="button" class="btn btn-outline-danger btn-sm " style="border-top:0px; border-top-left-radius:0px; border-top-right-radius:0px; ">{{$t('dashboard.offline')}} </button>
                                <button v-if="isStudentReachable(student, now) && student.exammode && student.focus" @mouseover="showDescription($t('dashboard.secureinfo'))" @mouseout="hideDescription"  @click='' type="button" 
                                    class="btn btn-danger btn-sm" style=" cursor:default; border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px; border-bottom-right-radius: 5px;" >
                                    <img src="/src/assets/img/svg/shield-lock.svg" class="white" width="18" height="18" >
                                </button>
                                <button v-if="isStudentReachable(student, now) && !student.focus" @mouseover="showDescription($t('dashboard.resumeinfo'))" @mouseout="hideDescription"   @click='restore(student.token)' type="button" class="btn btn-warning btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px; border-bottom-right-radius: 5px;"> {{$t('dashboard.restore')}} </button>
                                
                                <!-- group buttons START -->
                                <button v-if="isStudentReachable(student, now) && serverstatus.examSections[serverstatus.activeSection].groups && student.status.group == 'a' " @mouseover="showDescription($t('dashboard.groupSwitch'))" @mouseout="hideDescription" @click='quickSetGroup(student)' type="button" class="btn-click-feedback2 btn btn-info btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> A  </button>
                                <button v-if="isStudentReachable(student, now) && serverstatus.examSections[serverstatus.activeSection].groups && student.status.group == 'b' " @mouseover="showDescription($t('dashboard.groupSwitch'))" @mouseout="hideDescription" @click='quickSetGroup(student)' type="button" class="btn-click-feedback1 btn btn-warning btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> B  </button>
                                <!-- group buttons END -->
                            </div>
                           

                            <button v-if="submissions.find(s => s.studentName === student.clientname)?.sections[serverstatus.activeSection]?.path"  
                                @click='getSpecificSubmissionBase64(submissions.find(s => s.studentName === student.clientname).sections[serverstatus.activeSection].path)' 
                                @mouseover="showDescription($t('dashboard.showsubmission'))" 
                                @mouseout="hideDescription" 
                                type="button" 
                                class="btn btn-teal btn-sm " 
                                style="float:right; border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px; border-bottom-right-radius:5px; border-bottom-left-radius:5px;"> 
                                <img src="/src/assets/img/icon-checkmark.png" class="white-100" width="18" height="18" > 
                            </button>
                            <!-- bottom buttons END -->
                        </div>
                    </div> 
                </draggable>
            </div>
        </div>
        <!-- studentlist end -->



    </div>
 









    <!-- sort + zoom student widgets controls -->
    <div class="studentslist-controls">
        <button type="button" class="btn btn-sm btn-gray studentslist-controls-btn" @click="studentsZoomOut" title="Zoom out">−</button>
        <button type="button" class="btn btn-sm btn-gray studentslist-controls-btn studentslist-controls-label" @click="studentsZoomReset" title="Zoom reset">{{ Math.round(studentsZoom * 100) }}%</button>
        <button type="button" class="btn btn-sm btn-gray studentslist-controls-btn" @click="studentsZoomIn" title="Zoom in">+</button>
        <button type="button" class="btn btn-sm btn-gray studentslist-controls-btn" @click="sortStudentWidgets()" title="Sort" @mouseover="showDescription($t('dashboard.sortstudentwidgets'))" @mouseout="hideDescription">
            <img src="/src/assets/img/svg/view-sort-ascending-name.svg" class="" width="20" height="20" >
        </button>
    </div>
    <!-- sort + zoom student widgets controls end -->

    <!-- Exam Log Modal -->
    <ExamLog
        :visible="showExamLog"
        :examName="servername"
        :examStart="examLogStart"
        :examEnd="examLogEnd"
        :events="examLogEvents"
        @close="showExamLog = false"
    />

    <!-- Submissions View Modal -->
    <SubmissionsView
        :visible="showSubmissionsView"
        :submissions="submissions"
        :submissionsNumber="submissionsNumber"
        :lockPdfSummary="lockPdfSummary"
        @close="showSubmissionsView = false"
        @get-latest="getLatest()"
        @open-pdf="({ path, name }) => showPDFPreview({ filepath: path, filename: name })"
    />

        <div v-if="showDesc" id="description" class="bg-dark text-white" v-html="currentDescription"></div>
        <div id="statusdiv" class="bg-dark text-white">{{ $t('dashboard.connected') }}</div>
    
</div>

    <!-- pdf preview start -->
    <div :key="4" id="pdfpreview" class="fadeinfast p-4">
        <WebviewPane
            id="webview"
            :src="urlForWebview"
            :visible="webviewVisible"
            :allowed-url="urlForWebview"
            :block-external="true"
            :paper-background="currentpreviewType === 'html'"
            @close="hidepreview"
        />
        <div v-if="currentpreview" class="pdfpreview-centered">
            <PdfviewPaneRendered
                :src=currentpreview
                :currentpreviewPath=currentpreviewPath
                :currentpreviewBase64=currentpreviewBase64
                :currentpreviewType="currentpreviewType"
                :activesheets-correction="activesheetsCorrection"
                @close="hidepreview"
                @printBase64="printBase64"
                @downloadFile="downloadFile"
                @openFileExternal="openFileExternal"
                @save-correction="saveActivesheetsCorrectedPdf"
            />
        </div>
        <PdfRenderer
            v-if="activesheetsPreviewPdf"
            :pdfBase64="activesheetsPreviewPdf"
            :sourcePdfFilename="activesheetsPreviewFilename"
            :loading="false"
            :customFields="activesheetsPreviewCustomFields"
            :blacklist="activesheetsPreviewBlacklist"
            :initial-form-data="activesheetsPreviewInitialFormData"
            @close="discardActivesheetsPdf"
            @save-custom-fields="saveCustomFields"
            @save-correction-template="saveActivesheetsCorrectionTemplate"
        />
    </div>
    <!-- pdf preview end -->
</template>









<script lang="ts">
import { VueDraggableNext } from 'vue-draggable-next'
import { v4 as uuidv4 } from 'uuid'
import {SchedulerService} from '../utils/schedulerservice.js'
import MaterialsList from '../components/materialsList.vue'
import WebviewPane from '../components/WebviewPane.vue'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import PdfRenderer from '../components/PdfRenderer.vue'
import ExamLog from '../components/ExamLog.vue'
import SubmissionsView from '../components/SubmissionsView.vue'
import DashboardExplorer from '../components/DashboardExplorer.vue'
import StudentEditorTimelineDiffViewer from '../components/StudentEditorTimelineDiffViewer.vue'
import StudentView from '../components/StudentView.vue'
import examEventBus from '../utils/examEventBus.js'
import { isStudentReachable, countReachableStudents } from '../utils/studentPresence.js'

import { uploadselect, onedriveUpload, onedriveUploadSingle, uploadAndShareFile, createSharingLink, fileExistsInAppFolder, downloadFilesFromOneDrive} from '../msalutils/onedrive'
import { handleDragEndItem, handleMoveItem, sortStudentWidgets, initializeStudentwidgets} from '../utils/dragndrop'
import { loadFilelist, getLatest, processPrintrequest,  loadImage, showPDFPreview, loadTextFile, loadHtmlFile, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete,  openLatestFolder, printBase64, showBase64ImagePreview, showBase64PdfInRenderer, saveActivesheetsCorrectionTemplate, saveActivesheetsCorrectedPdf } from '../utils/filemanager'
import { swalQueued } from '../utils/swalQueue.js'
import { activateSpellcheckForStudent, delfolderquestion, stopserver, sendFiles, lockscreens, getFiles, startExam, lockSectionForAll, endExam, kick, restore } from '../utils/exammanagement.js'
import { configureWebsite, configureEduvidual, configureForms, configureMicrosoft365Template, configureEditorTemplate, removeEditorTemplate, removeMicrosoft365Template, removeWebsiteUrl, removeEduvidualUrl, removeRdp, removeFormsUrl, setEditorExamConfigPatch, configureCustomLanguageToolHost, removeCustomLanguageToolHost, configureActivesheets, configureRDP, configureLocalVM, defineMaterials, handleAllowedUrlRemove, openAllowedUrl, addFileAsExamMaterial } from '../utils/examsetup.js'
import { Exam } from '../types/api'
import { generateEncryptionPassword } from '../utils/encryptionPassword.js'
import { openStudentEditorTimelineDiff } from '../utils/studentEditorTimeline.js'
import { examApiFetch } from 'next-exam-shared/examApiFetch.js'
import { DEFAULT_EDITOR_EXAM_CONFIG } from 'next-exam-shared/editorExamConfig.js'

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
        PdfviewPaneRendered: PdfviewPaneRendered,
        PdfRenderer: PdfRenderer,
        ExamLog: ExamLog,
        SubmissionsView: SubmissionsView,
        DashboardExplorer: DashboardExplorer,
        StudentEditorTimelineDiffViewer: StudentEditorTimelineDiffViewer,
        StudentView: StudentView
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
            showStudentView: false,
            screenshotSidebarHint: '',
            screenshotSidebarHintTimer: null,
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
            editorAdvancedOpen: false,
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
            activesheetsPreviewInitialFormData: null,
            activesheetsPreviewGroup: null,
            activesheetsPreviewFileIndex: -1,
            activesheetsCorrection: null,
            
            serverlog: [],
            serverlogActive: false,
            serverlogReload: true,

            showExamLog: false,
            studentsZoom: 1,
            showSubmissionsView: false,
            showExplorer: false,
            showEditorTimelineViewer: false,
            editorTimelineViewerDoc: null,

            timelimitWarnedByStartTs: {},
            setupStatusText: '',

            ipcSubmissionHandler: null,

            bipToken:this.$route.params.bipToken === 'false' ?  false : this.$route.params.bipToken,   // parameters are always passed as string "false", convert to bool
            bipuserID: this.$route.params.bipuserID === 'false' ?  false : this.$route.params.bipuserID,
            bipUsername:this.$route.params.bipUsername === 'false' ?  false : this.$route.params.bipUsername,
            bipStatus: "closed", // "open" or "closed" or "offline"
            bipPhase: "ready",
            biptest:this.$route.params.biptest,

            serverstatus:{   // this object contains all neccessary information for students about the current exam settings
                bip: false,
                bipStatus: "closed",
                id: this.$route.params.id,
                nextexamVersion: this.$route.params.version,
                examName: this.$route.params.servername,
                examPassword: this.$route.params.passwd,
                encryptionPassword: generateEncryptionPassword(),
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
                        timelimit: 600,
                        locked: false,
                        sectionname: "Abschnitt 1",
                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    },
                    2: {
                        examtype: 'math',
                        timelimit: 600,
                        locked: false,
                        sectionname: "Abschnitt 2",
                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    },
                    3: {
                        examtype: 'math',
                        timelimit: 600,
                        locked: false,
                        sectionname: "Abschnitt 3",
                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    },
                    4: {
                        examtype: 'math',
                        timelimit: 600,
                        locked: false,
                        sectionname: "Abschnitt 4",
                        groups: false,
                        groupA: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } },
                        groupB: { users: [], examInstructionFiles: [], allowedUrls: [], examConfig: { activeSheets:{}, editor: { ...DEFAULT_EDITOR_EXAM_CONFIG }, eduvidual:{}, forms:{}, website:{}, math:{}, microsoft365:{}, rdp:{}, localvm:{} } }
                    }
                },                
            } as Exam
        };
    },

computed: {
    examLogEvents()    { return examEventBus.events.length ? examEventBus.events.slice() : [] },
    examLogStart()     { return examEventBus.examStart },
    examLogEnd()       { return examEventBus.examEnd },

    studentsZoomStyle() {
        const z = Number(this.studentsZoom) || 1
        return {
            transform: `scale(${z})`,
            width: z < 1 ? '100%' : `calc(100% / ${z})`,
        }
    },

    reachableConnections() {
        return countReachableStudents(this.studentlist, this.now);
    },

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
            const hasA = !!section.groupA?.examConfig?.forms?.url;
            const hasB = !!section.groupB?.examConfig?.forms?.url;
            return section.groups ? (hasA && hasB) : hasA;
        }
        if (examType === 'localvm') {
            const isOk = (cfg) => {
                if (!cfg || !cfg.qcow2Name) return false;
                const wantsHash = cfg.calculateSha256 === true;
                return wantsHash ? !!cfg.qcow2Sha256 : !!cfg.qcow2SizeBytes;
            };
            if (!section.groups) {
                const c = section.groupA?.examConfig?.localvm || {};
                return isOk(c);
            }
            const cfgA = section.groupA?.examConfig?.localvm || {};
            const cfgB = section.groupB?.examConfig?.localvm || {};
            return isOk(cfgA) && isOk(cfgB);
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

    lockPdfSummary() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return examType === 'eduvidual' || examType === 'website' || examType === 'math' || examType === 'microsoft365';
    },
    
    lockSendFile() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return countReachableStudents(this.studentlist) === 0 || examType === 'eduvidual' || examType === 'microsoft365';
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
        isStudentReachable: isStudentReachable,
        setSetupStatus(text) {
            this.setupStatusText = String(text || '')
        },
        clearSetupStatus() {
            this.setupStatusText = ''
        },
        isSectionTabActive(sectionIndex) {
            return this.serverstatus?.activeSection === sectionIndex;
        },

        async editSectionName(sectionIndex) {
            const section = this.serverstatus?.examSections?.[sectionIndex];
            if (!section) return;

            const result = await this.$swal.fire({
                title: this.$t('dashboard.sectionSettings'),
                html: `
                    <div class="mt-3 text-start">
                        <label class="form-label mb-1" for="nx-section-name">${this.$t('dashboard.sectionname')}</label>
                        <input id="nx-section-name" class="form-control" type="text" value="${String(section.sectionname || '').replaceAll('"', '&quot;')}">
                    </div>
                    <div class="form-check form-switch mt-3 text-start">
                        <input id="nx-section-groups" class="form-check-input" type="checkbox" ${section.groups ? 'checked' : ''}>
                        <label class="form-check-label" for="nx-section-groups">${this.$t('dashboard.groups')}</label>
                    </div>
                    <div class="mt-3 text-start">
                        <label class="form-label mb-1" for="nx-section-timelimit">${this.$t('dashboard.timelimit')}</label>
                        <input id="nx-section-timelimit" class="form-control" type="number" min="1" step="1" value="${Number(section.timelimit ?? 60)}" ${this.serverstatus?.allowSectionSwitch ? 'disabled' : ''}>
                    </div>
                `,
                showCancelButton: true,
                cancelButtonText: this.$t('dashboard.cancel'),
                confirmButtonText: this.$t('general.ok'),
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    actions: 'my-swal2-actions'
                },
                didOpen: () => {
                    const nameEl = document.getElementById('nx-section-name');
                    if (nameEl && typeof nameEl.focus === 'function') nameEl.focus();
                },
                preConfirm: () => {
                    const nameEl = document.getElementById('nx-section-name');
                    const nextName = String(nameEl?.value || '').trim();
                    if (!nextName) return false;
                    const groupsEl = document.getElementById('nx-section-groups');
                    const nextGroups = !!groupsEl?.checked;
                    const tlEl = document.getElementById('nx-section-timelimit');
                    const nextTimelimit = this.serverstatus?.allowSectionSwitch
                        ? Number(section.timelimit ?? 60)
                        : Number.parseInt(String(tlEl?.value ?? ''), 10);
                    if (!Number.isFinite(nextTimelimit) || nextTimelimit < 1) return false;
                    return { nextName, nextGroups, nextTimelimit };
                },
            });

            if (!result.isConfirmed) return;
            const { nextName, nextGroups, nextTimelimit } = result.value || {};
            if (!nextName) return;

            const groupsChanged = !!section.groups !== !!nextGroups;
            section.sectionname = nextName;
            section.groups = !!nextGroups;
            section.timelimit = Number(nextTimelimit);
            if (groupsChanged && section.groups) {
                await this.setupGroups(sectionIndex);
            }
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

        configureEditorTemplate: configureEditorTemplate,
        removeEditorTemplate: removeEditorTemplate,
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

        studentsZoomClamp(value) {
            return Math.min(1.5, Math.max(0.5, Number(value) || 1))
        },
        studentsZoomIn() {
            this.studentsZoom = this.studentsZoomClamp(this.studentsZoom + 0.1)
        },
        studentsZoomOut() {
            this.studentsZoom = this.studentsZoomClamp(this.studentsZoom - 0.1)
        },
        studentsZoomReset() {
            this.studentsZoom = 1
        },

        // Opens picked PDF in preview; decrypts NXE1 using serverstatus.encryptionPassword.
        async openEncryptedPdfPreview() {
            const pw = String(this.serverstatus?.encryptionPassword ?? '').trim()
            const res = await ipcRenderer.invoke('pickEncryptedPdfForPreview', pw)
            if (res?.cancelled) return
            if (!res?.ok) {
                const map = {
                    NEEDS_PASSWORD: 'dashboard.openEncryptedPdfNeedEncryptionKey',
                    BAD_PASSWORD: 'dashboard.openEncryptedPdfBadPassword',
                    STILL_ENCRYPTED: 'dashboard.openEncryptedPdfBadPassword',
                    NOT_PDF: 'dashboard.openEncryptedPdfNotPdf',
                    ERROR: 'dashboard.openEncryptedPdfError',
                }
                const key = map[res.code] || 'dashboard.openEncryptedPdfError'
                await swalQueued({
                    icon: 'error',
                    title: this.$t(key),
                    text: res.message || '',
                })
                return
            }
            this.showPDFPreview({ filepath: res.filePath, filename: res.filename, base64: res.base64 })
        },

        /**
         * Dashboard Explorer (Filemanager)
         */
        loadFilelist:loadFilelist,                  // load all files in a specific folder
        print:print,                                // check for default printer and trigger print operation
        printBase64: printBase64,                   // print the base64pdf via webcontens print
        getLatest:getLatest,                        // get latest files from all students and concatenate all pdf files
        processPrintrequest:processPrintrequest,  // handles a print request and first fetches the latest version from a specific student
        loadImage:loadImage,                        // displays an image in the preview panel
        showPDFPreview: showPDFPreview,             // displays a pdf in the preview panel ({filepath, filename, base64})
        loadTextFile:loadTextFile,                  // shows plain text / .log in a modal (DashboardExplorer)
        loadHtmlFile: loadHtmlFile,                 // renders .htm/.html in webview pane (DashboardExplorer)
        dashboardExplorerSendFile:dashboardExplorerSendFile,        // sends a given file to the selected student
        downloadFile:downloadFile,                                  // store the selected file to a local folder
        showWorkfolder:showWorkfolder,                              // makes the dashboard explorer visible
        fdelete:fdelete,                                            // deletes a file
        openLatestFolder:openLatestFolder,                          // opens the newest folder that belongs to the current visible student
        openStudentEditorTimelineDiff: openStudentEditorTimelineDiff, // scans .htm backups, writes *_editor_timeline.json, opens diff viewer
        showBase64ImagePreview:showBase64ImagePreview,              // displays a base64 encoded image in the preview panel
        showBase64PdfInRenderer:showBase64PdfInRenderer,            // displays a base64 encoded pdf in PdfRenderer component
        saveActivesheetsCorrectionTemplate: saveActivesheetsCorrectionTemplate,
        saveActivesheetsCorrectedPdf: saveActivesheetsCorrectedPdf,

        /**
         * Exam Managment functions
         */
        startExam:startExam,                         // enable exam mode 
        lockSectionForAll: lockSectionForAll,
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

            this.hostip = await ipcRenderer.invoke('checkhostip')
            if (!this.hostip?.hostip) return;

            if (this.bipToken && this.serverstatus.bip) {
                this.updateBiPServerInfo(this.bipStatus);
            }
            
            if (this.serverlogActive && this.serverlogReload){
                this.serverlog = await ipcRenderer.invoke('getlog')
                this.scheduleScrollServerLogToBottom()
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
                        //printrequest should also be set to false on the client immediately after sending, but the client could disconnect right here
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
                                const isReachable = isStudentReachable(student, this.now);
                                if (!isReachable){
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
                                    examEventBus.push('focuslost', student)
                                }

                                // log once when student enters secure exam mode
                                if (student.exammode && !this.studentwidgets[i].exammode) {
                                    examEventBus.push('secured', student)
                                }
                                // log once when student leaves secure exam mode
                                if (!student.exammode && this.studentwidgets[i].exammode) {
                                    examEventBus.push('unsecured', student)
                                }
                                // log once when virtualization is first detected
                                if (student.virtualized && !this.studentwidgets[i].virtualized) {
                                    examEventBus.push('virtualized', student)
                                }
                                // log once when remote assistant is first detected
                                if (student.remoteassistant && !this.studentwidgets[i].remoteassistant) {
                                    examEventBus.push('remoteassistant', student)
                                }

                                // Overwrite the studentwidget, but correct the group assignment based on the current section
                                this.studentwidgets[i] = student;

                                // Correct the group assignment based on the current section
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
                        student.online = isStudentReachable(student, this.now)
                        examEventBus.push('login', student)
                        this.getLatestBakFile(student.clientname).then(bakResult => {
                            if (bakResult.status === "success") {
                                const fileName = bakResult.filepath.split(/[/\\]/).pop()
                                const filePath = bakResult.filepath
                                swalQueued({
                                    customClass: {
                                        popup: 'my-popup',
                                        title: 'my-title',
                                        content: 'my-content',
                                        actions: 'my-swal2-actions',
                                        htmlContainer: 'my-html-container'
                                    },
                                    title: this.$t("dashboard.attention"),
                                    html: `<div class="my-content">
                                        <p><b>${student.clientname}</b> hat sich verbunden!</p>
                                        <p>Backup-Datei gefunden: <b>${fileName}</b></p>
                                    </div>`,
                                    icon: "info",
                                    showCancelButton: true,
                                    confirmButtonText: this.$t("dashboard.sendfileSingle"),
                                    cancelButtonText: this.$t("dashboard.cancel"),
                                    confirmButtonColor: '#0aa2c0',
                                })
                                .then(sendResult => {
                                    if (sendResult.isConfirmed) {
                                        ipcRenderer.invoke('setStudentStatus', {
                                            servername: this.servername,
                                            studenttoken: student.token,
                                            fetchfiles: true,
                                            files: [{ name: fileName, path: filePath }],
                                        })
                                            .then((result) => { console.log('dashboard @ login bakCheck:', result.message) })
                                            .catch((err) => { console.error('dashboard @ login bakCheck:', err) })
                                    }
                                })
                            }
                        })
                        for (let i = 0; i < this.studentwidgets.length; i++){  // we cant use (for .. of) or forEach because it creates a workingcopy of the original object
                            if (!this.studentwidgets[i].clientname){ //clientname == false in an emptyWidget so we found one
                                this.studentwidgets[i] = student; // replace emptywidget
                                
                                // Correct the group assignment based on the current section
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

            this.checkSectionTimelimit()
           
        }, 

        getTrackedTimelimitSectionIndex() {
            if (!this.serverstatus?.exammode) return null
            if (!this.serverstatus.useExamSections || this.serverstatus.allowSectionSwitch) return 1
            return this.serverstatus.lockedSection || 1
        },

        checkSectionTimelimit() {
            if (!this.serverstatus?.exammode) {
                this.timelimitWarnedByStartTs = {}
                return
            }

            const sectionIndex = this.getTrackedTimelimitSectionIndex()
            if (!sectionIndex) return
            const section = this.serverstatus?.examSections?.[sectionIndex]
            if (!section) return

            const startTs = Number(section.startTs || 0)
            const minutes = Number(section.timelimit || 0)
            if (!startTs || !minutes || minutes < 1) return

            const warnedForStartTs = Number(this.timelimitWarnedByStartTs?.[sectionIndex] || 0)
            if (warnedForStartTs === startTs) return

            const deadlineTs = startTs + (minutes * 60 * 1000)
            const now = Date.now()
            if (now < deadlineTs) return

            this.timelimitWarnedByStartTs = { ...this.timelimitWarnedByStartTs, [sectionIndex]: startTs }
            this.$swal.fire({
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    actions: 'my-swal2-actions'
                },
                title: this.$t('dashboard.timelimitExpiredTitle'),
                html: `<div class="my-content">${this.$t('dashboard.timelimitExpiredText', { section: section.sectionname || String(sectionIndex), minutes: minutes })}</div>`,
                icon: 'warning',
                confirmButtonText: this.$t('general.ok')
            })
        },


        async getLatestBakFile(studentName) {
            const result = await ipcRenderer.invoke('getLatestBakFile', this.servername, studentName)
            return result
        },

        async getSpecificSubmissionBase64(filepath) {
            const result = await ipcRenderer.invoke('getSpecificSubmissionBase64', filepath)
            if (result.status === "success") {
                this.showPDFPreview({ filepath, filename: filepath.split(/[/\\]/).pop(), base64: result.submission })
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
                    await this.setServerStatus()
                    await this.setStudentStatus({getmaterials: true}, 'all')
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
            if (type === 'localvm') {/* configured via sidebar */}
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

            // Show the groups configured for this section (without notifying students)
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
                        await this.lockSectionForAll(section)
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
                this.autoscreenshot = false;
            } else {
                console.log("dashboard @ updateScreenshotInterval: setting screenshot interval to", interval);
                this.autoscreenshot = true; // enable screenshots
            }
            this.setServerStatus(); // save changes
        },
      
        async showDescription(description, info=false, isHtml=false) {
            if (info) {
                description += ' | ';
                // remoteassistant: keywords and ports
                if (info.keywords?.length > 0) {
                    
                    description += `Keywords: ${info.keywords.join(', ')}`;
                }
                if (info.ports?.length > 0) {
                    description += '|';
                    description += `Ports: ${info.ports.join(', ')}`;
                }
                // virtualized: vmFindings (backend) and webglFindings (frontend)
                const vm = info.vmFindings;
                const webgl = info.webglFindings;
                if (vm?.isVM && vm?.reasons?.length > 0) {
                    description += ' ||' + this.$t('dashboard.vmFindingsBackend') + '|';
                    description += vm.reasons.map(r => '• ' + r).join('|');
                    if (vm.vendor) description += '|' + this.$t('dashboard.vmFindingsVendor') + ': ' + vm.vendor;
                }
                if (webgl?.detected) {
                    description += ' ||' + this.$t('dashboard.vmFindingsWebgl');
                    if (webgl.vendor) description += '|• Vendor: ' + webgl.vendor;
                    if (webgl.renderer) description += '|• Renderer: ' + webgl.renderer;
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
            return `Name: ${name}<br>Version: ${v}${versionSuffix}<br>IP: ${ip}<br>Documents: ${docs}`;
        },
        //display student specific actions
        showStudentview(student) {
            this.clearScreenshotSidebarHint()
            this.activestudent = student
            this.showStudentView = true
        },
        hideStudentview() {
            this.clearScreenshotSidebarHint()
            this.showStudentView = false
            this.activestudent = null
        },
        clearScreenshotSidebarHint() {
            if (this.screenshotSidebarHintTimer) {
                clearTimeout(this.screenshotSidebarHintTimer)
                this.screenshotSidebarHintTimer = null
            }
            this.screenshotSidebarHint = ''
        },
        async downloadStudentScreenshot(student) {
            if (!student?.clientname || !student?.imageurl || !String(student.imageurl).startsWith('data:image/')) {
                await this.$swal.fire({ icon: 'warning', text: this.$t('dashboard.downloadScreenshotNoImage') })
                return
            }
            const res = await ipcRenderer.invoke('saveStudentScreenshot', {
                servername: this.servername,
                clientname: student.clientname,
                imageDataUrl: student.imageurl,
            })
            if (res?.ok) {
                this.clearScreenshotSidebarHint()
                this.screenshotSidebarHint = this.$t('dashboard.downloadScreenshotSidebarOk')
                this.screenshotSidebarHintTimer = setTimeout(() => {
                    this.screenshotSidebarHint = ''
                    this.screenshotSidebarHintTimer = null
                }, 2800)
            } else {
                await this.$swal.fire({ icon: 'error', text: this.$t('dashboard.downloadScreenshotFail') + (res?.error ? ` (${res.error})` : '') })
            }
        },
        // hide pdf preview
        closeFileBrowser() {
            this.showExplorer = false;
        },
        hidepreview() {
            document.querySelector("#pdfpreview").style.display = 'none';
            if (this.currentpreview) URL.revokeObjectURL(this.currentpreview);
            if (this.urlForWebview?.startsWith('blob:')) URL.revokeObjectURL(this.urlForWebview);
            this.currentpreview = null;
            this.currentpreviewBase64 = null;
            this.currentpreviewPath = null;
            this.currentpreviewname = null;
            this.activesheetsCorrection = null;
            this.urlForWebview = null;
            this.webviewVisible = false;
        },
        // discard activesheets PDF
        discardActivesheetsPdf() {
            this.activesheetsPreviewPdf = null;
            this.activesheetsPreviewFilename = null;
            this.activesheetsPreviewCustomFields = [];
            this.activesheetsPreviewBlacklist = [];
            this.activesheetsPreviewInitialFormData = null;
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
        async editPin() {
            const prev = String(this.serverstatus.pin ?? '').trim()
            const result = await this.$swal.fire({
                title: this.$t('dashboard.pin'),
                input: 'text',
                inputValue: prev,
                inputAttributes: { maxlength: 4, autocapitalize: 'off', autocorrect: 'off', inputmode: 'numeric' },
                showCancelButton: true,
                cancelButtonText: this.$t('dashboard.cancel'),
                confirmButtonText: this.$t('general.ok'),
                customClass: { popup: 'custom-swal2-popup-info' },
                inputValidator: (value) => {
                    const nextPin = String(value ?? '').trim()
                    if (!/^\d{4}$/.test(nextPin)) return this.$t('dashboard.pinInvalid')
                },
            })
            if (!result.isConfirmed) return
            const nextPin = result.value
            if (!nextPin || nextPin === prev) return
            this.serverstatus.pin = nextPin
            const response = await this.setServerStatus()
            if (response?.status !== 'success') {
                this.serverstatus.pin = prev
                return
            }
            await this.status(this.$t('dashboard.pinSaved'))
        },
        //show pincode 
        showinfo(){
            const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
            this.$swal.fire({ 
                title: `<div style="display:flex;justify-content:flex-start;align-items:flex-start;gap:0px;text-align:left">
                            <div style="flex:0 0 auto;text-align:left;font-weight:normal;font-size:1.1em;line-height:1.5">${this.$t("dashboard.name")}<br/>${this.$t("dashboard.server")}<br/>${this.$t("dashboard.pin")}</div>
                            <div style="flex:1 1 auto;text-align:left;font-size:1.1em;line-height:1.5; margin-left: 50px;" ><b>${esc(this.servername)}</b><br/>${esc(this.serverip)}<br/>${esc(this.serverstatus.pin)}</div>
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

        // Hover description for LT-fake badge (other remoteassistant hits below main text).
        languageToolFakeDescription(student) {
            let desc = this.$t('dashboard.languagetoolfakeinfo');
            const ra = student?.remoteassistant;
            if (!ra) return desc;
            if (ra.keywords?.length) {
                desc += ` | ${this.$t('dashboard.languagetoolfakeOtherServices')}: ${ra.keywords.join(', ')}`;
            }
            if (ra.ports?.length) {
                desc += ` | Ports: ${ra.ports.join(', ')}`;
            }
            return desc;
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
            if (typeof status.encryptionPassword !== 'string' || status.encryptionPassword.trim().length < 64) {
                status.encryptionPassword = generateEncryptionPassword();
            }

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
                    if (!group.examConfig.editor.editorTemplate || typeof group.examConfig.editor.editorTemplate !== 'object') group.examConfig.editor.editorTemplate = {};
                    if (group.examConfig.editorTemplate !== undefined) {
                        const leg = group.examConfig.editorTemplate;
                        if (leg && typeof leg === 'object' && leg.filename && !group.examConfig.editor.editorTemplate?.filename) {
                            group.examConfig.editor.editorTemplate = { ...leg };
                        }
                        delete group.examConfig.editorTemplate;
                    }
                }
            }
        },

        // we save serverstatus everytime we start an exam - therefore exams can be resumed easily by the teacher if something wicked happens
        async getPreviousServerStatus(){
            this.config = await ipcRenderer.invoke('getconfigasync')
            const response = await ipcRenderer.invoke('getServerStatusFromDisk', this.servername)
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
        async setServerStatus(){
            try {
                const serverstatus = JSON.parse(JSON.stringify(this.serverstatus))
                const response = await ipcRenderer.invoke('setServerStatus', {
                    servername: this.servername,
                    serverstatus,
                })
                if (response.status === 'error') {
                    console.error('dashboard @ setServerStatus:', response.message);
                    this.status(response.message || 'Serverstatus speichern fehlgeschlagen.');
                }
                return response
            } catch (err) {
                console.error('dashboard @ setServerStatus:', err);
                this.status('Server nicht erreichbar (Serverstatus).');
                throw err
            }
        },

        // setup groups
        // every user is automatically in group a (see control /registerclient) - this function resets group arrangement and pushes every user into group a
        async setupGroups(sectionIndex = this.serverstatus.activeSection){
            this.serverstatus.examSections[sectionIndex].groupA.users = []
            this.serverstatus.examSections[sectionIndex].groupB.users = []
            // prepopulate group A
            for (let student of this.studentlist) {
                if (sectionIndex === this.serverstatus.activeSection) {
                    student.status.group = "a"
                }
                if (!this.serverstatus.examSections[sectionIndex].groupA.users.includes(student.clientname)) {
                    this.serverstatus.examSections[sectionIndex].groupA.users.push(student.clientname)
                } 
            } 
            await this.sleep(1000)
            this.setServerStatus()
        },

        // Restore group assignments from the stored arrays
        // informStudents: if true, students are notified about their group assignment
        restoreGroupAssignments(informStudents = false) {
            // Check whether groups are activated for this section
            if (!this.serverstatus.examSections[this.serverstatus.activeSection].groups) {
                return;
            }

            const groupA = this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users;
            const groupB = this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users;

            if (!informStudents) {
                // Only update local display, do not notify students
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

            // Notify students about their group assignment
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

            // Check whether students should be notified:
            // - When no sections are activated (always notify)
            // - When the current section is the locked section (students are in this section)
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
        async setStudentStatus(bodyobject, studenttoken){
            try {
                const result = await ipcRenderer.invoke('setStudentStatus', {
                    ...bodyobject,
                    servername: this.servername,
                    studenttoken,
                })
                console.log('dashboard @ setStudentStatus:', result.message)
            } catch (err) {
                console.error(err)
            }
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



        // Localized label for BiP exam join permission (open = students may connect)
        bipJoinStatusLabel(status = this.bipStatus) {
            return status === 'open'
                ? this.$t('dashboard.bipAccessOpen')
                : this.$t('dashboard.bipAccessClosed');
        },

        showBipInfo(){
            let message = "Bildungsportal"
            let html = `
            <div style="font-size:0.9em; text-align:left">
                <div><b>Bip-Username: </b>${this.bipUsername}</div>
                <div><b>Bip-UserID: </b>${this.bipuserID}</div><br>
                <div><b>${this.$t('dashboard.bipAccessPopupLabel')}: </b></div>
                <button id="fbtnA" class="swal2-button btn ${this.bipStatus === 'closed' ? 'btn-warning' : 'btn-teal'} mt-2" style="min-width: 100px; height: 42px;">
                    ${this.bipJoinStatusLabel()}
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
                            btnA.textContent = this.bipJoinStatusLabel(newStatus);

                            //call api and update bip data
                            if (this.bipToken && this.serverstatus.bip) {
                                this.updateBiPServerInfo(newStatus);
                            }
                            this.bipStatus = newStatus;
                            this.serverstatus.bipStatus = newStatus;
                            this.setServerStatus();
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
            this.serverstatus.bipStatus = newStatus;
            this.setServerStatus();
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

        // Check whether the string is Base64-encoded
        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (err) {
                return false;
            }
        },
        
        // Decode base64 string and extract possible tokens
        decodeBase64AndExtractTokens(base64Str) {
            if (base64Str == null || !this.isBase64(base64Str)) {
                return null;
            }
            const decodedStr = atob(base64Str);
            const tokens = decodedStr.split(/[:\s,]+/); // adjust separator if needed
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
                console.error("Error during API call:", error.message);
                if (this.bipPhase === 'completed') {
                    this.$swal.fire({
                        title: this.$t("dashboard.attention"),
                        text: `Bildungsportal currently unreachable, please manually set the exam phase to Completed in the Bildungsportal at a later time!`,
                        icon: "warn"
                    })
                }
            });
        },

        playAudioFile(filecontent, filename){
            document.querySelector("#aplayer").style.display = 'block';
            this.audioSource = filecontent;
            this.audioFilename = filename
            audioPlayer.load(); // loads the new source

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

                this.scheduleScrollServerLogToBottom()
            }
        },

        scrollServerLogToBottom() {
            const el = document.getElementById('logscrollarea')
            if (el && typeof el.scrollTop === 'number') {
                el.scrollTop = el.scrollHeight
            }
        },

        scheduleScrollServerLogToBottom() {
            this.$nextTick(() => {
                this.scrollServerLogToBottom()
                requestAnimationFrame(() => this.scrollServerLogToBottom())
            })
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

            await examEventBus.init(ipcRenderer, this.servername)
            examEventBus.push('serverstart')

            this.fetchInfo()
            this.initializeStudentwidgets()

            if (this.bipToken && this.serverstatus.bip) {
                this.updateBiPServerInfo(this.bipStatus);
            }

            // do not use setInterval() for intervals as it keeps all objects of the callbacks including fetch() responses in memory until the interval is stopped
            this.fetchinterval = new SchedulerService(4000);
            this.fetchinterval.addEventListener('action',  this.fetchInfo);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.fetchinterval.start();

            this.backupintervalCallback = () => this.getFiles('all');  //even if 'all' is the default.. via the eventlistener the first argument becomes "event"
            this.backupinterval = new SchedulerService(60000 * this.serverstatus.backupintervalPause);
            this.backupinterval.addEventListener('action',  this.backupintervalCallback);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.backupinterval.start();

            if (this.backupintervalPause == 0 ) { this.backupinterval.stop() }

            this.pdfPreviewEventlisterenCallback = () => { this.hidepreview(); } //unload pdf

            document.getElementById('setupdiv').addEventListener('click', function(e) { e.stopPropagation();});
            document.querySelector("#pdfpreview").addEventListener("click", this.pdfPreviewEventlisterenCallback);

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
       
        
  

        // fired by the express server (control.js) via webContents.send after a PDF is successfully written to disk
        // distinguishes between a plain submission (file saved only) and a printrequest (file saved + teacher print dialog)
        if (this.ipcSubmissionHandler) {
            ipcRenderer.removeListener('submission', this.ipcSubmissionHandler)
        }
        this.ipcSubmissionHandler = (event, student) => {
            examEventBus.push(student.printrequest ? 'printrequest' : 'submission', student)
        }
        ipcRenderer.on('submission', this.ipcSubmissionHandler)

        ipcRenderer.on('reconnected', async (event, student) => {
            examEventBus.push('relogin', student)
            //lookup latest htm backup of reconnected student
            const bakResult = await this.getLatestBakFile(student.clientname)
            
            if (bakResult.status === "success") {
                // BAK file found - show dialog with option to send
                const fileName = bakResult.filepath.split(/[/\\]/).pop()
                const filePath = bakResult.filepath
                
                swalQueued({
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
                    confirmButtonColor: '#0aa2c0',
                })
                .then((sendResult) => {
                    if (sendResult.isConfirmed) {
                        // Send the BAK file to the student
                        ipcRenderer.invoke('setStudentStatus', {
                            servername: this.servername,
                            studenttoken: student.token,
                            fetchfiles: true,
                            files: [{ name: fileName, path: filePath }],
                        })
                            .then((result) => {
                                console.log("dashboard @ ipcRenderer.on('reconnected'):", result.message)
                            })
                            .catch((err) => {
                                console.error("dashboard @ ipcRenderer.on('reconnected'):", err)
                            })
                    }
                })
                .catch(err => { console.error("dashboard @ ipcRenderer.on('reconnected'):", err) })
            } else {
                // No BAK file found - show simple reconnect message
                swalQueued({
                    customClass: {
                        popup: 'my-popup',
                        title: 'my-title',
                        content: 'my-content',
                        actions: 'my-swal2-actions',
                    },
                    title: this.$t("dashboard.attention"),
                    text: `${student.clientname} hat sich neu verbunden!`,
                    icon: "info",
                    confirmButtonColor: '#0aa2c0',
                })
            }
        }); 





    },
    beforeUnmount() {  //when leaving
        if (this.ipcSubmissionHandler) {
            ipcRenderer.removeListener('submission', this.ipcSubmissionHandler)
            this.ipcSubmissionHandler = null
        }
        this.fetchinterval.removeEventListener('action', this.fetchInfo);
        this.fetchinterval.stop() 
        this.backupinterval.removeEventListener('action', this.backupintervalCallback);
        this.backupinterval.stop() 
        document.querySelector("#pdfpreview").removeEventListener("click", this.pdfPreviewEventlisterenCallback);
    }

}
</script>





















<style scoped>

#wrapper {
    height: calc(100vh - 63px);
    overflow: hidden;
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
    z-index: 100002; /* ueber #pdfpreview (100001) */
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
    top: 198px; /* 244px minus one tab row (42px + gap) after 5th sidebar icon */
   
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 1000;
   
}

.control-buttons-container {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
}

.control-button-bip-access {
    margin-left: auto;
}

.control-button {
    width: 128px;
    height: 62px;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    padding: 8px;
}

.control-button-icon {
    display: block;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    align-self: center;
}

.control-button-label {
    display: flex;
    align-items: center;
    margin-top: 0 !important;
    margin-left: 4px;
    width: 70px;
    font-size: 0.8em;
    line-height: 1.1;
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



#description {
    position: fixed;
    left: 250px;
    right: 0;
    bottom: 0;
    height: 1.5rem;
    line-height: 1.5rem;
    padding-top: 0;
    padding-bottom: 0;
    padding-right: 6rem;
    z-index: 1500;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8em;
    text-align: left !important;
    margin: 0;
}

#statusdiv {
    position: fixed;
    right: 0;
    bottom: 0;
    height: 1.5rem;
    line-height: 1.5rem;
    padding: 0 0.5rem;
    z-index: 1501;
    box-sizing: border-box;
    cursor: help;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    margin: 0;
    font-size: 0.8rem;
}


#setupdiv {
    position: absolute;        /* positions the div above everything else */
    top: 50%;               /* centers vertically */
    left: 50%;              /* centers horizontally */
    display: flex;          /* flex container for the buttons */
    flex-direction: column; /* arrange buttons vertically */
    align-items: flex-start;    /* centers buttons within the container */
    padding: 20px;          /* inner padding */
    border-radius: 5px;    /* rounded corners */
    background-color: white;
    box-shadow: 0 0 1em rgba(0, 0, 0, 0.5);
    width: 800px;
    max-width: calc(100vw - 80px);
    max-height: 700px;      /* limit dialog height */
    overflow: hidden;       /* scrolling is handled by .setup-scroll */
    z-index: 1000000;
    border: 1px solid rgba(0,0,0,0.08);
}

.setup-title {
    color: rgba(0,0,0,0.8);
}

.setup-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.setup-title {
    font-size: 1.05rem;
    font-weight: 600;
}

.setup-card {
    width: 100%;
    background: #fafafa;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
}

.setup-grid .setup-card {
    margin-bottom: 0;
    height: 100%;
}

.setup-grid {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: stretch;
}

@media (max-width: 860px) {
    .setup-grid {
        grid-template-columns: 1fr;
    }
}






.setup-scroll {
    width: 100%;
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
}

.setup-footer {
    width: 100%;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 12px;
    margin-top: 6px;
    border-top: 1px solid rgba(0,0,0,0.08);
    background: #fff;
}

.setup-footer-actions {
    display: inline-flex;
    gap: 10px;
    align-items: center;
}

.setup-footer-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
}

.setup-status-fixed {
    position: absolute;
    right: 20px;
    bottom: 4px;
    max-width: calc(100% - 40px);
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
    text-align: right;
    font-size: 0.8rem;
    color: rgba(0,0,0,0.85);
    pointer-events: none;
}

/* setup-card-title removed by design (avoid box headers) */

.setup-row {
    width: 100%;
    margin-bottom: 8px;
}

.setup-row:last-child {
    margin-bottom: 0;
}

.setup-row-indent {
    padding-left: 22px;
}

.setup-row-split {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.setup-field-label {
    font-size: 0.9rem;
    font-weight: 500;
}

.setup-inline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.setup-inline-fill {
    width: 100%;
}

.setup-inline-fill {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: 10px;
}

.setup-inline-fill input[type="range"] {
    width: 100%;
    min-width: 180px;
    max-width:270px;
}

.setup-inline-fill .setup-value {
    min-width: 0;
    white-space: nowrap;
}

.setup-unit {
    font-size: 0.85rem;
    color: rgba(0,0,0,0.55);
    min-width: 26px;
}

.setup-value {
    font-size: 0.85rem;
    min-width: 0;
    text-align: right;
}

.setup-range {
    width: 100%;
}

.setup-inline-fill .setup-range {
    width: 100%;
}

.setup-timelimit {
    width: 88px;
}

.setup-hint {
    font-size: 0.85rem;
    color: rgba(0,0,0,0.55);
    margin-top: -4px;
    margin-bottom: 8px;
}

.setup-divider {
    width: 100%;
    height: 1px;
    background: rgba(0,0,0,0.08);
    margin: 10px 0;
}

.setup-row-disabled {
    cursor: not-allowed;
}
.setup-row-disabled * {
    cursor: not-allowed;
}

.setup-switch-details {
    padding-left: 3em;
}

/* Teal accents for setup sliders (match editor sidebar vibe) */
#setupdiv input[type="range"].custom-slider {
    accent-color: var(--bs-teal, #20c997);
}
#setupdiv input[type="range"].custom-slider::-webkit-slider-thumb {
    background: var(--bs-teal, #20c997);
}
#setupdiv input[type="range"].custom-slider::-moz-range-thumb {
    background: var(--bs-teal, #20c997);
    border: none;
}

/* Teal accents for setup + sidebar switches/checkboxes */
#setupdiv .form-check-input,
.sidebar-root .form-check-input {
    accent-color: var(--bs-teal, #20c997);
}
#setupdiv .form-check-input:disabled,
.sidebar-root .form-check-input:disabled {
    accent-color: rgba(0,0,0,0.25);
}

#setupdiv input[type="range"].custom-slider::-webkit-slider-runnable-track {
    background: color-mix(in srgb, var(--bs-teal, #20c997) 25%, transparent);
    height: 6px;
    border-radius: 99px;
}
#setupdiv input[type="range"].custom-slider::-moz-range-track {
    background: color-mix(in srgb, var(--bs-teal, #20c997) 25%, transparent);
    height: 6px;
    border-radius: 99px;
}

/* Bootstrap switches ignore accent-color in some cases; force teal when checked */
#setupdiv .form-check-input:checked,
.sidebar-root .form-check-input:checked {
    background-color: var(--bs-teal, #20c997);
    border-color: var(--bs-teal, #20c997);
}
#setupdiv .form-check-input:focus,
.sidebar-root .form-check-input:focus {
    box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--bs-teal, #20c997) 25%, transparent);
    border-color: var(--bs-teal, #20c997);
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
    max-width: 320px; /* or any desired fixed width */
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    white-space: nowrap;
    margin-bottom: 10px; /* spacing between buttons */
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
    background-color: rgba(0, 0, 0, 0.4); /* darken the background */
    backdrop-filter: blur(2px); /* blur effect */
    z-index: 111999; /* below the dialog */
    display: none; /* hidden by default */
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


.studentwidget-empty {
    border: 1px solid rgba(255, 255, 255, 0.7) !important;
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

.languagetoolfake {
    position: absolute;
    top: 78px;
    left: 0;
    background-color: #9b2c2c;
    color: white;
    font-size: 0.7em;
    padding: 2px;
    padding-left: 4px;
    padding-right: 10px;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
    z-index: 100;
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
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    border-bottom-left-radius: 16px;
    margin-bottom: 1.5rem;
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

.sidebar-overlays {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    
    width: 100%;
  
}

.sidebar-overlays div{
    min-height: 128px;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    text-align: left;
    font-size: 0.8em;
    font-weight: normal;

}

.sidebar-footer {
    font-size: 0.8em;
    cursor: pointer;
    user-select: none;
    padding-left: 6px;
    padding-bottom: 6px;
    height:1.4rem;
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
    display: block;
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
    color: var(--bs-body-color, #212529);
    border: var(--bs-border-width, 1px) solid transparent;
    padding: 0.375rem 0.75rem;
    cursor: default;
    box-shadow: none;
    user-select: text;
}
.infobutton:hover,
.infobutton:focus,
.infobutton:focus-visible {
    background-color: whitesmoke;
    color: var(--bs-body-color, #212529);
    border-color: transparent;
    box-shadow: none;
}

#studentslist{
    border-radius: 5px;
    width: 100%;
    flex: 1;
    min-height: 0;
    /* border: 1px solid rgb(99, 187, 175); */
    padding-bottom:30px;
    padding-right: 30px;
    margin-right: -30px;
    transition:0.1s;
    overflow-y:auto;
    overflow-x: hidden;
    scrollbar-gutter: auto;
}

.studentslist-zoom {
    transform-origin: top left;
    will-change: transform;
}

.studentslist-controls {
    position: fixed;
    bottom: 28px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    filter: opacity(50%);
    z-index: 800;
}

.studentslist-controls-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 10px;
    line-height: 1;
}

.studentslist-controls-label {
    min-width: 64px;
    font-variant-numeric: tabular-nums;
}

#studentslist::-webkit-scrollbar {
    width: 6px;
}

#studentslist::-webkit-scrollbar-track {
    background: transparent;
}

#studentslist::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.25);
    border-radius: 6px;
}

#studentslist::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0.35);
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


.pdfpreview-centered {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 1200px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 0 15px rgba(0,0,0,0.5);
}

#pdfpreview {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 100001;
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
    white-space: nowrap; /* prevents line breaks */
    overflow: hidden;    /* hides overflowing text */
    text-overflow: ellipsis; /* adds "..." at the end of overflowing text */
    max-width: 170px;    /* maximum width, adjust as needed */
}


.custom-slider {
    width: 345px; /* fixed width of the slider */
    margin-right: 10px; /* spacing to other elements */
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
    height: auto;
    right: -582px;
    top: 62px;
    bottom: 1.5em;
    background-color: var(--bs-gray-100);
    box-shadow: -2px 1px 2px rgba(0, 0, 0, 0);
    transition: 0.3s;
    padding: 6px;
  
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
    height: calc(100vh - 62px - 1.5em);
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
    z-index: 100003 !important; /* ueber #pdfpreview (100001) */
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -webkit-animation: none !important;
    
} 


.swal2-html-container {
    padding: 4px !important;
    overflow:visible !important;
}

.swal2-title {
   padding-left: 0.9em !important;
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
    overflow:visible;

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

/* SweetAlert2: use more horizontal space inside our popups */
.my-popup.swal2-popup {
    padding-left: 0.9em !important;
    padding-right: 0.9em !important;
}

.my-popup .swal2-html-container {
    width: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 1.9em !important;
    padding-right: 1.9em !important;
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
    justify-content: flex-start !important; /* aligns buttons to the left */
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

.sidebar-advanced-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    margin-top: 6px;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
}

.sidebar-advanced-toggle:hover {
    color: rgba(255, 255, 255, 0.88);
}

.sidebar-advanced-chevron {
    display: inline-block;
    width: 12px;
    opacity: 0.75;
    transform: rotate(0deg);
    transition: transform 0.12s ease-in-out;
}

.sidebar-advanced-chevron.open {
    transform: rotate(90deg);
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
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-size: 1.05rem;
    font-weight: 300;
}

.remove-x {
    position: absolute;
    left: 50%;
    top: 50%;
    line-height: 1;
    transform: translate(-50%, -55%);
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

@media print {
    /* nur #pdfpreview im Print sichtbar, Rest weg damit Layout-Flow den PDF-Wrapper voll nutzt */
    /* #pdfpreview haengt unter #q-app als Sibling von #wrapper -> alle Geschwister ausser #pdfpreview ausblenden */
    #q-app > *:not(#pdfpreview),
    #setupoverlay, .sidebar-root, #content,
    .studentslist-controls, .tab-buttons-container { display: none !important; }
    /* Root entclippen: body inline position:fixed + #q-app height:100vh begrenzen sonst Druck auf 1 Viewport-Hoehe -> nur Seite 1 */
    html, body#vuexambody { position: static !important; height: auto !important; overflow: visible !important; }
    #q-app { display: block !important; height: auto !important; overflow: visible !important; }
    #pdfpreview {
        display: block !important;
        /* hart an top/left 0 verankern: printToPDF paginiert ab html-Layout, nicht ab #pdfpreview;
           absolute gegen den initial containing block eliminiert jeden Vorfluss-Offset (DevTools-Print zeigt's korrekt, printToPDF sonst verschoben) */
        position: absolute !important;
        top: 0 !important; left: 0 !important; right: 0 !important;
        width: 100% !important; height: auto !important;
        padding: 0 !important; margin: 0 !important;
        background: #fff !important; backdrop-filter: none !important;
    }
    .pdfpreview-centered {
        position: static !important; transform: none !important;
        width: 100% !important; height: auto !important;
        max-width: none !important; max-height: none !important;
        margin: 0 !important; padding: 0 !important;
        border-radius: 0 !important; box-shadow: none !important;
        overflow: visible !important;
    }

}
</style>
