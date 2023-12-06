import type { Plugin, App } from 'vue'

import menu from './menu'
import tips from './tips'

const directives: any = {
  menu,
  tips
}

export default {
  install(app: App) {
    Object.keys(directives).forEach((key) => {
      app.directive(key, directives[key])
    })
  }
} as Plugin