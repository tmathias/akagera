import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),

    // Cesium — copies Cesium static assets to dist, sets CESIUM_BASE_URL
    cesium(),

    // PWA — generates service worker + manifest injection
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Akagera Aviation EFB',
        short_name: 'AkageraEFB',
        description: 'Professional Electronic Flight Bag — moving map, weather, W&B, documents',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache aeronautical tile layers and API responses
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/weather\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'weather-cache', expiration: { maxAgeSeconds: 1800 } },
          },
          {
            urlPattern: /\/api\/v1\/traffic\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'traffic-cache', expiration: { maxAgeSeconds: 30 } },
          },
          // Cache Cesium terrain tiles aggressively — large but stable
          {
            urlPattern: /cesium\.com\/terrain\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'cesium-terrain', expiration: { maxEntries: 2000, maxAgeSeconds: 604800 } },
          },
          // OpenAIP / FAA aeronautical chart tiles
          {
            urlPattern: /tiles\.openaip\.net\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'aero-tiles', expiration: { maxEntries: 5000, maxAgeSeconds: 86400 } },
          },
        ],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],

  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ['cesium'],
          recharts: ['recharts'],
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
    chunkSizeWarningLimit: 4096,
  },
});
