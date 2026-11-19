import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' agar bisa jalan di GitHub Pages (https://user.github.io/nama-repo/) tanpa ubah apa pun.
export default defineConfig({
  base: './',
  plugins: [vue()]
})
