import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enterprise Code-Splitting & High-Performance Chunking
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core vendors
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@capacitor')) {
              return 'vendor-capacitor';
            }
            // Everything else goes into vendor-misc
            return 'vendor-misc';
          }
        },
        // Optimize chunk names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Optimize CSS
    cssMinify: 'esbuild',
    // Enable source maps for debugging (disable in prod for smaller size)
    sourcemap: false,
    // Reduce reassignments in output
    reportCompressedSize: false
  },
  // Optimize dev server
  server: {
    hmr: {
      overlay: false
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
    exclude: []
  }
});
