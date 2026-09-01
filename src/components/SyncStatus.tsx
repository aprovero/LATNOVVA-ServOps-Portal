import React, { useEffect, useState } from 'react';
import { useStore, PendingSyncItem } from '../store/useStore';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2, Trash2, Database, ExternalLink } from 'lucide-react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle
} from './ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { format } from 'date-fns';

export const SyncStatus: React.FC = () => {
    const { pendingSync, isSyncing, syncError, processSyncQueue, clearSyncQueue } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const isOffline = !navigator.onLine;
    const pendingCount = pendingSync.length;

    useEffect(() => {
        const handleOnline = () => {
            processSyncQueue();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [processSyncQueue]);

    const renderBadge = () => {
        if (pendingCount === 0 && !isSyncing && !syncError) {
            return (
                <button
                    onClick={() => setIsOpen(true)}
                    title="Cloud Synced"
                    className="group relative flex items-center h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-xs transition-all duration-300 ease-in-out px-2 hover:px-3 hover:bg-emerald-100 hover:border-emerald-200 active:scale-95 cursor-pointer select-none shrink-0"
                >
                    <Cloud size={16} className="shrink-0" />
                    <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold leading-none select-none">
                        Sincronizado
                    </span>
                </button>
            );
        }

        if (syncError) {
            return (
                <button 
                    onClick={() => setIsOpen(true)}
                    title="Sync Error"
                    className="group relative flex items-center h-8 rounded-full bg-red-50 border border-red-100 text-red-600 shadow-xs animate-pulse transition-all duration-300 ease-in-out px-2 hover:px-3 hover:bg-red-100 hover:border-red-200 active:scale-95 cursor-pointer select-none shrink-0"
                >
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold leading-none select-none">
                        Error Sync
                    </span>
                </button>
            );
        }

        if (isSyncing) {
            return (
                <button
                    onClick={() => setIsOpen(true)}
                    title="Syncing..."
                    className="group relative flex items-center h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 shadow-xs transition-all duration-300 ease-in-out px-2 hover:px-3 hover:bg-blue-100 hover:border-blue-200 active:scale-95 cursor-pointer select-none shrink-0"
                >
                    <RefreshCw size={16} className="animate-spin shrink-0" />
                    <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold leading-none select-none">
                        Sincronizando...
                    </span>
                </button>
            );
        }

        if (pendingCount > 0) {
            const pendingLabel = isOffline 
                ? "Sin Conexión" 
                : `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}`;

            return (
                <button 
                    onClick={() => setIsOpen(true)}
                    title={`${pendingCount} changes pending`}
                    className={`group relative flex items-center h-8 rounded-full shadow-xs transition-all duration-300 ease-in-out px-2 hover:px-3 active:scale-95 cursor-pointer select-none shrink-0 ${
                        isOffline 
                            ? 'bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 hover:border-amber-200' 
                            : 'bg-brand-teal/10 border border-brand-teal/20 text-brand-teal hover:bg-brand-teal/20 hover:border-brand-teal/30'
                    }`}
                >
                    {isOffline ? <CloudOff size={16} className="shrink-0" /> : <Cloud size={16} className="shrink-0" />}
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm pointer-events-none">
                        {pendingCount}
                    </span>
                    <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold leading-none select-none">
                        {pendingLabel}
                    </span>
                </button>
            );
        }

        return null;
    };

    return (
        <div className="flex items-center gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                {renderBadge()}
                
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white">
                    <DialogHeader className="p-6 bg-gradient-to-r from-brand-teal/5 to-transparent border-b">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                                <Database className="text-brand-teal" size={20} />
                                Sync Queue Details
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                {pendingCount > 0 && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            if (window.confirm('Clear all pending changes? This cannot be undone.')) {
                                                clearSyncQueue();
                                                setIsOpen(false);
                                            }
                                        }}
                                        className="h-8 text-xs font-bold text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 rounded-lg gap-1.5"
                                    >
                                        <Trash2 size={14} />
                                        Clear Queue
                                    </Button>
                                )}
                                {!isOffline && pendingCount > 0 && (
                                    <Button 
                                        size="sm" 
                                        onClick={() => processSyncQueue()}
                                        className="h-8 text-xs font-bold bg-brand-teal hover:bg-brand-teal/90 text-white rounded-lg gap-1.5 shadow-sm"
                                    >
                                        <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                                        Sync Now
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-0">
                        {syncError && (
                            <div className="m-4 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                                <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={18} />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-red-800">Last Sync Error</h4>
                                    <p className="text-xs text-red-700 leading-relaxed font-medium">{syncError}</p>
                                </div>
                            </div>
                        )}

                        {pendingCount === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="text-emerald-500" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-accent-greyDark">All Caught Up!</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-[280px]">
                                    All your local changes have been successfully synchronized with the cloud.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4">
                                <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm bg-gray-50/30">
                                    <Table>
                                        <TableHeader className="bg-white">
                                            <TableRow className="hover:bg-transparent border-gray-100">
                                                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-wider text-gray-400">Time</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Target</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Action</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ID Reference</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingSync.map((item: PendingSyncItem, idx) => (
                                                <TableRow key={`${item.id}-${idx}`} className="bg-white hover:bg-gray-50/50 border-gray-100 transition-colors">
                                                    <TableCell className="text-[11px] font-medium text-gray-500 py-3">
                                                        {item.timestamp ? format(new Date(item.timestamp), 'HH:mm:ss') : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal/40" />
                                                            <span className="text-xs font-bold text-accent-greyDark capitalize">{item.table.replace(/_/g, ' ')}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-tighter ${
                                                            item.action === 'insert' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                            item.action === 'update' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                            item.action === 'delete' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                            'bg-gray-50 text-gray-600 border border-gray-100'
                                                        }`}>
                                                            {item.action}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 truncate max-w-[150px] block">
                                                            {item.id}
                                                        </code>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {isOffline ? "Offline Mode Active" : "Online — Auto-syncing enabled"}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-teal/70">
                            <ExternalLink size={12} />
                            v2.4.0-cloud-sync
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
