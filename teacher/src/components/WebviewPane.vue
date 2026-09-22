<template>
    <div :id="id" v-show="visible" class="position-relative w-100 h-100" :style="paneStyle">
      
        <ul
        class="nav nav-tabs position-absolute top-0 start-0 end-0 w-100 bg-white"
        style="z-index:10001; pointer-events:auto; font-size:1.1rem;"
        @mousedown.stop
        @click.stop
      >

        <li class="nav-item">
          <div
            type="button"
            class="nav-link btn btn-light btn-sm webview-toolbar-btn"
            @click.stop="goHome"
            style="width:40px; text-align:center;"
          >⌂</div>
        </li>
        <li class="nav-item">
          <div
            type="button"
            class="nav-link btn btn-light btn-sm webview-toolbar-btn"
            :disabled="!canGoBack"
            :class="{ disabled: !canGoBack }"
            @click.stop="goBack"
            style="width:40px; text-align:center;"
          >◀</div>
        </li>
        <li class="nav-item">
          <div
            type="button"
            class="nav-link btn btn-light btn-sm webview-toolbar-btn"
            :disabled="!canGoForward"
            :class="{ disabled: !canGoForward }"
            @click.stop="goForward"
            style="width:40px; text-align:center;"
          >▶</div>
        </li>


        <li class="nav-item ms-auto">  <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn"
          @click.stop="closePane"
          style="width:40px; text-align:center; font-weight:bold;"
        >&times;</div> </li>


      </ul>
  
      <webview
        ref="wv"
        :src="src || ''"
        class="position-absolute start-0 w-100 "
        :style="webviewStyle"
      />
    </div>
  </template>
  
  
  
  <script>
  export default {
    name: 'WebviewPane',
    props: {
      id: { type: String, default: '' },
      src: { type: String, default: '' },
      visible: { type: Boolean, default: true },
      allowedUrl: { type: String, default: '' },
      blockExternal: { type: Boolean, default: false },
      paperBackground: { type: Boolean, default: false },
    },


    computed: {
      paneStyle() {
        return this.paperBackground ? { background: '#fff' } : null
      },
      webviewStyle() {
        const style = {
          top: '42px',
          zIndex: 9999,
          height: 'calc(100% - 42px)',
        }
        if (this.paperBackground) style.background = '#fff'
        return style
      },
    },

    data() {
      return {
        canGoBack: false,            // nav state
        canGoForward: false,         // nav state
        lastAllowedUrl: '',          // track last allowedUrl
        disableNavigation: false     // flag to keep buttons disabled
      }
    },
    mounted() {
      this.wv = this.$refs.wv                                         // webview ref
      this.lastAllowedUrl = this.allowedUrl                     // store initial allowedUrl
    
      const updateNav = () => {                                       // refresh nav state
        if (this.lastAllowedUrl !== this.allowedUrl ) {                                 // keep disabled if flag set
          this.canGoBack = false
          this.canGoForward = false
          this.wv.clearHistory()
          this.lastAllowedUrl = this.allowedUrl
        } 
        else {
          this.canGoBack = this.wv?.canGoBack?.() || false            // can go back?
          this.canGoForward = this.wv?.canGoForward?.() || false      // can go forward?
         
        }
      }


      this._onDidStop = () => { updateNav() }                         // after stop loading
      this.wv.addEventListener('did-stop-loading', this._onDidStop)
    },
    unmounted() {
      if (!this.wv) return                                            // guard
      this.wv.removeEventListener('did-stop-loading', this._onDidStop)
    },
    watch: {
    
    },
    methods: {
      goHome() { if (this.allowedUrl) this.wv.loadURL(this.allowedUrl) },   // go to home URL
      goBack() { if (this.wv?.canGoBack?.()) this.wv.goBack() },      // history back
      goForward() { if (this.wv?.canGoForward?.()) this.wv.goForward() }, // history forward
      closePane() { this.$emit('close'); }                                // send 'close' Event
    }
  }
  </script>

<style scoped>
/* Pointer on toolbar; .disabled had pointer-events:none so cursor leaked from webview below */
.webview-toolbar-btn {
  cursor: pointer !important;
}
.webview-toolbar-btn.disabled {
  pointer-events: auto;
  cursor: pointer !important;
}
</style>
