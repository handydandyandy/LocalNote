import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'LocalNote',
        short_name: 'LocalNote',
        description: 'Infinite canvas note-taking — local, private, offline-ready',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],
        // don't cache API calls
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-assets',
              expiration: { maxEntries: 50 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
