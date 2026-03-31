import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff, Coffee, LogIn, LogOut, ChevronDown, X, Edit2 } from 'lucide-react';
import { useStore, ClockPunch } from '../store/useStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type PunchStep = 'idle' | 'clocked-in' | 'lunch-out' | 'clocked-out';

interface GpsState {
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    status: 'acquiring' | 'locked' | 'poor' | 'denied';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatShort = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatCoord = (lat: number, lng: number) =>
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

const punchLabel: Record<ClockPunch['type'], string> = {
    clockIn: 'Clocked In',
    lunchOut: 'Lunch Out',
    lunchIn: 'Back from Lunch',
    clockOut: 'Clocked Out',
};

const punchColor: Record<ClockPunch['type'], string> = {
    clockIn: '#00B4A6',
    lunchOut: '#F59E0B',
    lunchIn: '#F59E0B',
    clockOut: '#EF4444',
};

// ─── Manual Time Adjustment Modal ────────────────────────────────────────────

function ManualAdjustModal({
    punchType,
    onConfirm,
    onCancel,
}: {
    punchType: ClockPunch['type'];
    onConfirm: (time: string, note: string) => void;
    onCancel: () => void;
}) {
    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const [time, setTime] = useState(defaultTime);
    const [note, setNote] = useState('');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Manual Time Entry</h3>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>
                <p className="text-sm text-gray-500">
                    Enter the actual time for <strong>{punchLabel[punchType]}</strong>. This will be flagged as a manual adjustment for manager review.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Time</label>
                        <input
                            type="time"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Reason / Note</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="E.g., Forgot to punch, was hands-on with equipment"
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-amber-400 outline-none"
                        />
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => note.trim() ? onConfirm(time, note) : alert('Please enter a reason for the manual adjustment.')}
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
                    >
                        Submit
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClockIn() {
    const { userId, projects, timesheets, clockPunch } = useStore();

    // Personnel ID — tied to current userId for now
    const personnelId = userId;

    // Live clock
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    // GPS
    const [gps, setGps] = useState<GpsState>({ lat: null, lng: null, accuracy: null, status: 'acquiring' });
    const watchRef = useRef<number | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setGps(g => ({ ...g, status: 'denied' }));
            return;
        }
        watchRef.current = navigator.geolocation.watchPosition(
            pos => {
                setGps({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    status: pos.coords.accuracy <= 50 ? 'locked' : 'poor',
                });
            },
            () => setGps(g => ({ ...g, status: 'denied' })),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        return () => {
            if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
        };
    }, []);

    // Today's timesheet
    const today = now.toISOString().split('T')[0];
    const todayEntry = timesheets.find(t => t.personnelId === personnelId && t.date === today);
    const punches: ClockPunch[] = todayEntry?.punches ?? [];

    // Derive step
    const deriveStep = useCallback((): PunchStep => {
        const hasIn = punches.some(p => p.type === 'clockIn');
        const hasLunchOut = punches.some(p => p.type === 'lunchOut');
        const hasLunchIn = punches.some(p => p.type === 'lunchIn');
        const hasOut = punches.some(p => p.type === 'clockOut');
        if (!hasIn) return 'idle';
        if (hasOut) return 'clocked-out';
        if (hasLunchOut && !hasLunchIn) return 'lunch-out';
        return 'clocked-in';
    }, [punches]);

    const step = deriveStep();

    // Project selector
    const [selectedProject, setSelectedProject] = useState(todayEntry?.projectId ?? '');
    const activeProjects = projects.filter(p => p.status === 'Active');

    // Manual adjust modal
    const [manualModal, setManualModal] = useState<ClockPunch['type'] | null>(null);

    // ─── Punch action ─────────────────────────────────────────────────────────

    const doPunch = (type: ClockPunch['type'], overrideTime?: string, note?: string) => {
        const accuracy = gps.accuracy ?? 9999;
        const lat = gps.lat ?? 0;
        const lng = gps.lng ?? 0;

        let timestamp: string;
        if (overrideTime) {
            // Build ISO string from today + HH:mm
            const [h, m] = overrideTime.split(':');
            const d = new Date();
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            timestamp = d.toISOString();
        } else {
            timestamp = new Date().toISOString();
        }

        const punch: ClockPunch = {
            timestamp,
            lat,
            lng,
            accuracy,
            type,
            ...(note ? { manualAdjustment: true, adjustmentNote: note } : {}),
        };

        clockPunch(personnelId, punch, selectedProject || undefined);
    };

    const handleSkipLunch = () => {
        // Mark lunchSkipped directly — no punch recorded
        const punch: ClockPunch = {
            timestamp: new Date().toISOString(),
            lat: gps.lat ?? 0,
            lng: gps.lng ?? 0,
            accuracy: gps.accuracy ?? 9999,
            type: 'lunchOut',
            manualAdjustment: true,
            adjustmentNote: 'Lunch skipped – no break taken',
        };
        // Use a synthetic lunchIn punch immediately after
        const punchIn: ClockPunch = {
            ...punch,
            type: 'lunchIn',
        };
        clockPunch(personnelId, punch, selectedProject || undefined, true);
        setTimeout(() => clockPunch(personnelId, punchIn, selectedProject || undefined, true), 100);
    };

    const handleManualConfirm = (time: string, note: string) => {
        if (!manualModal) return;
        doPunch(manualModal, time, note);
        setManualModal(null);
    };

    // ─── GPS status badge ─────────────────────────────────────────────────────

    const gpsBadge = () => {
        if (gps.status === 'acquiring') return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold animate-pulse">
                <Wifi size={12} /> Acquiring GPS...
            </div>
        );
        if (gps.status === 'locked') return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                GPS Locked · ±{Math.round(gps.accuracy!)}m
            </div>
        );
        if (gps.status === 'poor') return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">
                <AlertTriangle size={12} /> Weak GPS · ±{Math.round(gps.accuracy!)}m
            </div>
        );
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
                <WifiOff size={12} /> GPS Unavailable
            </div>
        );
    };

    // ─── Punch timeline ───────────────────────────────────────────────────────

    const renderTimeline = () => {
        if (punches.length === 0) return null;
        return (
            <div className="w-full max-w-md space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Today's Punches</p>
                <div className="relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-teal-400 via-amber-400 to-red-400 opacity-30" />
                    {punches.map((p, i) => (
                        <div key={i} className="relative mb-4 last:mb-0">
                            <div
                                className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow"
                                style={{ backgroundColor: punchColor[p.type] }}
                            />
                            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 ml-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-gray-800">{punchLabel[p.type]}</span>
                                    <span className="text-xs font-mono text-gray-500">{formatShort(p.timestamp)}</span>
                                </div>
                                {p.lat !== 0 && (
                                    <a
                                        href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                                    >
                                        <MapPin size={10} />
                                        {formatCoord(p.lat, p.lng)} · ±{Math.round(p.accuracy)}m
                                    </a>
                                )}
                                {p.manualAdjustment && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-semibold">
                                        <Edit2 size={8} /> Manual Adj.
                                    </span>
                                )}
                                {p.adjustmentNote && (
                                    <p className="text-[11px] text-gray-400 mt-1 italic">"{p.adjustmentNote}"</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ─── Daily summary ────────────────────────────────────────────────────────

    const renderSummary = () => {
        if (step !== 'clocked-out' || !todayEntry) return null;
        const proj = activeProjects.find(p => p.id === todayEntry.projectId);
        return (
            <div className="w-full max-w-md bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-6 shadow-lg text-white">
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle size={22} />
                    <span className="text-lg font-bold">Day Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-teal-200 text-xs uppercase tracking-wide mb-0.5">Time In</p>
                        <p className="font-bold text-lg">{todayEntry.timeIn ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-teal-200 text-xs uppercase tracking-wide mb-0.5">Time Out</p>
                        <p className="font-bold text-lg">{todayEntry.timeOut ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-teal-200 text-xs uppercase tracking-wide mb-0.5">Total Hours</p>
                        <p className="font-bold text-2xl">{todayEntry.hours.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-teal-200 text-xs uppercase tracking-wide mb-0.5">GPS</p>
                        <p className="font-bold text-sm flex items-center gap-1">
                            {todayEntry.gpsVerified ? <><CheckCircle size={14} /> Verified</> : <><AlertTriangle size={14} /> Check Required</>}
                        </p>
                    </div>
                </div>
                {proj && (
                    <p className="mt-4 text-xs text-teal-100 border-t border-teal-400/30 pt-3">
                        Project: <strong>{proj.name}</strong>
                        {proj.codeName ? ` · ${proj.codeName}` : ''}
                    </p>
                )}
                {todayEntry.lunchSkipped && (
                    <p className="text-xs text-teal-200 mt-1">☕ No lunch break taken</p>
                )}
            </div>
        );
    };

    // ─── Action buttons ───────────────────────────────────────────────────────

    const gpsReady = gps.status === 'locked' || gps.status === 'poor';

    const renderButtons = () => {
        if (step === 'clocked-out') return null;

        if (step === 'idle') return (
            <div className="w-full max-w-md space-y-4">
                {/* Project selector */}
                <div className="relative">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Select Project</label>
                    <div className="relative">
                        <select
                            value={selectedProject}
                            onChange={e => setSelectedProject(e.target.value)}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-teal-400 outline-none pr-10"
                        >
                            <option value="">— No project selected —</option>
                            {activeProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}{p.codeName ? ` (${p.codeName})` : ''}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {!gpsReady && gps.status === 'acquiring' && (
                    <div className="text-center text-sm text-blue-500 animate-pulse py-2">Waiting for GPS signal...</div>
                )}

                <button
                    id="btn-clock-in"
                    onClick={() => doPunch('clockIn')}
                    disabled={!gpsReady}
                    className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-xl shadow-lg shadow-teal-500/30 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 active:scale-[0.98]"
                >
                    <LogIn size={26} />
                    CLOCK IN
                </button>

                {gps.status === 'poor' && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>GPS signal is weak (±{Math.round(gps.accuracy!)}m). Punch will be flagged for review.</span>
                    </div>
                )}
            </div>
        );

        if (step === 'clocked-in') return (
            <div className="w-full max-w-md space-y-3">
                <button
                    id="btn-lunch-out"
                    onClick={() => doPunch('lunchOut')}
                    disabled={!gpsReady}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md shadow-amber-400/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    <Coffee size={22} />
                    LUNCH OUT
                </button>
                <button
                    id="btn-skip-lunch"
                    onClick={handleSkipLunch}
                    className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                    Skip Lunch → Go to Clock Out
                </button>
                <button
                    id="btn-clock-out-direct"
                    onClick={() => doPunch('clockOut')}
                    disabled={!gpsReady}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg shadow-md shadow-red-400/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    <LogOut size={22} />
                    CLOCK OUT
                </button>
            </div>
        );

        if (step === 'lunch-out') return (
            <div className="w-full max-w-md space-y-3">
                <button
                    id="btn-lunch-in"
                    onClick={() => doPunch('lunchIn')}
                    disabled={!gpsReady}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-md shadow-amber-400/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    <Coffee size={22} />
                    BACK FROM LUNCH
                </button>
                <button
                    id="btn-manual-lunch-in"
                    onClick={() => setManualModal('lunchIn')}
                    className="w-full py-3 rounded-2xl border-2 border-amber-200 text-amber-600 font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:border-amber-300 hover:bg-amber-50"
                >
                    <Edit2 size={14} />
                    Forgot to punch? Enter time manually
                </button>
            </div>
        );

        return null;
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Hero clock header */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-10 px-6 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-6">
                    <Clock size={18} className="text-teal-400" />
                    <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Field Time Tracker</span>
                </div>
                {/* Live digital clock */}
                <div className="font-mono text-5xl md:text-7xl font-bold tracking-tight tabular-nums text-white drop-shadow-lg">
                    {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <p className="mt-2 text-gray-400 text-sm font-medium">
                    {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div className="mt-4">{gpsBadge()}</div>
            </div>

            {/* Current status chip */}
            <div className="flex justify-center -mt-4 z-10 relative">
                <div className={`px-5 py-2 rounded-full text-sm font-bold shadow-md border-2 border-white ${
                    step === 'idle' ? 'bg-gray-100 text-gray-600' :
                    step === 'clocked-in' ? 'bg-teal-50 text-teal-700' :
                    step === 'lunch-out' ? 'bg-amber-50 text-amber-700' :
                    'bg-green-50 text-green-700'
                }`}>
                    {step === 'idle' && '● Not Clocked In'}
                    {step === 'clocked-in' && '● On Site'}
                    {step === 'lunch-out' && '● On Lunch'}
                    {step === 'clocked-out' && '✓ Day Complete'}
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 flex flex-col items-center px-4 py-8 gap-8">
                {renderSummary()}
                {renderButtons()}
                {renderTimeline()}
            </div>

            {/* GPS denied warning */}
            {gps.status === 'denied' && (
                <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-md mx-auto bg-red-600 text-white rounded-2xl p-4 shadow-xl flex items-start gap-3 z-40">
                    <WifiOff size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm">Location Access Denied</p>
                        <p className="text-xs text-red-100">GPS location is required to clock in. Please enable location permissions in your browser and refresh.</p>
                    </div>
                </div>
            )}

            {/* Manual adjust modal */}
            {manualModal && (
                <ManualAdjustModal
                    punchType={manualModal}
                    onConfirm={handleManualConfirm}
                    onCancel={() => setManualModal(null)}
                />
            )}
        </div>
    );
}
