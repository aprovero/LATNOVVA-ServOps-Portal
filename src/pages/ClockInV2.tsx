import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    LogIn, LogOut, ChevronDown, CheckCircle, Zap, Users, X, Check, AlertTriangle, Wifi, WifiOff, UserCheck, Coffee, Sun, FileSpreadsheet, Printer
} from 'lucide-react';
import { useStore, ClockPunch } from '../store/useStore';
import { formatTime } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { isCertExpired } from '../utils/datetime.utils';
import UnifiedSignaturePad from '../components/shared/UnifiedSignaturePad';
import CameraCapture from '../components/shared/CameraCapture';

// ─── Types ────────────────────────────────────────────────────────────────────
type PunchStep = 'idle' | 'clocked-in' | 'on-lunch' | 'clocked-out';
type ViewMode = 'individual' | 'batch';

interface GpsState {
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    status: 'acquiring' | 'locked' | 'poor' | 'denied';
    gpsTimestampMs: number | null;
    gpsReceivedAt: number | null;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────
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
    const openEntry = timesheets.find((t: any) => t.personnelId === personnelId && t.timeIn && !t.timeOut);
    if (!openEntry) {
        const today = getLocalDate();
        const finishedToday = timesheets.some((t: any) => t.personnelId === personnelId && t.date === today && t.timeOut);
        return finishedToday ? 'clocked-out' : 'idle';
    }
    const punches = openEntry.punches || [];
    const lastPunch = punches[punches.length - 1];
    if (lastPunch?.type === 'lunchOut') return 'on-lunch';
    return 'clocked-in';
}

const getStepMeta = (t: any): Record<PunchStep, { label: string; dot: string; bg: string; text: string }> => ({
    idle:        { label: t('attendance.status.not_in', 'Not Clocked In'),   dot: '○', bg: 'bg-slate-100',     text: 'text-slate-500' },
    'clocked-in':{ label: t('attendance.status.on_site', 'On Site'),          dot: '●', bg: 'bg-emerald-50',    text: 'text-emerald-700' },
    'on-lunch':  { label: t('attendance.punches.lunch_out', 'On Lunch'),      dot: '☕', bg: 'bg-amber-50',     text: 'text-amber-700' },
    'clocked-out':{ label: t('attendance.status.done', 'Shift Completed'),    dot: '✓', bg: 'bg-violet-50',     text: 'text-violet-700'},
});

function GpsBadge({ gps }: { gps: GpsState }) {
    const { t } = useTranslation();
    if (gps.status === 'acquiring') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold animate-pulse border border-blue-100">
            <Wifi size={12} /> {t('attendance.gps.acquiring', 'Acquiring GPS...')}
        </div>
    );
    if (gps.status === 'locked') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            {t('attendance.gps.locked', { accuracy: Math.round(gps.accuracy!) })}
        </div>
    );
    if (gps.status === 'poor') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold border border-amber-100">
            <AlertTriangle size={12} /> {t('attendance.gps.poor', { accuracy: Math.round(gps.accuracy!) })}
        </div>
    );
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full text-xs font-semibold border border-rose-100">
            <WifiOff size={12} /> {t('attendance.gps.none', 'No GPS')}
        </div>
    );
}

// ─── Verification Flow Modal ─────────────────────────────────────────────────
interface VerificationModalProps {
    workerName: string;
    punchType: ClockPunch['type'];
    gps: GpsState;
    onConfirm: (selfieBlob: string, sigBlob: string) => void;
    onCancel: () => void;
}

function VerificationModal({ workerName, punchType, gps, onConfirm, onCancel }: VerificationModalProps) {
    const { t } = useTranslation();
    const [selfie, setSelfie] = useState<string | null>(null);
    const [signature, setSignature] = useState<string | null>(null);

    const isOut = punchType === 'clockOut';
    const gpsReady = gps.status === 'locked' || gps.status === 'poor';

    return (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] border border-slate-100 overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold tracking-tight">{workerName}</h3>
                        <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                            {isOut ? <LogOut size={12} className="text-rose-400" /> : <LogIn size={12} className="text-emerald-400" />}
                            {isOut ? t('attendance.punches.clockOut', 'Clocking Out') : t('attendance.punches.clockIn', 'Clocking In')}
                        </p>
                    </div>
                    <button onClick={onCancel} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-6">
                    {/* GPS Alert */}
                    <div className="flex justify-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <GpsBadge gps={gps} />
                    </div>

                    {/* Step 1: Camera Selfie Capture */}
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <CameraCapture 
                            onCapture={(b) => setSelfie(b)}
                            onClear={() => setSelfie(null)}
                        />
                    </div>

                    {/* Step 2: Signature Drawing */}
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        <UnifiedSignaturePad
                            onSign={(b) => setSignature(b)}
                            onClear={() => setSignature(null)}
                            placeholder={t('attendance.signature.sign_here', 'Please draw your signature to verify identity')}
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button 
                        onClick={onCancel} 
                        className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={() => selfie && signature && onConfirm(selfie, signature)}
                        disabled={!selfie || !signature || !gpsReady}
                        className={`flex-1 py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                            isOut ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        }`}
                    >
                        <Check size={16} />
                        {!selfie ? t('personnel.profile_photo', 'Capture Photo') : !signature ? t('reports.labor_section.click_to_sign', 'Sign to Verify') : t('attendance.manual.submit', 'Confirm Punch')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Shift Export Functions ──────────────────────────────────────────────────
function performCsvExport(projectName: string, list: any[]) {
    const headers = ['Date', 'Name', 'Time In', 'Lunch Start', 'Lunch End', 'Time Out', 'Total Hours', 'GPS Status'];
    const rows = list.map(item => [
        item.date,
        item.name,
        item.timeIn || '—',
        item.lunchStart || '—',
        item.lunchEnd || '—',
        item.timeOut || '—',
        item.hours.toFixed(2),
        item.gpsVerified ? 'Verified' : 'Manual / Poor'
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ShiftReport_${projectName.replace(/\s+/g, '_')}_${getLocalDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClockInV2() {
    const { userId, userRole, projects, personnel, timesheets, clockPunch, refreshAttendance } = useStore();
    const { t, i18n } = useTranslation();

    // Supervisor view and mode management
    const isSupervisor = userRole === 'Supervisor' || userRole === 'Manager';
    const [viewMode, setViewMode] = useState<ViewMode>('individual');
    
    // GPS Tracking State
    const [gps, setGps] = useState<GpsState>({
        lat: null, lng: null, accuracy: null, status: 'acquiring',
        gpsTimestampMs: null, gpsReceivedAt: null,
    });
    const watchRef = useRef<number | null>(null);

    // Selected project for punch operations
    const resolvedPersonnelId = useStore.getState().resolvePersonnelId() || userId;
    const supervisorAssigned = projects.find(p => p.status === 'Active' && p.assignedPersonnel?.includes(resolvedPersonnelId));
    const [selectedProject, setSelectedProject] = useState(supervisorAssigned?.id ?? '');

    // Modal verification trigger states
    const [verificationTarget, setVerificationTarget] = useState<{
        workerId: string;
        workerName: string;
        punchType: ClockPunch['type'];
    } | null>(null);

    // Refresh timesheets on view initialization
    useEffect(() => {
        refreshAttendance();
        const id = setInterval(() => refreshAttendance(), 30000);
        return () => clearInterval(id);
    }, [refreshAttendance]);

    // Track geolocation
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

    // Live display clock
    const [displayTime, setDisplayTime] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setDisplayTime(getBestDate(gps)), 500);
        return () => clearInterval(id);
    }, [gps]);

    // Individual state resolution
    const myStep = getPunchStep(timesheets, resolvedPersonnelId);
    const today = getLocalDate(getBestDate(gps));
    const myTodayEntry = timesheets.find((t: any) => t.personnelId === resolvedPersonnelId && t.date === today);

    // Trigger individual verification modal
    const handleIndividualPunch = (type: ClockPunch['type']) => {
        const name = personnel.find(p => p.id === resolvedPersonnelId)?.name || 'Me';
        setVerificationTarget({
            workerId: resolvedPersonnelId,
            workerName: name,
            punchType: type
        });
    };

    // Fast lunch log (No signature/picture required)
    const handleLunchPunch = (type: 'lunchOut' | 'lunchIn') => {
        const best = getBestTimestampISO(gps);
        const punch: ClockPunch = {
            timestamp: best.iso,
            lat: gps.lat ?? 0,
            lng: gps.lng ?? 0,
            accuracy: gps.accuracy ?? 9999,
            type,
            timeSource: best.source
        };
        clockPunch(resolvedPersonnelId, punch, selectedProject || undefined);
    };

    // Commit verification and execute clock punch
    const handleCommitVerification = (selfieBlob: string, sigBlob: string) => {
        if (!verificationTarget) return;
        const { workerId, punchType } = verificationTarget;
        const best = getBestTimestampISO(gps);

        const punch: ClockPunch = {
            timestamp: best.iso,
            lat: gps.lat ?? 0,
            lng: gps.lng ?? 0,
            accuracy: gps.accuracy ?? 9999,
            type: punchType,
            timeSource: best.source,
            selfieBlob,
            supervisorSignatureBlob: sigBlob
        };

        clockPunch(workerId, punch, selectedProject || undefined);
        setVerificationTarget(null);
    };

    // Group view project filter and sorting
    const activeProjects = projects.filter((p: any) => p.status === 'Active');
    const getEligibleWorkers = useCallback(() => {
        const eligible = personnel.filter(p => p.status === 'Active' && ['Tech', 'Supervisor'].includes(p.appRole ?? ''));
        if (!selectedProject) return [...eligible].sort((a, b) => a.name.localeCompare(b.name));
        const proj = projects.find(p => p.id === selectedProject);
        const assignedIds = proj?.assignedPersonnel ?? [];
        
        const assigned = eligible.filter(p => assignedIds.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
        const unassigned = eligible.filter(p => !assignedIds.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
        return [...assigned, ...unassigned];
    }, [personnel, projects, selectedProject]);

    // Build today's shift log summaries for Supervisor Export
    const getShiftLogs = useCallback(() => {
        const currentProj = projects.find(p => p.id === selectedProject);
        if (!currentProj) return [];

        const projectTimesheets = timesheets.filter(t => t.projectId === selectedProject && t.date === today);
        return projectTimesheets.map(t => {
            const pObj = personnel.find(p => p.id === t.personnelId);
            const name = t.isOutsourced ? t.outsourcedName : (pObj?.name || 'Unknown');
            
            const lunchOutPunch = t.punches?.find(p => p.type === 'lunchOut');
            const lunchInPunch = t.punches?.find(p => p.type === 'lunchIn');

            const toLocalTimeStr = (iso?: string) => {
                if (!iso) return null;
                const d = new Date(iso);
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            };

            return {
                id: t.id,
                name,
                date: t.date,
                timeIn: t.timeIn,
                lunchStart: lunchOutPunch ? toLocalTimeStr(lunchOutPunch.timestamp) : null,
                lunchEnd: lunchInPunch ? toLocalTimeStr(lunchInPunch.timestamp) : null,
                timeOut: t.timeOut,
                hours: t.hours || 0,
                gpsVerified: t.gpsVerified
            };
        });
    }, [projects, selectedProject, timesheets, personnel, today]);

    const activeProjectName = projects.find(p => p.id === selectedProject)?.name || 'Project';

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative pb-16">
            
            {/* Print Only Layout */}
            <div className="hidden print:block p-8 bg-white text-slate-900 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{activeProjectName} — Shift Time Report</h1>
                        <p className="text-sm text-slate-500 mt-1">Date: {today}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold">LATNOVVA US Ops Portal</p>
                        <p className="text-xs text-slate-400">Timesheet Summary</p>
                    </div>
                </div>

                <table className="w-full border-collapse text-sm text-left">
                    <thead>
                        <tr className="border-b bg-slate-50 text-slate-700">
                            <th className="py-2.5 px-3 border font-semibold">Name</th>
                            <th className="py-2.5 px-3 border font-semibold">Time In</th>
                            <th className="py-2.5 px-3 border font-semibold">Lunch Start</th>
                            <th className="py-2.5 px-3 border font-semibold">Lunch End</th>
                            <th className="py-2.5 px-3 border font-semibold">Time Out</th>
                            <th className="py-2.5 px-3 border font-semibold">Hours</th>
                            <th className="py-2.5 px-3 border font-semibold">GPS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {getShiftLogs().map((item, idx) => (
                            <tr key={item.id || idx} className="border-b">
                                <td className="py-2 px-3 border font-medium">{item.name}</td>
                                <td className="py-2 px-3 border">{item.timeIn || '—'}</td>
                                <td className="py-2 px-3 border">{item.lunchStart || '—'}</td>
                                <td className="py-2 px-3 border">{item.lunchEnd || '—'}</td>
                                <td className="py-2 px-3 border">{item.timeOut || '—'}</td>
                                <td className="py-2 px-3 border font-semibold">{item.hours.toFixed(2)}</td>
                                <td className="py-2 px-3 border text-xs">{item.gpsVerified ? 'Verified' : 'Manual'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-between text-xs text-slate-400 border-t pt-4 mt-8">
                    <span>Generated by Site Supervisor via LATNOVVA ClockIn V2</span>
                    <span>Page 1 of 1</span>
                </div>
            </div>

            {/* Main Interactive Web Layout */}
            <div className="print:hidden flex flex-col flex-1">
                {/* Clock Header */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-8 px-6 flex flex-col items-center shadow-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px] pointer-events-none" />
                    <div className="flex items-center gap-2 mb-3 bg-white/10 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest text-slate-300 backdrop-blur-sm">
                        <Zap size={11} className="text-teal-400" />
                        <span>V2 {t('attendance.labels.field_tracker', 'Clock-In App')}</span>
                    </div>
                    <div className="font-mono text-5xl md:text-6xl font-bold tracking-tight tabular-nums text-white drop-shadow-md">
                        {formatTime(displayTime, { second: '2-digit' })}
                    </div>
                    <p className="mt-1 text-slate-400 text-xs tracking-wide">
                        {displayTime.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div className="mt-3.5">
                        <GpsBadge gps={gps} />
                    </div>
                </div>

                {/* Status & View Swappers */}
                <div className="flex flex-col items-center -mt-4 z-10 relative gap-3 px-4">
                    <div className={`px-5 py-2.5 rounded-full text-xs font-bold shadow-lg border-2 border-white backdrop-blur-md flex items-center gap-1.5 ${
                        viewMode === 'batch' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                        myStep === 'idle' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                        myStep === 'clocked-in' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        myStep === 'on-lunch' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-violet-50 text-violet-700 border-violet-200'
                    }`}>
                        {viewMode === 'batch' ? (
                            <><Users size={13} /> {t('attendance.labels.team_batch_mode', 'Group Registration Mode')}</>
                        ) : (
                            <>
                                <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                                {myStep === 'idle' && t('attendance.status.not_in', 'Not Clocked In')}
                                {myStep === 'clocked-in' && t('attendance.status.on_site', 'Clocked In')}
                                {myStep === 'on-lunch' && t('attendance.punches.lunch_out', 'On Lunch')}
                                {myStep === 'clocked-out' && t('attendance.status.done', 'Shift Completed')}
                            </>
                        )}
                    </div>

                    {/* Tab Switcher */}
                    {isSupervisor && (
                        <div className="flex bg-white/80 border border-slate-200 rounded-2xl p-1 shadow-md backdrop-blur-sm">
                            <button 
                                onClick={() => setViewMode('individual')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'individual' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                <UserCheck size={14} /> {t('attendance.labels.my_checkin', 'My Check-In')}
                            </button>
                            <button 
                                onClick={() => setViewMode('batch')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'batch' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                <Users size={14} /> {t('attendance.labels.team_batch', 'Group Registration')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
                    
                    {/* Project Selector (Always active) */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t('attendance.select_project', 'Select Project')}</label>
                        <div className="relative">
                            <select 
                                value={selectedProject} 
                                onChange={e => setSelectedProject(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-teal-400 outline-none pr-10"
                            >
                                <option value="">{t('attendance.project_placeholder', '— Select a project —')}</option>
                                {activeProjects.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{p.codeName ? ` (${p.codeName})` : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Individual Mode view */}
                    {viewMode === 'individual' && (
                        <div className="space-y-4">
                            {/* Project complete box */}
                            {myStep === 'clocked-out' && myTodayEntry && (
                                <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-3xl p-5 shadow-lg text-white space-y-4 animate-scale-in">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={20} />
                                            <span className="font-bold text-base">{t('attendance.status.done', 'Shift Completed')}</span>
                                        </div>
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px]">
                                            {t('attendance.status.worked_today', 'Worked Today')}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center border-t border-white/25 pt-3">
                                        <div>
                                            <p className="text-[10px] text-violet-200">{t('attendance.punches.clockIn', 'In')}</p>
                                            <p className="font-bold text-base">{myTodayEntry.timeIn || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-violet-200">{t('attendance.punches.clockOut', 'Out')}</p>
                                            <p className="font-bold text-base">{myTodayEntry.timeOut || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-violet-200">{t('projects.table.reported_time', 'Hours')}</p>
                                            <p className="font-bold text-xl">{myTodayEntry.hours?.toFixed(2) || '0.00'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Clock In workflow */}
                            {myStep === 'idle' && (
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => handleIndividualPunch('clockIn')} 
                                        disabled={!selectedProject || (gps.status !== 'locked' && gps.status !== 'poor')}
                                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        <LogIn size={22} />
                                        {t('attendance.labels.action_in', 'Clock In')}
                                    </button>
                                    {gps.status === 'acquiring' && (
                                        <p className="text-center text-xs text-slate-400 animate-pulse">
                                            {t('attendance.gps.waiting', 'Waiting for GPS to punch…')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Clocked In / Lunch workflows */}
                            {myStep === 'clocked-in' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => handleLunchPunch('lunchOut')}
                                        className="py-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        <Coffee size={18} />
                                        {t('attendance.punches.lunch_out', 'Start Lunch')}
                                    </button>
                                    <button 
                                        onClick={() => handleIndividualPunch('clockOut')}
                                        disabled={(gps.status !== 'locked' && gps.status !== 'poor')}
                                        className="py-4 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <LogOut size={18} />
                                        {t('attendance.labels.action_out', 'Clock Out')}
                                    </button>
                                </div>
                            )}

                            {/* On Lunch workflows */}
                            {myStep === 'on-lunch' && (
                                <button 
                                    onClick={() => handleLunchPunch('lunchIn')}
                                    className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    <Sun size={20} />
                                    {t('attendance.punches.lunch_in', 'Back from Lunch')}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Group/Batch Mode view */}
                    {viewMode === 'batch' && (
                        <div className="space-y-4">
                            {/* Supervisor Export Panel */}
                            {isSupervisor && selectedProject && (
                                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex gap-3">
                                    <button
                                        onClick={() => performCsvExport(activeProjectName, getShiftLogs())}
                                        disabled={getShiftLogs().length === 0}
                                        className="flex-1 py-3 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-40 disabled:hover:bg-teal-50 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-teal-200/50 transition-all"
                                    >
                                        <FileSpreadsheet size={15} /> Export CSV
                                    </button>
                                    <button
                                        onClick={() => window.print()}
                                        disabled={getShiftLogs().length === 0}
                                        className="flex-1 py-3 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:hover:bg-violet-50 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-violet-200/50 transition-all"
                                    >
                                        <Printer size={15} /> Print Shift Report
                                    </button>
                                </div>
                            )}

                            {/* Workers List */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {t('attendance.team_count', 'Team Roster')}
                                </h4>

                                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm divide-y divide-slate-50">
                                    {getEligibleWorkers().map(worker => {
                                        const status = getPunchStep(timesheets, worker.id);
                                        const meta = getStepMeta(t)[status];
                                        const hasExpired = worker.certifications?.some((c: any) => isCertExpired(c.expirationDate));

                                        const nextPunchType = (status === 'idle' || status === 'clocked-out') ? 'clockIn' : 'clockOut';

                                        // Lunch actions inline for supervisor
                                        const isWorkerClockedIn = status === 'clocked-in';
                                        const isWorkerOnLunch = status === 'on-lunch';

                                        return (
                                            <div 
                                                key={worker.id}
                                                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden text-slate-600 border border-slate-200">
                                                        {worker.image ? <img src={worker.image} className="w-full h-full object-cover" /> : worker.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-bold text-sm text-slate-800 truncate">{worker.name}</p>
                                                            {hasExpired && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[10px] text-slate-400 font-semibold">{worker.position}</p>
                                                            <span className={`text-[8px] font-extrabold tracking-wide uppercase px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                                                                {meta.dot} {meta.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2shrink-0">
                                                    {/* Lunch Toggle Fast Buttons */}
                                                    {isWorkerClockedIn && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const best = getBestTimestampISO(gps);
                                                                clockPunch(worker.id, {
                                                                    timestamp: best.iso, lat: gps.lat || 0, lng: gps.lng || 0, accuracy: gps.accuracy || 9999,
                                                                    type: 'lunchOut', timeSource: best.source
                                                                }, selectedProject || undefined);
                                                            }}
                                                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-all border border-amber-100"
                                                            title="Start Lunch"
                                                        >
                                                            <Coffee size={14} />
                                                        </button>
                                                    )}
                                                    {isWorkerOnLunch && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const best = getBestTimestampISO(gps);
                                                                clockPunch(worker.id, {
                                                                    timestamp: best.iso, lat: gps.lat || 0, lng: gps.lng || 0, accuracy: gps.accuracy || 9999,
                                                                    type: 'lunchIn', timeSource: best.source
                                                                }, selectedProject || undefined);
                                                            }}
                                                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all border border-emerald-100"
                                                            title="End Lunch"
                                                        >
                                                            <Sun size={14} />
                                                        </button>
                                                    )}

                                                    {/* Verification Clock In/Out Modal Trigger */}
                                                    {!isWorkerOnLunch && (
                                                        <button
                                                            onClick={() => setVerificationTarget({
                                                                workerId: worker.id,
                                                                workerName: worker.name,
                                                                punchType: nextPunchType
                                                            })}
                                                            disabled={(gps.status !== 'locked' && gps.status !== 'poor') || !selectedProject}
                                                            className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-sm transition-all border shrink-0 ${
                                                                nextPunchType === 'clockIn' 
                                                                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100 text-emerald-700' 
                                                                    : 'bg-rose-50 hover:bg-rose-100 border-rose-100 text-rose-700'
                                                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                        >
                                                            {nextPunchType === 'clockIn' ? 'Clock In' : 'Clock Out'}
                                                        </button>
                                                    )}

                                                    {isWorkerOnLunch && (
                                                        <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                                                            On Lunch
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Verification Flow Modal */}
            {verificationTarget && (
                <VerificationModal
                    workerName={verificationTarget.workerName}
                    punchType={verificationTarget.punchType}
                    gps={gps}
                    onConfirm={handleCommitVerification}
                    onCancel={() => setVerificationTarget(null)}
                />
            )}
        </div>
    );
}
