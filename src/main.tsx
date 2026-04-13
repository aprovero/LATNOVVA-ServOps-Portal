import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

import { ensureInitialized } from './lib/microsoftGraph';

// Call MSAL initialization before rendering the app to catch redirects early
ensureInitialized().then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}).catch(err => {
    console.error('Core initialization failed:', err);
    // Render anyway as fallback
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
