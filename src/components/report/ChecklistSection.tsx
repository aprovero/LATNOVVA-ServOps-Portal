import { ClipboardCheck } from 'lucide-react';
import { ReportChecklist } from '../../store/useStore';

interface ChecklistSectionProps {
    checklists: ReportChecklist[];
    onChange: (checklists: ReportChecklist[]) => void;
    readOnly: boolean;
}

export default function ChecklistSection({ checklists, onChange, readOnly }: ChecklistSectionProps) {
    if (checklists.length === 0 && readOnly) return null;

    const handleStatusChange = (id: string, status: ReportChecklist['status']) => {
        if (readOnly) return;
        onChange(checklists.map(c => c.id === id ? { ...c, status } : c));
    };

    return (
        <div className="card-container">
            <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                <ClipboardCheck className="text-brand-teal" size={20} /> Inspections & Checklists
            </h2>
            <div className="space-y-3">
                {checklists.map((chk) => (
                    <div key={chk.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-surface-alt rounded-2xl border border-gray-100 gap-4">
                        <span className="text-sm font-medium text-accent-greyDark flex-1 leading-snug">{chk.item}</span>

                        <div className="flex items-center gap-2 shrink-0 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                            {['Matches', 'Does not match', 'N/A'].map((opt) => (
                                <button
                                    key={opt}
                                    disabled={readOnly}
                                    onClick={() => handleStatusChange(chk.id, opt as ReportChecklist['status'])}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                        ${chk.status === opt
                                            ? (opt === 'Matches' ? 'bg-status-success text-white shadow-md'
                                                : opt === 'Does not match' ? 'bg-status-error text-white shadow-md'
                                                    : 'bg-gray-400 text-white shadow-md')
                                            : 'bg-transparent text-gray-400 hover:bg-gray-50'}`}
                                >
                                    {opt === 'Does not match' ? 'Fail' : opt === 'Matches' ? 'Pass' : 'N/A'}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                {checklists.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6 border border-dashed rounded-xl">No checklist items defined.</p>
                )}
            </div>
        </div>
    );
}
