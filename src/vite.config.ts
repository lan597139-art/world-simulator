import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 核心：强制 Vite 不预构建它，防止 3D 引擎多实例报错
  optimizeDeps: {
    exclude: ['3d-force-graph', 'three']
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});