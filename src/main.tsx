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
    console.warn(`[App] Version mismatch: ${storedVersion} -> ${currentVersion}. Forcing cache wipe...`);
    
    // 1. Wipe IndexedDB natively (no store import needed)
    if (typeof indexedDB !== 'undefined') {
        indexedDB.databases?.().then(dbs => {
            dbs.forEach(db => db.name && indexedDB.deleteDatabase(db.name));
        }).catch(() => {
            // Fallback: blindly delete known DB names
            ['latnovva-db', 'supabase', 'keyval-store'].forEach(name => indexedDB.deleteDatabase(name));
        });
    }
    
    // 2. Clear Local & Session Storage
    localStorage.clear();
    sessionStorage.clear();
    
    // 3. Clear Service Worker Caches
    if ('caches' in window) {
        caches.keys().then((names) => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    // 4. Unregister Service Workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach(registration => registration.unregister());
        });
    }
    
    // 5. Store the new version and reload
    localStorage.setItem('latnovva_app_version', currentVersion);
    window.location.reload();
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
