import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
    MapPin, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff,
    Coffee, LogIn, LogOut, ChevronDown, X, Edit2, Zap,
    Camera, Users, ArrowRight, RotateCcw, UserCheck,
} from 'lucide-react';
import { useStore, ClockPunch, Personnel } from '../store/useStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type PunchStep = 'idle' | 'clocked-in' | 'lunch-out' | 'clocked-out';
type ViewMode = 'individual' | 'batch';
type BatchScreen = 'grid' | 'punch' | 'success';

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

const stepMeta: Record<PunchStep, { label: string; dot: string; bg: string; text: string }> = {
    idle:        { label: 'Not In',   dot: '○', bg: 'bg-gray-100',    text: 'text-gray-500' },
    'clocked-in':{ label: 'On Site',  dot: '●', bg: 'bg-teal-50',     text: 'text-teal-700' },
    'lunch-out': { label: 'Lunch',    dot: '●', bg: 'bg-amber-50',    text: 'text-amber-700'},
    'clocked-out':{ label: 'Done',    dot: '✓', bg: 'bg-green-50',    text: 'text-green-700'},
};

const punchLabel: Record<ClockPunch['type'], string> = {
    clockIn: 'Clocked In', lunchOut: 'Lunch Out',
    lunchIn: 'Back from Lunch', clockOut: 'Clocked Out',
};

const punchColor: Record<ClockPunch['type'], string> = {
    clockIn: '#00B4A6', lunchOut: '#F59E0B', lunchIn: '#F59E0B', clockOut: '#EF4444',
};

const formatShort = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

// ─── GpsBadge ─────────────────────────────────────────────────────────────────

function GpsBadge({ gps }: { gps: GpsState }) {
    if (gps.status === 'acquiring') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold animate-pulse">
            <Wifi size={12} /> Acquiring GPS...
        </div>
    );
    if (gps.status === 'locked') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            GPS ±{Math.round(gps.accuracy!)}m
        </div>
    );
    if (gps.status === 'poor') return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">
            <AlertTriangle size={12} /> Weak GPS ±{Math.round(gps.accuracy!)}m
        </div>
    );
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
            <WifiOff size={12} /> No GPS
        </div>
    );
}

// ─── CameraCapture ────────────────────────────────────────────────────────────

function CameraCapture({ onCapture, onSkip }: { onCapture: (blob: string) => void; onSkip: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [camError, setCamError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
            .then(stream => {
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => setLoading(false);
                }
            })
            .catch(() => { setCamError(true); setLoading(false); });
        return () => streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    const capture = () => {
        const canvas = canvasRef.current!;
        const video = videoRef.current!;
        canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext('2d')!;
        ctx.save(); ctx.scale(-1, 1);
        ctx.drawImage(video, -320, 0, 320, 240);
        ctx.restore();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        setPhoto(dataUrl);
        streamRef.current?.getTracks().forEach(t => t.stop());
    };

    if (camError) return (
        <div className="flex flex-col items-center py-5 gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Camera size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 text-center">Camera not available</p>
            <button onClick={onSkip} className="text-teal-600 text-sm font-semibold underline">Continue without photo</button>
        </div>
    );

    if (photo) return (
        <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border-4 border-teal-400 shadow">
                <img src={photo} alt="Selfie" className="w-full max-h-44 object-cover" />
            </div>
            <div className="flex gap-2">
                <button onClick={() => { setPhoto(null); }} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 flex items-center justify-center gap-2">
                    <RotateCcw size={14} /> Retake
                </button>
                <button onClick={() => onCapture(photo)} className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold">
                    ✓ Use Photo
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                <video ref={videoRef} autoPlay playsInline muted
                    className="w-full h-full object-cover [transform:scaleX(-1)]" />
                <canvas ref={canvasRef} className="hidden" />
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={onSkip} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600">
                    Skip Photo
                </button>
                <button onClick={capture} disabled={loading}
                    className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                    <Camera size={16} /> Take Photo
                </button>
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
    const now = new Date();
    const [time, setTime] = useState(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Manual Time Entry</h3>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                </div>
                <p className="text-sm text-gray-500">
                    Time for <strong>{punchLabel[punchType]}</strong>. Flagged for manager review.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Time</label>
                        <input type="time" value={time} onChange={e => setTime(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-mono focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Reason</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)}
                            placeholder="E.g., Forgot to punch" rows={3}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={() => note.trim() ? onConfirm(time, note) : alert('Please enter a reason.')}
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold">Submit</button>
                </div>
            </div>
        </div>
    );
}

// ─── BatchPunchScreen ─────────────────────────────────────────────────────────

function BatchPunchScreen({ person, step, gps, projectId, onDone, onBack, doPunch }: {
    person: Personnel;
    step: PunchStep;
    gps: GpsState;
    projectId: string;
    onDone: (type: ClockPunch['type'], time: string) => void;
    onBack: () => void;
    doPunch: (personnelId: string, punch: ClockPunch, projectId?: string) => void;
}) {
    const [photo, setPhoto] = useState<string | null>(null);
    const [showCam, setShowCam] = useState(false);
    const [manualModal, setManualModal] = useState<ClockPunch['type'] | null>(null);
    const gpsReady = gps.status === 'locked' || gps.status === 'poor';

    const executePunch = useCallback((type: ClockPunch['type'], overrideTime?: string, note?: string) => {
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
            selfieBlob: photo ?? undefined,
            ...(note ? { manualAdjustment: true, adjustmentNote: note } : {}),
        };
        doPunch(person.id, punch, projectId || undefined);
        onDone(type, formatShort(timestamp));
    }, [gps, photo, person.id, projectId, doPunch, onDone]);

    const actions: { type: ClockPunch['type']; label: string; cls: string; icon: ReactNode }[] = [];
    if (step === 'idle')
        actions.push({ type: 'clockIn', label: 'CLOCK IN', cls: 'from-teal-500 to-teal-600', icon: <LogIn size={22} /> });
    if (step === 'clocked-in') {
        actions.push({ type: 'lunchOut', label: 'LUNCH OUT', cls: 'from-amber-400 to-amber-500', icon: <Coffee size={22} /> });
        actions.push({ type: 'clockOut', label: 'CLOCK OUT', cls: 'from-red-500 to-red-600', icon: <LogOut size={22} /> });
    }
    if (step === 'lunch-out')
        actions.push({ type: 'lunchIn', label: 'BACK FROM LUNCH', cls: 'from-amber-400 to-amber-500', icon: <Coffee size={22} /> });

    return (
        <div className="space-y-4">
            {/* Person header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ChevronDown size={18} className="rotate-90 text-gray-500" />
                </button>
                <div className="flex-1">
                    <p className="font-bold text-gray-800 text-lg leading-tight">{person.name}</p>
                    <p className="text-xs text-gray-400">{person.position}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stepMeta[step].bg} ${stepMeta[step].text}`}>
                    {stepMeta[step].dot} {stepMeta[step].label}
                </span>
            </div>

            {/* Selfie section */}
            {!photo && !showCam && (
                <button onClick={() => setShowCam(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-semibold text-gray-400 flex items-center justify-center gap-2 hover:border-teal-300 hover:text-teal-600 transition-colors">
                    <Camera size={16} /> Add Verification Photo (Optional)
                </button>
            )}
            {showCam && !photo && (
                <CameraCapture onCapture={b => { setPhoto(b); setShowCam(false); }} onSkip={() => setShowCam(false)} />
            )}
            {photo && (
                <div className="relative rounded-2xl overflow-hidden border-2 border-teal-300">
                    <img src={photo} alt="Selfie" className="w-full max-h-36 object-cover" />
                    <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                        <X size={14} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-teal-500/80 text-white text-xs font-bold py-1 text-center">
                        ✓ Photo captured
                    </div>
                </div>
            )}

            {/* GPS */}
            <div className="flex justify-center"><GpsBadge gps={gps} /></div>

            {/* Action buttons */}
            {step === 'clocked-out' ? (
                <div className="py-6 text-center space-y-3">
                    <CheckCircle size={40} className="text-green-500 mx-auto" />
                    <p className="font-bold text-gray-700">Already done for the day</p>
                    <button onClick={onBack} className="text-sm text-teal-600 font-semibold underline">← Back to team</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {actions.map(a => (
                        <button key={a.type} onClick={() => executePunch(a.type)} disabled={!gpsReady}
                            className={`w-full py-4 rounded-2xl bg-gradient-to-r ${a.cls} text-white font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]`}>
                            {a.icon} {a.label}
                        </button>
                    ))}
                    {step === 'lunch-out' && (
                        <button onClick={() => setManualModal('lunchIn')}
                            className="w-full py-3 rounded-2xl border-2 border-amber-200 text-amber-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-50">
                            <Edit2 size={14} /> Forgot to punch? Enter manually
                        </button>
                    )}
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

// ─── BatchModeView ────────────────────────────────────────────────────────────

function BatchModeView({ gps, projects, personnel, timesheets, clockPunch: doPunch }: {
    gps: GpsState;
    projects: any[];
    personnel: Personnel[];
    timesheets: any[];
    clockPunch: (...args: any[]) => void;
}) {
    const [selectedProject, setSelectedProject] = useState('');
    const [screen, setScreen] = useState<BatchScreen>('grid');
    const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
    const [lastResult, setLastResult] = useState<{ name: string; action: string; time: string } | null>(null);
    const [countdown, setCountdown] = useState(5);

    const activeProjects = projects.filter(p => p.status === 'Active');
    const visiblePersonnel = personnel.filter(p => ['Tech', 'Supervisor'].includes(p.appRole ?? ''));

    useEffect(() => {
        if (screen !== 'success') return;
        if (countdown <= 0) { setScreen('grid'); setSelectedPerson(null); return; }
        const id = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(id);
    }, [screen, countdown]);

    const handleDone = (person: Personnel, type: ClockPunch['type'], time: string) => {
        setLastResult({ name: person.name, action: punchLabel[type], time });
        setScreen('success');
        setCountdown(5);
    };

    if (screen === 'punch' && selectedPerson) {
        return (
            <BatchPunchScreen
                person={selectedPerson}
                step={getPunchStep(timesheets, selectedPerson.id)}
                gps={gps}
                projectId={selectedProject}
                onDone={(type, time) => handleDone(selectedPerson, type, time)}
                onBack={() => { setScreen('grid'); setSelectedPerson(null); }}
                doPunch={doPunch}
            />
        );
    }

    if (screen === 'success' && lastResult) {
        return (
            <div className="flex flex-col items-center py-10 gap-6 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle size={44} className="text-green-500" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-gray-800">✓ {lastResult.action}</p>
                    <p className="text-lg font-semibold text-gray-600 mt-1">{lastResult.name}</p>
                    <p className="text-sm text-gray-400 mt-1">at {lastResult.time}</p>
                </div>
                <div className="w-full max-w-xs bg-teal-50 border border-teal-200 rounded-2xl p-4">
                    <p className="text-teal-700 font-semibold text-sm">👋 Pass the device to the next person</p>
                    <p className="text-teal-400 text-xs mt-1">Returning to team in {countdown}s…</p>
                </div>
                <button onClick={() => { setScreen('grid'); setSelectedPerson(null); }}
                    className="w-full max-w-xs py-3 bg-teal-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                    <Users size={16} /> Back to Team <ArrowRight size={16} />
                </button>
            </div>
        );
    }

    // Grid view
    return (
        <div className="space-y-4">
            <div className="relative">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Filter by Project</label>
                <div className="relative">
                    <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                        className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-teal-400 outline-none pr-10">
                        <option value="">— All Personnel —</option>
                        {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            </div>

            <div className="flex justify-center"><GpsBadge gps={gps} /></div>

            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Team · {visiblePersonnel.length} members</p>
                {visiblePersonnel.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Users size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No personnel with Tech/Supervisor role found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {visiblePersonnel.map(person => {
                            const step = getPunchStep(timesheets, person.id);
                            const meta = stepMeta[step];
                            const isJustPunched = lastResult?.name === person.name;
                            return (
                                <button key={person.id}
                                    onClick={() => { setSelectedPerson(person); setScreen('punch'); }}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md active:scale-[0.97] ${isJustPunched ? 'border-teal-300 bg-teal-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm shrink-0">
                                            {person.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                                            {meta.dot} {meta.label}
                                        </span>
                                    </div>
                                    <p className="font-bold text-gray-800 text-sm leading-tight">{person.name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{person.position}</p>
                                    {step !== 'clocked-out' && (
                                        <p className="text-[10px] text-teal-600 mt-1.5 font-semibold flex items-center gap-1">
                                            <ArrowRight size={10} /> Tap to punch
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
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
    const today = getLocalDate(getBestDate(gps));
    const todayEntry = timesheets.find((t: any) => t.personnelId === personnelId && t.date === today);
    const punches: ClockPunch[] = todayEntry?.punches ?? [];
    const step = getPunchStep(timesheets, personnelId);

    const [selectedProject, setSelectedProject] = useState(todayEntry?.projectId ?? '');
    const [manualModal, setManualModal] = useState<ClockPunch['type'] | null>(null);
    const activeProjects = projects.filter((p: any) => p.status === 'Active');
    const gpsReady = gps.status === 'locked' || gps.status === 'poor';

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
            {/* Day complete summary */}
            {step === 'clocked-out' && todayEntry && (
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-5 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle size={20} /><span className="font-bold text-lg">Day Complete</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <div><p className="text-teal-200 text-xs">Time In</p><p className="font-bold text-lg">{todayEntry.timeIn ?? '—'}</p></div>
                        <div><p className="text-teal-200 text-xs">Time Out</p><p className="font-bold text-lg">{todayEntry.timeOut ?? '—'}</p></div>
                        <div><p className="text-teal-200 text-xs">Hours</p><p className="font-bold text-2xl">{todayEntry.hours.toFixed(2)}</p></div>
                    </div>
                </div>
            )}

            {step === 'idle' && (
                <div className="relative">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Select Project</label>
                    <div className="relative">
                        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-teal-400 outline-none pr-10">
                            <option value="">— No project selected —</option>
                            {activeProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.codeName ? ` (${p.codeName})` : ''}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            )}

            {step === 'idle' && (
                <div className="space-y-3">
                    {!gpsReady && gps.status === 'acquiring' && (
                        <p className="text-center text-sm text-blue-500 animate-pulse">Waiting for GPS…</p>
                    )}
                    <button onClick={() => executePunch('clockIn')} disabled={!gpsReady}
                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                        <LogIn size={26} /> CLOCK IN
                    </button>
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
                    <button onClick={() => executePunch('lunchOut')} disabled={!gpsReady}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 active:scale-[0.98]">
                        <Coffee size={22} /> LUNCH OUT
                    </button>
                    <button onClick={handleSkipLunch}
                        className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 text-sm font-semibold flex items-center justify-center hover:bg-gray-50 transition-colors">
                        Skip Lunch → Go to Clock Out
                    </button>
                    <button onClick={() => executePunch('clockOut')} disabled={!gpsReady}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 active:scale-[0.98]">
                        <LogOut size={22} /> CLOCK OUT
                    </button>
                </div>
            )}

            {step === 'lunch-out' && (
                <div className="space-y-3">
                    <button onClick={() => executePunch('lunchIn')} disabled={!gpsReady}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 active:scale-[0.98]">
                        <Coffee size={22} /> BACK FROM LUNCH
                    </button>
                    <button onClick={() => setManualModal('lunchIn')}
                        className="w-full py-3 rounded-2xl border-2 border-amber-200 text-amber-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors">
                        <Edit2 size={14} /> Forgot to punch? Enter manually
                    </button>
                </div>
            )}

            {/* Today's punch timeline */}
            {punches.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Punches</p>
                    <div className="relative pl-6">
                        <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-teal-400 via-amber-400 to-red-400 opacity-30" />
                        {punches.map((p, i) => (
                            <div key={i} className="relative mb-3 last:mb-0">
                                <div className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow"
                                    style={{ backgroundColor: punchColor[p.type] }} />
                                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 ml-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-gray-800">{punchLabel[p.type]}</span>
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
                                            <Edit2 size={8} /> Manual Adj.
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

    const timeSourceLabel = gps.gpsTimestampMs !== null
        ? { icon: <Zap size={11} className="text-yellow-400" />, text: 'GPS Time', cls: 'text-yellow-300' }
        : { icon: <Clock size={11} className="text-gray-400" />, text: 'Device Time', cls: 'text-gray-400' };

    // Current step for individual mode (used for status chip only)
    const myStep = getPunchStep(timesheets, userId);

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Clock header */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-8 px-6 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-teal-400" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Field Time Tracker</span>
                </div>
                <div className="font-mono text-5xl md:text-6xl font-bold tracking-tight tabular-nums text-white drop-shadow-lg">
                    {displayTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <p className="mt-1 text-gray-400 text-sm">
                    {displayTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
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
                    {viewMode === 'batch' && <><Users size={14} className="inline mr-1 -mt-0.5" /> Team Batch Mode</>}
                    {viewMode === 'individual' && myStep === 'idle' && '○ Not Clocked In'}
                    {viewMode === 'individual' && myStep === 'clocked-in' && '● On Site'}
                    {viewMode === 'individual' && myStep === 'lunch-out' && '● On Lunch'}
                    {viewMode === 'individual' && myStep === 'clocked-out' && '✓ Day Complete'}
                </div>

                {/* Tab switcher — supervisors only */}
                {isSupervisor && (
                    <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
                        <button onClick={() => setViewMode('individual')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'individual' ? 'bg-teal-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <UserCheck size={15} /> My Check-In
                        </button>
                        <button onClick={() => setViewMode('batch')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'batch' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Users size={15} /> Team Batch
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
                    />
                )}
            </div>

            {/* GPS denied banner */}
            {gps.status === 'denied' && (
                <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-md mx-auto bg-red-600 text-white rounded-2xl p-4 shadow-xl flex items-start gap-3 z-40">
                    <WifiOff size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm">Location Access Denied</p>
                        <p className="text-xs text-red-100">Enable location permissions and refresh to clock in.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
