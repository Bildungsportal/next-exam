<template>
  <div :id="id" v-show="visible" class="position-relative w-100">
    
      <ul
      class="nav nav-tabs position-absolute top-0 start-0 end-0 w-100 bg-white"
      style="z-index:2000; pointer-events:auto; font-size:1.1rem;"
      @mousedown.stop
      @click.stop
    >

      <li class="nav-item">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm"
          @click.stop="goHome"
          style="width:40px; text-align:center;"
        >⌂</div>
      </li>
      <li class="nav-item">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm"
          :disabled="!canGoBack"
          :class="{ disabled: !canGoBack }"
          @click.stop="goBack"
          style="width:40px; text-align:center;"
        >◀</div>
      </li>
      <li class="nav-item">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm"
          :disabled="!canGoForward"
          :class="{ disabled: !canGoForward }"
          @click.stop="goForward"
          style="width:40px; text-align:center;"
        >▶</div>
      </li>


      <li class="nav-item ms-auto">  <div
        type="button"
        class="nav-link btn btn-light btn-sm"
        @click.stop="closePane"
        style="width:40px; text-align:center; font-weight:bold;"
      >&times;</div> </li>


    </ul>

    <webview
      ref="wv"
      id="safebrowser"
      :src="src || ''"
      class="position-absolute start-0 w-100 "
      style="top:42px; z-index:10000; height:calc(100% - 42px);"
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
  },


  data() {
    return {
      canGoBack: false,            // nav state
      canGoForward: false,         // nav state
      lastAllowedUrl: '',          // track last allowedUrl
      disableNavigation: false,    // flag to keep buttons disabled
      _onDidStop: null,            // store listener reference for cleanup
      _onDomReady: null,           // store listener reference for cleanup
      _onUnhandledRejection: null, // store unhandled rejection handler for cleanup
      _onDidFailLoad: null,        // store did-fail-load handler for cleanup
      _onDidFailProvisionalLoad: null // store did-fail-provisional-load handler for cleanup
    }
  },
  mounted() {
    // Add unhandled rejection handler to catch WebView errors
    this._onUnhandledRejection = (event) => {
      const reason = event?.reason;
      const message = typeof reason === 'string' ? reason : reason && reason.message;
      if (message && message.includes('GUEST_VIEW_MANAGER_CALL')) {
        event.preventDefault(); // Suppress WebView guest view manager errors
        return;
      }
    };
    window.addEventListener('unhandledrejection', this._onUnhandledRejection);
    
    this.$nextTick(() => {
      this.wv = this.$refs.wv                                         // webview ref
      this.lastAllowedUrl = this.allowedUrl                     // store initial allowedUrl
    
      const updateNav = () => {                                       // refresh nav state
        if (this.lastAllowedUrl !== this.allowedUrl ) {                                 // keep disabled if flag set
          this.canGoBack = false
          this.canGoForward = false
          this.wv?.clearHistory?.()
          this.lastAllowedUrl = this.allowedUrl
        } 
        else {
          this.canGoBack = this.wv?.canGoBack?.() || false            // can go back?
          this.canGoForward = this.wv?.canGoForward?.() || false      // can go forward?
        
        }
      }


      this._onDidStop = () => { updateNav() }                         // after stop loading
      this.wv?.addEventListener('did-stop-loading', this._onDidStop)

      // Suppress common WebView load errors
      const suppressCodes = [-3, -100, -101, -105];
      this._onDidFailLoad = (event) => {
        if (suppressCodes.includes(event.errorCode)) {
          event.preventDefault();
        }
      };
      this._onDidFailProvisionalLoad = (event) => {
        if (suppressCodes.includes(event.errorCode)) {
          event.preventDefault();
        }
      };
      this.wv?.addEventListener('did-fail-load', this._onDidFailLoad);
      this.wv?.addEventListener('did-fail-provisional-load', this._onDidFailProvisionalLoad);

      // open links in same WebView (target="_blank")
      this._onDomReady = () => {
        this.wv?.executeJavaScript(`
          document.addEventListener('click', (e) => {
            const a = e.target.closest('a[target="_blank"]');
            if (!a) return;
            e.preventDefault();
            window.location.href = a.href; // open in same WebView
          });
        `);
      };
      this.wv?.addEventListener('dom-ready', this._onDomReady);
    })
  },
  unmounted() {
    // Remove unhandled rejection handler
    if (this._onUnhandledRejection) {
      window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
    }
    
    if (!this.wv) return                                            // guard
    if (this._onDidStop) {
      this.wv?.removeEventListener('did-stop-loading', this._onDidStop)
    }
    if (this._onDomReady) {
      this.wv?.removeEventListener('dom-ready', this._onDomReady)
    }
    if (this._onDidFailLoad) {
      this.wv?.removeEventListener('did-fail-load', this._onDidFailLoad)
    }
    if (this._onDidFailProvisionalLoad) {
      this.wv?.removeEventListener('did-fail-provisional-load', this._onDidFailProvisionalLoad)
    }
  },
  watch: {
  
  },
  methods: {
    goHome() {
       if (this.allowedUrl) this.wv?.loadURL(this.allowedUrl) 
      },   // go to home URL
    goBack() { if (this.wv?.canGoBack?.()) this.wv?.goBack() },      // history back
    goForward() { if (this.wv?.canGoForward?.()) this.wv?.goForward() }, // history forward
    closePane() { this.$emit('close'); }                                // send 'close' Event
  }
}
</script>
