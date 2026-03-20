import { AlertCircle, Plus, Trash2, Clock } from 'lucide-react';
import { ReportOccurrence } from '../../store/useStore';

interface OccurrenceSectionProps {
    occurrences: ReportOccurrence[];
    onChange: (occurrences: ReportOccurrence[]) => void;
    readOnly: boolean;
}

export default function OccurrenceSection({ occurrences, onChange, readOnly }: OccurrenceSectionProps) {
    const handleAdd = () => {
        onChange([...occurrences, { id: `occ-${Date.now()}`, time: new Date().toTimeString().slice(0, 5), description: '' }]);
    };

    const handleUpdate = (id: string, field: keyof ReportOccurrence, value: string) => {
        onChange(occurrences.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const handleRemove = (id: string) => {
        onChange(occurrences.filter(o => o.id !== id));
    };

    if (occurrences.length === 0 && readOnly) return null;

    return (
        <div className="card-container border-l-4 border-l-orange-400">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <AlertCircle className="text-orange-500" size={20} /> Occurrences / Incidents
                </h2>
                {!readOnly && (
                    <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-white">
                        <Plus size={16} /> Add Log
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {occurrences.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-4 p-5 bg-orange-50/50 rounded-2xl border border-orange-100 relative">
                        {!readOnly && (
                            <button onClick={() => handleRemove(entry.id)} className="absolute top-4 right-4 text-orange-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        )}
                        <div className="w-24 shrink-0">
                            <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1">
                                <Clock size={12} /> Time
                            </label>
                            <input
                                type="time"
                                value={entry.time}
                                onChange={(e) => handleUpdate(entry.id, 'time', e.target.value)}
                                disabled={readOnly}
                                className="w-full bg-transparent border-b border-orange-200 focus:border-orange-500 outline-none py-1.5 font-mono text-sm font-semibold disabled:opacity-70"
                            />
                        </div>
                        <div className="flex-1 pr-6">
                            <label className="text-xs font-bold text-orange-500 uppercase mb-1 block">Description</label>
                            <input
                                type="text"
                                value={entry.description}
                                onChange={(e) => handleUpdate(entry.id, 'description', e.target.value)}
                                disabled={readOnly}
                                placeholder="Describe weather delay, incident, or change..."
                                className="w-full bg-transparent border-b border-orange-200 focus:border-orange-500 outline-none py-1.5 text-sm disabled:opacity-70"
                            />
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
