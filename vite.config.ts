import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    // Disable source maps in production for smaller bundle size
    sourcemap: false,
    
    // Set chunk size warning limit to 300KB
    chunkSizeWarningLimit: 300,
    
    // 🔥 使用 esbuild 压缩而不是 terser
    // esbuild 更快，问题更少，避免循环依赖问题
    minify: 'esbuild',
    
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return;

          const normalized = id.replace(/\\/g, '/');

          if (normalized.includes('/node_modules/')) {
            // 🔥 不要将 markdown 相关库分离到单独的 chunk
            // 这会导致循环依赖问题："Cannot access 'convert' before initialization"
            // if (
            //   normalized.includes('/react-markdown/') ||
            //   normalized.includes('/remark-gfm/') ||
            //   normalized.includes('/rehype-highlight/') ||
            //   normalized.includes('/unified/') ||
            //   normalized.includes('/micromark') ||
            //   normalized.includes('/mdast-') ||
            //   normalized.includes('/hast-') ||
            //   normalized.includes('/vfile')
            // ) {
            //   return 'markdown';
            // }

            if (normalized.includes('/highlight.js/')) {
              return 'highlight';
            }

            if (normalized.includes('/@tauri-apps/')) {
              return 'tauri';
            }

            if (normalized.includes('/lucide-react/')) {
              return 'icons';
            }

            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }

            return 'vendor';
          }
        },
      },
    },
  },
}));
