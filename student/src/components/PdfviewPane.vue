<template>
    <div class="embed-container" @click.stop>
      
        <ul class="nav nav-tabs position-absolute top-0 start-0 end-0 w-100 bg-white" style="z-index:2000; pointer-events:auto; font-size:1.1rem;">

         
            <!-- insert button -->
            <li class="nav-item" v-if="examtype == 'editor'">
                <div class="nav-link btn btn-light btn-sm unstyled" id="insert-button" style="display: inline-flex" @click="insertImage(selectedFile)" :title="$t('editor.insert')">
                    <img src="/src/assets/img/svg/edit-download.svg" class="white" >
                </div>
            </li>
      
            <!-- print button -->
            <li class="nav-item" v-if="!localLockdown">
                <div class="nav-link btn btn-light btn-sm unstyled" id="print-button" style="display: inline-flex" @click="printBase64(true)" :title="$t('editor.print')">
                    <img src="/src/assets/img/svg/print.svg" class="white" >
                </div>
            </li>

            <!-- send button -->
            <li class="nav-item" v-if="!localLockdown">
                <div class="nav-link btn btn-light btn-sm unstyled" id="send-button" style="display: inline-flex" @click="printBase64()" :title="$t('editor.send')">
                    <img src="/src/assets/img/svg/document-send.svg" class="white">
                 </div>
            </li>
            
            <!-- zoom buttons -->
            <li class="nav-item" id="pdfZoom" style="display:none;">
                <div class="nav-link btn btn-light btn-sm unstyled" style="display:inline-flex;" id="zoomIn" :title="$t('editor.zoomIn')">  <img src="/src/assets/img/svg/zoom-in.svg" class="" ></div>
                <div class="nav-link btn btn-light btn-sm unstyled" style="display:inline-flex;" id="zoomOut" :title="$t('editor.zoomOut')"> <img src="/src/assets/img/svg/zoom-out.svg" class="" ></div>
            </li>

            <!-- close button -->
            <li class="nav-item ms-auto">  
                <div type="button" class="nav-link btn btn-light btn-sm" :title="$t('editor.close')" @click.stop="closePane"style="width:40px; height:40px; text-align:center; font-weight:bold;">&times;</div> 
            </li>

        </ul>
    
        <embed src="" id="pdfembed" style="width:100%; height:100%; position:relative; top:40px;" />
    </div>
  </template>
  
  
  
  <script>
  export default {
    name: 'PdfviewPane',
    props: {
      id: { type: String, default: '' },
      src: { type: String, default: '' },
      localLockdown: { type: Boolean, default: false },
      examtype: { type: String, default: 'math' },
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
      printBase64(base64=false) { this.$emit('printBase64', base64); },
      insertImage(selectedFile) { this.$emit('insertImage', selectedFile); }

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


</style>
  