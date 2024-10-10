import { Extension, textInputRule } from '@tiptap/core'

export const CharReplacer = (options) => {
  return Extension.create({
    name: 'charReplacer',

    addInputRules() {
      if (options.language === "de-DE") {
        return [
          textInputRule({ find: /(^|(?<=\s))"(?=\s|$|\w)/g, replace: '„' })
   
        ];
      }
      return [];
    },
  })
}