import { AlertTriangle, Plus, Trash2, Clock } from 'lucide-react';
import { ReportOccurrence } from '../../store/useStore';

interface OccurrencesProps {
    occurrences: ReportOccurrence[];
    onChange: (occurrences: ReportOccurrence[]) => void;
    readOnly: boolean;
}

export default function Occurrences({ occurrences, onChange, readOnly }: OccurrencesProps) {
    const handleAdd = () => {
        onChange([...occurrences, { id: `occ-${Date.now()}`, time: '08:00', description: '' }]);
    };

    const handleUpdate = (id: string, field: keyof ReportOccurrence, value: string) => {
        onChange(occurrences.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const handleRemove = (id: string) => {
        onChange(occurrences.filter(o => o.id !== id));
    };

    return (
        <div className="card-container border border-status-warning/20">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <AlertTriangle className="text-status-warning" size={20} /> Occurrences & Blockers
                </h2>
                {!readOnly && (
                    <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 border-status-warning text-status-warning hover:bg-status-warning/10">
                        <Plus size={16} /> Log Event
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {occurrences.map((occ) => (
                    <div key={occ.id} className="flex items-start gap-4 p-4 bg-status-warning/5 rounded-xl border border-status-warning/20">
                        <div className="w-32 bg-white rounded-lg border border-gray-200 p-1 flex items-center shrink-0">
                            <Clock size={16} className="text-gray-400 ml-2" />
                            <input
                                type="time"
                                value={occ.time}
                                onChange={(e) => handleUpdate(occ.id, 'time', e.target.value)}
                                disabled={readOnly}
                                className="w-full bg-transparent border-none outline-none py-1 px-2 text-sm font-mono text-accent-greyDark disabled:opacity-70"
                            />
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={occ.description}
                                onChange={(e) => handleUpdate(occ.id, 'description', e.target.value)}
                                disabled={readOnly}
                                placeholder="Describe the occurrence (e.g. Missing material, wait time...)"
                                className="w-full bg-white border border-gray-200 rounded-lg focus:border-status-warning outline-none py-2 px-3 text-sm min-h-[60px] disabled:opacity-70 resize-y"
                            />
                        </div>
                        {!readOnly && (
                            <button onClick={() => handleRemove(occ.id)} className="text-gray-400 hover:text-red-500 transition-colors mt-2">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                ))}

                {occurrences.length === 0 && (
                    <div className="p-4 text-center text-status-warning/60 bg-status-warning/5 rounded-2xl border border-dashed border-status-warning/30">
                        <p className="text-sm">No occurrences or blockers logged.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
