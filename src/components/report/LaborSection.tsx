import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { UserCheck, Signature, Check, AlertTriangle, Plus, Users, Trash2 } from 'lucide-react';

interface LaborEntry {
    id: string;
    personnelId?: string;
    role: string;
    _tempName?: string;
    qty: number;
    timeIn?: string;
    timeOut?: string;
    type?: 'On Site' | 'Travel' | 'Other';
    hours: number;
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
    const { t } = useTranslation();
    const { personnel, reports, timesheets, userRole, projects, addPersonnel } = useStore();

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
        onChange([...labor, { id: `l-${Date.now()}`, personnelId: '', role: '', qty: 1, timeIn: '08:00', timeOut: '17:00', type: 'On Site', hours: 9 }]);
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
        
        // H-01: Mark as pending certs — uncertified quick-add workers need HSE validation
        onChange([...labor, { 
            id: `l-${Date.now()}`, 
            personnelId: newId, 
            role: quickPosition || 'Technician', 
            qty: 1, 
            timeIn: '08:00', 
            timeOut: '17:00', 
            type: 'On Site', 
            hours: 9,
            pendingCerts: true,
            _tempName: quickName, // Ensure name shows immediately
        } as any]);
        
        setIsAddQuickPersonOpen(false);
        setQuickName('');
        setQuickPosition('');

        // If we came from a specific entry, update it
        const entryId = (window as any)._lastLaborEntryId;
        if (entryId) {
            handleUpdate(entryId, 'personnelId', newId);
            handleUpdate(entryId, 'role', quickPosition || 'Technician');
            delete (window as any)._lastLaborEntryId;
        }
    };

    const handleBatchAddTeam = () => {
        const newEntries = selectedTeamIds.map(pid => {
            const p = personnel.find(per => per.id === pid);

            // M-03: Auto-fill times from today's GPS clock-in data if available
            const todayStr = currentDate || new Date().toISOString().split('T')[0];
            const todayPunch = timesheets.find(t => t.personnelId === pid && t.date === todayStr);
            const timeIn = todayPunch?.timeIn || '08:00';
            const timeOut = todayPunch?.timeOut || '17:00';
            const hours = todayPunch?.hours || 9;
            const hasClockIn = !!todayPunch?.timeIn;

            return {
                id: `l-${Date.now()}-${pid}`,
                personnelId: pid,
                role: p?.position || '',
                qty: 1,
                timeIn,
                timeOut,
                type: 'On Site' as const,
                hours,
                _tempName: p?.name,
                _autoFilledFromGPS: hasClockIn, // internal flag for UX hint
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




    return (
        <div className="card-container">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <Users className="text-brand-teal" size={20} /> {t('reports.labor_section.workforce_title')}
                    {discipline && (
                        <span className="text-[10px] bg-brand-teal text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {discipline}
                        </span>
                    )}
                </h2>
                <div className="flex flex-wrap gap-2">
                    {!readOnly && (
                        <div className="flex gap-2">
                            <button onClick={handleAdd} className="bg-brand-teal text-white text-xs font-bold uppercase tracking-wider py-2 px-4 rounded-lg hover:bg-brand-tealDark transition-all flex items-center gap-2">
                                <Plus size={14} /> {t('reports.labor_section.add_worker')}
                            </button>
                            <button onClick={() => {
                                const initialSelected = (project?.assignedPersonnel || []).filter(pid => !labor.some(l => l.personnelId === pid));
                                setSelectedTeamIds(initialSelected);
                                setIsBatchAddOpen(true);
                            }} className="bg-gray-50 text-gray-600 border border-gray-200 text-xs font-bold uppercase tracking-wider py-2 px-4 rounded-lg hover:bg-gray-100 transition-all flex items-center gap-2">
                                <UserCheck size={14} /> {t('reports.labor_section.batch_add_team')}
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

                    if (userRole === 'Customer') {
                        // Customers see the worker row but never see internal HSE warnings
                        return (
                            <div key={entry.id} className="flex flex-col gap-4 p-4 bg-surface-alt rounded-2xl border border-gray-100">
                                <div className="flex flex-wrap items-start gap-4">
                                    <div className="flex-[2] min-w-[200px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('reports.labor_section.personnel_position_label')}</label>

                                        <div className="flex items-center gap-3 mt-1 py-1">
                                            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal overflow-hidden border border-brand-teal/10 shadow-sm shrink-0">
                                                {(() => {
                                                    const p = personnel.find(per => per.id === entry.personnelId);
                                                    return p?.image ? <img src={p.image} className="w-full h-full object-cover" /> : (p?.name?.charAt(0) ?? '?');
                                                })()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-accent-greyDark leading-none mb-0.5">
                                                    {personnel.find(p => p.id === entry.personnelId)?.name || (entry as any)._tempName || entry.personnelId || '—'}
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{entry.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-sm">
                                        <div><p className="text-[10px] text-gray-400 uppercase font-bold">{t('reports.labor_section.hours_label')}</p><p className="font-bold">{entry.hours}h</p></div>
                                        <div><p className="text-[10px] text-gray-400 uppercase font-bold">{t('reports.labor_section.on_site_label')}</p><p className="font-bold">{entry.type}</p></div>

                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // H-01: Check for pending cert flag (Quick Add personnel) — internal roles only
                    const isPendingCerts = !!(entry as any).pendingCerts;

                    return (
                        <div key={entry.id} className={`flex flex-col gap-4 p-4 bg-surface-alt rounded-2xl border ${
                            isPendingCerts ? 'border-amber-300 bg-amber-50/40' :
                            hasWarning ? 'border-status-error/40 bg-red-50/30' : 'border-gray-100'
                        }`}>
                            {/* H-01: Pending Certification Records badge */}
                            {isPendingCerts && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-xl text-amber-800 text-xs font-bold">
                                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                                    {t('reports.labor_section.pending_certs_warning')}
                                </div>

                            )}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                <div className="md:col-span-12 lg:col-span-5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('reports.labor_section.personnel_position_label')}</label>

                                    <div className="flex items-center gap-3 mt-1 py-1">
                                        {!readOnly && (
                                            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal overflow-hidden border border-brand-teal/10 shadow-sm shrink-0">
                                                {(() => {
                                                    const p = personnel.find(per => per.id === entry.personnelId);
                                                    return p?.image ? <img src={p.image} className="w-full h-full object-cover" /> : (p?.name || (entry as any)._tempName || '?').charAt(0);
                                                })()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            {!readOnly && isPersonSelected ? (
                                                <div className="flex items-center justify-between group/name">
                                                    <button 
                                                        onClick={() => setSigningEntryId(entry.id)}
                                                        className="text-sm font-bold text-accent-greyDark hover:text-brand-teal transition-colors flex items-center gap-2 truncate"
                                                    >
                                                        {personnel.find(p => p.id === entry.personnelId)?.name || (entry as any)._tempName || entry.personnelId}
                                                        <Signature size={12} className="opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdate(entry.id, 'personnelId', '')}
                                                        className="text-[10px] font-bold text-gray-400 hover:text-brand-teal uppercase opacity-0 group-hover/name:opacity-100 transition-opacity whitespace-nowrap ml-2"
                                                    >
                                                        {t('reports.labor_section.change_worker')}
                                                    </button>

                                                </div>
                                            ) : (
                                            <select
                                                    value={entry.personnelId || ''}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'NEW_PERSON') {
                                                            setIsAddQuickPersonOpen(true);
                                                            // Keep track of which entry triggered the quick add
                                                            (window as any)._lastLaborEntryId = entry.id;
                                                            return;
                                                        }
                                                        const p = personnel.find(per => per.id === e.target.value);
                                                        handleUpdate(entry.id, 'personnelId', e.target.value);
                                                        if (p) handleUpdate(entry.id, 'role', p.position);
                                                        // M-03: auto-fill from GPS clock-in if available
                                                        if (currentDate) {
                                                            const punch = timesheets.find(t => t.personnelId === e.target.value && t.date === currentDate);
                                                            if (punch?.timeIn) handleUpdate(entry.id, 'timeIn', punch.timeIn);
                                                            if (punch?.timeOut) handleUpdate(entry.id, 'timeOut', punch.timeOut);
                                                        }
                                                    }}
                                                    disabled={readOnly}
                                                    className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 disabled:border-none disabled:opacity-100 text-sm font-bold text-accent-greyDark"
                                                >
                                                    <option value="">{t('reports.labor_section.select_worker_placeholder')}</option>

                                                    {/* M-05: exclude Customer-role accounts from labor */}
                                                    {personnel.filter(p => p.appRole !== 'Customer').map(p => {
                                                        const isBusy = busyPersonnelIds.has(p.id);
                                                        const expired = getExpiredCerts(p.id).length > 0;
                                                        const isDisabled = isBusy || expired;
                                                        return (
                                                            <option key={p.id} value={p.id} disabled={isDisabled}>
                                                                {p.name} {p.position ? `(${p.position})` : ''}
                                                                {isBusy ? ` - ${t('reports.labor_section.already_assigned')}` : ''}
                                                                {expired ? ` - ${t('reports.labor_section.expired_certs_tag')}` : ''}
                                                            </option>

                                                        );
                                                    })}
                                                    <option value="NEW_PERSON" className="text-brand-teal font-bold">+ {t('reports.labor_section.not_in_list')}</option>
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
                                        <div className="flex items-center gap-1 mt-1 text-status-error text-[10px] font-bold">
                                            <AlertTriangle size={12} /> Expired: {expiredCerts.join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:gap-3 md:col-span-12 lg:col-span-6 w-full items-end">
                                    <div className="min-w-0">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('reports.labor_section.time_in_label')}</label>
                                        <input
                                            type="time"
                                            value={entry.timeIn || '08:00'}
                                            onChange={(e) => handleUpdate(entry.id, 'timeIn', e.target.value)}
                                            disabled={readOnly}
                                            className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70 text-sm"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('reports.labor_section.time_out_label')}</label>
                                        <input
                                            type="time"
                                            value={entry.timeOut || '17:00'}
                                            onChange={(e) => handleUpdate(entry.id, 'timeOut', e.target.value)}
                                            disabled={readOnly}
                                            className="w-full bg-transparent border-b border-gray-200 focus:border-brand-teal outline-none py-1 mt-1 text-center disabled:opacity-70 text-sm"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1 min-w-0 text-center">
                                            <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">{t('reports.labor_section.hours_label')}</label>
                                            <div className="py-1 mt-1 font-bold text-brand-teal text-sm border-b border-transparent">
                                                {entry.hours}
                                            </div>
                                        </div>
                                        {!readOnly && (
                                            <button onClick={() => handleRemove(entry.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors mb-0.5">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {labor.length === 0 && (
                    <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-sm">{t('reports.labor_section.no_entries_shift')}</p>
                    </div>

                )}
            </div>

            {/* Batch Add Team Modal */}
            <Dialog open={isBatchAddOpen} onOpenChange={setIsBatchAddOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>{t('reports.labor_section.batch_add_team_modal_title')}</DialogTitle>

                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-xs text-gray-500">{t('reports.labor_section.batch_add_team_desc', { name: project?.name })}</p>

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
                                        {isAlreadyInLabor && <span className="text-[10px] font-bold text-gray-400 uppercase italic">{t('reports.reports.approved')}</span>}

                                    </label>
                                );
                            })}
                            {(project?.assignedPersonnel || []).length === 0 && (
                                <p className="text-center py-8 text-gray-400 italic text-sm border-2 border-dashed border-gray-100 rounded-2xl">{t('reports.labor_section.no_personnel_assigned')}</p>

                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBatchAddOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleBatchAddTeam} className="bg-brand-teal hover:bg-brand-teal/90 text-white" disabled={selectedTeamIds.length === 0}>
                            {t('reports.labor_section.add_workers_btn', { count: selectedTeamIds.length })}
                        </Button>

                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Add Personnel Modal */}
            <Dialog open={isAddQuickPersonOpen} onOpenChange={setIsAddQuickPersonOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>{t('reports.labor_section.quick_add_title')}</DialogTitle>

                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>{t('reports.labor_section.full_name_label')}</Label>
                            <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="e.g. Michael Scott" />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('reports.labor_section.position_label')}</Label>
                            <Input value={quickPosition} onChange={e => setQuickPosition(e.target.value)} placeholder="e.g. Electrician" />
                        </div>
                        <p className="text-[10px] text-amber-600 font-medium bg-amber-50 p-2 rounded border border-amber-100">
                             {t('reports.labor_section.quick_add_help')}
                        </p>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddQuickPersonOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleQuickAddPerson} className="bg-brand-teal hover:bg-brand-teal/90 text-white" disabled={!quickName.trim()}>
                            {t('reports.labor_section.add_select_btn')}
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
                            {t('reports.labor_section.digital_signature_title')}: {personnel.find(p => p.id === labor.find(l => l.id === signingEntryId)?.personnelId)?.name}
                        </DialogTitle>

                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center relative group cursor-pointer hover:bg-gray-100 transition-all">
                             <div className="absolute top-4 right-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                 <AlertTriangle size={10} /> {t('reports.labor_section.supervisor_sig_required')}
                             </div>
                             <div className="text-center text-gray-300">
                                 <Plus size={32} className="mx-auto mb-2 opacity-20" />
                                 <p className="text-sm font-medium">{t('reports.labor_section.click_to_sign')}</p>
                                 <p className="text-[10px] mt-1">{t('reports.labor_section.gps_verified')}</p>
                             </div>

                             {/* Canvas placeholder */}
                             <div className="absolute inset-4 border border-gray-100 bg-white/50 backdrop-blur-[1px] rounded-xl hidden group-hover:block transition-all" />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 bg-gray-50 p-3 rounded-xl border border-gray-100">
                             <Check size={14} className="text-brand-teal" />
                             <span>{t('reports.labor_section.certify_hours_text', { date: currentDate })}</span>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSigningEntryId(null)}>{t('common.cancel')}</Button>
                        <Button onClick={() => setSigningEntryId(null)} className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2">
                             {t('reports.labor_section.confirm_identity_log')} <Check size={16} />
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>
        </div>
    );
}
