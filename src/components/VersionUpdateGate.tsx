import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { compareSemver } from '../lib/semver';

interface VersionUpdateGateProps {
    currentVersion?: string;
    minimumVersion?: string;
}

export const VersionUpdateGate: React.FC<VersionUpdateGateProps> = ({
    currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '5.0.2',
    minimumVersion
}) => {
    const platformSettings = useStore(s => s.platformSettings);
    const pendingSync = useStore(s => s.pendingSync);
    const processSyncQueue = useStore(s => s.processSyncQueue);

    const targetMinVersion = minimumVersion || platformSettings.minimumClientVersion || '5.0.2';
    const isEnabled = platformSettings.minimumClientVersionEnabled;

    const [isUpdating, setIsUpdating] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Evaluate version gate
    const isObsolete = isEnabled && compareSemver(currentVersion, targetMinVersion) !== null && compareSemver(currentVersion, targetMinVersion)! < 0;

    if (!isObsolete) {
        return null; // Client is compliant
    }

    const handleUpdateNow = async () => {
        setIsUpdating(true);
        setStatusMessage('Checking unsynchronized attendance data...');

        try {
            // 1. Safe queue flush attempt
            if (pendingSync && pendingSync.length > 0) {
                setStatusMessage(`Flushing ${pendingSync.length} pending offline items...`);
                try {
                    await processSyncQueue();
                } catch (e) {
                    console.warn('[VersionUpdateGate] Sync queue flush warning (data preserved locally):', e);
                }
            }

            setStatusMessage('Clearing application caches & updating service worker...');

            // 2. Clear Service Worker Caches (preserving IndexedDB pendingSync storage!)
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }

            // 3. Unregister active service workers so network fetches new 5.0.0 bundle
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(r => r.unregister()));
            }

            setStatusMessage('Reloading application...');
            localStorage.setItem('latnovva_app_version', targetMinVersion);

            // Force hard reload from network
            window.location.reload();
        } catch (err: any) {
            console.error('[VersionUpdateGate] Error during update:', err);
            setStatusMessage(`Update error: ${err.message || 'Unknown error'}`);
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 text-white">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center space-x-3 text-amber-500">
                    <div className="p-3 bg-amber-500/10 rounded-xl">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Update Required</h2>
                        <p className="text-xs text-slate-400">LATNOVVA Client Protocol v{targetMinVersion}</p>
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 text-sm">
                    <p className="text-slate-300">
                        Your application protocol is out of date. To maintain normalized attendance sync, security compliance, and platform integrity, you must update to version <strong className="text-amber-400">{targetMinVersion}</strong> or higher.
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-700/50">
                        <div>
                            <span className="text-slate-400">Current Version:</span>
                            <p className="font-mono text-slate-200 font-semibold">{currentVersion}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Required Version:</span>
                            <p className="font-mono text-amber-400 font-semibold">{targetMinVersion}</p>
                        </div>
                    </div>
                </div>

                {pendingSync && pendingSync.length > 0 && (
                    <div className="flex items-start space-x-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
                        <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>
                            You have {pendingSync.length} unsynchronized attendance record(s). They will be safely preserved during this update.
                        </span>
                    </div>
                )}

                {statusMessage && (
                    <p className="text-xs text-center text-amber-300 animate-pulse">{statusMessage}</p>
                )}

                <button
                    onClick={handleUpdateNow}
                    disabled={isUpdating}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? 'Updating...' : 'Update Now'}</span>
                </button>
            </div>
        </div>
    );
};

export default VersionUpdateGate;
