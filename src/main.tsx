import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

import { ensureInitialized } from './lib/microsoftGraph';
import { useStore } from './store/useStore';

// --- Hard Update Logic ---
const currentVersion = __APP_VERSION__;
const storedVersion = localStorage.getItem('latnovva_app_version');

if (storedVersion !== currentVersion) {
    console.warn(`[App] Version mismatch: ${storedVersion} -> ${currentVersion}. Forcing cache wipe...`);
    
    // 1. Clear Zustand IndexedDB and other local DBs
    useStore.getState().resetDb();
    
    // 2. Clear Local & Session Storage
    localStorage.clear();
    sessionStorage.clear();
    
    // 3. Clear Service Worker Caches
    if ('caches' in window) {
        caches.keys().then((names) => {
            names.forEach(name => {
                caches.delete(name);
            });
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
        // Log but don't crash — SharePoint/OneDrive features will gracefully
        // degrade; core app auth via Supabase is completely unaffected.
        console.warn('[MSAL] Initialization skipped or timed out:', err?.message ?? err);
    })
    .finally(() => {
        renderApp();
    });
