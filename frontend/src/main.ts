import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

// Theme MDS mặc định (blue). Đổi runtime: document.documentElement.dataset.mdsTheme = 'green'
document.documentElement.dataset.mdsTheme = 'blue'

createApp(App).use(createPinia()).use(router).mount('#app')
