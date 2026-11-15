import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const key = new PluginKey('typewriterFocus')

/**
 * 只给当前光标所在块加 class，不改变文档。
 * 打字机模式开启时，CSS 用这个 class 压低其他段落的存在感。
 */
export const TypewriterFocus = Extension.create({
  name: 'typewriterFocus',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            try {
              const { $from } = state.selection
              if ($from.depth < 1) return null
              const from = $from.before($from.depth)
              const to = $from.after($from.depth)
              return DecorationSet.create(state.doc, [
                Decoration.node(from, to, { class: 'is-caret-block' }),
              ])
            } catch {
              return null
            }
          },
        },
      }),
    ]
  },
})
