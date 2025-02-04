<template>
    <div class="file-buttons-container">
        <!-- Wenn Gruppen aktiviert sind -->
        <template v-if="examSection.groups">
            <!-- Gruppe A -->
            <div class="group-section">
            <div class="group-label">Gruppe A</div>
            <div v-for="(file, index) in examSection.groupA.examInstructionFiles" :key="'A' + index" class="input-group"  style="">
                <div class="btn btn-sm btn-warning mt-1" @click="removeFile('A', index)" style="padding:4px 8px;">x</div>
                <div class="btn btn-sm btn-secondary mt-1"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
                <div class="btn btn-sm btn-cyan mt-1" style="width:14px; height: 31px;">
                    <div style="writing-mode:vertical-rl; font-size:0.7em; margin-left:-8px; margin-top:0px; color: whitesmoke;">{{ getFileExtension(file.filename) }}</div>
                </div>
                
            </div>
            </div>
    
            <!-- Gruppe B -->
            <div class="group-section">
            <div class="group-label">Gruppe B</div>
            <div v-for="(file, index) in examSection.groupB.examInstructionFiles" :key="'B' + index" class="input-group" style="">
                <div class="btn btn-sm btn-warning mt-1" @click="removeFile('B', index)" style="padding:4px 8px;">x</div>
                <div class="btn btn-sm btn-secondary mt-1"> {{ getFilenameWithoutExtension(file.filename) }} </div> 
                <div class="btn btn-sm btn-cyan mt-1" style="width:14px; height: 31px;"> 
                    <div style="writing-mode:vertical-rl; font-size:0.7em; margin-left:-8px; margin-top:0px; color: whitesmoke;">{{ getFileExtension(file.filename) }}</div>
                </div>
            </div>
            </div>
        </template>
    
        <!-- Wenn keine Gruppen aktiviert sind -->
        <template v-else>
            <div v-for="(file, index) in examSection.groupA.examInstructionFiles":key="index" class="input-group" style="">
            <div class="btn btn-sm btn-warning mt-1" @click="removeFile('A', index)" style="padding:4px 8px;">x</div>
            <div class="btn btn-sm btn-secondary mt-1"> {{ getFilenameWithoutExtension(file.filename) }} </div>   
            <div class="btn btn-sm btn-cyan mt-1" style="width:14px; height: 31px;"> 
                <div style="writing-mode:vertical-rl; font-size:0.7em; margin-left:-8px; margin-top:0px; color: whitesmoke;">{{ getFileExtension(file.filename) }}</div>
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
      }
    }
  }
  </script>
  
  <style scoped>
  .file-buttons-container {
    margin: 10px 0;
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