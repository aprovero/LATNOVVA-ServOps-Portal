import { AlertCircle, Plus, Trash2, Clock, Hourglass, Activity, Target } from 'lucide-react';
import { ReportOccurrence } from '../../store/useStore';

interface OccurrenceSectionProps {
    occurrences: ReportOccurrence[];
    onChange: (occurrences: ReportOccurrence[]) => void;
    readOnly: boolean;
}

const CATEGORIES = [
    'Customer delay',
    'Equipment failure',
    'Material Related',
    'Weather',
    'Access',
    'Crew',
    'Safety',
    'Other'
];

export default function Occurrences({ occurrences, onChange, readOnly }: OccurrenceSectionProps) {
    const handleAdd = () => {
        onChange([...occurrences, { 
            id: `occ-${Date.now()}`, 
            time: new Date().toTimeString().slice(0, 5), 
            durationMinutes: 0,
            category: 'Customer delay',
            description: '',
            impact: {
                schedule: false,
                productivity: false,
                safety: false,
                clientVisible: false
            }
        }]);
    };

    const handleUpdate = (id: string, field: keyof ReportOccurrence, value: any) => {
        onChange(occurrences.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const handleImpactToggle = (id: string, impactField: keyof NonNullable<ReportOccurrence['impact']>) => {
        onChange(occurrences.map(o => {
            if (o.id === id) {
                const currentImpact = o.impact || { schedule: false, productivity: false, safety: false, clientVisible: false };
                return {
                    ...o,
                    impact: { ...currentImpact, [impactField]: !currentImpact[impactField] }
                };
            }
            return o;
        }));
    };

    const handleRemove = (id: string) => {
        onChange(occurrences.filter(o => o.id !== id));
    };

    if (occurrences.length === 0 && readOnly) return null;

    return (
        <div className="card-container border-l-4 border-l-orange-400">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <AlertCircle className="text-orange-500" size={20} /> Field Issues / Blockers
                </h2>
                {!readOnly && (
                    <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center justify-center gap-2 bg-white w-full sm:w-auto">
                        <Plus size={16} /> Log Issue
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {occurrences.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-4 p-5 bg-orange-50/50 rounded-2xl border border-orange-100 relative">
                        {!readOnly && (
                            <button onClick={() => handleRemove(entry.id)} className="absolute top-4 right-4 text-orange-300 hover:text-red-500 transition-colors z-10">
                                <Trash2 size={16} />
                            </button>
                        )}
                        
                        <div className="flex flex-col md:flex-row items-start gap-4 pr-6 md:pr-0">
                            {/* Category Dropdown */}
                            <div className="w-full md:w-1/3 shrink-0">
                                <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1.5">
                                    <Target size={12} /> Category (Mandatory)
                                </label>
                                <select
                                    value={entry.category || 'Other'}
                                    onChange={(e) => handleUpdate(entry.id, 'category', e.target.value)}
                                    disabled={readOnly}
                                    className="w-full bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-3 py-2 text-sm disabled:opacity-70"
                                >
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            {/* Time & Duration */}
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-2/3 shrink-0">
                                <div>
                                    <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1.5">
                                        <Clock size={12} /> Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={entry.time}
                                        onChange={(e) => handleUpdate(entry.id, 'time', e.target.value)}
                                        disabled={readOnly}
                                        className="w-24 bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-2 py-2 font-mono text-sm font-semibold disabled:opacity-70"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1.5">
                                        <Hourglass size={12} /> Duration (Minutes)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={entry.durationMinutes || ''}
                                            onChange={(e) => handleUpdate(entry.id, 'durationMinutes', parseInt(e.target.value) || 0)}
                                            disabled={readOnly}
                                            placeholder="e.g. 60"
                                            className="w-24 bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-3 py-2 font-mono text-sm disabled:opacity-70"
                                        />
                                        {!readOnly && (
                                            <div className="hidden sm:flex gap-1">
                                                {[15, 30, 60, 120].map(mins => (
                                                    <button
                                                        key={mins}
                                                        type="button"
                                                        onClick={() => handleUpdate(entry.id, 'durationMinutes', mins)}
                                                        className="px-2 py-1 bg-white border border-orange-200 hover:bg-orange-100 text-xs font-bold text-orange-600 rounded-lg transition-colors"
                                                    >
                                                        {mins >= 60 ? `${mins/60}h` : `${mins}m`}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs font-bold text-orange-500 uppercase mb-1.5 block">Description / Notes</label>
                            <input
                                type="text"
                                value={entry.description}
                                onChange={(e) => handleUpdate(entry.id, 'description', e.target.value)}
                                disabled={readOnly}
                                placeholder="Describe the delay, incident, or change..."
                                className="w-full bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-3 py-2 text-sm disabled:opacity-70"
                            />
                        </div>

                        {/* Impact Toggles */}
                        <div className="pt-2 border-t border-orange-200/50">
                            <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-2">
                                <Activity size={12} /> Impact Toggle
                            </label>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { id: 'schedule', label: 'Affected schedule' },
                                    { id: 'productivity', label: 'Affected productivity' },
                                    { id: 'safety', label: 'Safety concern' },
                                    { id: 'clientVisible', label: 'Client visible' }
                                ].map((impactOption) => {
                                    const key = impactOption.id as keyof NonNullable<typeof entry.impact>;
                                    const isChecked = !!entry.impact?.[key];
                                    return (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                            <div className="relative flex items-center justify-center w-5 h-5">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleImpactToggle(entry.id, key)}
                                                    disabled={readOnly}
                                                    className="appearance-none w-5 h-5 rounded border border-orange-300 checked:bg-orange-500 checked:border-orange-500 disabled:opacity-70 transition-colors"
                                                />
                                                {isChecked && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-1.5 h-2.5 border-b-2 border-r-2 border-white transform rotate-45 mb-0.5"></div></div>}
                                            </div>
                                            <span className={`text-sm font-semibold transition-colors ${isChecked ? 'text-orange-700' : 'text-gray-500 group-hover:text-orange-600'}`}>{impactOption.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                ))}

                {occurrences.length === 0 && (
                    <div className="p-6 text-center text-orange-400 bg-orange-50/30 rounded-2xl border border-dashed border-orange-200">
                        <p className="text-sm">No occurrences or delays logged for this shift.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
