import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works under a sub-path such as
  // GitHub Pages (https://<user>.github.io/<repo>/).
  base: './',
})
