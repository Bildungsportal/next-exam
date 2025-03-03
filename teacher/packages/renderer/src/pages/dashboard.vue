<template>


<!-- Header START -->
<div :key="0" class="w-100 p-3 text-white bg-dark shadow text-right" style="min-width: 1180px;">
    <span class="text-white m-1">
        <img src="/src/assets/img/svg/speedometer.svg" class="white me-2  " width="32" height="32" >
        <span style="font-size:23px;" class="align-middle me-1 ">Next-Exam</span>
    </span>
    <span class="align-middle ms-3" style="float: right; font-size:23px;">Dashboard</span>

    <div v-if="serverstatus.useExamSections" style="position: absolute; left:257px; top:43px; min-width: 550px;">
        <div id="section1" v-if="serverstatus.examSections[1]" @click="activateSection(1)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 1 && !serverstatus.examSections[1].locked, 'sectionbuttonactivered': serverstatus.activeSection == 1 && serverstatus.examSections[1].locked, 'btn-secondary': serverstatus.activeSection != 1,'btn-danger': serverstatus.examSections[1].locked}">{{ serverstatus.examSections[1].sectionname }}</div>
        <div id="section2" v-if="serverstatus.examSections[2]" @click="activateSection(2)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 2 && !serverstatus.examSections[2].locked, 'sectionbuttonactivered': serverstatus.activeSection == 2 && serverstatus.examSections[2].locked, 'btn-secondary': serverstatus.activeSection != 2,'btn-danger': serverstatus.examSections[2].locked}">{{ serverstatus.examSections[2].sectionname }}</div>
        <div id="section3" v-if="serverstatus.examSections[3]" @click="activateSection(3)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 3 && !serverstatus.examSections[3].locked, 'sectionbuttonactivered': serverstatus.activeSection == 3 && serverstatus.examSections[3].locked, 'btn-secondary': serverstatus.activeSection != 3,'btn-danger': serverstatus.examSections[3].locked}">{{ serverstatus.examSections[3].sectionname }}</div>
        <div id="section4" v-if="serverstatus.examSections[4]" @click="activateSection(4)" class="sectionbutton btn btn-sm" :class="{'sectionbuttonactive': serverstatus.activeSection == 4 && !serverstatus.examSections[4].locked, 'sectionbuttonactivered': serverstatus.activeSection == 4 && serverstatus.examSections[4].locked, 'btn-secondary': serverstatus.activeSection != 4,'btn-danger': serverstatus.examSections[4].locked}">{{ serverstatus.examSections[4].sectionname }}</div>
    </div>

    <div class="btn btn-sm btn-cyan m-0 me-1 mt-1" style="float: right; padding:3px;" @click="showSetup()"  @mouseover="showDescription($t('dashboard.extendedsettings'))" @mouseout="hideDescription" ><img src="/src/assets/img/svg/settings-symbolic.svg" class="white-100" width="22" height="22" > </div>
    <div class="btn btn-sm btn-danger m-0 me-1 mt-1" @click="stopserver()" @mouseover="showDescription($t('dashboard.exitexam'))" @mouseout="hideDescription"  style="float: right"><img src="/src/assets/img/svg/stock_exit.svg" style="vertical-align:text-top;" class="" width="20" height="20" >&nbsp; {{$t('dashboard.stopserver')}}&nbsp; </div>
    <div v-if="!hostip" id="adv" class="btn btn-danger btn-sm m-0  mt-1 me-1 " style="cursor: unset; float: right">{{ $t("general.offline") }}</div>
</div>
 <!-- Header END -->


<div id="wrapper" class="w-100 h-100 d-flex" >
    
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
                    <div class="col d-inlineblock btn btn-info m-1 btn-sm"      @click="getFiles(activestudent.token, true)" :class="lockInExammode ? 'disabledexam':''" style="width: 110px">{{$t('dashboard.getfileSingle')}}</div>
                    <div class="col d-inlineblock btn btn-dark m-1 btn-sm "     @click="openLatestFolder(activestudent)"  style="width: 110px;">{{$t('dashboard.shownewestfolder')}} </div>
                    <div class="col d-inlineblock btn btn-warning m-1 btn-sm"   @click='kick(activestudent.token,activestudent.clientip);hideStudentview()'  style="width: 110px">{{$t('dashboard.kick')}}</div>
                </div>
            </div>
        </div>
    </div>
    <!-- single student view END -->


    <!-- dashboard EXPLORER start -->
    <div :key="2" id=preview class="fadeinfast ">
        <div id=workfolder style="overflow-y:hidden">
            <button id="closefilebrowser" type="button" class=" btn-close pt-2 pe-2 float-end" title="close"></button>
            <h4>{{$t('dashboard.filesfolder')}}: </h4> 
            <div class="ms-0 mb-3"><strong>{{currentdirectory}}</strong>  </div> 
            <div class="btn btn-dark pe-3 ps-3 me-1 mb-3 btn-sm" @click="loadFilelist(workdirectory) "><img src="/src/assets/img/svg/go-home.svg" class="" width="22" height="22" > </div>
            <div :class="lockPdfSummary ? 'disabledexam':''" class="btn btn-primary pe-3 ps-3 me-1 mb-3 btn-sm" style="float: right;" :title="$t('dashboard.summarizepdf')" @click="getLatest() "><img src="/src/assets/img/svg/edit-copy.svg" class="" width="22" height="22" >{{$t('dashboard.summarizepdfshort')}}</div>
            <div  v-if="(currentdirectory !== workdirectory)" class="btn btn-dark pe-3 ps-3 me-1 mb-3 btn-sm" @click="loadFilelist(currentdirectoryparent) "><img src="/src/assets/img/svg/edit-undo.svg" class="" width="22" height="22" >up </div>
            <div :key="3" style="height: 76vh; overflow-y:auto;">
                <div v-for="file in localfiles" :key="file.path" class="d-inline">
                    <hr v-if="(file.type == 'file' || file.type == 'dir')">
                    <div  v-if="(file.type == 'file' || file.type == 'dir')" class="btn btn-dark me-1 mb-2 btn-sm" style="float: right;" @click="fdelete(file)" :title="$t('dashboard.delete')"><img src="/src/assets/img/svg/edit-delete.svg" class="" width="22" height="22" ></div>

                    <!-- pdf -->
                    <div v-if="(file.type == 'file' && file.ext === '.pdf')" class="btn btn-primary pe-3 ps-3 me-3 mb-2 btn-sm" @click="loadPDF(file.path, file.name)" style="max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><img src="/src/assets/img/svg/document.svg" class="" width="22" height="22" > {{file.name}} </div>
                    <!-- images -->
                    <div v-if="(file.type == 'file' && (file.ext === '.png'|| file.ext === '.jpg'|| file.ext === '.webp'|| file.ext === '.jpeg' ) )" class="btn btn-primary pe-3 ps-3 me-3 mb-2 btn-sm" @click="loadImage(file.path)" style=" max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><img src="/src/assets/img/svg/document.svg" class="" width="22" height="22" > {{file.name}} </div>
                    <!-- other files -->
                    <div v-if="(file.type == 'file' && !(file.ext === '.pdf' || file.ext === '.png'|| file.ext === '.jpg'|| file.ext === '.webp'|| file.ext === '.jpeg' )  )" class="btn btn-info pe-3 ps-3 me-3 mb-2 btn-sm"  style=" max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default;"><img src="/src/assets/img/svg/document.svg" class="" width="22" height="22" > {{file.name}} </div>

                    <div v-if="(file.type == 'file')" :class="lockSendFile ? 'disabledexam':''"    class="btn btn-dark  me-1 mb-2 btn-sm " style="float: right;" @click="dashboardExplorerSendFile(file)" :title="$t('dashboard.send')"><img src="/src/assets/img/svg/document-send.svg" class="" width="22" height="22" ></div>
                    <div v-if="(file.type == 'file')" class="btn btn-dark  me-1 mb-2 btn-sm " style="float: right;" @click="downloadFile(file)" :title="$t('dashboard.download')"><img src="/src/assets/img/svg/edit-download.svg" class="" width="22" height="22" ></div>
                    <div v-if="(file.type == 'file' && file.ext === '.pdf')" class="btn btn-dark me-1 mb-2 btn-sm" style="float: right;" @click="loadPDF(file.path, file.name)" :title="$t('dashboard.preview')"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" ></div>
                    <div v-if="(file.type == 'file' && (file.ext === '.png'|| file.ext === '.jpg'|| file.ext === '.webp'|| file.ext === '.jpeg' ))" class="btn btn-dark me-1 mb-2 btn-sm" style="float: right;" @click="loadImage(file.path)" :title="$t('dashboard.preview')"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" ></div>
                    <!-- folders -->
                    <div v-if="(file.type == 'dir')" class="btn btn-success pe-3 ps-3 me-3 mb-2 btn-sm" @click="loadFilelist(file.path)"><img src="/src/assets/img/svg/folder-open.svg" class="" width="22" height="22" > {{file.name}} </div>
                    <div v-if="(file.type == 'dir')" class="btn btn-dark  me-1 mb-2 btn-sm " style="float: right;" @click="downloadFile(file)" :title="$t('dashboard.download')"><img src="/src/assets/img/svg/edit-download.svg" class="" width="22" height="22" ></div>
                
                </div>
           </div>
        </div>
    </div>
    <!-- dashboard EXPLORER end -->



    <!-- pdf preview start -->
    <div :key="4" id="pdfpreview" class="fadeinfast p-4">
        <div class="embed-container">
        <iframe src="" id="pdfembed"></iframe>
        <div id="previewbuttons">
            <div class="insert-button btn btn-danger me-2  shadow" style="float: right;" @click="hidepreview()" :title="$t('dashboard.close')"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="32" > </div>
            <div class="insert-button btn btn-warning me-2 shadow" style="float: right;" id="printPDF" @click="printBase64()"  :title="$t('dashboard.print')"><img src="/src/assets/img/svg/print.svg" class="white" width="22" height="32" > </div>
            <div class="insert-button btn btn-dark me-2 shadow" style="float: right;" id="downloadPDF" @click="downloadFile('current')" :title="$t('dashboard.save')"><img src="/src/assets/img/svg/edit-download.svg" class="" width="22" height="32" > </div>
            <div class="insert-button btn btn-dark me-2 shadow" style="float: right;" id="openPDF" @click="openFileExternal(currentpreviewPath)" :title="$t('dashboard.open')"><img src="/src/assets/img/svg/stock_exit_up.svg" class="" width="22" height="32" > </div>
        </div>
        </div>
    </div>
    <!-- pdf preview end -->
   


    <!-- SIDEBAR start -->
    <div :key="5" class="p-3 text-white bg-dark h-100 " style="width: 240px; min-width: 240px;">
        <div class="btn btn-light m-1 mt-0 text-start infobutton" @click="showinfo()">{{$t('dashboard.name')}} <br><b> {{$route.params.servername}}</b> </div><br>
        <div class="btn btn-light m-1 text-start infobutton" @click="showinfo()">{{$t('dashboard.server')}} <br><b>{{serverip}}</b> </div><br>
        <div class="btn btn-light m-1 mb-3 text-start infobutton" @click="showinfo()">{{$t('dashboard.pin')}}<br><b> {{ serverstatus.pin }} </b>  </div><br>
        
      



        <div class="dropdown-section m-1" style="width: 200px"   :class="lockInExammode ? 'disabledexam' : ''">
            <!-- Dropdown Button -->
            <div class="mb-1">{{$t("dashboard.exammode")}}</div>

            <button class="btn btn-sm btn-secondary dropdown-toggle d-inline-flex justify-content-between align-items-center" style="width: 166px; vertical-align: middle; text-align: left;"  type="button" data-bs-toggle="dropdown" aria-expanded="false">
                 <span>{{ getSelectedExamTypeLabel() }}</span>
            </button>
            <button class="btn btn-sm btn-secondary p-0" style="width: 31px; height: 31px; margin-left: 3px; display: inline-flex; vertical-align: middle; justify-content: center; align-items: center;" :class="isExamType('math') ? 'disabledexam' : ''" @click="selectExamType(serverstatus.examSections[serverstatus.activeSection].examtype)"  @mouseover="showDescription($t('dashboard.extendedsettings_mode'))"  @mouseout="hideDescription"> 
                <img src="/src/assets/img/svg/settings-symbolic.svg" class="white-100" width="22" height="22">
            </button>

            <!-- Dropdown Menu -->
            <ul class="dropdown-menu" style="cursor: pointer;">
                <li><a class="dropdown-item" @click="selectExamType('math')" :class="{ active: isExamType('math') }">{{$t('dashboard.math')}}</a></li>
                <li><a class="dropdown-item" @click="selectExamType('editor')" :class="{ active: isExamType('editor') }">{{$t('dashboard.lang')}}</a></li>
                <li><a class="dropdown-item" @click="selectExamType('eduvidual')" :class="{ active: isExamType('eduvidual') }">{{$t('dashboard.eduvidual')}}</a></li>
                <li><a class="dropdown-item" @click="selectExamType('gforms')" :class="{ active: isExamType('gforms') }">{{$t('dashboard.gforms')}}</a></li>
                <li><a class="dropdown-item" @click="selectExamType('website')" :class="{ active: isExamType('website') }">Website</a></li>
                <li><a class="dropdown-item" @click="selectExamType('microsoft365')" :class="{ active: isExamType('microsoft365') }">Microsoft365</a></li>
                <li><a class="dropdown-item" @click="selectExamType('rdp')" :class="{ active: isExamType('rdp') }">RDP</a> </li>
            </ul>

            <!-- Additional Info Section -->
            <div class="mt-2">
                <!-- Editor Spellcheck Info -->
                <div v-if="isExamType('editor') && serverstatus.examSections[serverstatus.activeSection].languagetool" class="small text-white-50">
                Spellcheck: {{serverstatus.examSections[serverstatus.activeSection].spellchecklang}}
                </div>

                <!-- Website Domain Info -->
                <div v-if="isExamType('website') && serverstatus.examSections[serverstatus.activeSection].domainname" class="small text-white-50 text-truncate">
                {{serverstatus.examSections[serverstatus.activeSection].domainname}}
                </div>

                <!-- Microsoft365 Buttons -->
                <div v-if="isExamType('microsoft365')" class="d-flex flex-column gap-2">
                <!-- Connect Button -->
                <button v-if="!config.accessToken" @click="openAuthWindow()" class="btn btn-sm btn-primary">
                    <img src="/src/assets/img/svg/win.svg" width="24" height="24">
                    <span class="ms-1">Verbinden</span>
                </button>

                <!-- File Select Button -->
                <button v-if="config.accessToken && !serverstatus.examSections[serverstatus.activeSection].msOfficeFile" @click="onedriveUploadselect()" class="btn btn-sm btn-info text-truncate">
                    <img src="/src/assets/img/svg/win.svg" width="24" height="24">
                    <span class="ms-1">Datei wählen</span>
                </button>

                <!-- Selected File Button -->
                <button v-if="config.accessToken && serverstatus.examSections[serverstatus.activeSection].msOfficeFile" @click="onedriveUploadselect()" class="btn btn-sm btn-success text-truncate">
                    <img src="/src/assets/img/svg/win.svg" width="24" height="24">
                    <span class="ms-1">{{serverstatus.examSections[serverstatus.activeSection].msOfficeFile.name}}</span>
                </button>

                <!-- Logout Button -->
                <button v-if="config.accessToken" @click="logout365()" class="btn btn-sm btn-warning">
                    <img src="/src/assets/img/svg/win.svg" width="24" height="24">
                    <span class="ms-1">Logout</span>
                </button>
                </div>
            </div>
        </div>





        <!-- Files Section START -->
        <div class="mb-2" style="display: inline-block; width: 100%; position: relative;">
            <div class=" m-1 mt-3" style="display: inline-block;">{{$t("dashboard.materials")}}</div>
            <div class="btn btn-sm m-1 btn-cyan plusbutton " @click="defineMaterials('all');hideDescription();" @mouseover="showDescription($t('dashboard.definematerials'))" @mouseout="hideDescription"  style="">+</div>
            <MaterialsList class="m-1" :examSection="serverstatus.examSections[serverstatus.activeSection]"  @remove-file="handleFileRemove" @show-preview="showBase64FilePreview" @show-image-preview="showBase64ImagePreview" @play-audio-file="playAudioFile"/>   
        </div>
        <!-- Files Section END -->


        <!-- Section name -->
         <div v-if="serverstatus.useExamSections" class="m-1 mb-4" style="display: inline-block; width: 200px; position: relative;">
            <div class="mb-1">{{$t("dashboard.sectionname")}}</div>
            <input type="text" class="form-control form-control-sm" v-model="serverstatus.examSections[serverstatus.activeSection].sectionname" @change="setServerStatus"/>
         </div>
        <!-- Section name END -->
        


        <!-- BIP Section START -->
        <div v-if="bipToken && this.serverstatus.bip" class="mb-4">
            <span class="small m-1">{{$t("dashboard.bildungsportal")}}</span><span v-if="bipToken" class="small m-1 me-0 text-secondary">(verbunden)</span>
            <div id="biploginbutton" @click="showBipInfo()" class="disabledbutton btn btn-success m-1" style="padding:0;">
                <img id="biplogo" style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span v-if="bipUsername" id="biploginbuttonlabel">{{bipUsername}}</span><span v-else id="biploginbuttonlabel">Login</span>
            </div> 
        </div>
        <!-- BIP Section END -->
        
        <div id="description" class="btn m-1"  v-if="showDesc">{{ currentDescription }}</div>
        <div id="statusdiv" class="btn btn-warning m-1"> {{$t('dashboard.connected')}}  </div>

        <span @click="showCopyleft()" style="position: absolute; bottom:2px; left: 6px; font-size:0.8em;cursor: pointer;">
            <span style=" display:inline-block; transform: scaleX(-1);font-size:1.2em; ">&copy; </span> 
            <span style="vertical-align: text-bottom;">&nbsp;{{version}} {{ info }}</span>
        </span>
       
    </div>
    <!-- SIDEBAR END -->


     <!-- AUDIO Player start -->
     <div id="aplayer" >
            <div style="text-align: left; margin-left: 40px;">{{ audioFilename }} </div>
            <audio id="audioPlayer" controls controlsList="nodownload">
                <source :src="audioSource" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <button  id="audioclose" type="button" class="btn-close" style="" title="close" ></button> 
        </div>
    <!-- AUDIO Player end -->




    <!-- SETUP DIALOG START -->
    <div :key="6" id="setupoverlay" class="fadeinslow" @click="hideSetup()">
        <div id="setupdiv">
            <!-- <div class="swal2-icon swal2-question swal2-icon-show" style="display: flex;"><div class="swal2-icon-content">?</div></div> -->
            <div class="mb-3"><h5 style="display: inline">{{ $t('dashboard.extendedsettings') }}</h5></div>
            <div class="m-1 mb-2" :class="lockInExammode ? 'disabledexam':''">
                <label for="abgabeintervalSlider" class="form-check-label"> {{$t('dashboard.autoget')}} </label>
                <span v-if="serverstatus.abgabeintervalPause > 0" class="ms-2 text-black-50">| {{serverstatus.abgabeintervalPause}}min </span>
                <span v-else class="ms-2 text-black-50">| {{$t('dashboard.disabled')}}</span>
                <input id="abgabeintervalSlider" type="range" 
                    v-model="serverstatus.abgabeintervalPause" 
                    :title="$t('dashboard.abgabeautoquestion')"
                    :min="0" :max="20" step="1" 
                    class="form-range custom-slider" 
                    @input="updateAbgabeInterval">
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
                <input v-model=serverstatus.useExamSections @click="" :title="$t('dashboard.activatesections')" checked=false class="form-check-input" type="checkbox" id="activatesections">
                <label class="form-check-label">{{$t('dashboard.activatesections')}}   </label><br>
            </div>
            <div class="form-check form-switch  m-1 mb-2">
                <input v-model=serverstatus.examSections[serverstatus.activeSection].groups @click="setupGroups()" :title="$t('dashboard.groupinfo')" checked=false class="form-check-input" type="checkbox" id="activategroups">
                <label class="form-check-label">{{$t('dashboard.groups')}}   </label><br>
            </div>
            <div v-if="config.bipIntegration && bipToken" class="form-check form-switch  m-1 mb-2" >
                <input v-model=serverstatus.requireBiP :title="$t('control.biprequired')" checked=false class="form-check-input" type="checkbox" id="activatebip">
                <label class="form-check-label">{{$t('dashboard.bildungsportal')}}   </label><br>
            </div>
            <div class="form-check form-switch  m-1 mb-2">
                <input v-model=directPrintAllowed @click="checkforDefaultprinter()" :title="$t('dashboard.allowdirectprint')" checked=false class="form-check-input" type="checkbox" id="directprint">
                <label class="form-check-label">{{$t('dashboard.directprint')}}   </label><br>
                <div v-if="defaultPrinter" class="ellipsis text-black-50"> {{ defaultPrinter }}</div>
                <div v-if="!defaultPrinter" class="ellipsis text-black-50"> kein Drucker gewählt</div>
            </div>
            <hr>
            <span><h6 style="display: inline">{{ $t('dashboard.defaultprinter') }}</h6></span>
            <div v-if="(availablePrinters.length < 1)">
                <button class="btn btn-secondary mt-1 mb-0"><img src="/src/assets/img/svg/print.svg" class="" width="22" height="22" >  no printer found </button>
            </div>
            <div v-for="printer in availablePrinters" :key="printer" style="position: relative;">
                <button @click="selectPrinter(printer)" :class="{'btn-cyan': defaultPrinter === printer}" class="printerbutton btn btn-secondary mt-1 mb-0" @mouseenter="visiblePrinter = printer" @mouseleave="visiblePrinter = null"><img src="/src/assets/img/svg/print.svg" alt="print" width="22" height="22" /> {{ printer }} </button>
                <div v-if="visiblePrinter === printer" class="tooltip-content"> {{ printer }} </div>
                <!-- Icon für den Standarddrucker -->
                <img v-if="printer === defaultPrinter" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" />
            </div>
            <div v-if="currentpreviewPath && defaultPrinter">
                <button id="printButton" class="btn btn-dark mt-1 mb-0" @click="printBase64();hideSetup()"><img src="/src/assets/img/svg/print.svg" class="" width="22" height="22" > Print: {{ currentpreviewname }} </button>
            </div> 
            <div>  <!-- ok button resets currentpreviewPath / print button only appears if currentpreviewPath is set and defaultprinter is set -->
                <div id="okButton" class="btn mt-3 btn-success" @click="hideSetup(); this.currentpreviewPath=null;">OK</div>
            </div>
        </div>
       
    </div>
  <!-- SETUP DIALOG END -->

   
    <div :key="7" id="content" class="fadeinslow p-3">
       



        <!-- CONTROL BUTTONS START -->        
        <div v-if="(serverstatus.exammode && numberOfConnections == 1)" class="btn btn-danger m-1 mt-0 text-start ms-0 " style="width:128px; height:62px;" @click="endExam();hideDescription();"  @mouseover="showDescription($t('dashboard.exitkiosk'))" @mouseout="hideDescription"  >
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> <div style="display:inline-block; margin-top:4px; margin-left:4px; width:60px; font-size:0.8em;"> {{numberOfConnections}} {{$t('dashboard.stopexamsingle')}} </div>
        </div>
        <div v-if="(serverstatus.exammode && numberOfConnections != 1)" class="btn btn-danger m-1 mt-0 text-start ms-0 " style="width:128px; height:62px;" @click="endExam();hideDescription();"  @mouseover="showDescription($t('dashboard.exitkiosk'))" @mouseout="hideDescription"  >
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> <div style="display:inline-block; margin-top:4px; margin-left:4px; width:60px; font-size:0.8em;"> {{numberOfConnections}} {{$t('dashboard.stopexam')}} </div>
        </div>
        <div v-if="(!serverstatus.exammode)" class="btn btn-teal m-1 mt-0 text-start ms-0"  @click="startExam();hideDescription();"  @mouseover="showDescription($t('dashboard.startexamdesc'))" @mouseout="hideDescription" :class="(serverstatus.examSections[serverstatus.activeSection].examtype === 'microsoft365' && (!this.config.accessToken || !serverstatus.examSections[serverstatus.activeSection].msOfficeFile))? 'disabledgreen':''" style="width:128px; height:62px;">  
            <img src="/src/assets/img/svg/shield-lock.svg" class="white mt-2" width="28" height="28" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:60px; font-size:0.8em;"> {{numberOfConnections}} {{$t('dashboard.startexam')}}</div>
        </div>
        <div class="btn btn-cyan m-1 mt-0 text-start ms-0" @click="getFiles('all', true);hideDescription();"  @mouseover="showDescription($t('dashboard.getfile'))" @mouseout="hideDescription"  :class="lockDownload ? 'disabledexam':''"  style="width:128px; height:62px;" >
            <img src="/src/assets/img/svg/edit-download.svg" class="mt-2" width="32" height="32" style="vertical-align: top;">
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:60px; font-size:0.8em;">{{$t('dashboard.getfiles')}}</div>
        </div>
        <div class="btn btn-cyan m-1 mt-0 text-start ms-0" @click="loadFilelist(workdirectory);hideDescription();"  @mouseover="showDescription($t('dashboard.showworkfolder'))" @mouseout="hideDescription"  style="width: 128px; height:62px;">
            <img src="/src/assets/img/svg/folder-open.svg" class="mt-2" width="32" height="32" style="vertical-align: top;" >
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:60px; font-size:0.8em;">{{$t('dashboard.workfolder')}}</div>
        </div>
        <div v-if="bipToken && serverstatus.bip" @mouseover="showDescription($t('dashboard.bipinfo'))" @mouseout="hideDescription" class="btn m-1 mt-0 ms-0 text-start p-1 pt-2 ps-2" :class="bipStatus === 'closed' ? 'btn-warning' : 'btn-teal'" @click="toggleBipStatus" style="width:128px; height:62px;">
            <img src="/src/assets/img/svg/globe.svg" class=" mt-1" width="32" height="32" style="vertical-align: top;"> 
            <div style="display:inline-block; margin-top:4px; margin-left:4px; width:70px; font-size:0.8em;" class="">BiP-Status {{bipStatus}}</div>
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










        <!-- studentlist start -->
        <div id="studentslist" class="pt-1">        
            <draggable v-model="studentwidgets" :move="handleMoveItem" @end="handleDragEndItem" ghost-class="ghost">
                <div v-for="student in studentwidgets" :key="student.token" style="cursor:auto" v-bind:class="(!student.focus)?'focuswarn':''" class="studentwidget btn rounded-3 btn-block">
                    <div v-if="student.clientname">
                        <div class="studentimage rounded" style="position: relative; height:132px;">  
                            <button v-if="serverstatus.examSections[serverstatus.activeSection].examtype === 'editor' && !this.serverstatus.examSections[serverstatus.activeSection].languagetool && this.serverstatus.examSections[serverstatus.activeSection].spellchecklang !== 'none'" @mouseover="showDescription($t('dashboard.allowspellcheck'))" @mouseout="hideDescription" @click='activateSpellcheckForStudent(student.token,student.clientname)' type="button" class="btn btn-sm pt-1 mt-2 pe-1 float-end" style="z-index:1000; position:relative;"><img src="/src/assets/img/svg/autocorrection.svg" class="widgetbutton" width="22" height="22" ></button> 
                            <div v-cloak :id="student.token" style="position: relative;background-size: cover; height: 132px;" v-bind:style="(student.imageurl && now - 20000 < student.timestamp)? `background-image: url('${student.imageurl}')`:'background-image: url(user-red.svg)'"></div>
                            <div v-if="student.virtualized && now - 20000 < student.timestamp" class="virtualizedinfo" >{{$t("dashboard.virtualized")}}</div>
                            <div v-if="!student.focus && now - 20000 < student.timestamp" class="kioskwarning" >{{$t("dashboard.leftkiosk")}}</div>
                            <div v-if="student.status.sendexam && now - 20000 < student.timestamp" class="examrequest" >{{$t("dashboard.examrequest")}}</div>
                            <span>   
                                <div v-if="now - 20000 < student.timestamp" style="display: inline-block; overflow: hidden; width: 140px; height: 22px" v-bind:title="(student.files) ? 'Documents: '+student.files : ''"> 
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
                        <div class="btn-group pt-0" role="group">
                            <button v-if="(now - 20000 < student.timestamp)" @click="showStudentview(student)" type="button" class="btn btn-outline-success btn-sm " style="border-top:0px; border-top-left-radius:0px; border-top-right-radius:0px; ">{{$t('dashboard.online')}} </button>
                            <button v-if="(now - 20000 > student.timestamp)" type="button" class="btn btn-outline-danger btn-sm " style="border-top:0px; border-top-left-radius:0px; border-top-right-radius:0px; ">{{$t('dashboard.offline')}} </button>
                            <button v-if="(now - 20000 < student.timestamp) && student.exammode && student.focus"  @click='showStudentview(student)' type="button" class="btn btn-outline-warning btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;">{{$t('dashboard.secure')}}</button>
                            <button v-if="(now - 20000 < student.timestamp) && !student.focus "   @click='restore(student.token)' type="button" class="btn btn-danger btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> {{$t('dashboard.restore')}} </button>
                            <button v-if="(now - 20000 < student.timestamp) && serverstatus.examSections[serverstatus.activeSection].groups && student.status.group == 'a' "   @click='quickSetGroup(student)' type="button" class="btn-click-feedback2 btn btn-info btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> A  </button>
                            <button v-if="(now - 20000 < student.timestamp) && serverstatus.examSections[serverstatus.activeSection].groups && student.status.group == 'b' "  @click='quickSetGroup(student)' type="button" class="btn-click-feedback1 btn btn-warning btn-sm " style="border-top:0px;border-top-left-radius:0px; border-top-right-radius:0px;"> B  </button>
                        </div>
                    </div>
                </div> 
            </draggable>  
        </div>
        <!-- studentlist end -->



    </div>
 
    <div style="position: fixed; bottom:20px; right: 20px; filter:opacity(50%)" class="col d-inlineblock btn " @click="sortStudentWidgets()">
        <img src="/src/assets/img/svg/view-sort-ascending-name.svg" class="white" title="sort" width="24" height="24" >  
    </div>

</div>
</template>









<script >
import { VueDraggableNext } from 'vue-draggable-next'
import { v4 as uuidv4 } from 'uuid'
import {SchedulerService} from '../utils/schedulerservice.js'
import MaterialsList from '../components/materialsList.vue'

import { uploadselect, onedriveUpload, onedriveUploadSingle, uploadAndShareFile, createSharingLink, fileExistsInAppFolder, downloadFilesFromOneDrive} from '../msalutils/onedrive'
import { handleDragEndItem, handleMoveItem, sortStudentWidgets, initializeStudentwidgets} from '../utils/dragndrop'
import { loadFilelist, print, getLatest, processPrintrequest,  loadImage, loadPDF, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete,  openLatestFolder, printBase64, showBase64FilePreview, showBase64ImagePreview } from '../utils/filemanager'
import { activateSpellcheckForStudent, delfolderquestion, stopserver, sendFiles, lockscreens, getFiles, startExam, endExam, kick, restore, defineMaterials } from '../utils/exammanagement.js'
import { getTestURL, getTestID, getFormsID, configureEditor } from '../utils/examsetup.js'

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
        MaterialsList: MaterialsList
    },
    data() {
        return {
            version: this.$route.params.version,
            info: config.info,
            title: document.title,
            fetchinterval: null,
            abgabeinterval: null,
            
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
            autoabgabe: true,
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
            directPrintAllowed: false,
            visiblePrinter: null,
            audioSource:'',
            audioFilename: '',

            bipToken:this.$route.params.bipToken === 'false' ?  false : this.$route.params.bipToken,   // parameter werden immer als string "false" übergeben, convert to bool
            bipuserID: this.$route.params.bipuserID === 'false' ?  false : this.$route.params.bipuserID,
            bipUsername:this.$route.params.bipUsername === 'false' ?  false : this.$route.params.bipUsername,
            bipStatus: "closed", // "open" or "closed" or "offline"

            serverstatus:{   // this object contains all neccessary information for students about the current exam settings
                bip: false,
                id: "1234",
                examName: this.$route.params.servername,
                examDate: new Date().toISOString().slice(0, 19),
                examDurationMinutes: 100, 
                pin: this.$route.params.pin,
                requireBiP: false,
                exammode: false,
                delfolderonexit: true,
                screenshotinterval: 4,
                abgabeintervalPause:6,
                screenslocked: false,
                screenshotocr: false,
                examTeachers: [],
                examSecurityKey: "oI9xGzHkUFe7Lg2iTXHkYp4pDab3Nvj4kFEOqA93cZE=",
                useExamSections: false, //if false exam section 1 is used and no tabs are displayed
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

                        moodleTestId: null, 
                        moodleDomain: 'eduvidual.at',
                        moodleURL:null, 
                        cmargin: { side: 'right', size: 3 }, 

                        gformsTestId: null,
                        msOfficeFile: null, 
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '16px',
                        audioRepeat: 0,
                        domainname: false,
                        allowedUrl: null,

                        groups: false, 
                        groupA: { users: [], examInstructionFiles: [] }, 
                        groupB: { users: [], examInstructionFiles: [] }
                    },
                    2: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,
                        sectionname: "Abschnitt 2",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        moodleTestId: null, 
                        moodleDomain: 'eduvidual.at',
                        moodleURL:null, 
                        cmargin: { side: 'right', size: 3 }, 

                        gformsTestId: null,
                        msOfficeFile: null, 
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '16px',
                        audioRepeat: 0,
                        domainname: false,
                        allowedUrl: null,
                        groups: false, 
                        groupA: { users: [], examInstructionFiles: [] }, 
                        groupB: { users: [], examInstructionFiles: [] }
                    },
                    3: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,
                        sectionname: "Abschnitt 3",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        moodleTestId: null, 
                        moodleDomain: 'eduvidual.at',
                        moodleURL:null, 
                        cmargin: { side: 'right', size: 3 }, 

                        gformsTestId: null,
                        msOfficeFile: null, 
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '16px',
                        audioRepeat: 0,
                        domainname: false,
                        allowedUrl: null,

                        groups: false, 
                        groupA: { users: [], examInstructionFiles: [] }, 
                        groupB: { users: [], examInstructionFiles: [] }
                    },
                    4: {
                        examtype: 'math',   
                        timelimit: 60,
                        locked: false,
                        sectionname: "Abschnitt 4",
                        spellchecklang: 'de-DE', 
                        suggestions: false, 

                        moodleTestId: null, 
                        moodleDomain: 'eduvidual.at',
                        moodleURL:null, 
                        cmargin: { side: 'right', size: 3 }, 

                        gformsTestId: null,
                        msOfficeFile: null, 
                        linespacing: 2, 
                        languagetool: false,
                        fontfamily: "sans-serif", 
                        fontsize: '16px',
                        audioRepeat: 0,
                        domainname: false,  
                        allowedUrl: null,   
                        
                        groups: false, 
                        groupA: { users: [], examInstructionFiles: [] }, 
                        groupB: { users: [], examInstructionFiles: [] }
                    }
                },                
            }
        };
    },

computed: {
    lockInExammode() {
        if (!this.serverstatus.useExamSections) {
            return this.serverstatus.exammode;
        }
        return this.serverstatus.exammode && this.serverstatus.examSections[this.serverstatus.activeSection].locked;
    },
    
    lockDownload() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return examType === 'eduvidual' || examType === 'gforms' || examType === 'website';
    },
    
    lockPdfSummary() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return examType === 'eduvidual' || examType === 'website' || examType === 'math' || examType === 'microsoft365';
    },
    
    lockSendFile() {
        const examType = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
        return this.studentlist.length === 0 || examType === 'eduvidual' || examType === 'microsoft365';
    }
},
    methods: {
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

        /**
         * Exam Managment functions
         */
        startExam:startExam,                         // enable exam mode 
        endExam:endExam,                             // disable exammode 
        kick: kick,                                  //remove student from exam
        restore: restore,                            //restore focus state for specific student -- we tell the client that his status is restored which will then (on the next update) update it's focus state on the server 
        getFiles:getFiles,                           // get finished exams (ABGABE) from students
        lockscreens:lockscreens,                     // temporarily lock screens
        sendFiles:sendFiles,                         //upload files to all students
        stopserver:stopserver,                       //Stop and Exit Exam Server Instance
        delfolderquestion: delfolderquestion,         // delete contents of studentfolder on student pc
        activateSpellcheckForStudent: activateSpellcheckForStudent,  // activate spellcheck for specific student only
        defineMaterials: defineMaterials,             // define materials for exam
   
        /**
         * Exam Setup Functions
         */
        getTestURL: getTestURL,
        getTestID: getTestID,
        getFormsID: getFormsID,
        configureEditor: configureEditor,




        /**
         * Runs every 4 seconds and fetches the current stundentlist from the backend
         * Handles Student-Widgets (create, delete, update)
         * Checks Screenshots and MSO Share Links
         */
        async fetchInfo() {
            if (!this.config.accessToken &&  this.isExamType("microsoft365")){
                this.config = await ipcRenderer.invoke('getconfigasync')  // this is only needed in order to get the accesstoken from the backend for MSAuthentication
            }
            this.now = new Date().getTime()

            this.hostip = ipcRenderer.sendSync('checkhostip')
            if (!this.hostip) return; 

            this.updateBiPServerInfo(this.bipStatus);


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
                    if ( this.isExamType("microsoft365") && this.config.accessToken && this.serverstatus.examSections[this.serverstatus.activeSection].msOfficeFile){
                        if (!student.status.msofficeshare) {  // this one is late to the party
                            console.log("dashboard @ fetchInfo: this student has no sharing link yet")
                            this.onedriveUploadSingle(student, this.serverstatus.examSections[this.serverstatus.activeSection].msOfficeFile)   // trigger upload of this.serverstatus.msOfficeFile, create sharelink and set student.status.msofficeshare to sharelink
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
                            if (student.token == this.studentwidgets[i].token){ this.studentwidgets[i] = student; }  //now update the entry in the original widgets object
                        }
                    }
                    else {
                        //replace empty widget with student
                        for (let i = 0; i < this.studentwidgets.length; i++){  // we cant use (for .. of) or forEach because it creates a workingcopy of the original object
                            if (!this.studentwidgets[i].clientname){ //clientname == false in an emptyWidget so we found one
                                this.studentwidgets[i] = student; // replace emptywidget
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



        // remove file from group a or b
        handleFileRemove({ group, index }) {
            this.$swal.fire({
                title: this.$t("dashboard.removefile"),
                text: this.$t("dashboard.removefileconfirm"),
                icon: 'warning',
                showCancelButton: true,
                reverseButtons: true,
            }).then(async (result) => {
                if (result.isConfirmed) {
                    if (group === 'A') { this.serverstatus.examSections[this.serverstatus.activeSection].groupA.examInstructionFiles.splice(index, 1); } 
                    else {               this.serverstatus.examSections[this.serverstatus.activeSection].groupB.examInstructionFiles.splice(index, 1); }
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
            if (type === 'editor') this.configureEditor();
            if (type === 'eduvidual') this.getTestID();
            if (type === 'gforms') this.getFormsID();
            if (type === 'website') this.getTestURL();
        },

        // get label for the current exam type
        getSelectedExamTypeLabel() {
            const type = this.serverstatus.examSections[this.serverstatus.activeSection].examtype;
            switch(type) {
            case 'math': return this.$t('dashboard.math');
            case 'editor': return this.$t('dashboard.lang');
            case 'eduvidual': return this.$t('dashboard.eduvidual');
            case 'gforms': return this.$t('dashboard.gforms');
            case 'website': return 'Website';
            case 'microsoft365': return 'Microsoft365';
            case 'rdp': return 'RDP';
            default: return 'Select Type';
            }
        },

        // activate section and check if we need to lock the section (start exam section for all students)
        activateSection(section){
            this.serverstatus.activeSection = section
            this.setServerStatus()

            if (this.serverstatus.exammode && !this.serverstatus.examSections[this.serverstatus.activeSection].locked) {
                this.$swal.fire({
                    title: this.$t("dashboard.examsections"),
                    icon: 'question',
                    text: this.$t("dashboard.examsectionsinfo"),
                    showCancelButton: true,
                    cancelButtonText: this.$t("dashboard.no"),
                    confirmButtonText: this.$t("dashboard.yes"),
                    reverseButtons: true,
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        //inform all students to save current work
                        //inform all students to archive/send current work
                        //wait for all students to finish
                        //activate new section for all student
                        Object.values(this.serverstatus.examSections).forEach(section => {   section.locked = false    })
                        this.serverstatus.examSections[this.serverstatus.activeSection].locked = true
                        this.serverstatus.lockedSection = section
                        this.setServerStatus()
                    }
                })    
            }
        },

        /**
         * triggered when abgabe slider is used in settings dialog
         * starts or stops the autofetch feature
         */
        updateAbgabeInterval() {
            const interval = parseInt(this.serverstatus.abgabeintervalPause, 10); // Ensure it's an integer
            if (interval === 0) {
                console.info("dashboard @ updateAbgabeInterval: stopping submission interval");
                this.abgabeinterval.stop();
            } else {
                console.info("dashboard @ updateAbgabeInterval: setting submission interval to", interval);
                this.abgabeinterval.stop(); // Stop any ongoing interval
                this.abgabeinterval.interval = 60000 * interval; // Convert minutes to milliseconds
                this.abgabeinterval.start();
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
      
        async showDescription(description) {
            this.currentDescription = description;
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
                while (!this.serverstatus.examSections[this.serverstatus.activeSection].msOfficeFile) {
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
        //show pincode 
        showinfo(){
            let info = `<span> IP: <strong>${this.serverip}</strong> \nName: ${this.servername}  \nPin: ${this.serverstatus.pin} </span>`
            this.$swal.fire({ 
                title: `<div style="display: flex; margin-top:0; justify-content: center">
                            <div style="text-align: right; margin-right: 10px; font-weight:normal; font-size: 0.8em;">${this.$t("dashboard.name")}:
                            ${this.$t("dashboard.server")}:
                            ${this.$t("dashboard.pin")}:
                            </div>
                            <div style="text-align: left;font-size: 0.8em;">${this.servername}
                            ${this.serverip}
                            ${this.serverstatus.pin} 

                            </div>
                        </div>`,
                icon: "info",
                customClass: {
                    popup: 'custom-swal2-popup',
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
                title: "Logout",
                icon: 'question',
                text: 'Wollen sie sich ausloggen?',
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

        // we save serverstatus everytime we start an exam - therefore exams can be resumed easily by the teacher if something wicked happens
        getPreviousServerStatus(){
            let result = fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/getserverstatus/${this.servername}/${this.servertoken}`, { method: 'POST', headers: {'Content-Type': 'application/json' },})
            .then( res => res.json())
            .then( async (response) => {
                if (response.serverstatus === false) {
                    this.setServerStatus()  // there is no serverstatus - we need to set it to default
                    return
                }
                this.serverstatus = response.serverstatus // we slowly move things over to a centra serverstatus object
         
                

                if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype === "microsoft365"){  // unfortunately we can't automagically reconnect the teacher without violating privacy
                    this.serverstatus.exammode = false
                    this.serverstatus.examSections[this.serverstatus.activeSection].msOfficeFile = false
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
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle;'>&copy;</span> <span style='font-size:0.8em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
        <a href="https://www.bmbwf.gv.at/Themen/schule/zrp/dibi/foss.html" target="_blank"><img style="width: 230px; opacity:1;" src="./BMBWF_Logo_srgb.png"></a>
                <br>
                <br>
                <a href="https://linux-bildung.at" target="_blank"><img style="width: 50px; opacity:0.7;" src="./osos.svg"></a>   <br>
                <span style="font-size:0.8em"> <a href="https://next-exam.at/#kontakt" target="_blank">next-exam.at</a> </span> <br>
                <span style="font-size:0.8em">Version: ${this.version} ${this.info}</span>
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

        // push user from one group to the other
        quickSetGroup(student){
            // Remove student from groups if present
            const indexA = this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.indexOf(student.clientname);
            const indexB = this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users.indexOf(student.clientname);
            if (indexA > -1) { this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.splice(indexA, 1);  }
            if (indexB > -1) { this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users.splice(indexB, 1);  }
            
            let studentWidget = this.studentwidgets.find(el => el.token === student.token);

            if (student.status.group == "a"){
                //Add and Set         
                this.serverstatus.examSections[this.serverstatus.activeSection].groupB.users.push(student.clientname)  //update group arrays
                this.setStudentStatus({group:"b"}, student.token)  //set student object (and inform student about group)
                this.setServerStatus()
                if(studentWidget){ studentWidget.status.group = "b"}                          
            }
            else {
                //Add and Set
                this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users.push(student.clientname)
                this.setStudentStatus({group:"a"}, student.token) 
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
            this.defaultPrinter = printer
            console.log(`dashboard: selected default printer: ${this.defaultPrinter}`)
            console.log(`dashboard: allow direct print: ${this.directPrintAllowed}`)
        },

        checkforDefaultprinter(){
            if (!this.defaultPrinter){ document.getElementById('directprint').checked = false }
        },

        async hideSetup(){
            if (!this.defaultPrinter){ document.getElementById('directprint').checked = false  }
            document.getElementById("setupoverlay").style.opacity = 0;
            document.getElementById('setupdiv').classList.remove('scaleIn');
            document.getElementById('setupdiv').classList.add('scaleOut');
            await this.sleep(200)  //the transition setting is set to .3s
            document.getElementById("setupoverlay").style.display = "none";
            this.setServerStatus()
        },

        async showSetup(){
            this.availablePrinters = await ipcRenderer.invoke("getprinters")
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
                            this.updateBiPServerInfo(newStatus);
                            this.bipStatus = newStatus;
                        });
                        btnA.dataset.listenerAdded = 'true';
                    }
                }
            });
        },


        toggleBipStatus() {
            const newStatus = this.bipStatus === 'closed' ? 'open' : 'closed';
            this.updateBiPServerInfo(newStatus);
            this.bipStatus = newStatus;
            this.updateBiPServerInfo(newStatus);
        },


         /** 
         * if this is a bip exam configured online that needs students to login into bip too
         * update exam info on server via api
         */
        async updateBiPServerInfo(status){
            if (!this.bipToken || !this.serverstatus.bip) { return }

            //console.log("bip exam - updating server info")
            let payload = {
                teacherIP: this.serverip,
                teacherID: this.bipuserID,   /// wird von student.vue nicht nach dashboard.vue übertragen.. ebenso token
                pin: this.serverstatus.pin,
                status: status,
                examID: this.serverstatus.id
            }

            // if (this.config.development){  // call to demo api
                let url= "http://localhost:3000/teacher"
                fetch(url, {
                    method: "POST",
                    headers: {"Content-Type": "application/json" },
                    body: JSON.stringify(payload) // Daten als JSON-String senden
                })
                .then(response => { return response.json(); } )                  
                .then(data => { 
                   // console.log(data.message, data.data);
                })
                .catch(error => { console.error("Fehler beim API-Aufruf:", error.message);});
            // }
            // else{
            //     //call to real bip api
            // }
        },

        playAudioFile(filecontent, filename){
            document.querySelector("#aplayer").style.display = 'block';
            this.audioSource = filecontent;
            this.audioFilename = filename
            audioPlayer.load(); // Lädt die neue Quelle

        }

    },



    mounted() {  // when ready
        this.$nextTick( async function () { // Code that will run only after the entire view has been rendered
       
            document.querySelector("#statusdiv").style.visibility = "hidden";
           
            await this.getPreviousServerStatus()
            this.fetchInfo()
            this.initializeStudentwidgets()

            this.updateBiPServerInfo(this.bipStatus);

            // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
            this.fetchinterval = new SchedulerService(4000);
            this.fetchinterval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.fetchinterval.start();

            this.abgabeCallback = () => this.getFiles('all');  //selbst wenn 'all' default ist.. über den eventlistener wird das erste attribut zu "event"
            this.abgabeinterval = new SchedulerService(60000 * this.serverstatus.abgabeintervalPause);
            this.abgabeinterval.addEventListener('action',  this.abgabeCallback);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.abgabeinterval.start();

            if (this.abgabeintervalPause == 0 ) { this.abgabeinterval.stop() }

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

        
        ipcRenderer.on('reconnected', (event, student) => {  
            this.$swal.fire({
                    title: this.$t("dashboard.attention"),
                    text: `${student.clientname} hat sich neu verbunden!`,
                    icon: "info"
                })  
        }); 





    },
    beforeUnmount() {  //when leaving
        this.fetchinterval.removeEventListener('action', this.fetchInfo);
        this.fetchinterval.stop() 
        this.abgabeinterval.removeEventListener('action', this.abgabeCallback);
        this.abgabeinterval.stop() 
        document.querySelector("#pdfpreview").removeEventListener("click", this.pdfPreviewEventlisterenCallback);
        document.querySelector("#closefilebrowser").removeEventListener("click", this.fileBrowserEventlistenerCallback);
    }

}
</script>





















<style scoped>

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
    top: 22%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 1000;
    width: 72px; /* Container ist so breit wie die hover-Breite */
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
    display:inline-block;
    width: 128px;
    border-bottom-right-radius: 0px;
    border-bottom-left-radius: 0px;
    color: white;
    font-weight: normal;
    margin-right:4px;
    cursor: pointer;
    height: 22px;
    font-size: 0.8em;
    padding-top: 0px;
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
    width: 200px  ;
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
    z-index: 1999; /* Unter dem Dialog */
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

.widgetbutton {
    background-color: transparent;
}
.widgetbutton:hover {
    filter: brightness(120%);
}

#content {
    background-color: whitesmoke;
}

.infobutton{
    width: 220px;
    min-width: 220px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background-color: whitesmoke;
    cursor: help;
}

#studentslist{
    border-radius: 5px;
    width: 100%;
    height: 90%;
    /* border: 1px solid rgb(99, 187, 175); */
    padding-bottom:100px;
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
    width: 200px  ;
    border-radius: 5px;
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

</style>


<style>
/**in order to override swal settings the css needs to be global not scoped*/
.swal2-popup{
    opacity: 0.9 !important; 
}

.swal2-container {
    backdrop-filter: blur(2px); 
    z-index: 100000 !important;
} 




.my-select{
    font-size: 1.125em;
    margin: 0em 0em 3px;
    min-height: 1.2em;
    padding: 0.5em;
    color: #545454;
    width: 99% !important;
}



.my-title {
    text-align: left;
    font-size: 1.5em;
}

.my-content {
    margin-bottom: 0px;
    overflow:hidden;
}

.my-content h5 {
    font-size: 1em;
    margin-bottom: 0px;
}

.my-content h6 {
   
    margin-bottom: 1px;
    margin-top:8px;
}


.my-custom-input {
    margin-top: 0px !important;
}  

.my-swal2-actions {
    width: 100%;
    margin-left: 1.9em;
  justify-content: flex-start !important; /* Richtet die Buttons linksbündig aus */
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



</style>
