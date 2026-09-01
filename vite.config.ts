import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inline service worker registration so PWA works immediately
      injectRegister: 'auto',
      // Ensure the service worker is activated right away
      devOptions: {
        enabled: true,          // Enable PWA in dev for local testing
        type: 'module',
      },
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        name: 'LATNOVVA Service Operations',
        short_name: 'Service Operations',
        description: 'COR Solutions / LATNOVVA field service & construction site management platform.',
        theme_color: '#0097A7',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'en-US',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Maskable icon — centered with safe-zone padding to avoid clipping on Android
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            // Apple Touch Icon
            src: 'apple-touch-icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        screenshots: [
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'LATNOVVA Service Operations Hub',
          },
        ],
      },
      workbox: {
        importScripts: ['/sw-push.js'],
        // Force new service worker to activate immediately — no waiting for tabs to close
        skipWaiting: true,
        clientsClaim: true,
        // Cache everything up to 15 MB to accommodate Face-API neural network models
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        // Pre-cache all core assets including ML models and manifests
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf,bin,json}'],
        // Clean stale caches on each service worker update
        cleanupOutdatedCaches: true,
        // Single page app fallback — serves index.html for all navigation
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Face-API ML Models & weights — CacheFirst for 100% offline field operation
            urlPattern: /\/models\/.*(\.bin|\.json)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-api-models-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Weather API — network first, 24-hour stale fallback
            urlPattern: /^https:\/\/api\.openweathermap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase API — network first, short stale window
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts — cache first (they're immutable)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000
  }
});
