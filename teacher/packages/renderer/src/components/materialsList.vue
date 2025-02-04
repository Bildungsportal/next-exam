<template>
    <div class="file-buttons-container">
        <!-- Wenn Gruppen aktiviert sind -->
        <template v-if="examSection.groups">
            <!-- Gruppe A -->
            <div class="group-section">
            <div class="group-label">Gruppe A</div>
            <div v-for="(file, index) in examSection.groupA.examInstructionFiles" :key="'A' + index" class="input-group"  style="">
                <div class="btn btn-sm btn-secondary mt-1" @click="removeFile('A', index)" style="padding:4px 8px;">x</div>
                <div class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="getFileExtension(file.filename).toLowerCase() === 'pdf' ? showBase64FilePreview(file.filecontent, file.filename) : showBase64ImagePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
                <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                  <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
              </div>
            </div>
            </div>
    
            <!-- Gruppe B -->
            <div class="group-section">
            <div class="group-label">Gruppe B</div>
            <div v-for="(file, index) in examSection.groupB.examInstructionFiles" :key="'B' + index" class="input-group" style="">
                <div class="btn btn-sm btn-secondary mt-1" @click="removeFile('B', index)" style="padding:4px 8px;">x</div>
                <div class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="getFileExtension(file.filename).toLowerCase() === 'pdf' ? showBase64FilePreview(file.filecontent, file.filename) : showBase64ImagePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                  <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
              </div>
            </div>
            </div>
        </template>
    
        <!-- Wenn keine Gruppen aktiviert sind -->
        <template v-else>
            <div v-for="(file, index) in examSection.groupA.examInstructionFiles":key="index" class="input-group" style="">
            <div class="btn btn-sm btn-secondary mt-1" @click="removeFile('A', index)" style="padding:4px 8px;">x</div>
            <div class="btn btn-sm btn-cyan mt-1 filename-button" :title="file.filename" @click="getFileExtension(file.filename).toLowerCase() === 'pdf' ? showBase64FilePreview(file.filecontent, file.filename) : showBase64ImagePreview(file.filecontent, file.filename)"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
            <div class="btn btn-sm btn-teal mt-1 extension-button"> 
                  <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
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
      }
    },
    methods: {
      getFileExtension(filename) {
        return filename.split('.').pop().toUpperCase();
      },
      
      getFilenameWithoutExtension(filename) {
        return filename.split('.').slice(0, -1).join('.');
      },
      
      removeFile(group, index) {
        this.$emit('remove-file', { group, index });
      },

      showBase64FilePreview(base64, filename){
        this.$emit('show-preview', base64, filename);
      },

      showBase64ImagePreview(base64, filename){
        this.$emit('show-image-preview', base64, filename);
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