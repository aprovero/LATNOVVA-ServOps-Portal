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
import { attendanceV2Db } from '../lib/attendanceV2/db';
import { getAttendanceV2Engine } from '../lib/attendanceV2/transport';
import type { QueuedAttendanceEvent } from '../lib/attendanceV2/types';

const V2_PENDING_STATUSES = new Set(['QUEUED', 'RETRYABLE', 'SYNCING', 'DEPENDENCY_WAITING']);
const V2_INTERVENTION_STATUSES = new Set(['FAILED_PERMANENT', 'CONFLICT', 'REJECTED', 'DEPENDENCY_FAILED']);

export const SyncStatus: React.FC = () => {
    const { pendingSync, isSyncing, syncError, processSyncQueue, clearSyncQueue, userRole } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isV2Syncing, setIsV2Syncing] = useState(false);
    const [v2PendingCount, setV2PendingCount] = useState(0);
    const [v2PendingEvents, setV2PendingEvents] = useState<QueuedAttendanceEvent[]>([]);
    const [v2InterventionEvents, setV2InterventionEvents] = useState<QueuedAttendanceEvent[]>([]);
    const pendingCount = pendingSync.length + v2PendingCount;
    const effectiveIsSyncing = isSyncing || isV2Syncing;
    const hasIntervention = v2InterventionEvents.length > 0;

    const refreshV2Count = async () => {
        try {
            const [queuedEvents, pendingMedia] = await Promise.all([
                attendanceV2Db.getAllQueuedEvents(),
                attendanceV2Db.getPendingMediaBlobs()
            ]);
            const pendingEvList = queuedEvents.filter(e => V2_PENDING_STATUSES.has(e.sync_status));
            const interventionList = queuedEvents.filter(e => V2_INTERVENTION_STATUSES.has(e.sync_status));
            setV2PendingEvents(pendingEvList);
            setV2InterventionEvents(interventionList);
            setV2PendingCount(pendingEvList.length + pendingMedia.length);
        } catch {
            // non-fatal
        }
    };

    const triggerFullSync = async () => {
        await processSyncQueue();
        if (navigator.onLine) {
            try {
                const { engine, mediaSync } = getAttendanceV2Engine();
                await engine.syncOfflineQueue();
                await mediaSync.syncAllPendingMedia();
            } catch { /* non-fatal */ }
        }
        await refreshV2Count();
    };

    useEffect(() => {
        const { engine } = getAttendanceV2Engine();
        setIsV2Syncing(engine.isSyncing());
        const unsubscribeSync = engine.onSyncStateChange((active) => {
            setIsV2Syncing(active);
            if (!active) {
                refreshV2Count();
            }
        });

        refreshV2Count();
        const interval = setInterval(refreshV2Count, 15000);
        const handleOnline = () => {
            setIsOffline(false);
            triggerFullSync();
        };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            unsubscribeSync();
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [processSyncQueue]);

    const renderBadge = () => {
        if (pendingCount === 0 && !effectiveIsSyncing && !syncError && !hasIntervention) {
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

        if (syncError || hasIntervention) {
            return (
                <button 
                    onClick={() => setIsOpen(true)}
                    title={hasIntervention ? `${v2InterventionEvents.length} attendance event(s) require management review` : "Sync Error"}
                    className="group relative flex items-center h-8 rounded-full bg-red-50 border border-red-100 text-red-600 shadow-xs animate-pulse transition-all duration-300 ease-in-out px-2 hover:px-3 hover:bg-red-100 hover:border-red-200 active:scale-95 cursor-pointer select-none shrink-0"
                >
                    <AlertCircle size={16} className="shrink-0" />
                    {hasIntervention && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white shadow-sm pointer-events-none">
                            {v2InterventionEvents.length}
                        </span>
                    )}
                    <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold leading-none select-none">
                        {hasIntervention ? 'Revisión Requerida' : 'Error Sync'}
                    </span>
                </button>
            );
        }

        if (effectiveIsSyncing) {
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
                                {pendingSync.length > 0 && userRole && ['Manager', 'HR'].includes(userRole) && (
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
                                        disabled={effectiveIsSyncing}
                                        onClick={() => triggerFullSync()}
                                        className="h-8 text-xs font-bold bg-brand-teal hover:bg-brand-teal/90 text-white rounded-lg gap-1.5 shadow-sm"
                                    >
                                        <RefreshCw size={14} className={effectiveIsSyncing ? "animate-spin" : ""} />
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

                        {hasIntervention && (
                            <div className="m-4 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2" data-testid="v2-intervention-panel">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="text-amber-700 mt-0.5 shrink-0" size={18} />
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-amber-900">
                                            Attendance Events Requiring Management Review ({v2InterventionEvents.length})
                                        </h4>
                                        <p className="text-xs text-amber-800 leading-relaxed">
                                            Local attendance evidence is preserved and has not been deleted. Contact HR or your supervisor for reconciliation.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                    {v2InterventionEvents.map((ev) => (
                                        <div key={ev.event_id} className="text-xs bg-white/80 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="font-bold text-amber-950">{ev.event_type}</span>
                                                <span className="ml-2 text-[10px] font-mono text-amber-700">{ev.sync_status}</span>
                                                {ev.error_message && (
                                                    <p className="text-[11px] text-amber-800 truncate">{ev.error_message}</p>
                                                )}
                                            </div>
                                            <code className="text-[10px] font-mono text-gray-500 shrink-0">{ev.event_id.slice(0, 8)}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {pendingCount === 0 && !hasIntervention ? (
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
                            <div className="p-4 space-y-4">
                                {v2PendingEvents.length > 0 && (
                                    <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm bg-gray-50/30">
                                        <div className="px-4 py-2 bg-white border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-brand-teal">
                                            Attendance V2 Offline Queue ({v2PendingEvents.length})
                                        </div>
                                        <Table>
                                            <TableHeader className="bg-white">
                                                <TableRow className="hover:bg-transparent border-gray-100">
                                                    <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-wider text-gray-400">Time</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Event</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Event ID</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {v2PendingEvents.map((ev) => (
                                                    <TableRow key={ev.event_id} className="bg-white hover:bg-gray-50/50 border-gray-100 transition-colors">
                                                        <TableCell className="text-[11px] font-medium text-gray-500 py-3">
                                                            {ev.device_event_timestamp ? format(new Date(ev.device_event_timestamp), 'HH:mm:ss') : 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-xs font-bold text-accent-greyDark">
                                                            {ev.event_type}
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-tighter bg-blue-50 text-blue-600 border border-blue-100">
                                                                {ev.sync_status}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 truncate max-w-[150px] block">
                                                                {ev.event_id}
                                                            </code>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {pendingSync.length > 0 && (
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
                                )}
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
