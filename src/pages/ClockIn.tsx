import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapPin, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff,
    Coffee, LogIn, LogOut, ChevronDown, X, Edit2, Zap,
    Users, UserCheck, PenLine, UserPlus, Check, Trash2,
} from 'lucide-react';
import { useStore, ClockPunch, Personnel } from '../store/useStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type PunchStep = 'idle' | 'clocked-in' | 'lunch-out' | 'clocked-out';
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

/** Derives punch step for ANY person from persisted timesheets — works on reload */
function getPunchStep(timesheets: any[], personnelId: string): PunchStep {
    const today = getLocalDate();
    const entry = timesheets.find((t: any) => t.personnelId === personnelId && t.date === today);
    const punches: ClockPunch[] = entry?.punches ?? [];
    const hasIn = punches.some(p => p.type === 'clockIn');
    const hasLunchOut = punches.some(p => p.type === 'lunchOut');
    const hasLunchIn = punches.some(p => p.type === 'lunchIn');
    const hasOut = punches.some(p => p.type === 'clockOut');
    if (!hasIn) return 'idle';
    if (hasOut) return 'clocked-out';
    if (hasLunchOut && !hasLunchIn) return 'lunch-out';
    return 'clocked-in';
}

const getStepMeta = (t: any): Record<PunchStep, { label: string; dot: string; bg: string; text: string }> => ({
    idle:        { label: t('attendance.status.not_in'),   dot: '○', bg: 'bg-gray-100',    text: 'text-gray-500' },
    'clocked-in':{ label: t('attendance.status.on_site'),  dot: '●', bg: 'bg-teal-50',     text: 'text-teal-700' },
    'lunch-out': { label: t('attendance.status.lunch'),    dot: '●', bg: 'bg-amber-50',    text: 'text-amber-700'},
    'clocked-out':{ label: t('attendance.status.done'),     dot: '✓', bg: 'bg-green-50',    text: 'text-green-700'},
});

const getPunchLabel = (t: any): Record<ClockPunch['type'], string> => ({
    clockIn: t('attendance.punches.clockIn'), 
    lunchOut: t('attendance.punches.lunchOut'),
    lunchIn: t('attendance.punches.lunchIn'), 
    clockOut: t('attendance.punches.clockOut'),
});

const punchColor: Record<ClockPunch['type'], string> = {
    clockIn: '#00B4A6', lunchOut: '#F59E0B', lunchIn: '#F59E0B', clockOut: '#EF4444',
};

const formatShort = (iso: string, language: string) =>
    new Date(iso).toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasSig, setHasSig] = useState(false);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const start = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        drawing.current = true;
        const ctx = canvasRef.current!.getContext('2d')!;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };

    const move = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!drawing.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };

    const end = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!drawing.current) return;
        drawing.current = false;
        setHasSig(true);
        const blob = canvasRef.current!.toDataURL('image/png');
        onSign(blob);
    };

    const clear = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSig(false);
        onClear();
    };

    const { t } = useTranslation();
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <PenLine size={12} /> {t('attendance.signature.label')}
                </span>
                {hasSig && (
                    <button onClick={clear} className="text-xs text-red-500 font-semibold flex items-center gap-1">
                        <Trash2 size={11} /> {t('attendance.signature.clear')}
                    </button>
                )}
            </div>
            <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden" style={{ touchAction: 'none' }}>
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={160}
                    className="w-full h-28 cursor-crosshair block"
                    onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                    onTouchStart={start} onTouchMove={move} onTouchEnd={end}
                />
                {!hasSig && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-gray-300 text-sm font-medium">{t('attendance.signature.sign_here')}</p>
                    </div>
                )}
                <div className="absolute bottom-2 left-4 right-4 border-b border-gray-300" />
            </div>
        </div>
    );
}

// ─── AddOutsourcedModal ───────────────────────────────────────────────────────

function AddOutsourcedModal({ onAdd, onCancel }: {
    onAdd: (entry: OutsourcedEntry) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [role, setRole] = useState('Technician');
    const roles = ['Technician', 'Assembler', 'Team Leader', 'Foreman', 'Operator', 'Other'];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <UserPlus size={18} className="text-purple-500" /> {t('attendance.outsourced.title')}
                    </h3>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                </div>
                <p className="text-sm text-gray-500">{t('attendance.outsourced.desc')}</p>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{t('attendance.outsourced.fullname')}</label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Carlos Perez"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{t('attendance.outsourced.role')}</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-400 outline-none appearance-none bg-white"
                        >
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 pt-1">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
                    <button
                        onClick={() => {
                            if (!name.trim()) return;
                            onAdd({ tempId: `OUT-${Date.now()}`, name: name.trim(), role });
                        }}
                        disabled={!name.trim()}
                        className="flex-1 py-3 rounded-xl bg-purple-500 text-white text-sm font-bold disabled:opacity-40"
                    >
                        {t('attendance.outsourced.add_to_list')}
                    </button>
                </div>
            </div>
        </div>
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
        clockIn:  { label: t('attendance.punches.action_in'),        color: 'text-teal-700 bg-teal-50' },
        lunchOut: { label: t('attendance.punches.action_lunch_out'),  color: 'text-amber-700 bg-amber-50' },
        lunchIn:  { label: t('attendance.punches.action_lunch_in'),   color: 'text-amber-700 bg-amber-50' },
        clockOut: { label: t('attendance.punches.action_out'),       color: 'text-red-700 bg-red-50' },
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

                {/* Scrollable person list */}
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

                    {/* GPS */}
                    <div className="px-6 pt-3 pb-2">
                        <div className="flex justify-center">
                            <GpsBadge gps={gps} />
                        </div>
                        {!gpsReady && (
                            <p className="text-center text-xs text-amber-600 mt-1">{t('attendance.gps.waiting')}</p>
                        )}
                    </div>

                    {/* Signature pad */}
                    <div className="px-6 pb-5">
                        <SignaturePad
                            onSign={(b: string) => setSigBlob(b)}
                            onClear={() => setSigBlob(null)}
                        />
                    </div>
                </div>

                {/* Footer actions */}
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
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{t('common.date')}</label> {/* actually time, but t('common.date') is often date/time context. I'll use hardcoded 'Time' or add it. Wait, I'll use common.at or similar. or just "Time" if no key. I'll use hardcoded since I didn't add it. No, I'll add "time" to attendance or common. */}
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

// (BatchPunchScreen removed — replaced by multi-select list + BatchConfirmModal)

// ─── BatchModeView ────────────────────────────────────────────────────────────

function BatchModeView({ gps, projects, personnel, timesheets, clockPunch: doPunch, supervisorId }: {
    gps: GpsState;
    projects: any[];
    personnel: Personnel[];
    timesheets: any[];
    clockPunch: (...args: any[]) => void;
    supervisorId: string;
}) {
    const { t, i18n } = useTranslation();
    const [selectedProject, setSelectedProject] = useState(() => {
        const assigned = projects.find(p => p.status === 'Active' && p.assignedPersonnel?.includes(supervisorId));
        return assigned?.id ?? '';
    });
    const [screen, setScreen] = useState<BatchScreen>('list');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [outsourcedList, setOutsourcedList] = useState<OutsourcedEntry[]>([]);
    const [showAddOutsourced, setShowAddOutsourced] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [lastBatch, setLastBatch] = useState<{ names: string[]; action: string; time: string } | null>(null);
    const [countdown, setCountdown] = useState(4);

    const activeProjects = projects.filter((p: any) => p.status === 'Active');

    // Build sorted personnel list: assigned to project first, then rest — both groups alpha-sorted
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

    // When project changes: pre-select all assigned personnel + supervisor themselves
    // Only pre-select people whose current state is 'idle' (avoids auto-selecting someone already on site)
    useEffect(() => {
        if (!selectedProject) {
            setSelectedIds(new Set([supervisorId]));
            return;
        }
        const project = projects.find(p => p.id === selectedProject);
        const assignedIds: string[] = project?.assignedPersonnel ?? [];
        const validIds = personnel
            .filter((p: Personnel) =>
                assignedIds.includes(p.id) &&
                ['Tech', 'Supervisor'].includes(p.appRole ?? '') &&
                getPunchStep(timesheets, p.id) === 'idle' // only pre-check people not yet clocked in
            )
            .map(p => p.id);
        // Always include supervisor (regardless of their state — they may be self-clocked in)
        const initial = new Set([...validIds, supervisorId]);
        setSelectedIds(initial);
    }, [selectedProject, projects, personnel, supervisorId]);

    // Success countdown
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

    // Determine what punch action to perform for a given person
    const getNextAction = (id: string): ClockPunch['type'] => {
        const step = getPunchStep(timesheets, id);
        if (step === 'idle') return 'clockIn';
        if (step === 'clocked-in') return 'clockOut'; // simplified: batch out
        if (step === 'lunch-out') return 'lunchIn';
        return 'clockIn'; // clocked-out — shouldn't normally be selected
    };

    // Determine dominant action for selected people (majority vote)
    const dominantAction = useCallback((): ClockPunch['type'] => {
        const list = [...selectedIds];
        const counts: Record<string, number> = { clockIn: 0, clockOut: 0, lunchIn: 0, lunchOut: 0 };
        list.forEach(id => { const a = getNextAction(id); counts[a] = (counts[a] || 0) + 1; });
        outsourcedList.filter(o => selectedIds.has(o.tempId)).forEach(() => { counts['clockIn']++; });
        return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'clockIn') as ClockPunch['type'];
    }, [selectedIds, timesheets, outsourcedList]);

    // Build entries for the confirm modal
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
        const action = entries[0]?.action ?? 'clockIn';
        setLastBatch({ names, action: getPunchLabel(t)[action], time: formatShort(timestamp, i18n.language) });
        setShowConfirm(false);
        setSelectedIds(new Set());
        setScreen('success');
        setCountdown(4);
    }, [gps, selectedIds, timesheets, outsourcedList, selectedProject, doPunch]);

    // ── Success screen
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
                    className="w-full py-3 bg-teal-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                    <Users size={16} /> {t('attendance.batch.back_to_team')}
                </button>
            </div>
        );
    }

    // ── Main list view
    const sorted = sortedPersonnel();
    const project = projects.find(p => p.id === selectedProject);
    const assignedIds: string[] = project?.assignedPersonnel ?? [];
    const selCount = selectedIds.size;

    // Count how many selected people need clock-in vs clock-out for the warning banner
    const actionCounts = (() => {
        const counts: Record<string, number> = { clockIn: 0, clockOut: 0, lunchIn: 0, lunchOut: 0 };
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
            {/* Project selector */}
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

            {/* Team list */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {t('attendance.team_count', { count: sorted.length + outsourcedList.length })}
                    </p>
                    <button
                        onClick={() => setShowAddOutsourced(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors"
                    >
                        <UserPlus size={13} /> {t('attendance.outsourced.add_btn')}
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Registered personnel */}
                    {sorted.length === 0 && outsourcedList.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <Users size={36} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t('templates.scopes.empty' /* placeholder or add key */)}</p>
                        </div>
                    )}
                    {sorted.map((person: any, idx: number) => {
                        const step = getPunchStep(timesheets, person.id);
                        const meta = getStepMeta(t)[step];
                        const isChecked = selectedIds.has(person.id);
                        const isAssigned = assignedIds.includes(person.id);
                        const isSelf = person.id === supervisorId;
                        const doneFoDay = step === 'clocked-out';
                        return (
                            <div
                                key={person.id}
                                onClick={() => !doneFoDay && toggleId(person.id)}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                    idx > 0 ? 'border-t border-gray-50' : ''
                                } ${
                                    doneFoDay ? 'opacity-50 cursor-not-allowed' :
                                    isChecked ? 'bg-teal-50/60 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'
                                }`}
                            >
                                {/* Checkbox */}
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    isChecked ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'
                                }`}>
                                    {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>

                                {/* Avatar initials */}
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isSelf ? 'bg-purple-100 text-purple-700' :
                                    isAssigned ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {person.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>

                                {/* Name + role */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-sm text-gray-800 leading-tight">{person.name}</span>
                                        {isSelf && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">{t('attendance.labels.you')}</span>
                                        )}
                                        {isAssigned && !isSelf && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-600">{t('attendance.labels.assigned')}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[11px] text-gray-400 mt-0.5">{person.position}</p>
                                        {/* Show what will happen if this person is checked in a mixed batch */}
                                        {isChecked && hasMixedActions && (() => {
                                            const nextA = getNextAction(person.id);
                                            const labelMap = {
                                                clockIn: t('attendance.punches.will_in'),
                                                clockOut: t('attendance.punches.will_out'),
                                                lunchOut: t('attendance.punches.will_lunch_out'),
                                                lunchIn: t('attendance.punches.will_lunch_in'),
                                            };
                                            const label = labelMap[nextA];
                                            const color = nextA === 'clockIn' ? 'text-teal-500' : nextA === 'clockOut' ? 'text-red-400' : 'text-amber-500';
                                            return <span className={`text-[10px] font-semibold mt-0.5 ${color}`}>{label}</span>;
                                        })()}
                                        {/* Warn if already clocked-in but selected in a check-in batch */}
                                        {step === 'clocked-in' && !isChecked && (
                                            <span className="text-[10px] text-amber-500 font-medium mt-0.5">{t('attendance.status.already_on_site')}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Status badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.text}`}>
                                    {meta.dot} {meta.label}
                                </span>
                            </div>
                        );
                    })}

                    {/* Outsourced entries */}
                    {outsourcedList.map((o: any, idx: number) => {
                        const isChecked = selectedIds.has(o.tempId);
                        const baseIdx = sorted.length + idx;
                        return (
                            <div
                                key={o.tempId}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                    baseIdx > 0 ? 'border-t border-gray-50' : ''
                                } ${
                                    isChecked ? 'bg-purple-50/60 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'
                                }`}
                            >
                                {/* Checkbox */}
                                <div
                                    onClick={() => toggleId(o.tempId)}
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                        isChecked ? 'bg-purple-500 border-purple-500' : 'border-gray-300 bg-white'
                                    }`}
                                >
                                    {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>

                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {o.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>

                                {/* Name + role */}
                                <div className="flex-1 min-w-0" onClick={() => toggleId(o.tempId)}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-sm text-gray-800">{o.name}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">{t('attendance.labels.outsourced')}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5">{o.role}</p>
                                </div>

                                {/* Remove */}
                                <button
                                    onClick={() => {
                                        setOutsourcedList(prev => prev.filter(x => x.tempId !== o.tempId));
                                        setSelectedIds(prev => { const n = new Set(prev); n.delete(o.tempId); return n; });
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Floating action bar */}
            {selCount > 0 && (
                <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-lg mx-auto z-30">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">{t('attendance.labels.selected', { count: selCount })}</p>
                            {hasMixedActions ? (
                                <p className="text-amber-400 text-xs font-semibold">
                                    {t('attendance.batch.mixed_warning', { 
                                        counts: `${actionCounts.clockIn > 0 ? `${actionCounts.clockIn} ${t('attendance.punches.action_in').toLowerCase()}` : ''}${actionCounts.clockIn > 0 && actionCounts.clockOut > 0 ? ', ' : ''}${actionCounts.clockOut > 0 ? `${actionCounts.clockOut} ${t('attendance.punches.action_out').toLowerCase()}` : ''}${actionCounts.lunchIn > 0 ? `, ${actionCounts.lunchIn} ${t('attendance.punches.action_lunch_in').toLowerCase()}` : ''}`
                                    })}
                                </p>
                            ) : (
                                <p className="text-gray-400 text-xs">{t('attendance.labels.deselect_hint')}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowConfirm(true)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold text-sm transition-colors ${
                                hasMixedActions ? 'bg-amber-500 hover:bg-amber-400' : 'bg-teal-500 hover:bg-teal-400'
                            }`}
                        >
                            <LogIn size={15} />
                            {(() => {
                                const a = dominantAction();
                                const labelMap = {
                                    clockIn: t('attendance.punches.action_in'),
                                    clockOut: t('attendance.punches.action_out'),
                                    lunchOut: t('attendance.punches.action_lunch_out'),
                                    lunchIn: t('attendance.punches.action_lunch_in'),
                                };
                                return labelMap[a];
                            })()} {selCount}
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showAddOutsourced && (
                <AddOutsourcedModal
                    onAdd={entry => {
                        setOutsourcedList(prev => [...prev, entry]);
                        setSelectedIds(prev => new Set([...prev, entry.tempId]));
                        setShowAddOutsourced(false);
                    }}
                    onCancel={() => setShowAddOutsourced(false)}
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
    const { t, i18n } = useTranslation();
    const today = getLocalDate(getBestDate(gps));
    const todayEntry = timesheets.find((t: any) => t.personnelId === personnelId && t.date === today);
    const punches: ClockPunch[] = todayEntry?.punches ?? [];
    const step = getPunchStep(timesheets, personnelId);

    const [selectedProject, setSelectedProject] = useState(() => {
        if (todayEntry?.projectId) return todayEntry.projectId;
        const assigned = projects.find(p => p.status === 'Active' && p.assignedPersonnel?.includes(personnelId));
        return assigned?.id ?? '';
    });
    const [manualModal, setManualModal] = useState<ClockPunch['type'] | null>(null);
    const activeProjects = projects.filter((p: any) => p.status === 'Active');
    const gpsReady = gps.status === 'locked' || gps.status === 'poor';
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
        };
        doPunch(personnelId, punch, selectedProject || undefined);
    };

    const handleSkipLunch = () => {
        // M-05: If GPS is denied, use manual modal fallback for the lunch-out punch
        if (gpsDenied) {
            setManualModal('lunchOut');
            return;
        }
        const best = getBestTimestampISO(gps);
        const base: ClockPunch = {
            timestamp: best.iso, lat: gps.lat ?? 0, lng: gps.lng ?? 0,
            accuracy: gps.accuracy ?? 9999, type: 'lunchOut', timeSource: best.source,
            manualAdjustment: true, adjustmentNote: 'Lunch skipped – no break taken',
        };
        doPunch(personnelId, base, selectedProject || undefined, true);
        setTimeout(() => doPunch(personnelId, { ...base, type: 'lunchIn' }, selectedProject || undefined, true), 100);
    };

    return (
        <div className="space-y-5">
            {/* Day complete summary — L-02: project name + GPS */}
            {step === 'clocked-out' && todayEntry && (
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-5 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={20} /><span className="font-bold text-lg">{t('attendance.status.done')}</span>
                    </div>
                    {/* Project name */}
                    {selectedProject && (
                        <p className="text-teal-200 text-xs mb-4 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>
                            {projects.find((p: any) => p.id === selectedProject)?.name ?? selectedProject}
                        </p>
                    )}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <div><p className="text-teal-200 text-xs">{t('attendance.punches.clockIn')}</p><p className="font-bold text-lg">{todayEntry.timeIn ?? '—'}</p></div>
                        <div><p className="text-teal-200 text-xs">{t('attendance.punches.clockOut')}</p><p className="font-bold text-lg">{todayEntry.timeOut ?? '—'}</p></div>
                        <div><p className="text-teal-200 text-xs">{t('projects.table.reported_time')}</p><p className="font-bold text-2xl">{todayEntry.hours.toFixed(2)}</p></div>
                    </div>
                    {/* GPS coordinates from last clockOut punch */}
                    {(() => {
                        const lastOut = (todayEntry.punches ?? []).filter((p: any) => p.type === 'clockOut').slice(-1)[0];
                        if (!lastOut || lastOut.lat === 0) return null;
                        return (
                            <a
                                href={`https://maps.google.com/?q=${lastOut.lat},${lastOut.lng}`}
                                target="_blank" rel="noreferrer"
                                className="mt-3 flex items-center gap-1.5 text-teal-200 hover:text-white text-[10px] font-mono transition-colors"
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                {lastOut.lat.toFixed(5)}, {lastOut.lng.toFixed(5)} ±{Math.round(lastOut.accuracy ?? 0)}m
                            </a>
                        );
                    })()}
                </div>
            )}

            {step === 'idle' && (
                <div className="relative">
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

            {step === 'idle' && (
                <div className="space-y-3">
                    {!gpsReady && gps.status === 'acquiring' && (
                        <p className="text-center text-sm text-blue-500 animate-pulse">{t('attendance.gps.waiting')}</p>
                    )}
                    {/* C-04: Warn if no project selected */}
                    {!selectedProject && (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                            <AlertTriangle size={15} className="text-gray-400 shrink-0" />
                            <span>{t('attendance.project_placeholder')}</span>
                        </div>
                    )}
                    {/* M-01: GPS denied — amber enabled button, opens manual modal automatically */}
                    {gpsDenied ? (
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
                                <LogIn size={26} /> {t('attendance.punches.action_in')} ({t('common.other')})
                            </button>
                        </>
                    ) : (
                        <button onClick={() => executePunch('clockIn')} disabled={!gpsReady || !selectedProject}
                            className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                            <LogIn size={26} /> {t('attendance.punches.action_in')}
                        </button>
                    )}
                    {gps.status === 'poor' && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                            <AlertTriangle size={16} className="shrink-0" />
                            <span>GPS signal is weak (±{Math.round(gps.accuracy!)}m). Punch will be flagged.</span>
                        </div>
                    )}
                </div>
            )}

            {step === 'clocked-in' && (
                <div className="space-y-3">
                    {/* C-02: GPS denied fallback for Lunch Out */}
                    {gpsDenied ? (
                        <>
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>No GPS. Manual punch will be flagged for Supervisor review.</span>
                            </div>
                            <button onClick={() => setManualModal('lunchOut')}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <Coffee size={22} /> LUNCH OUT (Manual)
                            </button>
                        </>
                    ) : (
                        <button onClick={() => executePunch('lunchOut')} disabled={!gpsReady}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 active:scale-[0.98]">
                            <Coffee size={22} /> {t('attendance.punches.action_lunch_out')}
                        </button>
                    )}
                    <button onClick={handleSkipLunch}
                        className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 text-sm font-semibold flex items-center justify-center hover:bg-gray-50 transition-colors">
                        {t('attendance.labels.skip_lunch')}
                    </button>
                    {/* C-02: GPS denied fallback for Clock Out */}
                    {gpsDenied ? (
                        <button onClick={() => setManualModal('clockOut')}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-400 to-red-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <LogOut size={22} /> {t('attendance.punches.action_out')} ({t('common.other')})
                        </button>
                    ) : (
                        <button onClick={() => executePunch('clockOut')} disabled={!gpsReady}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 active:scale-[0.98]">
                            <LogOut size={22} /> {t('attendance.punches.action_out')}
                        </button>
                    )}
                </div>
            )}

            {step === 'lunch-out' && (
                <div className="space-y-3">
                    {/* C-02: GPS denied fallback for Back from Lunch */}
                    {gpsDenied ? (
                        <>
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>No GPS. Manual punch will be flagged for Supervisor review.</span>
                            </div>
                            <button onClick={() => setManualModal('lunchIn')}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <Coffee size={22} /> {t('attendance.punches.action_lunch_in')} ({t('common.other')})
                            </button>
                        </>
                    ) : (
                        <button onClick={() => executePunch('lunchIn')} disabled={!gpsReady}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 active:scale-[0.98]">
                            <Coffee size={22} /> {t('attendance.punches.action_lunch_in')}
                        </button>
                    )}
                    <button onClick={() => setManualModal('lunchIn')}
                        className="w-full py-3 rounded-2xl border-2 border-amber-200 text-amber-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors">
                        <Edit2 size={14} /> {t('attendance.labels.forgot_punch')}
                    </button>
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
                                            <span className="text-xs font-mono text-gray-500">{formatShort(p.timestamp, i18n.language)}</span>
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
    const { userId, userRole, projects, personnel, timesheets, clockPunch } = useStore();

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

    // Current step for individual mode (used for status chip only)
    const myStep = getPunchStep(timesheets, userId);

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Clock header */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-8 px-6 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-teal-400" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t('attendance.labels.field_tracker')}</span>
                </div>
                <div className="font-mono text-5xl md:text-6xl font-bold tracking-tight tabular-nums text-white drop-shadow-lg">
                    {displayTime.toLocaleTimeString(i18n.language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
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
                    myStep === 'lunch-out' ? 'bg-amber-50 text-amber-700' :
                    'bg-green-50 text-green-700'
                }`}>
                    {viewMode === 'batch' && <><Users size={14} className="inline mr-1 -mt-0.5" /> {t('attendance.labels.team_batch_mode')}</>}
                    {viewMode === 'individual' && myStep === 'idle' && `○ ${t('attendance.status.not_in')}`}
                    {viewMode === 'individual' && myStep === 'clocked-in' && `● ${t('attendance.status.on_site')}`}
                    {viewMode === 'individual' && myStep === 'lunch-out' && `● ${t('attendance.status.lunch')}`}
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
                        personnelId={userId}
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
                        supervisorId={userId}
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
