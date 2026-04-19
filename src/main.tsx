import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

import { ensureInitialized } from './lib/microsoftGraph';

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
