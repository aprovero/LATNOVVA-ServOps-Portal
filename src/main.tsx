import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { runVersionUpgradeStorageCleanup } from './lib/storageMigration';

// --- Safe Version Upgrade Logic (Web APIs only — no store imports here) ---
// IMPORTANT: Do NOT import useStore or authStore at module level before React mounts.
// IMPORTANT (P0-4 / Item 5): Do NOT wildcard-delete CacheStorage here — let Workbox's
// `cleanupOutdatedCaches: true` manage obsolete precaches while preserving the active
// service worker precache and face-api model caches.
const currentVersion = __APP_VERSION__;

try {
    const { upgraded } = runVersionUpgradeStorageCleanup(localStorage, currentVersion);
    if (upgraded) {
        console.info(`[App] Upgraded client to v${currentVersion}. Preserved attendance_device_id, active shifts, auth, and CacheStorage.`);
    }
} catch (e) {
    console.warn('[App] Non-fatal localStorage cleanup warning:', e);
}

// ── PWA Auto-Update Hardening ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.info('[PWA] New service worker activated. Reloading page for updates...');
        window.location.reload();
    });

    const checkSwUpdate = () => {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update().catch(err => console.warn('[PWA] SW update check failed:', err));
            }
        }).catch(() => {});
    };

    let lastFocusCheck = 0;
    window.addEventListener('focus', () => {
        const now = Date.now();
        if (now - lastFocusCheck > 5 * 60 * 1000) {
            lastFocusCheck = now;
            checkSwUpdate();
        }
    });
    setInterval(checkSwUpdate, 30 * 60 * 1000);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
);
