import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SyncStatus: React.FC = () => {
    const { pendingSync, isSyncing, syncError, processSyncQueue } = useStore();
    const isOffline = !navigator.onLine;
    const pendingCount = pendingSync.length;

    useEffect(() => {
        const handleOnline = () => {
            processSyncQueue();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [processSyncQueue]);

    if (pendingCount === 0 && !isSyncing && !syncError) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-sm animate-in fade-in duration-500">
                <CheckCircle2 size={14} className="animate-bounce" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Cloud Synced</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {syncError ? (
                <div 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-600 shadow-sm animate-pulse"
                    title={syncError}
                >
                    <AlertCircle size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sync Error</span>
                </div>
            ) : isSyncing ? (
                <div 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 shadow-sm"
                >
                    <RefreshCw size={14} className="animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Syncing...</span>
                </div>
            ) : pendingCount > 0 ? (
                <button 
                    onClick={() => processSyncQueue()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm transition-all hover:scale-105 active:scale-95 ${
                        isOffline 
                            ? 'bg-amber-50 border border-amber-100 text-amber-600' 
                            : 'bg-brand-teal/10 border border-brand-teal/20 text-brand-teal'
                    }`}
                >
                    {isOffline ? <CloudOff size={14} /> : <Cloud size={14} />}
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        {pendingCount} Pending
                    </span>
                </button>
            ) : null}
        </div>
    );
};
