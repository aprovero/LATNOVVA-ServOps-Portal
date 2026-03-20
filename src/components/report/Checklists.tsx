import { CheckSquare, Plus, Trash2, ShieldAlert, ListChecks } from 'lucide-react';
import { ReportChecklist, useStore } from '../../store/useStore';

interface ChecklistsProps {
    checklists: ReportChecklist[];
    onChange: (checklists: ReportChecklist[]) => void;
    readOnly: boolean;
}

export default function Checklists({ checklists, onChange, readOnly }: ChecklistsProps) {
    const { templates } = useStore();
    const handleAdd = () => {
        onChange([...checklists, { id: `chk-${Date.now()}`, item: '', status: 'Unchecked' }]);
    };

    const handleApplyTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        const newItems: ReportChecklist[] = template.items.map((item, index) => ({
            id: `chk-${Date.now()}-${index}`,
            item,
            status: 'Unchecked'
        }));

        onChange([...checklists, ...newItems]);
    };

    const handleUpdate = (id: string, field: keyof ReportChecklist, value: string) => {
        onChange(checklists.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleRemove = (id: string) => {
        onChange(checklists.filter(c => c.id !== id));
    };

    const statusColors = {
        'Matches': 'bg-status-success text-white border-status-success',
        'Does not match': 'bg-status-error text-white border-status-error',
        'N/A': 'bg-gray-500 text-white border-gray-500',
        'Unchecked': 'bg-surface-alt text-gray-500 border-gray-200 hover:bg-gray-100'
    };

    return (
        <div className="card-container">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <CheckSquare className="text-brand-teal" size={20} /> Quality Assurance Checklists
                </h2>
                {!readOnly && (
                    <div className="flex flex-col sm:flex-row gap-3">
                        {templates.length > 0 && (
                            <div className="relative flex-1 sm:flex-none">
                                <ListChecks className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select
                                    className="pl-9 pr-8 py-2 w-full sm:w-48 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleApplyTemplate(e.target.value);
                                            e.target.value = ''; // Reset after selection
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="" disabled>Apply Template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center justify-center gap-2 shrink-0">
                            <Plus size={16} /> Add Custom
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {checklists.map((chk) => (
                    <div key={chk.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-surface-alt rounded-xl border border-gray-100">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={chk.item}
                                onChange={(e) => handleUpdate(chk.id, 'item', e.target.value)}
                                disabled={readOnly}
                                placeholder="Inspection point (e.g. Earthing system verified...)"
                                className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 font-medium text-accent-greyDark disabled:opacity-70"
                            />
                        </div>
                        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                            {(['Matches', 'Does not match', 'N/A'] as const).map(s => (
                                <button
                                    key={s}
                                    disabled={readOnly}
                                    onClick={() => handleUpdate(chk.id, 'status', s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${chk.status === s ? statusColors[s] : statusColors['Unchecked']
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        {!readOnly && (
                            <button onClick={() => handleRemove(chk.id)} className="text-gray-400 hover:text-red-500 transition-colors shrink-0 hidden md:block">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                ))}

                {checklists.length === 0 && (
                    <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center">
                        <ShieldAlert size={32} className="mb-2 opacity-50 text-gray-400" />
                        <p className="text-sm font-medium">No checklists configured for this report.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
