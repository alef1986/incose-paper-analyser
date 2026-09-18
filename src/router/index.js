import { createRouter, createWebHistory } from 'vue-router'
import SingleAnalyzer from '../views/SingleAnalyzer.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'analyzer',
      component: SingleAnalyzer
    }
  ]
})

export default router