import { mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import StatsRuleComponent from './StatsRuleComponent.vue'

export interface StatsRuleOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statsRule: {
      setStatsRule: () => ReturnType
    }
  }
}

export const StatsRule = Node.create<StatsRuleOptions>({
  name: 'statsRule',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  atom: true,

  selectable: true,

  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-stats-rule]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes as Record<string, any>, HTMLAttributes, {
        'data-stats-rule': '',
      }),
      ['div', { class: 'stats-rule-hr' }],
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(StatsRuleComponent)
  },

  addCommands() {
    return {
      setStatsRule:
        () =>
        ({ chain, state }) => {
          if (!state.schema.nodes[this.name]) {
            return false
          }

          const { $from } = state.selection

          // Insert after the doc-level block that contains the caret so statsRule stays a direct doc child, never inside table/list/cell.
          if ($from.depth < 1) {
            return false
          }

          const insertPos = $from.after(1)
          if (insertPos > state.doc.content.size) {
            return false
          }

          return chain()
            .insertContentAt(insertPos, { type: this.name })
            .command(({ tr, dispatch, editor }) => {
              if (dispatch) {
                const { $to } = tr.selection
                const posAfter = $to.end()

                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1))
                  } else if ($to.nodeAfter.isBlock) {
                    tr.setSelection(NodeSelection.create(tr.doc, $to.pos))
                  } else {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos))
                  }
                } else {
                  const node = $to.parent.type.contentMatch.defaultType?.create()

                  if (node) {
                    tr.insert(posAfter, node)
                    tr.setSelection(TextSelection.create(tr.doc, posAfter + 1))
                  }
                }

                tr.scrollIntoView()

                const { from, to } = tr.selection
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    editor.commands.setTextSelection({ from, to })
                    editor.commands.focus()
                  })
                })
              }

              return true
            })
            .run()
        },
    }
  },
})

export default StatsRule
