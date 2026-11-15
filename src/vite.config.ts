import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['3d-force-graph', 'three']
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});