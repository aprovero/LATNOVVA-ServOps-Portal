import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Plus, AlertTriangle, Wrench } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface ToolDropdownProps {
    onAdd: (toolId: string) => void;
    readOnly: boolean;
    alreadyAssigned: string[];
    currentReportId?: string;
    currentDate?: string;
}

export default function ToolDropdown({ onAdd, readOnly, alreadyAssigned, currentReportId, currentDate }: ToolDropdownProps) {
    const { tools, reports } = useStore();
    const [selectedId, setSelectedId] = useState<string>('');
    const [warning, setWarning] = useState<string | null>(null);

    const busyToolIds = useMemo(() => {
        if (!currentDate || !currentReportId) return new Set<string>();
        const busy = new Set<string>();
        reports.forEach(r => {
            if (r.id !== currentReportId && r.date === currentDate) {
                if (r.usedTools) {
                    r.usedTools.forEach(tId => busy.add(tId));
                }
            }
        });
        return busy;
    }, [reports, currentDate, currentReportId]);

    const availableTools = tools.filter(t => !alreadyAssigned.includes(t.id));

    const handleSelectChange = (val: string) => {
        setSelectedId(val);
        const t = tools.find(tool => tool.id === val);
        if (t && new Date(t.certificationExpiry) < new Date()) {
            setWarning(`Warning: ${t.name} (SN: ${t.serialNumber}) has an expired certification!`);
        } else {
            setWarning(null);
        }
    };

    const handleAdd = () => {
        if (!selectedId) return;
        onAdd(selectedId);
        setSelectedId('');
        setWarning(null);
    };

    if (readOnly) return null;

    if (tools.length === 0) {
        return <p className="text-sm text-gray-500">No tools defined in the system. Go to Tools to add some.</p>;
    }

    return (
        <div className="flex flex-col gap-2 w-full max-w-sm">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <Select value={selectedId} onValueChange={handleSelectChange} disabled={readOnly}>
                        <SelectTrigger className={`bg-white focus:ring-brand-teal h-10 w-full rounded-xl ${warning ? 'border-status-warning text-status-warning bg-orange-50' : 'border-gray-200'}`}>
                            <SelectValue placeholder="Select a tool to add..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-xl max-h-60">
                            {availableTools.map((t) => {
                                const isExpired = new Date(t.certificationExpiry) < new Date();
                                const isBusy = busyToolIds.has(t.id);
                                const isDisabled = isExpired || isBusy;
                                return (
                                    <SelectItem key={t.id} value={t.id} disabled={isDisabled}>
                                        <div className="flex items-center gap-2">
                                            <Wrench size={14} className={isExpired ? 'text-status-warning' : 'text-gray-400'} />
                                            <span className={(isExpired || isBusy) ? 'text-status-warning font-medium' : ''}>
                                                {t.name} ({t.serialNumber})
                                                {isBusy ? ' - Busy on another report today' : ''}
                                                {isExpired && !isBusy ? ' - EXPIRED' : ''}
                                            </span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    onClick={handleAdd}
                    disabled={!selectedId || readOnly}
                    className="bg-gray-100 hover:bg-gray-200 text-accent-greyDark shadow-none border border-gray-200 h-10 px-4 rounded-xl flex items-center gap-2 font-semibold shrink-0"
                >
                    <Plus size={16} /> Add
                </Button>
            </div>
            {warning && (
                <div className="flex items-start gap-2 text-sm text-status-warning bg-orange-50 p-2 rounded-lg border border-orange-200 animate-in fade-in zoom-in slide-in-from-top-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{warning}</span>
                </div>
            )}
        </div>
    );
}
