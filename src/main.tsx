import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

import { ensureInitialized } from './lib/microsoftGraph';

// --- Hard Update Logic (Web APIs only — no store imports here) ---
// IMPORTANT: Do NOT import useStore or authStore at module level before React mounts.
// Doing so triggers Zustand/Supabase module-level side effects that invoke React hooks
// before ReactDOM.createRoot(), causing "Cannot read properties of undefined (reading 'useState')".
const currentVersion = __APP_VERSION__;
const storedVersion = localStorage.getItem('latnovva_app_version');

if (storedVersion !== currentVersion) {
    console.warn(`[App] Version updated: ${storedVersion} -> ${currentVersion}. Refreshing web cache while preserving offline attendance state & auth...`);
    
    // 1. Preserve pending local storage item (latnovva-storage contains Zustand state & pendingSync)
    const preservedStore = localStorage.getItem('latnovva-storage');

    // 2. Clear non-essential scratch keys (PRESERVE auth tokens and critical app state)
    try {
        const keysToRemove = Object.keys(localStorage).filter(k => 
            k !== 'latnovva-storage' && 
            k !== 'latnovva_app_version' &&
            !k.startsWith('app_version_logged_') &&
            !k.startsWith('sb-') &&
            !k.includes('supabase.auth')
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.warn('[App] Non-fatal localStorage cleanup warning:', e);
    }
    
    // 3. Clear Service Worker Caches
    if ('caches' in window) {
        caches.keys().then((names) => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    // 4. Update the stored version without disruptive immediate hard-reload loop
    localStorage.setItem('latnovva_app_version', currentVersion);
    if (preservedStore) {
        localStorage.setItem('latnovva-storage', preservedStore);
    }
}

// ── PWA Auto-Update Hardening ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
    let refreshing = false;
    // When a new service worker takes over (skipWaiting: true), auto-reload ONCE to load new assets
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.warn('[PWA] New service worker activated. Reloading page for updates...');
        window.location.reload();
    });

    // Periodically check for SW updates
    const checkSwUpdate = () => {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update().catch(err => console.warn('[PWA] SW update check failed:', err));
            }
        }).catch(() => {});
    };

    // Throttle focus event to at most once every 5 minutes to prevent spamming network on tab switches
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

const renderApp = () => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
};

// MSAL is only needed for SharePoint/OneDrive features — NOT for core Supabase auth.
// Race it against a 3-second timeout so a hung MSAL init (common in multi-tab scenarios
// where it gets confused by stale redirect state in localStorage) never blocks the app
// from rendering. React will always mount within 3 seconds maximum.
const MSAL_TIMEOUT_MS = 3000;

Promise.race([
    ensureInitialized(),
    new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('MSAL init timed out')), MSAL_TIMEOUT_MS)
    ),
])
    .catch(err => {
        console.warn('[MSAL] Initialization skipped or timed out:', err?.message ?? err);
    })
    .finally(() => {
        renderApp();
    });
