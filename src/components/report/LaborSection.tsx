import { useMemo } from 'react';
import { Plus, Trash2, Users, AlertTriangle, Send } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface LaborEntry {
    id: string;
    personnelId?: string;
    role: string;
    qty: number;
    timeIn?: string;
    timeOut?: string;
    type?: 'On Site' | 'Travel' | 'Other';
    hours: number;
    isOutsourced?: boolean;
}

interface LaborSectionProps {
    labor: LaborEntry[];
    onChange: (labor: LaborEntry[]) => void;
    readOnly: boolean;
    currentReportId?: string;
    currentDate?: string;
}

const calculateHours = (inTime?: string, outTime?: string) => {
    if (!inTime || !outTime) return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60;
    return Number((diff / 60).toFixed(2));
};

export default function LaborSection({ labor, onChange, readOnly, currentReportId, currentDate }: LaborSectionProps) {
    const { personnel, reports, timesheets, addTimesheet, userRole } = useStore();

    const handleAdd = () => {
        onChange([...labor, { id: `l-${Date.now()}`, personnelId: '', role: '', qty: 1, timeIn: '08:00', timeOut: '17:00', type: 'On Site', hours: 9, isOutsourced: false }]);
    };

    const handleUpdate = (id: string, field: keyof LaborEntry, value: string | number | boolean) => {
        onChange(labor.map(l => {
            if (l.id !== id) return l;
            const updated = { ...l, [field]: value };
            if (field === 'timeIn' || field === 'timeOut') {
                updated.hours = calculateHours(updated.timeIn, updated.timeOut);
            }
            return updated;
        }));
    };

    const handleRemove = (id: string) => {
        onChange(labor.filter(l => l.id !== id));
    };

    const getExpiredCerts = (personId: string | undefined) => {
        if (!personId) return [];
        const person = personnel.find(p => p.id === personId);
        if (!person || !person.certifications) return [];
        return person.certifications.filter(cert => cert.expirationDate && new Date(cert.expirationDate) < new Date()).map(c => c.name);
    };

    const busyPersonnelIds = useMemo(() => {
        if (!currentDate || !currentReportId) return new Set<string>();
        const busy = new Set<string>();
        reports.forEach(r => {
            if (r.id !== currentReportId && r.date === currentDate) {
                r.labor?.forEach(l => {
                    if (l.personnelId) busy.add(l.personnelId);
                });
            }
        });
        return busy;
    }, [reports, currentDate, currentReportId]);

    const handleBatchLogTimesheets = () => {
        if (!currentDate || readOnly) return;
        
        let successCount = 0;
        let failCount = 0;
        const currentReport = reports.find(r => r.id === currentReportId);
        
        labor.forEach(entry => {
            if (!entry.personnelId || !entry.timeIn || !entry.timeOut || entry.isOutsourced) {
                if (entry.personnelId && !entry.isOutsourced) failCount++;
                return;
            }
            
            const overlap = timesheets.some(t => {
                if (t.personnelId !== entry.personnelId) return false;
                if (t.date !== currentDate) return false;
                if (!t.timeIn || !t.timeOut) return false;
                
                const tIn = t.timeIn;
                const tOut = t.timeOut < t.timeIn ? '24:00' : t.timeOut;
                const nIn = entry.timeIn!;
                const nOut = entry.timeOut! < entry.timeIn! ? '24:00' : entry.timeOut!;

                return tIn < nOut && nIn < tOut;
            });

            if (overlap) {
                failCount++;
            } else {
                addTimesheet({
                    id: `TS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    personnelId: entry.personnelId,
                    date: currentDate,
                    timeIn: entry.timeIn,
                    timeOut: entry.timeOut,
                    hours: entry.hours,
                    type: entry.type || 'On Site',
                    classification: 'Regular',
                    projectId: currentReport?.projectId,
                    status: 'Pending',
                    notes: `Autologged from report ${currentReportId}`
                });
                successCount++;
            }
        });

        alert(`Timesheet Batch Log:\n✅ Successfully created ${successCount} entries.\n❌ Skipped ${failCount} entries (overlapping times or missing data).`);
    };

    return (
        <div className="card-container">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <Users className="text-brand-teal" size={20} /> Workforce & Labor
                </h2>
                <div className="flex flex-wrap gap-2">
                    {!readOnly && labor.length > 0 && ['Manager', 'Supervisor', 'HR'].includes(userRole) && (
                        <button onClick={handleBatchLogTimesheets} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-brand-teal/10 text-brand-teal border-brand-teal/20 hover:bg-brand-teal hover:text-white transition-colors">
                            <Send size={16} /> Batch Log Timesheets
                        </button>
                    )}
                    {!readOnly && (
                        <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-gray-50 border-gray-200">
                            <Plus size={16} /> Add Role
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {labor.map((entry) => {
                    const isPersonSelected = !!entry.personnelId;
                    const expiredCerts = isPersonSelected ? getExpiredCerts(entry.personnelId) : [];
                    const hasWarning = expiredCerts.length > 0;

                    return (
                        <div key={entry.id} className={`flex flex-col gap-4 p-4 bg-surface-alt rounded-2xl border ${hasWarning ? 'border-status-error/40 bg-red-50/30' : 'border-gray-100'}`}>
                            <div className="flex flex-wrap items-start gap-4">
                                <div className="flex-[2] min-w-[200px]">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personnel</label>
                                    <select
                                        value={entry.personnelId || ''}
                                        onChange={(e) => {
                                            const p = personnel.find(person => person.id === e.target.value);
                                            handleUpdate(entry.id, 'personnelId', e.target.value);
                                            if (p && !entry.role) {
                                                handleUpdate(entry.id, 'role', p.position);
                                            }
                                        }}
                                        disabled={readOnly}
                                        className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 disabled:opacity-70 text-sm font-semibold"
                                    >
                                        <option value="">-- Worker --</option>
                                        {personnel.map(p => {
                                            const isBusy = busyPersonnelIds.has(p.id);
                                            const expired = getExpiredCerts(p.id).length > 0;
                                            const isDisabled = isBusy || expired;
                                            return (
                                                <option key={p.id} value={p.id} disabled={isDisabled}>
                                                    {p.name} ({p.position})
                                                    {isBusy ? ' - Busy' : ''}
                                                    {expired ? ' - Expired Certs' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {hasWarning && (
                                        <div className="flex items-center gap-1 mt-2 text-status-error text-[10px] font-bold">
                                            <AlertTriangle size={12} /> Expired: {expiredCerts.join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-[1.5] min-w-[150px]">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</label>
                                    <input
                                        type="text"
                                        value={entry.role}
                                        onChange={(e) => handleUpdate(entry.id, 'role', e.target.value)}
                                        disabled={readOnly || isPersonSelected}
                                        placeholder="Position"
                                        className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 disabled:opacity-70 text-sm"
                                    />
                                </div>
                                <div className="w-16 shrink-0">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={entry.qty}
                                        onChange={(e) => handleUpdate(entry.id, 'qty', parseInt(e.target.value) || 0)}
                                        disabled={readOnly}
                                        className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70 text-sm"
                                    />
                                </div>
                                <div className="w-24 shrink-0">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time In</label>
                                    <input
                                        type="time"
                                        value={entry.timeIn || '08:00'}
                                        onChange={(e) => handleUpdate(entry.id, 'timeIn', e.target.value)}
                                        disabled={readOnly}
                                        className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70 text-sm"
                                    />
                                </div>
                                <div className="w-24 shrink-0">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Out</label>
                                    <input
                                        type="time"
                                        value={entry.timeOut || '17:00'}
                                        onChange={(e) => handleUpdate(entry.id, 'timeOut', e.target.value)}
                                        disabled={readOnly}
                                        className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70 text-sm"
                                    />
                                </div>
                                <div className="w-16 shrink-0">
                                    <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">Hrs</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={entry.hours}
                                        disabled
                                        className="w-full bg-transparent border-b border-transparent text-brand-teal outline-none py-1 mt-1 text-center font-bold text-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                                <div className="flex items-center gap-6">
                                    <div className="w-32">
                                        <select
                                            value={entry.type || 'On Site'}
                                            onChange={(e) => handleUpdate(entry.id, 'type', e.target.value)}
                                            disabled={readOnly}
                                            className="w-full bg-gray-50 border-none focus:ring-1 focus:ring-brand-teal rounded py-1 px-2 text-xs font-semibold text-gray-600 outline-none"
                                        >
                                            <option value="On Site">On Site</option>
                                            <option value="Travel">Travel Time</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!entry.isOutsourced}
                                            onChange={(e) => handleUpdate(entry.id, 'isOutsourced', e.target.checked)}
                                            disabled={readOnly}
                                            className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal w-3.5 h-3.5 disabled:opacity-50"
                                        />
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Outsourced</span>
                                    </label>
                                </div>
                                {!readOnly && (
                                    <button onClick={() => handleRemove(entry.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {labor.length === 0 && (
                    <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-sm">No labor entries logged for this shift.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
