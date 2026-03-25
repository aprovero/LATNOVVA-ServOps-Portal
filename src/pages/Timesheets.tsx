import { useState, useEffect } from 'react';
import { useStore, TimesheetEntry } from '../store/useStore';
import { Clock, Plus, Calendar as CalendarIcon, User, Briefcase, Filter, Download, Edit2, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const calculateHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime) return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60; // Handling crossing midnight
    return Number((diff / 60).toFixed(2));
};

export default function Timesheets() {
    const { timesheets, addTimesheet, updateTimesheet, deleteTimesheet, personnel, projects, userRole } = useStore();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

    // Form state
    const [newEntry, setNewEntry] = useState<Partial<TimesheetEntry>>({
        date: format(new Date(), 'yyyy-MM-dd'),
        timeIn: '08:00',
        timeOut: '17:00',
        hours: 9,
        type: 'On Site',
        classification: 'Regular',
        personnelId: personnel[0]?.id || '',
        status: 'Pending',
        notes: ''
    });

    const [filterProject, setFilterProject] = useState('');
    const [filterPersonnel, setFilterPersonnel] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    useEffect(() => {
        // Auto-update hours when time in/out changes
        if (newEntry.timeIn && newEntry.timeOut) {
            setNewEntry(prev => ({ ...prev, hours: calculateHours(prev.timeIn!, prev.timeOut!) }));
        }
    }, [newEntry.timeIn, newEntry.timeOut]);

    const openAddModal = () => {
        setEditingEntryId(null);
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
            projectId: ''
        });
        setIsAddModalOpen(true);
    };

    const openEditModal = (entry: TimesheetEntry) => {
        setEditingEntryId(entry.id);
        setNewEntry(entry);
        setIsAddModalOpen(true);
    };

    const handleSaveEntry = () => {
        if (!newEntry.personnelId || !newEntry.date || !newEntry.hours) return;

        // Overlap validation
        const overlap = timesheets.some(t => {
            if (t.id === editingEntryId) return false;
            if (t.personnelId !== newEntry.personnelId) return false;
            if (t.date !== newEntry.date) return false;
            if (!t.timeIn || !t.timeOut || !newEntry.timeIn || !newEntry.timeOut) return false;

            const tIn = t.timeIn;
            const tOut = t.timeOut < t.timeIn ? '24:00' : t.timeOut;
            const nIn = newEntry.timeIn;
            const nOut = newEntry.timeOut < newEntry.timeIn ? '24:00' : newEntry.timeOut;

            return tIn < nOut && nIn < tOut;
        });

        if (overlap) {
            alert("This time overlaps with an existing timesheet entry for this person on this date.");
            return;
        }

        if (editingEntryId) {
            updateTimesheet(editingEntryId, newEntry);
        } else {
            addTimesheet({
                id: `TS-${Date.now()}`,
                personnelId: newEntry.personnelId,
                date: newEntry.date,
                timeIn: newEntry.timeIn,
                timeOut: newEntry.timeOut,
                hours: Number(newEntry.hours),
                type: newEntry.type as any,
                classification: newEntry.classification as any,
                projectId: newEntry.projectId,
                notes: newEntry.notes || '',
                status: newEntry.status || 'Pending'
            });
        }

        setIsAddModalOpen(false);
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

    const getPersonnelName = (id: string) => personnel.find(p => p.id === id)?.name || 'Unknown';
    const getProjectName = (id?: string) => id ? projects.find(p => p.id === id)?.name || 'Unknown' : '-';

    const filteredTimesheets = timesheets
        .filter(t => filterProject ? t.projectId === filterProject : true)
        .filter(t => filterPersonnel ? t.personnelId === filterPersonnel : true)
        .filter(t => userRole === 'Tech' ? t.personnelId === newEntry.personnelId : true)
        .filter(t => filterStartDate ? new Date(t.date) >= new Date(filterStartDate) : true)
        .filter(t => filterEndDate ? new Date(t.date) <= new Date(filterEndDate) : true)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalHours = filteredTimesheets.reduce((sum, t) => sum + t.hours, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Clock className="text-brand-teal" size={32} />
                        Timesheets & Logs
                    </h1>
                    <p className="text-accent-grey mt-1">Track personnel hours, overtime, and travel.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm px-4 py-2 hidden sm:flex">
                        <span className="text-sm font-semibold text-gray-500">Total Hours Logged:</span>
                        <span className="ml-2 text-sm font-bold text-brand-teal">{totalHours} hrs</span>
                    </div>

                    {['Manager', 'Supervisor'].includes(userRole) && (
                        <Button variant="outline" onClick={handleExportCSV} className="rounded-xl gap-2 font-semibold shadow-sm h-11 px-4 border-gray-200 hover:bg-gray-50 text-gray-700">
                            <Download size={18} /> Export CSV
                        </Button>
                    )}

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6" onClick={openAddModal}>
                            <Plus size={18} /> Log Time
                        </Button>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">
                                    {editingEntryId ? 'Edit Timesheet' : 'Log Hours'}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Personnel</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal disabled:bg-gray-50 disabled:text-gray-500"
                                        value={newEntry.personnelId}
                                        onChange={e => setNewEntry({ ...newEntry, personnelId: e.target.value })}
                                        disabled={userRole === 'Tech'}
                                    >
                                        <option value="" disabled>Select personnel...</option>
                                        {personnel.filter(p => userRole === 'Tech' ? p.id === newEntry.personnelId : true).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Date</label>
                                    <Input
                                        type="date"
                                        value={newEntry.date}
                                        onChange={e => setNewEntry({ ...newEntry, date: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">Time In</label>
                                        <Input
                                            type="time"
                                            value={newEntry.timeIn || ''}
                                            onChange={e => setNewEntry({ ...newEntry, timeIn: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">Time Out</label>
                                        <Input
                                            type="time"
                                            value={newEntry.timeOut || ''}
                                            onChange={e => setNewEntry({ ...newEntry, timeOut: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">Hours</label>
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
                                        <label className="text-sm font-semibold text-accent-greyDark block">Type / Location</label>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                            value={newEntry.type}
                                            onChange={e => setNewEntry({ ...newEntry, type: e.target.value as any })}
                                        >
                                            <option value="On Site">On Site</option>
                                            <option value="Travel">Travel</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Project (Optional)</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEntry.projectId || ''}
                                        onChange={e => setNewEntry({ ...newEntry, projectId: e.target.value })}
                                    >
                                        <option value="">None (Admin / Prep)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Notes (Optional)</label>
                                    <Input
                                        placeholder="e.g. Travel to Site Alpha"
                                        value={newEntry.notes || ''}
                                        onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>

                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleSaveEntry}>
                                    {editingEntryId ? 'Update Entry' : 'Save Entry'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> Filter Project</label>
                    <select
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                    >
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                {userRole !== 'Tech' && (
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><User size={12} /> Filter Personnel</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                            value={filterPersonnel}
                            onChange={e => setFilterPersonnel(e.target.value)}
                        >
                            <option value="">All Personnel</option>
                            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><CalendarIcon size={12} /> From Date</label>
                    <Input
                        type="date"
                        className="bg-gray-50 border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-teal h-[42px]"
                        value={filterStartDate}
                        onChange={e => setFilterStartDate(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><CalendarIcon size={12} /> To Date</label>
                    <Input
                        type="date"
                        className="bg-gray-50 border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-teal h-[42px]"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                    />
                </div>
                {(filterProject || filterPersonnel || filterStartDate || filterEndDate) && (
                    <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 py-2.5 h-auto text-sm font-bold" onClick={() => { setFilterProject(''); setFilterPersonnel(''); setFilterStartDate(''); setFilterEndDate(''); }}>
                        Clear Filters
                    </Button>
                )}
            </div>

            {/* Timesheet List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                <th className="p-4 rounded-tl-xl whitespace-nowrap">Date</th>
                                <th className="p-4">Personnel</th>
                                <th className="p-4 whitespace-nowrap">Time In/Out</th>
                                <th className="p-4 whitespace-nowrap">Hours</th>
                                <th className="p-4 min-w-[150px]">Project</th>
                                <th className="p-4 rounded-tr-xl text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTimesheets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                        <p className="text-lg font-semibold text-accent-greyDark flex items-center justify-center gap-2">No timesheets found.</p>
                                        <p className="text-sm">Log hours above to get started.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTimesheets.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="p-4 text-sm font-medium text-accent-greyDark whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon size={14} className="text-gray-400" />
                                                {format(parseISO(entry.date), 'MMM d, yyyy')}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-accent-greyDark whitespace-nowrap">
                                            {getPersonnelName(entry.personnelId)}
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
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Only Supervisors, Managers, or the Tech who owns the entry can edit/delete */}
                                                {['Supervisor', 'Manager'].includes(userRole) || (
                                                    userRole === 'Tech' && entry.personnelId === newEntry.personnelId /* using newEntry.personnelId as mock current user */
                                                ) ? (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(entry)}
                                                            className="text-brand-teal hover:text-brand-teal/80 hover:bg-teal-50 p-2 rounded-lg transition-colors"
                                                            title="Edit Timesheet"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteTimesheet(entry.id)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                            title="Delete Timesheet"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
