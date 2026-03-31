import { useState } from 'react';
import { CheckSquare, Plus, Trash2, ShieldAlert, ListChecks, Lock, LockOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { ChecklistGroup, ReportChecklist, useStore } from '../../store/useStore';

interface ChecklistsProps {
    checklists: ChecklistGroup[];
    onChange: (checklists: ChecklistGroup[]) => void;
    readOnly: boolean;
}

const statusColors = {
    'Matches': 'bg-status-success text-white border-status-success',
    'Does not match': 'bg-status-error text-white border-status-error',
    'N/A': 'bg-gray-500 text-white border-gray-500',
    'Unchecked': 'bg-surface-alt text-gray-500 border-gray-200 hover:bg-gray-100'
};

export default function Checklists({ checklists, onChange, readOnly }: ChecklistsProps) {
    const { templates } = useStore();
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    // ── Group-level operations ─────────────────────────────────────────────

    const handleApplyTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        const newItems: ReportChecklist[] = template.items.map((item, index) => ({
            id: `chk-${Date.now()}-${index}`,
            item,
            status: 'Unchecked'
        }));

        const newGroup: ChecklistGroup = {
            id: `grp-${Date.now()}`,
            title: template.name,
            locked: false,
            items: newItems,
        };

        onChange([...checklists, newGroup]);
    };

    const handleAddCustomGroup = () => {
        const newGroup: ChecklistGroup = {
            id: `grp-${Date.now()}`,
            title: 'Custom Checklist',
            locked: false,
            items: [],
        };
        onChange([...checklists, newGroup]);
    };

    const handleRemoveGroup = (groupId: string) => {
        onChange(checklists.filter(g => g.id !== groupId));
    };

    const handleToggleLock = (groupId: string) => {
        onChange(checklists.map(g => g.id === groupId ? { ...g, locked: !g.locked } : g));
    };

    const handleUpdateGroupTitle = (groupId: string, title: string) => {
        onChange(checklists.map(g => g.id === groupId ? { ...g, title } : g));
    };

    const toggleCollapse = (groupId: string) => {
        setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // ── Item-level operations ──────────────────────────────────────────────

    const handleAddItem = (groupId: string) => {
        onChange(checklists.map(g => g.id === groupId
            ? { ...g, items: [...g.items, { id: `chk-${Date.now()}`, item: '', status: 'Unchecked' }] }
            : g
        ));
    };

    const handleUpdateItem = (groupId: string, itemId: string, field: keyof ReportChecklist, value: string) => {
        onChange(checklists.map(g => g.id === groupId
            ? { ...g, items: g.items.map(c => c.id === itemId ? { ...c, [field]: value } : c) }
            : g
        ));
    };

    const handleRemoveItem = (groupId: string, itemId: string) => {
        onChange(checklists.map(g => g.id === groupId
            ? { ...g, items: g.items.filter(c => c.id !== itemId) }
            : g
        ));
    };

    // ── Render ─────────────────────────────────────────────────────────────

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
                                            e.target.value = '';
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
                        <button onClick={handleAddCustomGroup} className="btn-secondary text-sm py-2 px-4 flex items-center justify-center gap-2 shrink-0">
                            <Plus size={16} /> Add Checklist
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {checklists.length === 0 && (
                    <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center">
                        <ShieldAlert size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-medium">No checklists added for this report.</p>
                        <p className="text-xs mt-1">Use "Apply Template" or "Add Checklist" to get started.</p>
                    </div>
                )}

                {checklists.map((group) => {
                    const isLocked = group.locked;
                    const isGroupEditable = !readOnly && !isLocked;
                    const isCollapsed = collapsed[group.id];
                    const allDone = group.items.length > 0 && group.items.every(i => i.status !== 'Unchecked');

                    return (
                        <div
                            key={group.id}
                            className={`rounded-2xl border transition-all ${isLocked
                                ? 'border-brand-teal/30 bg-brand-teal/3'
                                : 'border-gray-200 bg-surface-alt'
                                }`}
                        >
                            {/* Group Header */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                                <button
                                    onClick={() => toggleCollapse(group.id)}
                                    className="text-gray-400 hover:text-accent-grey transition-colors shrink-0"
                                    title={isCollapsed ? 'Expand' : 'Collapse'}
                                >
                                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                </button>

                                <input
                                    type="text"
                                    value={group.title}
                                    onChange={(e) => handleUpdateGroupTitle(group.id, e.target.value)}
                                    disabled={!isGroupEditable}
                                    placeholder="Checklist Name..."
                                    className="flex-1 bg-transparent border-none outline-none font-bold text-accent-greyDark text-base disabled:opacity-80 focus:ring-0 px-0"
                                />

                                <div className="flex items-center gap-2 shrink-0">
                                    {allDone && !isLocked && (
                                        <span className="text-[10px] font-bold text-status-success bg-status-success/10 px-2 py-1 rounded-full uppercase tracking-wider">
                                            Complete
                                        </span>
                                    )}
                                    {isLocked && (
                                        <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                            <Lock size={10} /> Locked
                                        </span>
                                    )}
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleToggleLock(group.id)}
                                            className={`p-1.5 rounded-lg transition-colors ${isLocked
                                                ? 'text-brand-teal bg-brand-teal/10 hover:bg-brand-teal/20'
                                                : 'text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10'
                                                }`}
                                            title={isLocked ? 'Unlock checklist' : 'Lock checklist'}
                                        >
                                            {isLocked ? <LockOpen size={16} /> : <Lock size={16} />}
                                        </button>
                                    )}
                                    {!readOnly && !isLocked && (
                                        <button
                                            onClick={() => handleRemoveGroup(group.id)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Remove this checklist"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            {!isCollapsed && (
                                <div className="p-3 space-y-2">
                                    {group.items.length === 0 && (
                                        <p className="text-xs text-center text-gray-400 py-3">
                                            No items yet. Add inspection points below.
                                        </p>
                                    )}
                                    {group.items.map((chk) => (
                                        <div key={chk.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={chk.item}
                                                    onChange={(e) => handleUpdateItem(group.id, chk.id, 'item', e.target.value)}
                                                    disabled={!isGroupEditable}
                                                    placeholder="Inspection point..."
                                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 font-medium text-accent-greyDark disabled:opacity-70 text-sm"
                                                />
                                            </div>
                                            <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 md:pb-0">
                                                {(['Matches', 'Does not match', 'N/A'] as const).map(s => (
                                                    <button
                                                        key={s}
                                                        disabled={!isGroupEditable}
                                                        onClick={() => handleUpdateItem(group.id, chk.id, 'status', s)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${chk.status === s
                                                            ? statusColors[s]
                                                            : statusColors['Unchecked']
                                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                            {isGroupEditable && (
                                                <button
                                                    onClick={() => handleRemoveItem(group.id, chk.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 hidden md:block"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    {isGroupEditable && (
                                        <button
                                            onClick={() => handleAddItem(group.id)}
                                            className="w-full mt-1 py-2 text-xs font-bold text-gray-400 hover:text-brand-teal border border-dashed border-gray-200 hover:border-brand-teal/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Plus size={14} /> Add Item
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
