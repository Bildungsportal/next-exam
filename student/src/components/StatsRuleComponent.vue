
<template>
  <node-view-wrapper class="stats-rule-block">
    <div class="stats-rule-hr" aria-hidden="true" />
    <div class="stats-rule-badge" contenteditable="false">
      {{ badgeText }}
    </div>
  </node-view-wrapper>
</template>

<script>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

// Section starts at doc pos 1, or after the latest statsRule before this marker.
function findSectionStart(doc, statsPos) {
  let start = 1
  doc.nodesBetween(1, statsPos, (node, pos) => {
    if (node.type.name === 'statsRule') {
      start = pos + node.nodeSize
    }
  })
  return start
}

function countWordsAndChars(sliceText) {
  const normalized = sliceText.replace(/\r\n/g, '\n')
  const words = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean).length : 0
  const chars = normalized.replace(/\s/g, '').length // non-whitespace chars only
  return { chars, words }
}

export default {
  components: {
    NodeViewWrapper,
  },

  props: nodeViewProps,

  data() {
    return {
      charCount: 0,
      wordCount: 0,
      rafScheduled: false,
    }
  },

  computed: {
    badgeText() {
      return this.$t('editor.statsruleBadge', {
        chars: this.charCount,
        words: this.wordCount,
      })
    },
  },

  mounted() {
    this.editor.on('update', this.scheduleRecalc)
    this.recalcStats()
  },

  beforeUnmount() {
    this.editor.off('update', this.scheduleRecalc)
  },

  methods: {
    scheduleRecalc() {
      if (this.rafScheduled) {
        return
      }
      this.rafScheduled = true
      requestAnimationFrame(() => {
        this.rafScheduled = false
        this.recalcStats()
      })
    },

    recalcStats() {
      const pos = typeof this.getPos === 'function' ? this.getPos() : null
      if (pos == null) {
        return
      }
      const { state } = this.editor
      const start = findSectionStart(state.doc, pos)
      const sliceText = state.doc.textBetween(start, pos, '\n', '\n')
      const { chars, words } = countWordsAndChars(sliceText)
      this.charCount = chars
      this.wordCount = words
    },
  },
}
</script>

<style lang="scss">
.stats-rule-block .stats-rule-hr {
  border: none;
  border-top: 1px dashed rgba(13, 13, 13, 0.5);
  margin: 1rem 0 0 0;
  height: 0;
}

.stats-rule-block.ProseMirror-selectednode .stats-rule-hr {
  border-color: #5900ff;
}

.stats-rule-block .stats-rule-badge {
  user-select: none;
  font-size: 0.6rem;
  color: rgba(13, 13, 13, 0.65);
  margin-bottom: 0.5rem;
  pointer-events: none;
  line-height: 1rem;
}
</style>
