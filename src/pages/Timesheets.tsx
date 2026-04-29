import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, TimesheetEntry } from '../store/useStore';
import { format, parseISO } from 'date-fns';
import { Clock, Plus, Calendar as CalendarIcon, User, Users, Briefcase, Filter, Download, Edit2, Trash2, PenTool, MapPin, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';

import UnifiedSignaturePad from '../components/shared/UnifiedSignaturePad';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { formatTime } from '../lib/utils';

const calculateHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime) return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60; // Handling crossing midnight
    return Number((diff / 60).toFixed(2));
};

const punchDotColor: Record<string, string> = {
    clockIn: '#00B4A6',
    clockOut: '#EF4444',
};

const formatPunchTime = (iso: string) => formatTime(iso);

export default function Timesheets() {
    const { t } = useTranslation();
    const { timesheets, addTimesheet, updateTimesheet, deleteTimesheet, personnel, projects, userRole, userId, getCurrentUserName, resolvePersonnelId } = useStore();
    const resolvedPersonnelId = resolvePersonnelId() || userId;

    const punchLabel: Record<string, string> = {
        clockIn: t('timesheets.punches.clock_in'),
        clockOut: t('timesheets.punches.clock_out'),
    };
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [signatureBlob, setSignatureBlob] = useState<string>('');
    const [signatureName, setSignatureName] = useState<string>('');
    const [expandedPunchId, setExpandedPunchId] = useState<string | null>(null);
    const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
    const [batchAction, setBatchAction] = useState<'Check-in' | 'Check-out'>('Check-in');
    const [batchSignatures, setBatchSignatures] = useState<Record<string, string>>({});
    const [batchProject, setBatchProject] = useState('');
    const [batchDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [batchTime, setBatchTime] = useState(format(new Date(), 'HH:mm'));
    const [signingPersonnelId, setSigningPersonnelId] = useState<string | null>(null);

    // Form state
    const [newEntry, setNewEntry] = useState<Partial<TimesheetEntry>>({
        date: format(new Date(), 'yyyy-MM-dd'),
        timeIn: '08:00',
        timeOut: '17:00',
        hours: 9,
        type: 'On Site',
        classification: 'Regular',
        personnelId: resolvedPersonnelId,
        status: 'Pending',
        notes: '',
        manualReason: '', // H-04: required justification for manual entries
    });

    const [filterProject, setFilterProject] = useState('');
    const [filterPersonnel, setFilterPersonnel] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [projectSearchDropdown, setProjectSearchDropdown] = useState('');
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    const [isPersonnelDropdownOpen, setIsPersonnelDropdownOpen] = useState(false);
    const [personnelSearchDropdown, setPersonnelSearchDropdown] = useState('');
    const personnelDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
                setIsProjectDropdownOpen(false);
            }
            if (personnelDropdownRef.current && !personnelDropdownRef.current.contains(event.target as Node)) {
                setIsPersonnelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Auto-update hours when time in/out changes
        if (newEntry.timeIn && newEntry.timeOut) {
            setNewEntry((prev: Partial<TimesheetEntry>) => ({ ...prev, hours: calculateHours(prev.timeIn!, prev.timeOut!) }));
        }
    }, [newEntry.timeIn, newEntry.timeOut]);

    const openAddModal = () => {
        setEditingEntryId(null);
        setSignatureBlob('');
        setSignatureName('');
        setNewEntry({
            date: format(new Date(), 'yyyy-MM-dd'),
            timeIn: '08:00',
            timeOut: '17:00',
            hours: 9,
            type: 'On Site',
            classification: 'Regular',
            personnelId: userRole === 'Tech' ? newEntry.personnelId : (personnel[0]?.id || ''),
            status: 'Pending',
            notes: '',
            manualReason: '',
            projectId: ''
        });
        setIsAddModalOpen(true);
    };

    const openBatchModal = () => {
        setBatchAction('Check-in');
        setBatchSignatures({});
        
        const assignedProj = projects.find(p => p.assignedPersonnel?.includes(resolvedPersonnelId));
        if (assignedProj) {
            setBatchProject(assignedProj.id);
            const teamIds = (assignedProj.assignedPersonnel || []).filter(id => {
                const p = personnel.find(person => person.id === id);
                return p && p.status !== 'Inactive';
            });
            setSelectedPersonnel(teamIds);
        } else {
            setBatchProject('');
            setSelectedPersonnel([]);
        }
        setIsBatchModalOpen(true);
    };

    const openEditModal = (entry: TimesheetEntry) => {
        setEditingEntryId(entry.id);
        setNewEntry(entry);
        setSignatureBlob(entry.signature?.blob || '');
        setSignatureName(entry.signature?.name || '');
        setIsAddModalOpen(true);
    };

    const handleSaveEntry = () => {
        if (!newEntry.personnelId || !newEntry.date) return;

        // L-06: Explicit positive hours check applies to BOTH creates AND edits
        if (!newEntry.hours || Number(newEntry.hours) <= 0) {
            alert(t('timesheets.alerts.hours_positive'));
            return;
        }

        if (newEntry.type === 'On Site' && newEntry.projectId && !signatureBlob) {
            alert(t('timesheets.alerts.signature_required'));
            return;
        }

        // H-04: Require justification for ALL manually-entered or edited timesheets
        if (!newEntry.manualReason?.trim()) {
            alert(t('timesheets.alerts.reason_required'));
            return;
        }

        // M-06 FIX: Proper overnight overlap detection using minutes-since-midnight
        const toMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const overlap = timesheets.some(t => {
            if (t.id === editingEntryId) return false;
            if (t.personnelId !== newEntry.personnelId) return false;
            if (t.date !== newEntry.date) return false;
            if (!t.timeIn || !t.timeOut || !newEntry.timeIn || !newEntry.timeOut) return false;

            let tInM = toMinutes(t.timeIn);
            let tOutM = toMinutes(t.timeOut);
            if (tOutM <= tInM) tOutM += 1440; // crosses midnight

            let nInM = toMinutes(newEntry.timeIn!);
            let nOutM = toMinutes(newEntry.timeOut!);
            if (nOutM <= nInM) nOutM += 1440; // crosses midnight

            return tInM < nOutM && nInM < tOutM;
        });

        if (overlap) {
            alert(t('timesheets.alerts.overlap'));
            return;
        }

        const payload = {
            id: editingEntryId || `TS-${Date.now()}`,
            personnelId: newEntry.personnelId,
            date: newEntry.date,
            timeIn: newEntry.timeIn,
            timeOut: newEntry.timeOut,
            hours: Number(newEntry.hours),
            type: newEntry.type as any,
            classification: newEntry.classification as any,
            projectId: newEntry.projectId,
            notes: newEntry.notes || '',
            manualReason: newEntry.manualReason || '',  // H-04
            source: 'manual' as const,                 // H-04: explicit source field
            status: newEntry.status || 'Pending',
            signature: signatureBlob ? {
                name: signatureName || 'Customer',
                timestamp: new Date().toISOString(),
                blob: signatureBlob
            } : newEntry.signature
        };

        if (editingEntryId) {
            updateTimesheet(editingEntryId, payload as any);
        } else {
            addTimesheet(payload as any);
        }

        setIsAddModalOpen(false);
    };

    const handleBatchSubmit = () => {
        if (!batchProject) {
            alert(t('timesheets.alerts.select_project'));
            return;
        }

        let reused = 0;
        let created = 0;

        selectedPersonnel.forEach((pId: string) => {
            const sig = batchSignatures[pId];
            if (!sig) return;

            const personName = personnel.find(p => p.id === pId)?.name || 'Worker';
            const sigPayload = { name: personName, timestamp: new Date().toISOString(), blob: sig };

            if (batchAction === 'Check-in') {
                // H-02: Check if a GPS clock-in already exists for this person today
                const existingGpsEntry = timesheets.find(t =>
                    t.personnelId === pId && t.date === batchDate && t.timeIn
                );
                if (existingGpsEntry) {
                    // Reuse existing GPS record — just append signature and update project
                    updateTimesheet(existingGpsEntry.id, {
                        projectId: batchProject,
                        status: 'Pending',
                        signature: sigPayload,
                    } as any);
                    reused++;
                } else {
                    // No GPS record — create a manual entry, flagged for audit
                    addTimesheet({
                        id: `TS-BATCH-${Date.now()}-${pId}`,
                        personnelId: pId,
                        date: batchDate,
                        timeIn: batchTime,
                        hours: 0,
                        type: 'On Site',
                        classification: 'Regular',
                        projectId: batchProject,
                        status: 'Pending',
                        gpsVerified: false,
                        source: 'manual',
                        manualReason: `Batch check-in by supervisor at ${batchTime} (no GPS record found)`,
                        signature: sigPayload,
                    } as any);
                    created++;
                }
            } else {
                // Check-out: find open entry (no timeOut) and close it
                const existing = timesheets.find(t =>
                    t.personnelId === pId && t.date === batchDate && !t.timeOut
                );
                if (existing) {
                    const hours = calculateHours(existing.timeIn || '08:00', batchTime);
                    updateTimesheet(existing.id, {
                        timeOut: batchTime,
                        hours,
                        status: 'Pending',
                        signature: sigPayload,
                    });
                    reused++;
                }
            }
        });

        setIsBatchModalOpen(false);
        setSigningPersonnelId(null);
        setBatchSignatures({});
        setSelectedPersonnel([]);
        const summary = batchAction === 'Check-in'
            ? t('timesheets.batch.summary_checkin', { reused, created })
            : t('timesheets.batch.summary_checkout', { reused });
        alert(`${t('timesheets.batch.complete_alert', { action: batchAction })}\n${summary}`);
    };

    const handleBatchApprove = () => {
        if (selectedEntries.length === 0) return;
        selectedEntries.forEach(id => {
            const entry = timesheets.find(t => t.id === id);
            if (entry && entry.status !== 'Approved') {
                updateTimesheet(id, { status: 'Approved', approvedBy: getCurrentUserName() } as any);
            }
        });
        setSelectedEntries([]);
    };

    const handleBatchDelete = () => {
        if (selectedEntries.length === 0) return;
        if (confirm(t('timesheets.alerts.delete_selected_confirm', { count: selectedEntries.length }))) {
            selectedEntries.forEach(id => {
                deleteTimesheet(id);
            });
            setSelectedEntries([]);
        }
    };

    const handleExportCSV = () => {
        const headers = ['Name', 'Date', 'Time In', 'Time Out', 'Hours', 'Location/Type', 'Classification', 'Project', 'Status', 'Notes'];
        const rows = filteredTimesheets.map(t => [
            `"${getPersonnelName(t.personnelId)}"`,
            t.date,
            t.timeIn || '',
            t.timeOut || '',
            t.hours,
            t.type || '',
            t.classification || '',
            `"${getProjectName(t.projectId)}"`,
            t.status || '',
            `"${(t.notes || '').replace(/"/g, '""')}"`
        ]);
        const csvStr = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timesheets_export_${format(new Date(), 'yyyyMMdd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getPersonnelName = (id: string, entry?: TimesheetEntry) => {
        const p = personnel.find(p => p.id === id);
        if (p) return p.name;
        if (entry?.punches?.[0]?.isOutsourced && entry.punches[0].outsourcedName) {
            return entry.punches[0].outsourcedName;
        }
        return 'Unknown';
    };
    const getProjectName = (id?: string) => id ? projects.find(p => p.id === id)?.name || 'Unknown' : '-';

    const filteredTimesheets = timesheets
        .filter(t => filterProject ? t.projectId === filterProject : true)
        .filter(t => filterPersonnel ? t.personnelId === filterPersonnel : true)
        .filter(t => userRole === 'Tech' ? t.personnelId === resolvedPersonnelId : true)
        .filter(t => filterStartDate ? new Date(t.date) >= new Date(filterStartDate) : true)
        .filter(t => filterEndDate ? new Date(t.date) <= new Date(filterEndDate) : true)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalHours = filteredTimesheets.reduce((sum, t) => sum + t.hours, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Clock className="text-brand-teal" size={28} />
                        {t('timesheets.title')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('timesheets.subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm px-4 py-2 hidden sm:flex">
                        <span className="text-sm font-semibold text-gray-500">{t('timesheets.total_hours')}:</span>
                        <span className="ml-2 text-sm font-bold text-brand-teal">{totalHours} hrs</span>
                    </div>

                    {['Manager', 'Supervisor', 'HR'].includes(userRole) && (
                        <Button variant="outline" onClick={openBatchModal} className="rounded-xl gap-2 font-bold shadow-sm h-11 px-6 border-brand-teal/20 text-brand-teal hover:bg-brand-teal/5">
                            <Users size={18} /> {t('timesheets.team_checkin')}
                        </Button>
                    )}

                    {['Manager', 'HR'].includes(userRole) && (
                        <Button variant="outline" onClick={handleExportCSV} className="rounded-xl gap-2 font-bold shadow-sm h-11 px-6 border-gray-200 hover:bg-gray-50 text-gray-700">
                            <Download size={18} /> {t('common.export')}
                        </Button>
                    )}

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6" onClick={openAddModal}>
                            <Plus size={18} /> {t('timesheets.log_time')}
                        </Button>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">
                                    {editingEntryId ? t('timesheets.modals.edit_timesheet') : t('timesheets.modals.log_hours')}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.personnel')}</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal disabled:bg-gray-50 disabled:text-gray-500"
                                        value={newEntry.personnelId}
                                        onChange={e => setNewEntry({ ...newEntry, personnelId: e.target.value })}
                                        disabled={userRole === 'Tech'}
                                    >
                                        <option value="" disabled>{t('personnel.select_prompt')}...</option>
                                        {personnel.filter(p => userRole === 'Tech' ? p.id === newEntry.personnelId : true).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.date')}</label>
                                    <Input
                                        type="date"
                                        value={newEntry.date}
                                        onChange={e => setNewEntry({ ...newEntry, date: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.time_in')}</label>
                                        <Input
                                            type="time"
                                            value={newEntry.timeIn || ''}
                                            onChange={e => setNewEntry({ ...newEntry, timeIn: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.time_out')}</label>
                                        <Input
                                            type="time"
                                            value={newEntry.timeOut || ''}
                                            onChange={e => setNewEntry({ ...newEntry, timeOut: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.hours')}</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={newEntry.hours}
                                            onChange={e => setNewEntry({ ...newEntry, hours: Number(e.target.value) })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.type_location')}</label>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                            value={newEntry.type}
                                            onChange={e => setNewEntry({ ...newEntry, type: e.target.value as any })}
                                        >
                                            <option value="On Site">{t('timesheets.types.on_site')}</option>
                                            <option value="Travel">{t('timesheets.types.travel')}</option>
                                            <option value="Other">{t('timesheets.types.other')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.project_optional')}</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEntry.projectId || ''}
                                        onChange={e => setNewEntry({ ...newEntry, projectId: e.target.value })}
                                    >
                                        <option value="">{t('timesheets.modals.none_admin')}</option>
                                        {projects.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">{t('timesheets.modals.notes_optional')}</label>
                                    <Input
                                        placeholder="e.g. Travel to Site Alpha"
                                        value={newEntry.notes || ''}
                                        onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>

                                {!editingEntryId && (
                                    <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <label className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                                            <AlertTriangle size={14} className="text-amber-600" />
                                            {t('timesheets.modals.manual_reason')} <span className="text-red-500">*</span>
                                        </label>
                                        <p className="text-xs text-amber-600">{t('timesheets.modals.manual_reason_help')}</p>
                                        <Input
                                            placeholder={t('timesheets.modals.manual_reason_placeholder')}
                                            value={(newEntry as any).manualReason || ''}
                                            onChange={e => setNewEntry({ ...newEntry, manualReason: e.target.value } as any)}
                                            className="rounded-xl bg-white border-amber-300 focus:ring-amber-400"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2 mt-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                                    <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2">
                                        <PenTool size={16} className="text-brand-teal" /> {t('timesheets.modals.signature_label')}
                                    </label>
                                    <p className="text-xs text-gray-500 mb-2">{t('timesheets.modals.signature_help')}</p>
                                    <div className="space-y-3">
                                        <Input 
                                            placeholder={t('timesheets.modals.signer_placeholder')} 
                                            value={signatureName} 
                                            onChange={e => setSignatureName(e.target.value)}
                                            className="rounded-xl bg-white"
                                        />
                                        {signatureBlob ? (
                                            <div className="bg-white border text-center p-2 rounded-xl relative group">
                                                <img src={signatureBlob} alt="Signature" className="mx-auto max-h-24" />
                                                <button onClick={() => setSignatureBlob('')} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 font-bold text-xs rounded-md shadow-sm transition-opacity">{t('timesheets.modals.clear')}</button>
                                            </div>
                                        ) : (
                                            <div className="bg-white border border-dashed border-gray-300 rounded-xl relative overflow-hidden group p-4">
                                                <UnifiedSignaturePad 
                                                    onSign={(blob) => setSignatureBlob(blob)} 
                                                    onClear={() => setSignatureBlob('')}
                                                    placeholder={t('timesheets.modals.sign_here')}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleSaveEntry}>
                                    {editingEntryId ? t('timesheets.modals.update_entry') : t('timesheets.modals.save_entry')}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[200px] relative z-20" ref={projectDropdownRef}>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> {t('timesheets.filters.project')}</label>
                    <div 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus-within:ring-2 focus-within:ring-brand-teal flex items-center justify-between cursor-pointer"
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    >
                        <span className="truncate">{filterProject ? projects.find(p => p.id === filterProject)?.codeName || projects.find(p => p.id === filterProject)?.name : t('timesheets.filters.all_projects')}</span>
                        <ChevronDown className={`text-gray-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180': ''}`} size={16} />
                    </div>
                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                                <input
                                    type="text"
                                    placeholder={t('timesheets.filters.search_projects')}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-teal/50"
                                    value={projectSearchDropdown}
                                    onChange={(e) => setProjectSearchDropdown(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                                <div 
                                    className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${!filterProject ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`}
                                    onClick={() => { setFilterProject(''); setIsProjectDropdownOpen(false); setProjectSearchDropdown(''); }}
                                >
                                    {t('timesheets.filters.all_projects')}
                                </div>
                                {projects.filter(p => p.status === 'Active' && (!projectSearchDropdown || ((p.name || '') + (p.codeName || '')).toLowerCase().includes(projectSearchDropdown.toLowerCase()))).map(p => (
                                    <div 
                                        key={p.id}
                                        className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${filterProject === p.id ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`}
                                        onClick={() => { setFilterProject(p.id); setIsProjectDropdownOpen(false); setProjectSearchDropdown(''); }}
                                    >
                                        {p.codeName || p.name}
                                    </div>
                                ))}
                                {projects.filter(p => !projectSearchDropdown || ((p.name || '') + (p.codeName || '')).toLowerCase().includes(projectSearchDropdown.toLowerCase())).length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-gray-400 italic">{t('timesheets.filters.no_projects')}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {userRole !== 'Tech' && (
                    <div className="space-y-1.5 flex-1 min-w-[200px] relative z-10" ref={personnelDropdownRef}>
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><User size={12} /> {t('timesheets.filters.personnel')}</label>
                        <div 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus-within:ring-2 focus-within:ring-brand-teal flex items-center justify-between cursor-pointer"
                            onClick={() => setIsPersonnelDropdownOpen(!isPersonnelDropdownOpen)}
                        >
                            <span className="truncate">{filterPersonnel ? personnel.find(p => p.id === filterPersonnel)?.name : t('timesheets.filters.all_personnel')}</span>
                            <ChevronDown className={`text-gray-400 transition-transform ${isPersonnelDropdownOpen ? 'rotate-180': ''}`} size={16} />
                        </div>
                        {isPersonnelDropdownOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                                    <input
                                        type="text"
                                        placeholder={t('timesheets.filters.search_personnel')}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-teal/50"
                                        value={personnelSearchDropdown}
                                        onChange={(e) => setPersonnelSearchDropdown(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                                    <div 
                                        className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${!filterPersonnel ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`}
                                        onClick={() => { setFilterPersonnel(''); setIsPersonnelDropdownOpen(false); setPersonnelSearchDropdown(''); }}
                                    >
                                        {t('timesheets.filters.all_personnel')}
                                    </div>
                                    {personnel.filter(p => !personnelSearchDropdown || (p.name || '').toLowerCase().includes(personnelSearchDropdown.toLowerCase())).map(p => (
                                        <div 
                                            key={p.id}
                                            className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${filterPersonnel === p.id ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`}
                                            onClick={() => { setFilterPersonnel(p.id); setIsPersonnelDropdownOpen(false); setPersonnelSearchDropdown(''); }}
                                        >
                                            {p.name}
                                        </div>
                                    ))}
                                    {personnel.filter(p => !personnelSearchDropdown || (p.name || '').toLowerCase().includes(personnelSearchDropdown.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-xs text-gray-400 italic">{t('timesheets.filters.no_personnel')}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><CalendarIcon size={12} /> {t('timesheets.filters.from_date')}</label>
                    <Input
                        type="date"
                        className="bg-gray-50 border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-teal h-[42px]"
                        value={filterStartDate}
                        onChange={e => setFilterStartDate(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><CalendarIcon size={12} /> {t('timesheets.filters.to_date')}</label>
                    <Input
                        type="date"
                        className="bg-gray-50 border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-teal h-[42px]"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                    />
                </div>
                {(filterProject || filterPersonnel || filterStartDate || filterEndDate) && (
                    <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 py-2.5 h-auto text-sm font-bold" onClick={() => { setFilterProject(''); setFilterPersonnel(''); setFilterStartDate(''); setFilterEndDate(''); }}>
                        {t('timesheets.filters.clear')}
                    </Button>
                )}
            </div>

            {/* Batch Actions Bar */}
            {selectedEntries.length > 0 && (
                <div className="bg-brand-teal text-white p-4 rounded-2xl shadow-teal flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-sm">{selectedEntries.length} {t('timesheets.batch.selected_count')}</p>
                            <p className="text-[10px] text-white/70 uppercase tracking-widest font-semibold">{t('timesheets.batch.actions_available')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {['Manager', 'Supervisor'].includes(userRole) && (
                            <Button 
                                onClick={handleBatchApprove}
                                className="bg-white text-brand-teal hover:bg-white/90 rounded-xl px-4 py-2 text-xs font-bold gap-1.5 h-9"
                            >
                                <CheckCircle size={14} /> {t('timesheets.status.approved')}
                            </Button>
                        )}
                        <Button 
                            onClick={handleBatchDelete}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 text-xs font-bold gap-1.5 h-9 shadow-sm"
                        >
                            <Trash2 size={14} /> {t('common.actions')}
                        </Button>
                        <div className="w-px h-6 bg-white/20 mx-1" />
                        <Button 
                            variant="ghost" 
                            onClick={() => setSelectedEntries([])}
                            className="text-white hover:bg-white/10 rounded-xl px-3 py-2 text-xs font-bold h-9"
                        >
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Timesheet List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                <th className="p-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal cursor-pointer"
                                        checked={filteredTimesheets.length > 0 && selectedEntries.length === filteredTimesheets.length}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedEntries(filteredTimesheets.map(t => t.id));
                                            else setSelectedEntries([]);
                                        }}
                                    />
                                </th>
                                <th className="p-4 whitespace-nowrap">{t('timesheets.table.date')}</th>
                                <th className="p-4">{t('timesheets.table.personnel')}</th>
                                <th className="p-4 whitespace-nowrap">{t('timesheets.table.time_in_out')}</th>
                                <th className="p-4 whitespace-nowrap">{t('timesheets.table.hours')}</th>
                                <th className="p-4 min-w-[150px]">{t('timesheets.table.project')}</th>
                                <th className="p-4 whitespace-nowrap">{t('timesheets.table.gps')}</th>
                                <th className="p-4 whitespace-nowrap">{t('timesheets.table.status')}</th>
                                <th className="p-4 rounded-tr-xl text-right">{t('timesheets.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTimesheets.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-gray-500">
                                        <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                        <p className="text-lg font-semibold text-accent-greyDark flex items-center justify-center gap-2">{t('timesheets.table.empty')}</p>
                                        <p className="text-sm">{t('timesheets.table.empty_subtitle')}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTimesheets.map((entry) => (
                                    <>
                                        <tr key={entry.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedEntries.includes(entry.id) ? 'bg-brand-teal/5' : ''}`}>
                                            <td className="p-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal cursor-pointer"
                                                    checked={selectedEntries.includes(entry.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedEntries([...selectedEntries, entry.id]);
                                                        else setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                                                    }}
                                                />
                                            </td>
                                            <td className="p-4 text-sm font-medium text-accent-greyDark whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={14} className="text-gray-400" />
                                                    {format(parseISO(entry.date), 'MMM d, yyyy')}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-bold text-accent-greyDark whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>{getPersonnelName(entry.personnelId, entry)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                {entry.timeIn && entry.timeOut ? `${entry.timeIn} - ${entry.timeOut}` : '-'}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-lg text-brand-teal">{entry.hours}</span> <span className="text-xs text-gray-500 font-medium">hrs</span>
                                            </td>
                                            <td className="p-4 text-sm font-medium text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase size={14} className="text-gray-400 shrink-0" />
                                                    <span className="truncate max-w-[150px]" title={getProjectName(entry.projectId)}>{getProjectName(entry.projectId)}</span>
                                                </div>
                                                {entry.signature && (
                                                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-status-success font-bold px-1.5 py-0.5 bg-green-50 border border-green-100/50 rounded-md w-fit uppercase tracking-wider" title={`${t('common.actions')} ${entry.signature.name}`}>
                                                        <PenTool size={10} /> {entry.signature?.name ? `Verified by ${entry.signature.name}` : t('timesheets.table.verified')}
                                                    </div>
                                                )}
                                            </td>
                                            {/* GPS Badge */}
                                            <td className="p-4">
                                                {entry.punches && entry.punches.length > 0 ? (
                                                    <button
                                                        onClick={() => setExpandedPunchId(expandedPunchId === entry.id ? null : entry.id)}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                                                            entry.gpsVerified
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                        }`}
                                                        title={t('timesheets.table.view_gps')}
                                                    >
                                                        {entry.gpsVerified
                                                            ? <><CheckCircle size={11} /> GPS ✓</>                                                                : <><AlertTriangle size={11} /> {t('timesheets.table.review')}</>}
                                                        {expandedPunchId === entry.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="text-[11px] px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-semibold border border-amber-200 cursor-help"
                                                        title={entry.manualReason || t('timesheets.table.manual')}
                                                    >
                                                        ⚠ {t('timesheets.table.manual')}{entry.manualReason ? ' ·ℹ' : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                                                    entry.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                    entry.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {entry.status === 'Approved' ? t('timesheets.status.approved') :
                                                    entry.status === 'Rejected' ? t('timesheets.status.rejected') :
                                                    t('timesheets.status.pending')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {['Manager', 'Supervisor'].includes(userRole) && entry.status !== 'Approved' && (
                                                        <button
                                                            onClick={() => updateTimesheet(entry.id, { status: 'Approved', approvedBy: getCurrentUserName() })}
                                                            className="text-status-success hover:text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors"
                                                            title={t('timesheets.status.approved')}
                                                        >
                                                            <CheckCircle size={16} />
                                                        </button>
                                                    )}
                                                    {['Manager', 'Supervisor'].includes(userRole) && entry.status === 'Approved' && (
                                                        <button
                                                            onClick={() => updateTimesheet(entry.id, { status: 'Pending' })}
                                                            className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors"
                                                            title={t('timesheets.status.pending')}
                                                        >
                                                            <Clock size={16} />
                                                        </button>
                                                    )}

                                                    {/* Only Supervisors, Managers, or the Tech who owns the entry can edit/delete, AND it must not be approved */}
                                                    {(['Supervisor', 'Manager'].includes(userRole) || (
                                                        userRole === 'Tech' && entry.personnelId === resolvedPersonnelId
                                                    )) && entry.status !== 'Approved' ? (
                                                        <>
                                                            <button
                                                                onClick={() => openEditModal(entry)}
                                                                className="text-brand-teal hover:text-brand-teal/80 hover:bg-teal-50 p-2 rounded-lg transition-colors"
                                                                title={t('timesheets.modals.edit_timesheet')}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(t('timesheets.alerts.delete_confirm', { name: getPersonnelName(entry.personnelId), date: entry.date }))) {
                                                                        deleteTimesheet(entry.id);
                                                                    }
                                                                }}
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                title={t('common.actions')}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                        {/* GPS Punch Audit Trail */}
                                        {expandedPunchId === entry.id && entry.punches && (
                                            <tr key={`${entry.id}-punches`}>
                                                <td colSpan={9} className="px-6 pb-4 pt-0 bg-gray-50/60">
                                                    <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                            <MapPin size={12} /> {t('timesheets.table.audit_trail')}
                                                        </p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                            {entry.punches.map((punch, i) => (
                                                                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                                    <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: punchDotColor[punch.type] }} />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-gray-700">{punchLabel[punch.type] || punch.type}</p>
                                                                        <p className="text-xs text-gray-500 font-mono">{formatPunchTime(punch.timestamp)}</p>
                                                                        {punch.lat !== 0 ? (
                                                                            <a
                                                                                href={`https://maps.google.com/?q=${punch.lat},${punch.lng}`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="text-[10px] text-teal-600 hover:underline flex items-center gap-1 mt-0.5"
                                                                            >
                                                                                <MapPin size={9} />
                                                                                {punch.lat.toFixed(4)}, {punch.lng.toFixed(4)} · ±{Math.round(punch.accuracy)}m
                                                                            </a>
                                                                        ) : <p className="text-[10px] text-gray-400">{t('timesheets.table.no_gps')}</p>}
                                                                        {punch.manualAdjustment && (
                                                                            <span className="mt-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-bold">
                                                                                ✏ {t('timesheets.table.manual_adj')}
                                                                            </span>
                                                                        )}
                                                                        {punch.adjustmentNote && (
                                                                            <p className="text-[10px] text-gray-400 italic mt-0.5 truncate" title={punch.adjustmentNote}>"{punch.adjustmentNote}"</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
                <DialogContent className="sm:max-w-[550px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                            <Users size={20} className="text-brand-teal" /> 
                            {t('timesheets.batch.manager_title')}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100 mb-4">
                            <div className="flex flex-1 gap-1">
                                <button 
                                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${batchAction === 'Check-in' ? 'bg-brand-teal text-white shadow-sm' : 'text-gray-400 hover:text-brand-teal'}`}
                                    onClick={() => { setBatchAction('Check-in'); setSelectedPersonnel([]); setBatchSignatures({}); }}
                                >
                                    {t('timesheets.batch.checkin_group')}
                                </button>
                                <button 
                                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${batchAction === 'Check-out' ? 'bg-brand-teal text-white shadow-sm' : 'text-gray-400 hover:text-brand-teal'}`}
                                    onClick={() => { setBatchAction('Check-out'); setSelectedPersonnel([]); setBatchSignatures({}); }}
                                >
                                    {t('timesheets.batch.checkout_group')}
                                </button>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 px-3 gap-1.5 text-xs font-bold border-brand-teal/20 text-brand-teal hover:bg-brand-teal hover:text-white rounded-lg"
                                disabled={selectedPersonnel.length === 0}
                                onClick={() => setSigningPersonnelId('BATCH_ALL')}
                            >
                                <PenTool size={12} /> Sign for All
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">{t('timesheets.batch.project_site')}</label>
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                    value={batchProject}
                                    onChange={e => {
                                        const newProjectId = e.target.value;
                                        setBatchProject(newProjectId);
                                        const proj = projects.find(p => p.id === newProjectId);
                                        if (proj && proj.assignedPersonnel) {
                                            const teamIds = proj.assignedPersonnel.filter(id => {
                                                const p = personnel.find(person => person.id === id);
                                                return p && p.status !== 'Inactive';
                                            });
                                            setSelectedPersonnel(teamIds);
                                        } else {
                                            setSelectedPersonnel([]);
                                        }
                                        setBatchSignatures({}); // Clear signatures since team changed
                                    }}
                                >
                                    <option value="">{t('timesheets.modals.project_optional').split(' (')[0]}...</option>
                                    {projects.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.codeName || p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">{batchAction === 'Check-in' ? t('timesheets.punches.clock_in') : t('timesheets.punches.clock_out')} {t('timesheet.manual_time')}</label>
                                <Input
                                    type="time"
                                    value={batchTime}
                                    onChange={e => setBatchTime(e.target.value)}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-accent-greyDark">
                                {t('timesheets.batch.select_obtain')}
                            </label>
                            <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto p-1 pr-2 thin-scrollbar">
                                {personnel.filter((p: any) => {
                                    if (p.status === 'Inactive') return false;
                                    if (batchAction === 'Check-out') {
                                        return timesheets.some((t: any) => t.personnelId === p.id && t.date === batchDate && !t.timeOut);
                                    }
                                    return true;
                                }).map((p: any) => {
                                    const isSelected = selectedPersonnel.includes(p.id);
                                    const hasSigned = !!batchSignatures[p.id];
                                    
                                    return (
                                        <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-brand-teal/5 border-brand-teal/30 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedPersonnel([...selectedPersonnel, p.id]);
                                                        else {
                                                            setSelectedPersonnel(selectedPersonnel.filter((id: string) => id !== p.id));
                                                            const newSigs = { ...batchSignatures };
                                                            delete newSigs[p.id];
                                                            setBatchSignatures(newSigs);
                                                        }
                                                    }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal overflow-hidden">
                                                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : p.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-accent-greyDark leading-none">{p.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-[10px] text-gray-500 font-medium uppercase">{p.position}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="flex items-center">
                                                    {hasSigned ? (
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-status-success bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                                                            <CheckCircle size={12} /> {t('timesheets.batch.signed')}
                                                            <button 
                                                                onClick={() => {
                                                                    const newSigs = { ...batchSignatures };
                                                                    delete newSigs[p.id];
                                                                    setBatchSignatures(newSigs);
                                                                }}
                                                                className="ml-1 text-red-400 hover:text-red-500"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setSigningPersonnelId(p.id)}
                                                            className="flex items-center gap-1.5 text-[10px] font-bold text-brand-teal bg-white hover:bg-brand-teal hover:text-white px-3 py-1.5 rounded-lg border border-brand-teal/20 shadow-sm transition-all"
                                                        >
                                                            <PenTool size={12} /> {t('timesheets.batch.sign_now')}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Button 
                            className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold shadow-teal"
                            disabled={selectedPersonnel.length === 0 || !batchProject || selectedPersonnel.some((id: string) => !batchSignatures[id])}
                            onClick={handleBatchSubmit}
                        >
                            {t('timesheets.batch.complete_action', { action: batchAction, count: selectedPersonnel.length })}
                        </Button>
                        {selectedPersonnel.some((id: string) => !batchSignatures[id]) && selectedPersonnel.length > 0 && (
                            <p className="text-[10px] text-center text-status-warning font-bold mt-2 animate-pulse uppercase tracking-widest">
                                ⚠ {t('timesheets.batch.waiting_signatures')}
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sub-modal for Individual Signature */}
            <Dialog open={!!signingPersonnelId} onOpenChange={() => setSigningPersonnelId(null)}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-accent-greyDark flex items-center gap-2">
                             <PenTool size={18} className="text-brand-teal" /> 
                             {signingPersonnelId === 'BATCH_ALL' ? 'Sign for All Personnel' : t('timesheets.batch.worker_signature_title', { name: personnel.find(p => p.id === signingPersonnelId)?.name })}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-xs text-gray-500 leading-relaxed">
                            {t('timesheets.batch.confirm_text', { 
                                action: batchAction === 'Check-in' ? t('timesheets.punches.clock_in') : t('timesheets.punches.clock_out'),
                                date: batchDate,
                                time: batchTime
                            })}
                        </p>
                        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl relative overflow-hidden group p-4">
                            <UnifiedSignaturePad 
                                onSign={(blob) => {
                                    if (signingPersonnelId === 'BATCH_ALL') {
                                        const newSigs = { ...batchSignatures };
                                        selectedPersonnel.forEach(id => {
                                            newSigs[id] = blob;
                                        });
                                        setBatchSignatures(newSigs);
                                    } else {
                                        setBatchSignatures({ ...batchSignatures, [signingPersonnelId!]: blob });
                                    }
                                    setSigningPersonnelId(null);
                                }} 
                                onClear={() => {}}
                                placeholder={t('attendance.signature.sign_here')}
                            />
                        </div>
                        <Button variant="outline" className="w-full rounded-xl" onClick={() => setSigningPersonnelId(null)}>{t('common.cancel')}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
