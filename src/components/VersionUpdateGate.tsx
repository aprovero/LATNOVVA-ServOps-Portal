import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { compareSemver } from '../lib/semver';
import { getAppVersion, getReleaseId } from '../config/release';
import { recordReleaseTelemetry } from '../lib/releaseCheck';

interface VersionUpdateGateProps {
    currentVersion?: string;
    minimumVersion?: string;
}

export const VersionUpdateGate: React.FC<VersionUpdateGateProps> = ({
    currentVersion = getAppVersion(),
    minimumVersion
}) => {
    const platformSettings = useStore(s => s.platformSettings);
    const pendingSync = useStore(s => s.pendingSync);
    const processSyncQueue = useStore(s => s.processSyncQueue);
    const showUpdateModal = useStore(s => s.showUpdateModal);
    const clientReleaseStatus = useStore(s => s.clientReleaseStatus);

    const targetMinVersion = minimumVersion || platformSettings.minimumClientVersion || '5.0.3';
    const isEnabled = platformSettings.minimumClientVersionEnabled;

    const [isUpdating, setIsUpdating] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Evaluate version gate & release status
    const isSemverObsolete = isEnabled && compareSemver(currentVersion, targetMinVersion) !== null && compareSemver(currentVersion, targetMinVersion)! < 0;
    const isReleaseObsolete = clientReleaseStatus === 'UPDATE_REQUIRED';
    const shouldBlock = showUpdateModal || isReleaseObsolete || isSemverObsolete;

    // Trap keyboard events to prevent Escape dismissal
    useEffect(() => {
        if (!shouldBlock) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [shouldBlock]);

    if (!shouldBlock) {
        return null; // Client is compliant
    }

    const handleUpdateNow = async () => {
        setIsUpdating(true);
        setStatusMessage('Actualizando aplicación...');
        await recordReleaseTelemetry('CLIENT_UPDATE_STARTED');

        try {
            // 1. Safe flush attempt for existing offline queue items (do NOT wipe IndexedDB!)
            if (pendingSync && pendingSync.length > 0) {
                setStatusMessage(`Sincronizando ${pendingSync.length} marcaje(s) pendientes...`);
                try {
                    await processSyncQueue();
                } catch (e) {
                    console.warn('[VersionUpdateGate] Queue flush warning (data preserved locally):', e);
                }
            }

            setStatusMessage('Obteniendo nueva versión del servidor...');

            // 2. Obtain ServiceWorker registration & update
            if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg) {
                        await reg.update();
                        if (reg.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    }
                } catch (swErr) {
                    console.warn('[VersionUpdateGate] ServiceWorker update error:', swErr);
                }
            }

            // 3. Clear obsolete application CacheStorage entries (PRESERVING IndexedDB pendingSync storage!)
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                } catch (cErr) {
                    console.warn('[VersionUpdateGate] CacheStorage clearance error:', cErr);
                }
            }

            // 4. Record telemetry success
            await recordReleaseTelemetry('CLIENT_UPDATE_SUCCESS');

            setStatusMessage('Recargando aplicación...');
            localStorage.setItem('latnovva_app_version', targetMinVersion);

            // 5. Hard reload to activate the current build
            window.location.reload();
        } catch (err: any) {
            console.error('[VersionUpdateGate] Error during update:', err);
            await recordReleaseTelemetry('CLIENT_UPDATE_FAILED', { error: err.message });
            setStatusMessage(`Error durante la actualización: ${err.message || 'Error desconocido'}`);
            setIsUpdating(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 text-white select-none"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150">
                <div className="flex items-center space-x-3 text-amber-500">
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <ShieldAlert className="w-8 h-8 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Actualización disponible</h2>
                        <p className="text-xs text-slate-400">Portal LATNOVVA v{targetMinVersion}</p>
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 text-sm">
                    <p className="text-slate-200 leading-relaxed font-normal">
                        Hemos actualizado el portal. Debes actualizar la aplicación antes de continuar para asegurarnos de que estás utilizando la versión más reciente.
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-700/50">
                        <div>
                            <span className="text-slate-400">Versión actual:</span>
                            <p className="font-mono text-slate-300 font-semibold">{currentVersion} (r{getReleaseId()})</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Versión requerida:</span>
                            <p className="font-mono text-amber-400 font-semibold">{targetMinVersion} (r43)</p>
                        </div>
                    </div>
                </div>

                {pendingSync && pendingSync.length > 0 && (
                    <div className="flex items-start space-x-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
                        <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>
                            Tienes {pendingSync.length} marcaje(s) pendientes de sincronización. Se conservarán de forma segura durante la actualización.
                        </span>
                    </div>
                )}

                {statusMessage && (
                    <p className="text-xs text-center text-amber-300 animate-pulse">{statusMessage}</p>
                )}

                <button
                    onClick={handleUpdateNow}
                    disabled={isUpdating}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                    <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? 'Actualizando...' : 'Actualizar ahora'}</span>
                </button>
            </div>
        </div>
    );
};

export default VersionUpdateGate;
