import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// A relative base plus hash routing lets the same build run from GitHub Pages,
// a sub-folder, or a local file server without any rewrite rules.
export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // `--mode native` builds the copy packaged as the desktop and Android apps.
    __NATIVE__: JSON.stringify(mode === 'native'),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // No service worker for hosts that don't allow one (preview-artifact) or don't need one:
      // the desktop and Android apps already ship every file inside the app.
      disable: mode === 'preview-artifact' || mode === 'native',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'كواليس — استوديو صانع المحتوى',
        short_name: 'كواليس',
        description:
          'استوديو صانع المحتوى: الأفكار والسكريبتات وجدول النشر والأرقام في مكان واحد. By: Eng.Reem Alfadly',
        lang: 'ar',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#07070c',
        theme_color: '#07070c',
        categories: ['productivity', 'social', 'lifestyle'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        screenshots: [
          {
            src: 'screenshots/phone-home.jpg',
            sizes: '780x1688',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'الرئيسية: هدف الأسبوع وسلسلة الإبداع',
          },
          {
            src: 'screenshots/phone-board.jpg',
            sizes: '780x1688',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'لوحة المراحل من الفكرة للنشر',
          },
          {
            src: 'screenshots/phone-stats.jpg',
            sizes: '780x1688',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'الأرقام والإنجازات',
          },
          {
            src: 'screenshots/desktop-home.jpg',
            sizes: '1440x900',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'كواليس على الكمبيوتر',
          },
          {
            src: 'screenshots/desktop-stats.jpg',
            sizes: '1440x900',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'نمو المتابعين وخريطة النشاط',
          },
        ],
        shortcuts: [
          {
            name: 'فكرة جديدة',
            short_name: 'فكرة',
            url: './#/?capture=1',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'التقويم',
            short_name: 'التقويم',
            url: './#/calendar',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Install-dialog screenshots aren't needed offline.
        globIgnores: ['**/screenshots/**'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
  },
  server: { host: true },
  preview: { host: true },
}));
