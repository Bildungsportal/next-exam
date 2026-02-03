<template>
    <div class="file-buttons-container">
        <!-- Wenn Gruppen aktiviert sind -->
        <template v-if="examSection.groups">
            <!-- Gruppe A -->
            <div class="group-section">
              <div class="group-label">{{$t('dashboard.groupA')}}</div>
              <div v-for="(file, index) in examSection.groupA.examInstructionFiles" :key="'A' + index" class="input-group"  style="">
                  <div v-if="!(file.filetype == 'pdf' && file.IsActiveSheet === true && exammode)" class="btn btn-sm btn-secondary mt-1" @click="removeFile('A', index)" style="padding:4px 8px;">x</div>
                  <div v-else class="btn btn-sm btn-secondary mt-1" style="padding:4px 8px; opacity: 0.5; cursor: not-allowed;" :title="$t('dashboard.cannotDeleteActiveSheet')">x</div>
                  
                  <div v-if="file.filetype == 'pdf' && file.IsActiveSheet === true" class="btn btn-sm btn-warning mt-1 filename-button" :title="file.filename" @click="showBase64PdfInRenderer(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>
                  <div v-else-if="file.filetype == 'pdf'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="showBase64FilePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
                  <div v-else-if="file.filetype == 'image'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="showBase64ImagePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                  <div v-else-if="file.filetype == 'audio'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="playAudioFile(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                  <div v-else-if="file.filetype == 'ggb'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                  <div v-else-if="file.filetype == 'docx'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div>
                  <div v-else-if="file.filetype == 'bak'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div>

                  <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                    <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
                  </div>
              </div>

              <div v-for="(allowedUrl, index) in examSection.groupA.allowedUrls" :key="'allowedUrl' + index" class="input-group" style="">
                  <div class="btn btn-sm btn-secondary mt-1" @click="removeAllowedUrl('A', index)" style="padding:4px 8px;">x</div>
                  <div class="btn btn-sm btn-cyan mt-1 filename-button" :title="allowedUrl" @click="openAllowedUrl(allowedUrl)"> {{ allowedUrl }} </div>
                  <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                      <div class="vertical-text">URL</div>
                  </div>
              </div>


            </div>
    
            <!-- Gruppe B -->
            <div class="group-section">
              <div class="group-label">{{$t('dashboard.groupB')}}</div>
              <div v-for="(file, index) in examSection.groupB.examInstructionFiles" :key="'B' + index" class="input-group" style="">
                  <div v-if="!(file.filetype == 'pdf' && file.IsActiveSheet === true && exammode)" class="btn btn-sm btn-secondary mt-1" @click="removeFile('B', index)" style="padding:4px 8px;">x</div>
                  <div v-else class="btn btn-sm btn-secondary mt-1" style="padding:4px 8px; opacity: 0.5; cursor: not-allowed;" :title="$t('dashboard.cannotDeleteActiveSheet')">x</div>

                  <div v-if="file.filetype == 'pdf' && file.IsActiveSheet === true" class="btn btn-sm btn-warning mt-1 filename-button" :title="file.filename" @click="showBase64PdfInRenderer(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>
                  <div v-else-if="file.filetype == 'pdf'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="showBase64FilePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
                  <div v-else-if="file.filetype == 'image'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="showBase64ImagePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                  <div v-else-if="file.filetype == 'audio'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="playAudioFile(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                  <div v-else-if="file.filetype == 'ggb'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                  <div v-else-if="file.filetype == 'docx'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div>
                  <div v-else-if="file.filetype == 'bak'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div>
                  
                  <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                    <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
                  </div>
              </div>

              <div v-for="(allowedUrl, index) in examSection.groupB.allowedUrls" :key="'allowedUrl' + index" class="input-group" style="">
                  <div class="btn btn-sm btn-secondary mt-1" @click="removeAllowedUrl('B', index)" style="padding:4px 8px;">x</div>
                  <div class="btn btn-sm btn-cyan mt-1 filename-button" :title="allowedUrl" @click="openAllowedUrl(allowedUrl)"> {{ allowedUrl }} </div>
                  <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                      <div class="vertical-text">URL</div>
                  </div>
              </div>



            </div>
        </template>
    
        <!-- Wenn keine Gruppen aktiviert sind -->
        <template v-else>
            <div v-for="(file, index) in examSection.groupA.examInstructionFiles":key="index" class="input-group" style="">
            <div v-if="!(file.filetype == 'pdf' && file.IsActiveSheet === true && exammode)" class="btn btn-sm btn-secondary mt-1" @click="removeFile('A', index)" style="padding:4px 8px;">x</div>
            <div v-else class="btn btn-sm btn-secondary mt-1" style="padding:4px 8px; opacity: 0.5; cursor: not-allowed;" :title="$t('dashboard.cannotDeleteActiveSheet')">x</div>
 
                <div v-if="file.filetype == 'pdf' && file.IsActiveSheet === true" class="btn btn-sm btn-warning mt-1 filename-button" :title="file.filename" @click="showBase64PdfInRenderer(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>
                <div v-else-if="file.filetype == 'pdf'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="showBase64FilePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
                <div v-else-if="file.filetype == 'image'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="showBase64ImagePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                <div v-else-if="file.filetype == 'audio'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="playAudioFile(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                <div v-else-if="file.filetype == 'ggb'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                <div v-else-if="file.filetype == 'docx'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div>
                <div v-else-if="file.filetype == 'bak'" class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click=""> {{ getFilenameWithoutExtension(file.filename) }} </div>

              <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                  <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
              </div>
            </div>


            <div v-for="(allowedUrl, index) in examSection.groupA.allowedUrls" :key="'allowedUrl' + index" class="input-group" style="">
                <div class="btn btn-sm btn-secondary mt-1" @click="removeAllowedUrl('A', index)" style="padding:4px 8px;">x</div>
                <div class="btn btn-sm btn-cyan mt-1 filename-button" :title="allowedUrl" @click="openAllowedUrl(allowedUrl)"> {{ allowedUrl }} </div>
                <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                    <div class="vertical-text">URL</div>
                </div>
            </div>

        </template>
    </div>
</template>
  










  <script>
  export default {
    name: 'MaterialsList',
    props: {
      examSection: {
        type: Object,
        required: true
      },
      exammode: {
        type: Boolean,
        default: false
      }
    },
    methods: {
      getFileExtension(filename) {
        if (!filename || typeof filename !== 'string') {
          return '';
        }
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toUpperCase() : '';
      },
      
      getFilenameWithoutExtension(filename) {
        if (!filename || typeof filename !== 'string') {
          return filename || '';
        }
        const parts = filename.split('.');
        return parts.length > 1 ? parts.slice(0, -1).join('.') : filename;
      },
      
      removeFile(group, index) {
        this.$emit('remove-file', { group, index });
      },

      showBase64FilePreview(base64, filename){
        this.$emit('show-preview', base64, filename);
      },

      showBase64PdfInRenderer(base64, filename){
        this.$emit('show-pdf-in-renderer', base64, filename);
      },

      showBase64ImagePreview(base64, filename){
        this.$emit('show-image-preview', base64, filename);
      },

      playAudioFile(base64, filename){
        this.$emit('play-audio-file', base64, filename);
      },

      openAllowedUrl(allowedUrl){
        this.$emit('open-allowed-url', allowedUrl);
      },

      removeAllowedUrl(index){
        this.$emit('remove-allowed-url', index);
      }

    }
  }
  </script>
  
  <style scoped>



.extension-button {
    width: 14px;
    height: 31px;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}

.vertical-text {
    writing-mode: vertical-rl;
    font-size: 0.7em;
    color: whitesmoke;
    text-align: center;
    transform: translateX(-10%); /* Optional: feinere Zentrierung */
}







  .file-buttons-container {
    margin: 10px 0;
  }

  .filename-button {
    max-width: 158px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .group-section {
    margin-bottom: 15px;
  }
  
  .group-label {
    font-weight: normal;
    font-size: 0.9em;
  }
  
  .input-group {
    margin-right: 10px;
  }
  
  .btn-danger {
    padding: 0 6px;
  }
  </style>