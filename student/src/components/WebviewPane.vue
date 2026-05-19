<template>
  <div v-show="visible" :id="id" class="position-relative nx-webview-pane-host">
    <div class="nx-webview-pane-fill">
      <ul
      class="nav nav-tabs d-flex align-items-stretch flex-nowrap position-absolute start-0 end-0 w-100 bg-white"
      style="top: var(--nx-preview-top-offset, 0px); z-index:2000; pointer-events:auto; font-size:1.1rem;"
      @mousedown.stop
      @click.stop
    >

      <li class="nav-item d-flex">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn"
          @click.stop="goHome"
          style="width:40px; text-align:center;"
        >⌂</div>
      </li>
      <li class="nav-item d-flex">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn"
          :disabled="!canGoBack"
          :class="{ disabled: !canGoBack }"
          @click.stop="goBack"
          style="width:40px; text-align:center;"
        >◀</div>
      </li>
      <li class="nav-item d-flex">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn"
          :disabled="!canGoForward"
          :class="{ disabled: !canGoForward }"
          @click.stop="goForward"
          style="width:40px; text-align:center;"
        >▶</div>
      </li>

      <li class="nav-item d-flex">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn"
          :disabled="zoomPercent <= zoomMin"
          :class="{ disabled: zoomPercent <= zoomMin }"
          :title="$t('webview.zoomout')"
          @click.stop="zoomOut"
          style="width:40px; text-align:center;"
        >−</div>
      </li>
      <li class="nav-item d-flex">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn"
          :disabled="zoomPercent >= zoomMax"
          :class="{ disabled: zoomPercent >= zoomMax }"
          :title="$t('webview.zoomin')"
          @click.stop="zoomIn"
          style="width:40px; text-align:center;"
        >+</div>
      </li>
      <li class="nav-item d-flex">
        <div
          type="button"
          class="nav-link btn btn-light btn-sm webview-toolbar-btn webview-zoom-pct"
          :title="$t('webview.zoomreset')"
          @click.stop="zoomReset"
        >{{ zoomPercent }}%</div>
      </li>


      <li v-if="showClose" class="nav-item ms-auto d-flex">  <div
        type="button"
        class="nav-link btn btn-light btn-sm webview-toolbar-btn"
        @click.stop="closePane"
        style="width:40px; text-align:center; font-weight:bold;"
      >&times;</div> </li>


    </ul>

    <webview
      ref="wv"
      id="safebrowser"
      :src="src || ''"
      class="position-absolute start-0 end-0 w-100"
      style="top:calc(42px + var(--nx-preview-top-offset, 0px)); z-index:10000; height:calc(100% - 42px - var(--nx-preview-top-offset, 0px)); border:0; min-width:0;"
    />
    </div>
  </div>
</template>



<script>
import { applyPreviewWebviewHostLayout } from '../utils/commonMethods.js'

export default {
  name: 'WebviewPane',
  props: {
    id: { type: String, default: '' },
    src: { type: String, default: '' },
    visible: { type: Boolean, default: false },
    allowedUrl: { type: String, default: '' },
    blockExternal: { type: Boolean, default: false },
    splitview: { type: Boolean, default: false },
    showClose: { type: Boolean, default: true },
  },


  data() {
    return {
      zoomPercent: 100,            // guest zoom via webview.setZoomFactor (percent / 100)
      zoomMin: 70,
      zoomMax: 160,
      zoomStep: 10,
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

      // Suppress common WebView load errors and subframe errors
      const suppressCodes = [-3, -100, -101, -105];
      this._onDidFailLoad = (event) => {
        // Silently suppress subframe errors and common error codes
        if (!event.isMainFrame || suppressCodes.includes(event.errorCode)) {
          event.preventDefault();
        }
      };
      this._onDidFailProvisionalLoad = (event) => {
        // Silently suppress subframe errors and common error codes
        if (!event.isMainFrame || suppressCodes.includes(event.errorCode)) {
          event.preventDefault();
        }
      };
      this.wv?.addEventListener('did-fail-load', this._onDidFailLoad);
      this.wv?.addEventListener('did-fail-provisional-load', this._onDidFailProvisionalLoad);

      // open links in same WebView (target="_blank")
      this._onDomReady = () => {
        this.applyWebviewZoom()
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
    visible(v) {
      if (!v) return
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.applyWebviewZoom()
            applyPreviewWebviewHostLayout(this.splitview)
          })
        })
      })
    },
  },
  methods: {
    goHome() {
       if (this.allowedUrl) this.wv?.loadURL(this.allowedUrl) 
      },   // go to home URL
    goBack() { if (this.wv?.canGoBack?.()) this.wv?.goBack() },      // history back
    goForward() { if (this.wv?.canGoForward?.()) this.wv?.goForward() }, // history forward
    applyWebviewZoom() {
      const factor = this.zoomPercent / 100
      if (!this.wv || typeof this.wv.setZoomFactor !== 'function') return
      try {
        this.wv.setZoomFactor(factor)
      } catch {
        return
      }
    },
    zoomIn() {
      this.zoomPercent = Math.min(this.zoomMax, this.zoomPercent + this.zoomStep)
      this.$nextTick(() => {
        this.applyWebviewZoom()
        applyPreviewWebviewHostLayout(this.splitview)
      })
    },
    zoomOut() {
      this.zoomPercent = Math.max(this.zoomMin, this.zoomPercent - this.zoomStep)
      this.$nextTick(() => {
        this.applyWebviewZoom()
        applyPreviewWebviewHostLayout(this.splitview)
      })
    },
    zoomReset() {
      this.zoomPercent = 100
      this.$nextTick(() => {
        this.applyWebviewZoom()
        applyPreviewWebviewHostLayout(this.splitview)
      })
    },
    closePane() { this.$emit('close'); }                                // send 'close' Event
  }
}
</script>

<style scoped>
/* Host #webview must not use Vue-bound inline style or showUrl 80vw/80vh is wiped on re-render */
.nx-webview-pane-host {
  min-height: 0;
}

.nx-webview-pane-fill {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* Same vertical stretch as nav row so −/+/% align with ⌂◀▶ */
.webview-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  margin-bottom: 0;
  cursor: pointer !important;
}

/* Gray compact zoom label; overrides Bootstrap .nav-link blue */
.webview-zoom-pct {
  color: #6c757d !important;
  min-width: 48px;
  font-size: 0.72rem;
  line-height: 1;
}
</style>
