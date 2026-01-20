import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
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
    
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log in production
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
      format: {
        // Remove comments
        comments: false,
      },
    },
    
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return;

          const normalized = id.replace(/\\/g, '/');

          if (normalized.includes('/node_modules/')) {
            if (
              normalized.includes('/react-markdown/') ||
              normalized.includes('/remark-gfm/') ||
              normalized.includes('/rehype-highlight/') ||
              normalized.includes('/unified/') ||
              normalized.includes('/micromark') ||
              normalized.includes('/mdast-') ||
              normalized.includes('/hast-') ||
              normalized.includes('/vfile')
            ) {
              return 'markdown';
            }

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
});
