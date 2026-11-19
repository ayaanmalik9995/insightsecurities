import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Default build targets the subdomain (insights.insightsec.com.pk) at the root.
// `npm run build:path` builds for a sub-path of the main site (/insights/).
export default defineConfig(({ mode }) => ({
  base: mode === 'path' ? '/insights/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    // Only source files need watching; tool output folders can be locked on Windows.
    watch: { ignored: ['**/.playwright-mcp/**', '**/qa/**', '**/research/**', '**/data-src/**', '**/.impeccable/**', '**/dist/**'] },
  },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers', 'echarts/features'],
          react: ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
}));
