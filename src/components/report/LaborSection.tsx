import { useMemo } from 'react';
import { Plus, Trash2, Users, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface LaborEntry {
    id: string;
    personnelId?: string;
    role: string;
    qty: number;
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

export default function LaborSection({ labor, onChange, readOnly, currentReportId, currentDate }: LaborSectionProps) {
    const { personnel, reports } = useStore();

    const handleAdd = () => {
        onChange([...labor, { id: `l-${Date.now()}`, personnelId: '', role: '', qty: 1, hours: 8, isOutsourced: false }]);
    };

    const handleUpdate = (id: string, field: keyof LaborEntry, value: string | number | boolean) => {
        onChange(labor.map(l => l.id === id ? { ...l, [field]: value } : l));
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

    return (
        <div className="card-container">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <Users className="text-brand-teal" size={20} /> Workforce & Labor
                </h2>
                {!readOnly && (
                    <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-gray-50 border-gray-200">
                        <Plus size={16} /> Add Role
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {labor.map((entry) => {
                    const isPersonSelected = !!entry.personnelId;
                    const expiredCerts = isPersonSelected ? getExpiredCerts(entry.personnelId) : [];
                    const hasWarning = expiredCerts.length > 0;

                    return (
                        <div key={entry.id} className={`flex items-start gap-4 p-4 bg-surface-alt rounded-2xl border ${hasWarning ? 'border-status-error/40 bg-red-50/30' : 'border-gray-100'}`}>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Personnel</label>
                                <select
                                    value={entry.personnelId || ''}
                                    onChange={(e) => {
                                        const p = personnel.find(person => person.id === e.target.value);
                                        handleUpdate(entry.id, 'personnelId', e.target.value);
                                        if (p) {
                                            handleUpdate(entry.id, 'role', p.position);
                                        }
                                    }}
                                    disabled={readOnly}
                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 disabled:opacity-70 text-sm"
                                >
                                    <option value="">-- Select Person --</option>
                                    {personnel.map(p => {
                                        const isBusy = busyPersonnelIds.has(p.id);
                                        const expired = getExpiredCerts(p.id).length > 0;
                                        const isDisabled = isBusy || expired;
                                        return (
                                            <option key={p.id} value={p.id} disabled={isDisabled}>
                                                {p.name} ({p.position})
                                                {isBusy ? ' - Busy on another report today' : ''}
                                                {expired ? ' - Expired Certs' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                {hasWarning && (
                                    <div className="flex items-center gap-1 mt-2 text-status-error text-xs font-bold">
                                        <AlertTriangle size={14} /> Expired: {expiredCerts.join(', ')}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Role / Position</label>
                                <input
                                    type="text"
                                    value={entry.role}
                                    onChange={(e) => handleUpdate(entry.id, 'role', e.target.value)}
                                    disabled={readOnly || isPersonSelected}
                                    placeholder="e.g. Electrician"
                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 disabled:opacity-70 text-sm"
                                />
                            </div>
                            <div className="w-20">
                                <label className="text-xs font-bold text-gray-500 uppercase">Qty</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={entry.qty}
                                    onChange={(e) => handleUpdate(entry.id, 'qty', parseInt(e.target.value) || 0)}
                                    disabled={readOnly}
                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70"
                                />
                            </div>
                            <div className="w-20">
                                <label className="text-xs font-bold text-gray-500 uppercase">Hours</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={entry.hours}
                                    onChange={(e) => handleUpdate(entry.id, 'hours', parseFloat(e.target.value) || 0)}
                                    disabled={readOnly}
                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!entry.isOutsourced}
                                        onChange={(e) => handleUpdate(entry.id, 'isOutsourced', e.target.checked)}
                                        disabled={readOnly}
                                        className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal w-4 h-4 disabled:opacity-50"
                                    />
                                    <span className="text-xs font-bold text-gray-500 uppercase">Outsourced</span>
                                </label>
                            </div>
                            {!readOnly && (
                                <button onClick={() => handleRemove(entry.id)} className="mt-5 text-gray-400 hover:text-red-500 transition-colors ml-2">
                                    <Trash2 size={20} />
                                </button>
                            )}
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
