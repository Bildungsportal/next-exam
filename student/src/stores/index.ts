import { store } from 'quasar/wrappers'
import { createPinia } from 'pinia'

export default store(function () {
  return createPinia()
})