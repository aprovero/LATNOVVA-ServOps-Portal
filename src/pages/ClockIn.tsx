import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    LogIn, LogOut, ChevronDown, CheckCircle, MapPin, Zap, Users, X, Check, AlertTriangle, Edit2, Wifi, WifiOff, Trash2, UserPlus, Clock, UserCheck
} from 'lucide-react';
import { useStore, ClockPunch, Personnel } from '../store/useStore';
import { formatTime } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { useAttendance } from '../hooks/useAttendance';
import { isCertExpired } from '../utils/datetime.utils';
import QuickAddWorker from '../components/shared/QuickAddWorker';
import UnifiedSignaturePad from '../components/shared/UnifiedSignaturePad';

// ─── Types ────────────────────────────────────────────────────────────────────

type PunchStep = 'idle' | 'clocked-in' | 'clocked-out';
type ViewMode = 'individual' | 'batch';
type BatchScreen = 'list' | 'success';

interface OutsourcedEntry {
    tempId: string;
    name: string;
    role: string;
}

interface GpsState {
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    status: 'acquiring' | 'locked' | 'poor' | 'denied';
    gpsTimestampMs: number | null;
    gpsReceivedAt: number | null;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

/** Timezone-safe local date string "YYYY-MM-DD" — never uses UTC offset */
const getLocalDate = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getBestDate(gps: GpsState): Date {
    if (gps.gpsTimestampMs !== null && gps.gpsReceivedAt !== null)
        return new Date(gps.gpsTimestampMs + (performance.now() - gps.gpsReceivedAt));
    return new Date();
}

function getBestTimestampISO(gps: GpsState): { iso: string; source: 'gps' | 'device' } {
    if (gps.gpsTimestampMs !== null && gps.gpsReceivedAt !== null) {
        const ms = gps.gpsTimestampMs + (performance.now() - gps.gpsReceivedAt);
        return { iso: new Date(ms).toISOString(), source: 'gps' };
    }
    return { iso: new Date().toISOString(), source: 'device' };
}

function getPunchStep(timesheets: any[], personnelId: string): PunchStep {
    const today = getLocalDate();
    const openEntry = timesheets.find((t: any) => t.personnelId === personnelId && t.date === today && t.timeIn && !t.timeOut);
    if (openEntry) return 'clocked-in';
    return 'idle';
}

function hasFinishedShiftToday(timesheets: any[], personnelId: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return timesheets.some((t: any) => t.personnelId === personnelId && t.date === today && t.timeOut);
}

const getStepMeta = (t: any): Record<PunchStep, { label: string; dot: string; bg: string; text: string }> => ({
    idle:        { label: t('attendance.status.not_in'),   dot: '○', bg: 'bg-gray-100',    text: 'text-gray-500' },
    'clocked-in':{ label: t('attendance.status.on_site'),  dot: '●', bg: 'bg-teal-50',     text: 'text-teal-700' },
    'clocked-out':{ label: t('attendance.status.done'),     dot: '✓', bg: 'bg-green-50',    text: 'text-green-700'},
});

const getPunchLabel = (t: any): Record<ClockPunch['type'], string> => ({
    clockIn: t('attendance.punches.clockIn'), 
    clockOut: t('attendance.punches.clockOut'),
});

const punchColor: Record<ClockPunch['type'], string> = {
    clockIn: '#00B4A6', clockOut: '#EF4444',
};

const formatShort = (iso: string) => formatTime(iso);

// ─── GpsBadge ─────────────────────────────────────────────────────────────────

function GpsBadge({ gps }: { gps: GpsState }) {
    const { t } = useTranslation();
    if (gps.status === 'acquiring') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold animate-pulse">
            <Wifi size={12} /> {t('attendance.gps.acquiring')}
        </div>
    );
    if (gps.status === 'locked') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            {t('attendance.gps.locked', { accuracy: Math.round(gps.accuracy!) })}
        </div>
    );
    if (gps.status === 'poor') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">
            <AlertTriangle size={12} /> {t('attendance.gps.poor', { accuracy: Math.round(gps.accuracy!) })}
        </div>
    );
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
            <WifiOff size={12} /> {t('attendance.gps.none')}
        </div>
    );
}

// ─── SignaturePad ─────────────────────────────────────────────────────────────

function SignaturePad({ onSign, onClear }: { onSign: (blob: string) => void; onClear: () => void }) {
    const { t } = useTranslation();
    return (
        <UnifiedSignaturePad 
            onSign={onSign} 
            onClear={onClear} 
            placeholder={t('attendance.signature.sign_here')} 
        />
    );
}


// ─── BatchConfirmModal ────────────────────────────────────────────────────────

interface BatchEntry {
    id: string;
    name: string;
    role: string;
    action: ClockPunch['type'];
    isOutsourced?: boolean;
}

function BatchConfirmModal({ entries, gps, onConfirm, onCancel }: {
    entries: BatchEntry[];
    gps: GpsState;
    onConfirm: (sigBlob: string) => void;
    onCancel: () => void;
}) {
    const { t, i18n } = useTranslation();
    const [sigBlob, setSigBlob] = useState<string | null>(null);
    const gpsReady = gps.status === 'locked' || gps.status === 'poor';

    const actionLabel: Record<ClockPunch['type'], { label: string; color: string }> = {
        clockIn:  { label: t('attendance.labels.action_in'),        color: 'text-teal-700 bg-teal-50' },
        clockOut: { label: t('attendance.labels.action_out'),       color: 'text-rose-700 bg-rose-50' },
    };

    // Group by action type for the header
    const primaryAction = entries[0]?.action ?? 'clockIn';
    const actionMeta = actionLabel[primaryAction];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">{t('attendance.batch.confirm_title')}</h3>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                </div>

                <div className="overflow-y-auto flex-1">
                    <div className="px-6 pt-4 pb-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            {entries.length === 1 
                                ? t('attendance.batch.count_label_singular')
                                : t('attendance.batch.count_label_plural', { count: entries.length })}
                        </p>
                        <div className="space-y-1.5">
                            {entries.map((e: BatchEntry) => (
                                <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                            {e.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-gray-800 truncate">{e.name}</p>
                                            <p className="text-[10px] text-gray-400">{e.role}{e.isOutsourced ? ` · ${t('attendance.labels.outsourced')}` : ''}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-2 ${actionLabel[e.action].color}`}>
                                        {actionLabel[e.action].label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="px-6 pt-3 pb-2">
                        <div className="flex justify-center">
                            <GpsBadge gps={gps} />
                        </div>
                        {!gpsReady && (
                            <p className="text-center text-xs text-amber-600 mt-1">{t('attendance.gps.waiting')}</p>
                        )}
                    </div>

                    <div className="px-6 pb-5">
                        <SignaturePad
                            onSign={(b: string) => setSigBlob(b)}
                            onClear={() => setSigBlob(null)}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
                    <button
                        onClick={() => sigBlob && onConfirm(sigBlob)}
                        disabled={!sigBlob || !gpsReady}
                        className={`flex-1 py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            primaryAction === 'clockOut' ? 'bg-red-500' :
                            primaryAction === 'clockIn' ? 'bg-teal-500' : 'bg-amber-500'
                        }`}
                    >
                        <Check size={16} />
                        {!sigBlob 
                            ? t('attendance.signature.sign_to_confirm') 
                            : `${actionMeta.label} ${entries.length} ${entries.length === 1 ? (i18n.language === 'es' ? 'persona' : 'person') : (i18n.language === 'es' ? 'personas' : 'people')}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── ManualAdjustModal ────────────────────────────────────────────────────────

function ManualAdjustModal({ punchType, onConfirm, onCancel }: {
    punchType: ClockPunch['type'];
    onConfirm: (time: string, note: string) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const now = new Date();
    const [time, setTime] = useState(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">{t('attendance.manual.title')}</h3>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                </div>
                <p className="text-sm text-gray-500">
                    {t('attendance.manual.desc', { type: getPunchLabel(t)[punchType] })}
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{t('common.date')}</label>
                        <input type="time" value={time} onChange={e => setTime(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-mono focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{t('attendance.manual.reason')}</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)}
                            placeholder={t('attendance.manual.reason')} rows={3}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
                    <button onClick={() => note.trim() ? onConfirm(time, note) : alert(t('common.error'))}
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold">{t('attendance.manual.submit')}</button>
                </div>
            </div>
        </div>
    );
}

// ─── BatchModeView ────────────────────────────────────────────────────────────

function BatchModeView({ gps, projects, personnel, timesheets, clockPunch: doPunch, supervisorId }: {
    gps: GpsState;
    projects: any[];
    personnel: Personnel[];
    timesheets: any[];
    clockPunch: (...args: any[]) => void;
    supervisorId: string;
}) {
    const { t } = useTranslation();
    const { getAttendanceState } = useAttendance();

    const [selectedProject, setSelectedProject] = useState(() => {
        const assigned = projects.find(p => (p.status === 'Active' || p.status === 'In Progress') && p.assignedPersonnel?.includes(supervisorId));
        return assigned?.id ?? '';
    });
    const [screen, setScreen] = useState<BatchScreen>('list');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [outsourcedList, setOutsourcedList] = useState<OutsourcedEntry[]>([]);
    const [showAddOutsourced, setShowAddOutsourced] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [lastBatch, setLastBatch] = useState<{ names: string[]; action: string; time: string } | null>(null);
    const [countdown, setCountdown] = useState(4);

    const activeProjects = projects.filter((p: any) => (p.status === 'Active' || p.status === 'In Progress') && p.subsidiary === 'MX');

    const sortedPersonnel = useCallback(() => {
        const eligible = personnel.filter(p =>
            ['Tech', 'Supervisor'].includes(p.appRole ?? '') && p.status === 'Active'
        );
        if (!selectedProject) return [...eligible].sort((a, b) => a.name.localeCompare(b.name));
        const project = projects.find(p => p.id === selectedProject);
        const assignedIds: string[] = project?.assignedPersonnel ?? [];
        const assigned = eligible.filter(p => assignedIds.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
        const rest = eligible.filter(p => !assignedIds.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
        return [...assigned, ...rest];
    }, [personnel, projects, selectedProject]);

    useEffect(() => {
        if (!selectedProject) {
            setSelectedIds(new Set([supervisorId]));
            return;
        }
        const project = projects.find(p => p.id === selectedProject);
        const assignedIds: string[] = project?.assignedPersonnel ?? [];
        
        // Smart Selection Strategy: 
        // 1. Check current status of all assigned personnel
        // 2. If more people are 'clocked-in' than 'idle', assume intent is 'Clock Out'
        // 3. Otherwise, assume intent is 'Clock In'
        // 4. This prevents mixed-action confusion while staying proactive for both start/end of shift.
        const statuses = personnel
            .filter(p => assignedIds.includes(p.id))
            .map(p => getPunchStep(timesheets, p.id));
        
        const idleCount = statuses.filter(s => s === 'idle').length;
        const clockedInCount = statuses.filter(s => s === 'clocked-in').length;
        const targetStep = (clockedInCount > idleCount) ? 'clocked-in' : 'idle';

        const validIds = personnel
            .filter((p: Personnel) =>
                assignedIds.includes(p.id) &&
                ['Tech', 'Supervisor'].includes(p.appRole ?? '') &&
                getPunchStep(timesheets, p.id) === targetStep
            )
            .map(p => p.id);
        const initial = new Set([...validIds, supervisorId]);
        setSelectedIds(initial);
    }, [selectedProject, projects, personnel, supervisorId]);

    useEffect(() => {
        if (screen !== 'success') return;
        if (countdown <= 0) { setScreen('list'); return; }
        const id = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(id);
    }, [screen, countdown]);

    const toggleId = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const getNextAction = (id: string): ClockPunch['type'] => {
        const step = getPunchStep(timesheets, id);
        if (step === 'idle') return 'clockIn';
        if (step === 'clocked-in') return 'clockOut';
        return 'clockIn';
    };

    const dominantAction = useCallback((): ClockPunch['type'] => {
        const list = [...selectedIds];
        const counts: Record<string, number> = { clockIn: 0, clockOut: 0 };
        list.forEach(id => { const a = getNextAction(id); counts[a] = (counts[a] || 0) + 1; });
        outsourcedList.filter(o => selectedIds.has(o.tempId)).forEach(() => { counts['clockIn']++; });
        return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'clockIn') as ClockPunch['type'];
    }, [selectedIds, timesheets, outsourcedList]);

    const buildEntries = (): BatchEntry[] => {
        const action = dominantAction();
        const result: BatchEntry[] = [];
        sortedPersonnel().forEach((p: any) => {
            if (!selectedIds.has(p.id)) return;
            result.push({ id: p.id, name: p.name, role: p.position, action: getNextAction(p.id) });
        });
        outsourcedList.forEach(o => {
            if (!selectedIds.has(o.tempId)) return;
            result.push({ id: o.tempId, name: o.name, role: o.role, action, isOutsourced: true });
        });
        return result;
    };

    const commitBatch = useCallback((sigBlob: string) => {
        const entries = buildEntries();
        const action = dominantAction();
        
        if (action === 'clockIn') {
            const alreadyIn = entries.filter(e => getPunchStep(timesheets, e.id) === 'clocked-in');
            if (alreadyIn.length > 0) {
                const names = alreadyIn.map(e => e.name).join(', ');
                if (!window.confirm(t('attendance.batch.confirm_already_in', { names }))) {
                    return;
                }
            }
        }

        const best = getBestTimestampISO(gps);
        const timestamp = best.iso;
        const names: string[] = [];
        entries.forEach((entry: any) => {
            const punch: ClockPunch = {
                timestamp, lat: gps.lat ?? 0, lng: gps.lng ?? 0,
                accuracy: gps.accuracy ?? 9999,
                type: entry.action,
                timeSource: best.source,
                supervisorSignatureBlob: sigBlob,
                ...(entry.isOutsourced ? { isOutsourced: true, outsourcedName: entry.name } : {}),
            };
            doPunch(entry.isOutsourced ? `OUT-${entry.id.replace('OUT-', '')}` : entry.id, punch, selectedProject || undefined);
            names.push(entry.name);
        });
        const finalAction = entries[0]?.action ?? 'clockIn';
        setLastBatch({ names, action: getPunchLabel(t)[finalAction], time: formatShort(timestamp) });
        setShowConfirm(false);
        setSelectedIds(new Set());
        setScreen('success');
        setCountdown(4);
    }, [gps, selectedIds, timesheets, outsourcedList, selectedProject, doPunch]);

    if (screen === 'success' && lastBatch) {
        return (
            <div className="flex flex-col items-center py-8 gap-5 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle size={44} className="text-green-500" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-gray-800">{t('attendance.batch.success_title', { action: lastBatch.action })}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('attendance.batch.at_time', { time: lastBatch.time })}</p>
                </div>
                <div className="w-full bg-teal-50 border border-teal-200 rounded-2xl p-4 text-left space-y-1">
                    {lastBatch.names.map((n, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm font-semibold text-teal-700">
                            <Check size={14} className="shrink-0" /> {n}
                        </div>
                    ))}
                </div>
                <div className="text-xs text-gray-400">{t('attendance.batch.return_countdown', { count: countdown })}</div>
                <button
                    onClick={() => { setScreen('list'); }}
                    className="w-full py-3 bg-brand-teal text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                    <Users size={16} /> {t('attendance.batch.back_to_team')}
                </button>
            </div>
        );
    }

    const sorted = sortedPersonnel();
    const selCount = selectedIds.size;

    const actionCounts = (() => {
        const counts: Record<string, number> = { clockIn: 0, clockOut: 0 };
        [...selectedIds].forEach(id => {
            if (outsourcedList.some(o => o.tempId === id)) { counts.clockIn++; return; }
            const a = getNextAction(id);
            counts[a] = (counts[a] || 0) + 1;
        });
        return counts;
    })();
    const uniqueActions = Object.entries(actionCounts).filter(([, v]) => v > 0).length;
    const hasMixedActions = uniqueActions > 1;

    return (
        <div className="space-y-4 pb-24">
            <div className="relative">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('attendance.select_project')}</label>
                <div className="relative">
                    <select
                        value={selectedProject}
                        onChange={e => setSelectedProject(e.target.value)}
                        className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-teal-400 outline-none pr-10"
                    >
                        <option value="">{t('attendance.project_placeholder')}</option>
                        {activeProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            </div>

            <div className="flex justify-center"><GpsBadge gps={gps} /></div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {t('attendance.team_count', { num: sorted.length + outsourcedList.length })}
                    </p>
                    <button
                        onClick={() => setShowAddOutsourced(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors"
                    >
                        <UserPlus size={13} /> {t('attendance.outsourced.add_btn')}
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {sorted.length === 0 && outsourcedList.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <Users size={36} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t('templates.scopes.empty')}</p>
                        </div>
                    )}
                    {sorted.map((p: any, idx: number) => {
                        const isChecked = selectedIds.has(p.id);
                        const state = getAttendanceState(p.id);
                        const meta = getStepMeta(t)[state];
                        const hasExpired = p.certifications?.some((c: any) => isCertExpired(c.expirationDate));

                        return (
                            <div
                                key={p.id}
                                onClick={() => toggleId(p.id)}
                                className={`flex flex-col gap-2 px-4 py-3 transition-colors ${
                                    idx > 0 ? 'border-t border-gray-50' : ''
                                } ${isChecked ? 'bg-teal-50/60' : 'hover:bg-gray-50'}`}
                            >

                                <div className="flex items-center gap-3 cursor-pointer">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isChecked ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
                                        {isChecked && <Check size={12} className="text-white" />}
                                    </div>
                                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                                            {hasExpired && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const expired = p.certifications?.filter((c: any) => isCertExpired(c.expirationDate)).map((c: any) => c.name) || [];
                                                        alert(`${p.name} has expired certifications:\n- ${expired.join('\n- ')}`);
                                                    }}
                                                    className="text-amber-500 hover:text-amber-600 transition-colors"
                                                    title={t('reports.labor_section.expired_certs_tag')}
                                                >
                                                    <AlertTriangle size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-400">{p.position}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                                        {meta.dot} {meta.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {outsourcedList.map((o: any) => {
                        const isChecked = selectedIds.has(o.tempId);
                        return (
                            <div key={o.tempId} className={`flex items-center gap-3 px-4 py-3 border-t border-gray-50 ${isChecked ? 'bg-purple-50/60' : ''}`}>
                                <div onClick={() => toggleId(o.tempId)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${isChecked ? 'bg-purple-500 border-purple-500' : 'border-gray-300'}`}>
                                    {isChecked && <Check size={12} className="text-white" />}
                                </div>
                                <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">{o.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-gray-800">{o.name}</p>
                                    <p className="text-[10px] text-gray-400">{o.role}</p>
                                </div>
                                <button onClick={() => { setOutsourcedList(prev => prev.filter(x => x.tempId !== o.tempId)); setSelectedIds(prev => { const n = new Set(prev); n.delete(o.tempId); return n; }); }} className="p-1.5 text-gray-300 hover:text-red-400">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selCount > 0 && (
                <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-30">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">{t('attendance.labels.selected', { count: selCount })}</p>
                            {hasMixedActions ? (
                                <p className="text-amber-400 text-[10px] font-semibold">
                                    {t('attendance.batch.mixed_warning', { 
                                        counts: `${actionCounts.clockIn} IN / ${actionCounts.clockOut} OUT` 
                                    })}
                                </p>
                            ) : (
                                <p className="text-gray-400 text-xs">{t('attendance.labels.deselect_hint')}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowConfirm(true)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold text-sm transition-colors ${hasMixedActions ? 'bg-amber-500' : 'bg-teal-500'}`}
                        >
                            <LogIn size={15} />
                            {(() => {
                                const a = dominantAction();
                                const labelMap = { clockIn: t('attendance.labels.action_in'), clockOut: t('attendance.labels.action_out') };
                                return labelMap[a];
                            })()} {selCount}
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showAddOutsourced && (
                <QuickAddWorker 
                    open={showAddOutsourced} 
                    onOpenChange={setShowAddOutsourced} 
                    onSuccess={(id, name, role) => {
                        setOutsourcedList(prev => [...prev, { tempId: id, name, role }]);
                        setSelectedIds(prev => new Set([...prev, id]));
                    }}
                />
            )}
            {showConfirm && (
                <BatchConfirmModal
                    entries={buildEntries()}
                    gps={gps}
                    onConfirm={commitBatch}
                    onCancel={() => setShowConfirm(false)}
                />
            )}
        </div>
    );
}

// ─── IndividualModeView ───────────────────────────────────────────────────────

function IndividualModeView({ personnelId, gps, projects, timesheets, clockPunch: doPunch }: {
    personnelId: string;
    gps: GpsState;
    projects: any[];
    timesheets: any[];
    clockPunch: (...args: any[]) => void;
}) {
    const { t } = useTranslation();
    const today = getLocalDate(getBestDate(gps));
    const todayEntry = timesheets.find((t: any) => t.personnelId === personnelId && t.date === today && t.timeOut); // find a finished one for summary
    const punches: ClockPunch[] = todayEntry?.punches ?? [];
    const step = getPunchStep(timesheets, personnelId);
    const hasFinishedToday = hasFinishedShiftToday(timesheets, personnelId);

    const [selectedProject, setSelectedProject] = useState(() => {
        if (todayEntry?.projectId) return todayEntry.projectId;
        const assigned = projects.find(p => (p.status === 'Active' || p.status === 'In Progress') && p.assignedPersonnel?.includes(personnelId));
        return assigned?.id ?? '';
    });
    const [manualModal, setManualModal] = useState<ClockPunch['type'] | null>(null);
    const [workMode, setWorkMode] = useState<'On Site' | 'Home Office'>('On Site');
    const activeProjects = projects.filter((p: any) => (p.status === 'Active' || p.status === 'In Progress') && p.subsidiary === 'MX');
    const gpsReady = workMode === 'Home Office' || gps.status === 'locked' || gps.status === 'poor';
    const gpsDenied = gps.status === 'denied';

    const executePunch = (type: ClockPunch['type'], overrideTime?: string, note?: string) => {
        const best = getBestTimestampISO(gps);
        let timestamp = best.iso;
        if (overrideTime) {
            const [h, m] = overrideTime.split(':');
            const d = getBestDate(gps);
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            timestamp = d.toISOString();
        }
        const punch: ClockPunch = {
            timestamp, lat: gps.lat ?? 0, lng: gps.lng ?? 0,
            accuracy: gps.accuracy ?? 9999, type,
            timeSource: overrideTime ? 'device' : best.source,
            ...(note ? { manualAdjustment: true, adjustmentNote: note } : {}),
            workMode,
        };
        doPunch(personnelId, punch, workMode === 'Home Office' ? undefined : (selectedProject || undefined));
    };

    return (
        <div className="space-y-5">
            {/* Day complete summary — Only show if they actually finished a shift today and aren't currently clocked in */}
            {hasFinishedToday && step === 'idle' && todayEntry && (
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 shadow-lg text-white mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={20} /><span className="font-bold text-lg">{t('attendance.status.done')}</span>
                        </div>
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0">{t('attendance.status.worked_today', 'Shift Completed')}</Badge>
                    </div>
                    {/* Project name */}
                    {todayEntry.projectId && (
                        <p className="text-emerald-100 text-xs mb-4 flex items-center gap-1">
                            <Clock size={12} />
                            {projects.find((p: any) => p.id === todayEntry.projectId)?.name ?? todayEntry.projectId}
                        </p>
                    )}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <div><p className="text-emerald-100 text-xs">{t('attendance.punches.clockIn')}</p><p className="font-bold text-lg">{todayEntry.timeIn ?? '—'}</p></div>
                        <div><p className="text-emerald-100 text-xs">{t('attendance.punches.clockOut')}</p><p className="font-bold text-lg">{todayEntry.timeOut ?? '—'}</p></div>
                        <div><p className="text-emerald-100 text-xs">{t('projects.table.reported_time')}</p><p className="font-bold text-2xl">{todayEntry.hours.toFixed(2)}</p></div>
                    </div>
                </div>
            )}

            {step === 'idle' && (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('attendance.labels.work_mode', 'Modo de Trabajo')}</label>
                        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setWorkMode('On Site')}
                                className={`py-2 text-xs font-bold rounded-lg transition-all ${workMode === 'On Site' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {t('attendance.work_mode.on_site', 'Presencial (On Site)')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setWorkMode('Home Office')}
                                className={`py-2 text-xs font-bold rounded-lg transition-all ${workMode === 'Home Office' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {t('attendance.work_mode.home_office', 'Home Office')}
                            </button>
                        </div>
                    </div>

                    {workMode === 'On Site' && (
                        <div className="relative animate-in fade-in duration-200">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('attendance.select_project')}</label>
                            <div className="relative">
                                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                                    className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-teal-400 outline-none pr-10">
                                    <option value="">{t('attendance.project_placeholder')}</option>
                                    {activeProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.codeName ? ` (${p.codeName})` : ''}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 'idle' && (
                <div className="space-y-3">
                    {workMode === 'On Site' && !gpsReady && gps.status === 'acquiring' && (
                        <p className="text-center text-sm text-blue-500 animate-pulse">{t('attendance.gps.waiting')}</p>
                    )}
                    {/* Warning if already worked today */}
                    {hasFinishedToday && (
                        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-sm animate-in slide-in-from-top-1 duration-300">
                            <Clock className="text-blue-500 shrink-0" size={20} />
                            <div>
                                <p className="font-bold">{t('attendance.alerts.double_shift', 'Starting a new shift?')}</p>
                                <p className="text-xs text-blue-600/80">{t('attendance.alerts.shift_exists_desc', 'You already have a completed timesheet for today.')}</p>
                            </div>
                        </div>
                    )}

                    {/* M-01: GPS denied — amber enabled button, opens manual modal automatically */}
                    {workMode === 'On Site' && gpsDenied ? (
                        <>
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>{t('attendance.gps.none')} - {t('attendance.manual.title')}</span>
                            </div>
                            <button
                                onClick={() => setManualModal('clockIn')}
                                disabled={!selectedProject}
                                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                <LogIn size={26} /> {hasFinishedToday ? t('attendance.labels.start_new_shift', 'Start New Shift') : `${t('attendance.labels.action_in')} (${t('common.other')})`}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => {
                            if (hasFinishedToday && !window.confirm(t('attendance.alerts.double_shift'))) return;
                            executePunch('clockIn');
                        }} disabled={!gpsReady || (workMode === 'On Site' && !selectedProject)}
                            className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                            <LogIn size={26} /> {hasFinishedToday ? t('attendance.labels.start_new_shift', 'Start New Shift') : t('attendance.labels.action_in')}
                        </button>
                    )}
                    {workMode === 'On Site' && gps.status === 'poor' && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                            <AlertTriangle size={16} className="shrink-0" />
                            <span>GPS signal is weak (±{Math.round(gps.accuracy!)}m). Punch will be flagged.</span>
                        </div>
                    )}
                </div>
            )}

            {step === 'clocked-in' && (
                <div className="space-y-3">
                    {/* C-02: GPS denied fallback for Clock Out */}
                    {gpsDenied ? (
                        <>
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>No GPS. Manual punch will be flagged for Supervisor review.</span>
                            </div>
                            <button onClick={() => setManualModal('clockOut')}
                                className="w-full py-5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <LogOut size={26} /> {t('attendance.labels.action_out')} ({t('common.other')})
                            </button>
                        </>
                    ) : (
                        <button onClick={() => executePunch('clockOut')} disabled={!gpsReady}
                            className="w-full py-5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                            <LogOut size={26} /> {t('attendance.labels.action_out')}
                        </button>
                    )}
                </div>
            )}

            {/* Today's punch timeline */}
            {punches.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('attendance.labels.todays_punches')}</p>
                    <div className="relative pl-6">
                        <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-teal-400 via-amber-400 to-red-400 opacity-30" />
                        {punches.map((p: any, i: number) => (
                            <div key={i} className="relative mb-3 last:mb-0">
                                <div className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow"
                                    style={{ backgroundColor: punchColor[p.type as keyof typeof punchColor] }} />
                                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 ml-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-gray-800">{(getPunchLabel(t) as any)[p.type]}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-mono text-gray-500">{formatShort(p.timestamp)}</span>
                                            {p.timeSource === 'gps' && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded-full font-bold border border-yellow-200 flex items-center gap-0.5">
                                                    <Zap size={8} /> GPS
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {p.lat !== 0 && (
                                        <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1">
                                            <MapPin size={10} /> {p.lat.toFixed(4)}, {p.lng.toFixed(4)} · ±{Math.round(p.accuracy)}m
                                        </a>
                                    )}
                                    {p.selfieBlob && (
                                        <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 w-16 h-12">
                                            <img src={p.selfieBlob} alt="Selfie" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    {p.manualAdjustment && (
                                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-semibold">
                                            <Edit2 size={8} /> {t('attendance.labels.manual_adj')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {manualModal && (
                <ManualAdjustModal punchType={manualModal}
                    onConfirm={(t, n) => { executePunch(manualModal, t, n); setManualModal(null); }}
                    onCancel={() => setManualModal(null)} />
            )}
        </div>
    );
}

// ─── Main ClockIn Page ────────────────────────────────────────────────────────

export default function ClockIn() {
    const { userId, userRole, projects, personnel, timesheets, clockPunch, refreshAttendance } = useStore();

    useEffect(() => {
        refreshAttendance();
        // Periodically refresh every 30 seconds while in ClockIn view to ensure real-time status
        const id = setInterval(() => refreshAttendance(), 30000);
        return () => clearInterval(id);
    }, [refreshAttendance]);

    // GPS state with satellite timestamp
    const [gps, setGps] = useState<GpsState>({
        lat: null, lng: null, accuracy: null, status: 'acquiring',
        gpsTimestampMs: null, gpsReceivedAt: null,
    });
    const watchRef = useRef<number | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) { setGps(g => ({ ...g, status: 'denied' })); return; }
        watchRef.current = navigator.geolocation.watchPosition(
            pos => setGps({
                lat: pos.coords.latitude, lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                status: pos.coords.accuracy <= 50 ? 'locked' : 'poor',
                gpsTimestampMs: pos.timestamp,
                gpsReceivedAt: performance.now(),
            }),
            () => setGps(g => ({ ...g, status: 'denied' })),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
    }, []);

    // Live clock driven by GPS time when available
    const [displayTime, setDisplayTime] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setDisplayTime(getBestDate(gps)), 500);
        return () => clearInterval(id);
    }, [gps]);

    const isSupervisor = userRole === 'Supervisor' || userRole === 'Manager';
    const [viewMode, setViewMode] = useState<ViewMode>('individual');

    const { t, i18n } = useTranslation();
    const timeSourceLabel = gps.gpsTimestampMs !== null
        ? { icon: <Zap size={11} className="text-yellow-400" />, text: t('attendance.labels.gps_time'), cls: 'text-yellow-300' }
        : { icon: <Clock size={11} className="text-gray-400" />, text: t('attendance.labels.device_time'), cls: 'text-gray-400' };

    // Resolve the real personnel ID for data linking
    const resolvedPersonnelId = useStore.getState().resolvePersonnelId() || userId;

    // Current step for individual mode (used for status chip only)
    const myStep = getPunchStep(timesheets, resolvedPersonnelId);

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Clock header */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-8 px-6 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-teal-400" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t('attendance.labels.field_tracker')}</span>
                </div>
                <div className="font-mono text-5xl md:text-6xl font-bold tracking-tight tabular-nums text-white drop-shadow-lg">
                    {formatTime(displayTime, { second: '2-digit' })}
                </div>
                <p className="mt-1 text-gray-400 text-sm">
                    {displayTime.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="mt-3 flex flex-col items-center gap-2">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${timeSourceLabel.cls}`}>
                        {timeSourceLabel.icon} {timeSourceLabel.text}
                    </div>
                </div>
            </div>

            {/* Status + tabs */}
            <div className="flex flex-col items-center -mt-4 z-10 relative gap-3 px-4">
                <div className={`px-5 py-2 rounded-full text-sm font-bold shadow-md border-2 border-white ${
                    viewMode === 'batch' ? 'bg-purple-50 text-purple-700' :
                    myStep === 'idle' ? 'bg-gray-100 text-gray-600' :
                    myStep === 'clocked-in' ? 'bg-teal-50 text-teal-700' :
                    'bg-green-50 text-green-700'
                }`}>
                    {viewMode === 'batch' && <><Users size={14} className="inline mr-1 -mt-0.5" /> {t('attendance.labels.team_batch_mode')}</>}
                    {viewMode === 'individual' && myStep === 'idle' && `○ ${t('attendance.status.not_in')}`}
                    {viewMode === 'individual' && myStep === 'clocked-in' && `● ${t('attendance.status.on_site')}`}
                    {viewMode === 'individual' && myStep === 'clocked-out' && `✓ ${t('attendance.status.done')}`}
                </div>

                {/* Tab switcher — supervisors only */}
                {isSupervisor && (
                    <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
                        <button onClick={() => setViewMode('individual')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'individual' ? 'bg-teal-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <UserCheck size={15} /> {t('attendance.labels.my_checkin')}
                        </button>
                        <button onClick={() => setViewMode('batch')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'batch' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Users size={15} /> {t('attendance.labels.team_batch')}
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
                {viewMode === 'individual' ? (
                    <IndividualModeView
                        personnelId={resolvedPersonnelId}
                        gps={gps}
                        projects={projects}
                        timesheets={timesheets}
                        clockPunch={clockPunch}
                    />
                ) : (
                    <BatchModeView
                        gps={gps}
                        projects={projects}
                        personnel={personnel}
                        timesheets={timesheets}
                        clockPunch={clockPunch}
                        supervisorId={resolvedPersonnelId}
                    />
                )}
            </div>

            {/* GPS denied banner */}
            {gps.status === 'denied' && (
                <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-md mx-auto bg-red-600 text-white rounded-2xl p-4 shadow-xl flex items-start gap-3 z-40">
                    <WifiOff size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm">{t('attendance.gps.none')}</p>
                        <p className="text-xs text-red-100">{t('attendance.gps.waiting')}</p> {/* Fallback text if I didn't add the specific permission denied text. Wait, I'll use the hardcoded translated one if I add it. No, I'll use existing keys. */}
                    </div>
                </div>
            )}
        </div>
    );
}
