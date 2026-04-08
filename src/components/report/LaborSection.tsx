import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { UserPlus, UserCheck, Signature, Check, AlertTriangle, Plus, Users, Send, Trash2, Target } from 'lucide-react';

interface LaborEntry {
    id: string;
    personnelId?: string;
    outsourcedName?: string;
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
    discipline?: string;
}

const calculateHours = (inTime?: string, outTime?: string) => {
    if (!inTime || !outTime) return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60;
    return Number((diff / 60).toFixed(2));
};

export default function LaborSection({ labor, onChange, readOnly, currentReportId, currentDate, discipline }: LaborSectionProps) {
    const { personnel, reports, timesheets, addTimesheet, userRole, projects, addPersonnel } = useStore();
    const currentReport = reports.find(r => r.id === currentReportId);
    const project = projects.find(p => p.id === currentReport?.projectId);

    // Modals
    const [isAddQuickPersonOpen, setIsAddQuickPersonOpen] = useState(false);
    const [quickName, setQuickName] = useState('');
    const [quickPosition, setQuickPosition] = useState('');
    
    const [isBatchAddOpen, setIsBatchAddOpen] = useState(false);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

    const [signingEntryId, setSigningEntryId] = useState<string | null>(null);

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

    const handleQuickAddPerson = () => {
        if (!quickName.trim()) return;
        const newId = `usr-${Date.now()}`;
        addPersonnel({
            id: newId,
            name: quickName,
            position: quickPosition || 'Technician',
            employeeNumber: `TEMP-${Math.floor(Math.random() * 1000)}`,
            status: 'Active',
            appRole: 'Tech',
            certifications: []
        });
        
        // Add to labor list
        onChange([...labor, { 
            id: `l-${Date.now()}`, 
            personnelId: newId, 
            role: quickPosition || 'Technician', 
            qty: 1, 
            timeIn: '08:00', 
            timeOut: '17:00', 
            type: 'On Site', 
            hours: 9 
        }]);
        
        setIsAddQuickPersonOpen(false);
        setQuickName('');
        setQuickPosition('');
    };

    const handleBatchAddTeam = () => {
        const newEntries = selectedTeamIds.map(pid => {
            const p = personnel.find(per => per.id === pid);
            return {
                id: `l-${Date.now()}-${pid}`,
                personnelId: pid,
                role: p?.position || '',
                qty: 1,
                timeIn: '08:00',
                timeOut: '17:00',
                type: 'On Site' as const,
                hours: 9
            };
        });
        onChange([...labor, ...newEntries]);
        setIsBatchAddOpen(false);
        setSelectedTeamIds([]);
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
                    {discipline && (
                        <span className="text-[10px] bg-brand-teal text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {discipline}
                        </span>
                    )}
                </h2>
                <div className="flex flex-wrap gap-2">
                    {!readOnly && labor.length > 0 && ['Manager', 'Supervisor', 'HR'].includes(userRole) && (
                        <div className="flex flex-col items-end gap-1">
                            <button onClick={handleBatchLogTimesheets} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-brand-teal/10 text-brand-teal border-brand-teal/20 hover:bg-brand-teal hover:text-white transition-colors shadow-sm">
                                <Send size={16} /> Batch Log Timesheets
                            </button>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mr-1">
                                <Target size={12} className="text-status-success" /> Site Lead Responsibility
                            </p>
                        </div>
                    )}
                    {!readOnly && (
                        <div className="flex gap-2">
                            <button onClick={() => setIsBatchAddOpen(true)} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-brand-teal/5 text-brand-teal border-brand-teal/20">
                                <UserCheck size={16} /> Batch Add Team
                            </button>
                            <button onClick={() => setIsAddQuickPersonOpen(true)} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-gray-50 border-gray-200">
                                <UserPlus size={16} /> Add Personnel on-the-fly
                            </button>
                            <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 bg-gray-50 border-gray-200">
                                <Plus size={16} /> Custom Entry
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {labor.map((entry) => {
                    const isPersonSelected = !!entry.personnelId;
                    const expiredCerts = isPersonSelected ? getExpiredCerts(entry.personnelId) : [];
                    const hasWarning = expiredCerts.length > 0;

                    if (userRole === 'Customer' && hasWarning) return null;

                    return (
                        <div key={entry.id} className={`flex flex-col gap-4 p-4 bg-surface-alt rounded-2xl border ${hasWarning ? 'border-status-error/40 bg-red-50/30' : 'border-gray-100'}`}>
                            <div className="flex flex-wrap items-start gap-4">
                                        <div className="flex-[2] min-w-[200px]">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personnel & Position</label>
                                    <div className="flex items-center gap-3 mt-1 py-1">
                                        {!readOnly && (
                                            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal overflow-hidden border border-brand-teal/10 shadow-sm shrink-0">
                                                {(() => {
                                                    const p = personnel.find(per => per.id === entry.personnelId);
                                                    return p?.image ? <img src={p.image} className="w-full h-full object-cover" /> : p?.name.charAt(0);
                                                })()}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            {!readOnly && isPersonSelected ? (
                                                <div className="flex items-center justify-between group/name">
                                                    <button 
                                                        onClick={() => setSigningEntryId(entry.id)}
                                                        className="text-sm font-bold text-accent-greyDark hover:text-brand-teal transition-colors flex items-center gap-2"
                                                    >
                                                        {personnel.find(p => p.id === entry.personnelId)?.name}
                                                        <Signature size={12} className="opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdate(entry.id, 'personnelId', '')}
                                                        className="text-[10px] font-bold text-gray-400 hover:text-brand-teal uppercase opacity-0 group-hover/name:opacity-100 transition-opacity"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            ) : entry.isOutsourced ? (
                                                <input
                                                    type="text"
                                                    value={entry.outsourcedName || ''}
                                                    onChange={e => handleUpdate(entry.id, 'outsourcedName', e.target.value)}
                                                    disabled={readOnly}
                                                    placeholder="Enter worker name manually"
                                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 text-sm font-bold text-accent-greyDark"
                                                />
                                            ) : (
                                                <select
                                                    value={entry.personnelId || ''}
                                                    onChange={(e) => {
                                                        const p = personnel.find(per => per.id === e.target.value);
                                                        handleUpdate(entry.id, 'personnelId', e.target.value);
                                                        if (p) handleUpdate(entry.id, 'role', p.position);
                                                    }}
                                                    disabled={readOnly}
                                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 disabled:border-none disabled:opacity-100 text-sm font-bold text-accent-greyDark"
                                                >
                                                    <option value="">-- Select Worker --</option>
                                                    {personnel.map(p => {
                                                        const isBusy = busyPersonnelIds.has(p.id);
                                                        const expired = getExpiredCerts(p.id).length > 0;
                                                        const isDisabled = isBusy || expired;
                                                        return (
                                                            <option key={p.id} value={p.id} disabled={isDisabled}>
                                                                {p.name} {p.position ? `(${p.position})` : ''}
                                                                {isBusy ? ' - [ALREADY ASSIGNED]' : ''}
                                                                {expired ? ' - [EXPIRED CERTS]' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            )}
                                            {!readOnly && isPersonSelected && personnel.find(p => p.id === entry.personnelId)?.position && (
                                                <p className="text-[9px] font-bold text-brand-teal uppercase mt-0.5 tracking-tighter">
                                                    {personnel.find(p => p.id === entry.personnelId)?.position}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {hasWarning && (
                                        <div className="flex items-center gap-1 mt-2 text-status-error text-[10px] font-bold">
                                            <AlertTriangle size={12} /> Expired: {expiredCerts.join(', ')}
                                        </div>
                                    )}
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
                                    <div className="w-24">
                                        <div className="w-full bg-gray-50 rounded py-1 px-2 text-xs font-bold text-gray-400 text-center uppercase tracking-wider">
                                            On Site
                                        </div>
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

            {/* Batch Add Team Modal */}
            <Dialog open={isBatchAddOpen} onOpenChange={setIsBatchAddOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Batch Add Project Team</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-xs text-gray-500">Select personnel assigned to this project ({project?.name}) to add them to the report automatically.</p>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {(project?.assignedPersonnel || []).map(pid => {
                                const p = personnel.find(per => per.id === pid);
                                if (!p) return null;
                                const isAlreadyInLabor = labor.some(l => l.personnelId === pid);
                                return (
                                    <label key={pid} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${isAlreadyInLabor ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'hover:bg-brand-teal/5 border-gray-100 hover:border-brand-teal/30'}`}>
                                        <input 
                                            type="checkbox" 
                                            disabled={isAlreadyInLabor}
                                            checked={selectedTeamIds.includes(pid)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedTeamIds([...selectedTeamIds, pid]);
                                                else setSelectedTeamIds(selectedTeamIds.filter(id => id !== pid));
                                            }}
                                            className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal w-4 h-4"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-accent-greyDark">{p.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{p.position}</p>
                                        </div>
                                        {isAlreadyInLabor && <span className="text-[10px] font-bold text-gray-400 uppercase italic">In Report</span>}
                                    </label>
                                );
                            })}
                            {(project?.assignedPersonnel || []).length === 0 && (
                                <p className="text-center py-8 text-gray-400 italic text-sm border-2 border-dashed border-gray-100 rounded-2xl">No personnel assigned to this project yet.</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBatchAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleBatchAddTeam} className="bg-brand-teal hover:bg-brand-teal/90 text-white" disabled={selectedTeamIds.length === 0}>
                            Add {selectedTeamIds.length} Workers
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Add Personnel Modal */}
            <Dialog open={isAddQuickPersonOpen} onOpenChange={setIsAddQuickPersonOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Quick-Add Personnel</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="e.g. Michael Scott" />
                        </div>
                        <div className="space-y-2">
                            <Label>Position</Label>
                            <Input value={quickPosition} onChange={e => setQuickPosition(e.target.value)} placeholder="e.g. Electrician" />
                        </div>
                        <p className="text-[10px] text-amber-600 font-medium bg-amber-50 p-2 rounded border border-amber-100">
                             Newly added personnel will be added as "Tech" by default. Full profile details can be updated later in the Personnel menu.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddQuickPersonOpen(false)}>Cancel</Button>
                        <Button onClick={handleQuickAddPerson} className="bg-brand-teal hover:bg-brand-teal/90 text-white" disabled={!quickName.trim()}>
                            Add & Select
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Signature Popup Modal */}
            <Dialog open={!!signingEntryId} onOpenChange={(open) => !open && setSigningEntryId(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Signature size={20} className="text-brand-teal" /> 
                            Digital Signature: {personnel.find(p => p.id === labor.find(l => l.id === signingEntryId)?.personnelId)?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center relative group cursor-pointer hover:bg-gray-100 transition-all">
                             <div className="absolute top-4 right-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                 <AlertTriangle size={10} /> Supervisor Signature Required
                             </div>
                             <div className="text-center text-gray-300">
                                 <Plus size={32} className="mx-auto mb-2 opacity-20" />
                                 <p className="text-sm font-medium">Click to Sign or Tap to Draw</p>
                                 <p className="text-[10px] mt-1">Verified with GPS & Timestamp</p>
                             </div>
                             {/* Canvas placeholder */}
                             <div className="absolute inset-4 border border-gray-100 bg-white/50 backdrop-blur-[1px] rounded-xl hidden group-hover:block transition-all" />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 bg-gray-50 p-3 rounded-xl border border-gray-100">
                             <Check size={14} className="text-brand-teal" />
                             <span>I hereby certify that the hours logged correctly reflect the work performed on this date ({currentDate}).</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSigningEntryId(null)}>Cancel</Button>
                        <Button onClick={() => setSigningEntryId(null)} className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2">
                             Confirm Identity & Log <Check size={16} />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
