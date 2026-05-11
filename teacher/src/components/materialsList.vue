<template>
    <div class="file-buttons-container">
        <!-- Wenn Gruppen aktiviert sind -->
        <template v-if="examSection.groups">
            <!-- Gruppe A: first row = pill + choose or first item; no group title -->
            <div class="group-section">
              <div class="materials-group-stack">
              <template v-if="groupAMaterialCount === 0">
              <div class="materials-pick-row">
                <span class="materials-group-pill">A</span>
                <button type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="emitChooseMaterials('a')">
                  <span class="sidebar-pick-btn__label">{{ $t('dashboard.materialsChoosePlaceholder') }}</span>
                  <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                </button>
              </div>
              </template>
              <template v-else>
              <div v-for="(file, index) in examSection.groupA.examInstructionFiles" :key="'A' + index" class="materials-item-row materials-file-row">
                  <span v-if="index === 0" class="materials-group-pill">A</span>
                  <span v-else class="materials-pick-spacer" aria-hidden="true"></span>
                  <div class="btn-group materials-filegroup" role="group">
                  <div class="btn btn-sm btn-teal extension-button">
                    <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
                  </div>
                  <div v-if="file.filetype == 'pdf'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="showBase64FilePreview(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'image'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="showBase64ImagePreview(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'audio'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="playAudioFile(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'ggb'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'docx'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'odt'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'htm'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <button type="button" class="btn btn-sm btn-secondary materials-remove" :title="$t('dashboard.removefile')" @click="removeFile('A', index)"><span class="remove-x">&times;</span></button>
                  </div>
              </div>

              <div v-for="(allowedUrl, index) in examSection.groupA.allowedUrls" :key="'allowedUrl' + index" class="materials-item-row materials-url-row">
                  <span v-if="examSection.groupA.examInstructionFiles.length === 0 && index === 0" class="materials-group-pill">A</span>
                  <span v-else class="materials-pick-spacer" aria-hidden="true"></span>
                  <div class="btn-group materials-filegroup" role="group">
                  <div class="btn btn-sm btn-teal extension-button">
                      <div class="vertical-text">URL</div>
                  </div>
                  <div class="btn btn-sm btn-cyan filename-button url-display-button text-truncate" :title="getUrlTooltip(allowedUrl)" @click="openAllowedUrl(allowedUrl)"><span class="materials-filename-truncate">{{ getUrlDisplay(allowedUrl) }}</span></div>
                  <div v-if="getUrlFlag(allowedUrl, 'blockSubdomains')" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubdomainsInfo')"><span class="sd-sf-stack">SD</span></div>
                  <div v-if="getUrlFlag(allowedUrl, 'blockSubfolders')" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubfoldersInfo')"><span class="sd-sf-stack">SF</span></div>
                  <button type="button" class="btn btn-sm btn-secondary materials-remove" :title="$t('dashboard.removefile')" @click="removeAllowedUrl('A', index)"><span class="remove-x">&times;</span></button>
                  </div>
              </div>

              <div class="materials-pick-row">
                <span class="materials-pick-spacer" aria-hidden="true"></span>
                <button type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="emitChooseMaterials('a')">
                  <span class="sidebar-pick-btn__label">{{ $t('dashboard.materialsChoosePlaceholder') }}</span>
                  <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                </button>
              </div>
              </template>
              </div>

            </div>

            <!-- Gruppe B: first row = pill + choose or first item; no group title -->
            <div class="group-section">
              <div class="materials-group-stack">
              <template v-if="groupBMaterialCount === 0">
              <div class="materials-pick-row">
                <span class="materials-group-pill materials-group-pill--b">B</span>
                <button type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="emitChooseMaterials('b')">
                  <span class="sidebar-pick-btn__label">{{ $t('dashboard.materialsChoosePlaceholder') }}</span>
                  <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                </button>
              </div>
              </template>
              <template v-else>
              <div v-for="(file, index) in examSection.groupB.examInstructionFiles" :key="'B' + index" class="materials-item-row materials-file-row">
                  <span v-if="index === 0" class="materials-group-pill materials-group-pill--b">B</span>
                  <span v-else class="materials-pick-spacer" aria-hidden="true"></span>
                  <div class="btn-group materials-filegroup" role="group">
                  <div class="btn btn-sm btn-teal extension-button">
                    <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
                  </div>
                  <div v-if="file.filetype == 'pdf'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="showBase64FilePreview(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'image'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="showBase64ImagePreview(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'audio'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="playAudioFile(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'ggb'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'docx'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'odt'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <div v-else-if="file.filetype == 'htm'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                  <button type="button" class="btn btn-sm btn-secondary materials-remove" :title="$t('dashboard.removefile')" @click="removeFile('B', index)"><span class="remove-x">&times;</span></button>
                  </div>
              </div>

              <div v-for="(allowedUrl, index) in examSection.groupB.allowedUrls" :key="'allowedUrl' + index" class="materials-item-row materials-url-row">
                  <span v-if="examSection.groupB.examInstructionFiles.length === 0 && index === 0" class="materials-group-pill materials-group-pill--b">B</span>
                  <span v-else class="materials-pick-spacer" aria-hidden="true"></span>
                  <div class="btn-group materials-filegroup" role="group">
                  <div class="btn btn-sm btn-teal extension-button">
                      <div class="vertical-text">URL</div>
                  </div>
                  <div class="btn btn-sm btn-cyan filename-button url-display-button text-truncate" :title="getUrlTooltip(allowedUrl)" @click="openAllowedUrl(allowedUrl)"><span class="materials-filename-truncate">{{ getUrlDisplay(allowedUrl) }}</span></div>
                  <div v-if="getUrlFlag(allowedUrl, 'blockSubdomains')" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubdomainsInfo')"><span class="sd-sf-stack">SD</span></div>
                  <div v-if="getUrlFlag(allowedUrl, 'blockSubfolders')" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubfoldersInfo')"><span class="sd-sf-stack">SF</span></div>
                  <button type="button" class="btn btn-sm btn-secondary materials-remove" :title="$t('dashboard.removefile')" @click="removeAllowedUrl('B', index)"><span class="remove-x">&times;</span></button>
                  </div>
              </div>

              <div class="materials-pick-row">
                <span class="materials-pick-spacer" aria-hidden="true"></span>
                <button type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="emitChooseMaterials('b')">
                  <span class="sidebar-pick-btn__label">{{ $t('dashboard.materialsChoosePlaceholder') }}</span>
                  <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                </button>
              </div>
              </template>
              </div>

            </div>
        </template>
    
        <!-- Wenn keine Gruppen aktiviert sind -->
        <template v-else>
            <div class="materials-group-stack">
              <template v-if="groupAMaterialCount === 0">
                <div class="materials-pick-row">
                    <span class="materials-group-pill materials-group-pill--ab" aria-label="A/B">AB</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="emitChooseMaterials('all')">
                      <span class="sidebar-pick-btn__label">{{ $t('dashboard.materialsChoosePlaceholder') }}</span>
                      <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                    </button>
                </div>
              </template>

              <template v-else>
                <div v-for="(file, index) in examSection.groupA.examInstructionFiles" :key="index" class="materials-item-row materials-file-row">
                    <span v-if="index === 0" class="materials-group-pill materials-group-pill--ab" aria-label="A/B">AB</span>
                    <span v-else class="materials-pick-spacer" aria-hidden="true"></span>
                    <div class="btn-group materials-filegroup" role="group">
                    <div class="btn btn-sm btn-teal extension-button">
                      <div class="vertical-text">{{ getFileExtension(file.filename) }}</div>
                    </div>
                    <div v-if="file.filetype == 'pdf'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="showBase64FilePreview(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <div v-else-if="file.filetype == 'image'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="showBase64ImagePreview(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <div v-else-if="file.filetype == 'audio'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click="playAudioFile(file.filecontent, file.filename)"><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <div v-else-if="file.filetype == 'ggb'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <div v-else-if="file.filetype == 'docx'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <div v-else-if="file.filetype == 'odt'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <div v-else-if="file.filetype == 'htm'" class="btn btn-sm btn-cyan filename-button text-truncate" :title="file.filename" @click=""><span class="materials-filename-truncate">{{ getFilenameWithoutExtension(file.filename) }}</span></div>
                    <button type="button" class="btn btn-sm btn-secondary materials-remove" :title="$t('dashboard.removefile')" @click="removeFile('A', index)"><span class="remove-x">&times;</span></button>
                    </div>
                </div>

                <div v-for="(allowedUrl, index) in examSection.groupA.allowedUrls" :key="'allowedUrl' + index" class="materials-item-row materials-url-row">
                    <span v-if="examSection.groupA.examInstructionFiles.length === 0 && index === 0" class="materials-group-pill materials-group-pill--ab" aria-label="A/B">AB</span>
                    <span v-else class="materials-pick-spacer" aria-hidden="true"></span>
                    <div class="btn-group materials-filegroup" role="group">
                    <div class="btn btn-sm btn-teal extension-button">
                        <div class="vertical-text">URL</div>
                    </div>
                    <div class="btn btn-sm btn-cyan filename-button url-display-button text-truncate" :title="getUrlTooltip(allowedUrl)" @click="openAllowedUrl(allowedUrl)"><span class="materials-filename-truncate">{{ getUrlDisplay(allowedUrl) }}</span></div>
                    <div v-if="getUrlFlag(allowedUrl, 'blockSubdomains')" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubdomainsInfo')"><span class="sd-sf-stack">SD</span></div>
                    <div v-if="getUrlFlag(allowedUrl, 'blockSubfolders')" class="btn btn-sm btn-warning sd-sf-btn" :title="$t('dashboard.blockSubfoldersInfo')"><span class="sd-sf-stack">SF</span></div>
                    <button type="button" class="btn btn-sm btn-secondary materials-remove" :title="$t('dashboard.removefile')" @click="removeAllowedUrl('A', index)"><span class="remove-x">&times;</span></button>
                    </div>
                </div>

                <div class="materials-pick-row">
                    <span class="materials-pick-spacer" aria-hidden="true"></span>
                    <button type="button" class="btn btn-sm btn-outline-secondary sidebar-pick-btn" @click="emitChooseMaterials('all')">
                      <span class="sidebar-pick-btn__label">{{ $t('dashboard.materialsChoosePlaceholder') }}</span>
                      <span class="sidebar-pick-btn__plus" aria-hidden="true">+</span>
                    </button>
                </div>
              </template>
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
    computed: {
      groupAMaterialCount() {
        const g = this.examSection?.groupA;
        if (!g) return 0;
        return (g.examInstructionFiles?.length || 0) + (g.allowedUrls?.length || 0);
      },
      groupBMaterialCount() {
        const g = this.examSection?.groupB;
        if (!g) return 0;
        return (g.examInstructionFiles?.length || 0) + (g.allowedUrls?.length || 0);
      },
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

      removeAllowedUrl(group, index){
        this.$emit('remove-allowed-url', group, index);
      },

      getUrlDisplay(allowedUrl) {
        return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
      },

      getUrlTooltip(allowedUrl) {
        if (typeof allowedUrl !== 'object') return allowedUrl;
        let tip = allowedUrl.url;
        if (allowedUrl.blockSubdomains) tip += ' [SD]';
        if (allowedUrl.blockSubfolders) tip += ' [SF]';
        return tip;
      },

      getUrlFlag(allowedUrl, flag) {
        return typeof allowedUrl === 'object' && allowedUrl[flag];
      },

      emitChooseMaterials(group) {
        this.$emit('choose-materials', group);
      }

    }
  }
  </script>
  
  <style scoped>



.extension-button {
    width: 14px;
    height: 32px;
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
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .filename-button {
    max-width: 158px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Ellipsis needs a block/flex child: raw text in .btn inline-flex does not truncate reliably */
  .materials-filename-truncate {
    display: block;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .url-display-button {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 280px;
    text-align: left;
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
    background-color: #ffc107;
    border-color: #ffc107;
    color: #212529;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: default;
  }

  .sd-sf-btn:hover {
    background-color: #e0a800;
    border-color: #d39e00;
    color: #212529;
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

  .remove-x {
    position: absolute;
    left: 50%;
    top: 50%;
    line-height: 1;
    transform: translate(-50%, -55%);
  }
  
  .group-section {
    margin-bottom: 0.65rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .materials-group-pill {
    flex: 0 0 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(165deg, #0dcaf0 0%, #0a9cb8 100%);
    border-radius: 5px;
    line-height: 1;
    user-select: none;
    height: 32px;
  }

  .materials-group-pill--b {
    background: linear-gradient(165deg, #ffc107 0%, #d39e00 100%);
    color: #212529;
  }

  .materials-group-pill--ab {
    background: linear-gradient(135deg, var(--bs-info) 0 50%, var(--bs-warning) 50% 100%);
    color: var(--bs-dark);
    border: 0px solid rgba(255, 255, 255, 0.12);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
    transform: translateY(-0.5px);
  }

  .materials-group-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .materials-item-row {
    display: flex;
    align-items: stretch;
    gap: 6px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .materials-filegroup {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    align-items: stretch;
  }

  .materials-filegroup .filename-button {
    max-width: none;
    flex: 1 1 0%;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .materials-filegroup > .btn.filename-button,
  .materials-filegroup > .btn.url-display-button {
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .materials-filegroup .url-display-button {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .materials-filegroup .sd-sf-btn {
    flex-shrink: 0;
  }

  .materials-filegroup > .materials-remove.btn {
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

  /* btn-group gives children flex:1 1 auto — lock typ column to fixed narrow width */
  .materials-filegroup > .extension-button.btn {
    flex: 0 0 14px;
    min-width: 14px;
    max-width: 14px;
    width: 14px;
    box-sizing: border-box;
  }

  .materials-pick-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 0;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: visible;
    box-sizing: border-box;
  }

  .materials-pick-spacer {
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    min-height: 32px;
    align-self: center;
  }

  .input-group {
    margin-right: 10px;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
  }

  .input-group .filename-button.text-truncate,
  .input-group .url-display-button.text-truncate {
    flex: 1 1 0%;
    min-width: 0;
    max-width: 100%;
    display: flex !important;
    align-items: center;
    overflow: hidden;
  }
  
  .btn-danger {
    padding: 0 6px;
  }
  </style>