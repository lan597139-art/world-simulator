import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // 3d-force-graph / three-forcegraph / three-render-objects 必须共用同一份 three，
    // 否则会出现 “Multiple instances of Three.js” 以及 intersectsFrustum 崩溃。
    dedupe: ["three"],
  },
})
