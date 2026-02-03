<template>
    <div class="embed-container" @click.stop>
      
        <ul class="nav nav-tabs position-absolute top-0 start-0 end-0 w-100 bg-white" style="z-index:2000; pointer-events:auto; font-size:1.1rem; height:45px;">

         

      
            <!-- print button -->
            <li class="nav-item" >
                <div class="nav-link btn btn-light btn-sm unstyled" id="printPDF" style="display: inline-flex; height:45px !important;" @click="printBase64()" :title="$t('dashboard.print')">
                    <img src="/src/assets/img/svg/print.svg" class="white" >
                </div>
            </li>

            <!-- download button -->
            <li class="nav-item">
                <div class="nav-link btn btn-light btn-sm unstyled" id="downloadPDF" style="display: inline-flex; height:45px !important;" @click="downloadFile('current')" :title="$t('dashboard.save')">
                    <img src="/src/assets/img/svg/edit-download.svg" class="white">
                 </div>
            </li>
            
          <!-- open button -->
          <li class="nav-item">
                <div class="nav-link btn btn-light btn-sm unstyled" id="openPDF" style="display: inline-flex; height:45px !important;" @click="openFileExternal(currentpreviewPath)" :title="$t('dashboard.open')">
                    <img src="/src/assets/img/svg/stock_exit_up.svg" class="white">
                 </div>
            </li>

            
            <!-- zoom buttons -->
            <!-- <li class="nav-item" id="pdfZoom" style="display:none;">
                <div class="nav-link btn btn-light btn-sm unstyled" style="display:inline-flex;" id="zoomIn" :title="$t('editor.zoomIn')">  <img src="/src/assets/img/svg/zoom-in.svg" class="" ></div>
                <div class="nav-link btn btn-light btn-sm unstyled" style="display:inline-flex;" id="zoomOut" :title="$t('editor.zoomOut')"> <img src="/src/assets/img/svg/zoom-out.svg" class="" ></div>
            </li> -->

            <!-- close button -->
            <li class="nav-item ms-auto">  
                <div type="button" id="closePDF" class="nav-link btn btn-light btn-sm" :title="$t('dashboard.close')" @click.stop="closePane"style="width:40px; height:45px !important;text-align:center; font-weight:bold;">&times;</div> 
            </li>

        </ul>
    
        <embed src="" id="pdfembed" style="width:100%; height:100%; position:relative; top:45px !important;" />
    </div>
  </template>
  
  
  
  <script>
  export default {
    name: 'PdfviewPane',
    props: {
      id: { type: String, default: '' },
      src: { type: String, default: '' },
      currentpreviewPath: { type: String, default: '' },
      currentpreviewBase64: { type: String, default: '' },
    },


    data() {
      return {
      }
    },
    mounted() {
     
    },
    unmounted() {
 
    },
    methods: {
      closePane() { this.$emit('close'); },                                // send 'close' Event
      printBase64() { this.$emit('printBase64', this.currentpreviewBase64); },
      insertImage(selectedFile) { this.$emit('insertImage', selectedFile); },
      downloadFile(file) { this.$emit('downloadFile', file); },
      openFileExternal(path) { this.$emit('openFileExternal', path); }

    }
  }
  </script>

  <style scoped>
    .unstyled{
        box-shadow: none !important;
        padding: 10px !important;
        margin: 0px !important;
        border: none !important;
        border-radius: 0px !important;
        align-items: center !important;
        width: 40px !important;
        height: 40px !important;
        text-align: center !important;
       
    }
    .unstyled img{
        width: 20px !important;
        height: 20px !important;
        margin: 0px !important;
        padding: 0px !important;
    }
    #pdfembed{
        background-repeat: no-repeat;
        background-size: contain;
        background-position: center;
       
    }

</style>
  