<template>
    <div class="embed-container" @click.stop>
      
        <ul class="nav nav-tabs position-absolute top-0 start-0 end-0 w-100 bg-white" style="z-index:2000; pointer-events:auto; font-size:1.1rem;">

         
            <!-- insert button -->
            <li v-if="examtype === 'editor' && toolbar.showInsert" class="nav-item">
                <div class="nav-link btn btn-light btn-sm unstyled" id="insert-button" @click="insertImage()" :title="$t('editor.insert')">
                    <img :src="edit_download_img" class="white" />
                </div>
            </li>
      
            <!-- print button -->
            <li v-if="!localLockdown && toolbar.showPrint" class="nav-item">
                <div class="nav-link btn btn-success btn-sm unstyled unstyled-send" id="print-button" @click="printBase64(true)" :title="$t('editor.printToPrinter')">
                    <img :src="print_img" class="white" />
                    <span class="ms-2 send-label">{{ $t('editor.printToPrinter') }}</span>
                </div>
            </li>

            <!-- send button -->
            <li v-if="!localLockdown && toolbar.showSend" class="nav-item">
                <div class="nav-link btn btn-success btn-sm unstyled unstyled-send" id="send-button" @click="printBase64()" :title="$t('editor.send')">
                    <img :src="document_send_img" class="white" />
                    <span class="ms-2 send-label">{{ $t('editor.send') }}</span>
                 </div>
            </li>
            
            <!-- zoom buttons -->
            <li v-show="toolbar.showZoom" class="nav-item" id="pdfZoom">
                <div class="nav-link btn btn-light btn-sm unstyled" style="display:inline-flex;" id="zoomIn" :title="$t('editor.zoomIn')">  <img :src="zoom_in_img" class="" /></div>
                <div class="nav-link btn btn-light btn-sm unstyled" style="display:inline-flex;" id="zoomOut" :title="$t('editor.zoomOut')"> <img :src="zoom_out_img" class="" /></div>
            </li>

            <!-- close button -->
            <li class="nav-item ms-auto">  
                <div type="button" class="nav-link btn btn-light btn-sm" :title="$t('editor.close')" @click.stop="closePane" style="width:40px; height:40px; text-align:center; font-weight:bold;">&times;</div> 
            </li>

        </ul>
    
        <embed src="" id="pdfembed" style="width:100%; height:100%; position:relative; top:40px;" />
    </div>
  </template>
  
  
  
  <script>
  import document_send_img from '/src/assets/img/svg/document-send.svg'
  import edit_download_img from '/src/assets/img/svg/edit-download.svg'
  import print_img from '/src/assets/img/svg/print.svg'
  import zoom_in_img from '/src/assets/img/svg/zoom-in.svg'
  import zoom_out_img from '/src/assets/img/svg/zoom-out.svg'

  export default {
    name: 'PdfviewPane',
    props: {
      localLockdown: { type: Boolean, default: false },
      examtype: { type: String, default: 'math' },
      toolbar: {
        type: Object,
        required: true,
      },
    },


    data() {
      return {
        document_send_img,
        edit_download_img,
        print_img,
        zoom_in_img,
        zoom_out_img
      }
    },
    mounted() {
     
    },
    unmounted() {
 
    },
    methods: {
      closePane() { this.$emit('close'); },                                // send 'close' Event
      printBase64(base64=false) { this.$emit('printBase64', base64); },
      insertImage() { this.$emit('insertImage'); }

    }
  }
  </script>

  <style scoped>
    .unstyled{
        box-shadow: none !important;
        padding: 10px !important;
        margin: 0px !important;
        border: none !important;
        border-radius: 0 !important;
        align-items: center !important;
        width: 40px !important;
        height: 40px !important;
        text-align: center !important;
       
    }
    .unstyled.unstyled-send {
        width: auto !important;
        min-width: 120px !important;
        display: inline-flex !important;
        justify-content: center !important;
        color: #000 !important;
    }
    .unstyled-send .send-label {
        color: #000 !important;
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
  
