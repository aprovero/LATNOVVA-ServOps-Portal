import { useState } from 'react';
import { useStore, TimesheetEntry } from '../store/useStore';
import { Clock, Plus, Calendar as CalendarIcon, User, Briefcase, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Timesheets() {
    const { timesheets, addTimesheet, deleteTimesheet, personnel, projects, userRole } = useStore();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state
    const [newEntry, setNewEntry] = useState<Partial<TimesheetEntry>>({
        date: format(new Date(), 'yyyy-MM-dd'),
        hours: 8,
        type: 'Regular',
        personnelId: personnel[0]?.id || '',
        status: 'Pending'
    });

    const [filterProject, setFilterProject] = useState('');
    const [filterPersonnel, setFilterPersonnel] = useState('');

    const handleAddEntry = () => {
        if (!newEntry.personnelId || !newEntry.date || !newEntry.hours) return;

        addTimesheet({
            id: `TS-${Date.now()}`,
            personnelId: newEntry.personnelId,
            date: newEntry.date,
            hours: Number(newEntry.hours),
            type: newEntry.type as any,
            projectId: newEntry.projectId,
            notes: newEntry.notes || '',
            status: 'Pending'
        });

        setIsAddModalOpen(false);
        setNewEntry({
            ...newEntry,
            hours: 8,
            notes: ''
        });
    };

    const getPersonnelName = (id: string) => personnel.find(p => p.id === id)?.name || 'Unknown';
    const getProjectName = (id?: string) => id ? projects.find(p => p.id === id)?.name || 'Unknown' : '-';

    const filteredTimesheets = timesheets
        .filter(t => filterProject ? t.projectId === filterProject : true)
        .filter(t => filterPersonnel ? t.personnelId === filterPersonnel : true)
        .filter(t => userRole === 'Tech' ? t.personnelId === newEntry.personnelId : true)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // For Approvals View
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    
    // In a real app, this would filter based on manager/supervisor assignments.

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

                <div className="flex items-center gap-4 hidden md:flex">
                    <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm px-4 py-2">
                        <span className="text-sm font-semibold text-gray-500">Total Hours Logged:</span>
                        <span className="ml-2 text-sm font-bold text-brand-teal">{totalHours} hrs</span>
                    </div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                                <Plus size={18} /> Log Time
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">Log Hours</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Personnel</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEntry.personnelId}
                                        onChange={e => setNewEntry({ ...newEntry, personnelId: e.target.value })}
                                        disabled={useStore.getState().userRole === 'Tech'}
                                    >
                                        <option value="" disabled>Select personnel...</option>
                                        {personnel.filter(p => useStore.getState().userRole === 'Tech' ? p.id === newEntry.personnelId : true).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">Date</label>
                                        <Input
                                            type="date"
                                            value={newEntry.date}
                                            onChange={e => setNewEntry({ ...newEntry, date: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">Hours</label>
                                        <Input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={newEntry.hours}
                                            onChange={e => setNewEntry({ ...newEntry, hours: Number(e.target.value) })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Classification</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEntry.type}
                                        onChange={e => setNewEntry({ ...newEntry, type: e.target.value as any })}
                                    >
                                        <option value="Regular">Regular Hours (Straight Time)</option>
                                        <option value="Overtime">Overtime / Premium</option>
                                        <option value="Travel">Travel Time</option>
                                    </select>
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

                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddEntry}>
                                    Save Entry
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
                {(filterProject || filterPersonnel) && (
                    <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 py-2.5 h-auto text-sm font-bold" onClick={() => { setFilterProject(''); setFilterPersonnel(''); }}>
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
                                    <th className="p-4 whitespace-nowrap">Hours</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 min-w-[200px]">Project</th>
                                    <th className="p-4 min-w-[200px]">Notes</th>
                                    <th className="p-4 rounded-tr-xl text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredTimesheets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-gray-500">
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
                                            <td className="p-4 text-sm font-bold text-accent-greyDark">
                                                {getPersonnelName(entry.personnelId)}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-lg text-brand-teal">{entry.hours}</span> <span className="text-xs text-gray-500 font-medium">hrs</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${entry.type === 'Regular' ? 'bg-blue-50 text-blue-700' :
                                                    entry.type === 'Overtime' ? 'bg-purple-50 text-purple-700' :
                                                        'bg-orange-50 text-orange-700'
                                                    }`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                    entry.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                                    entry.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {entry.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-medium text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase size={14} className="text-gray-400" />
                                                    {getProjectName(entry.projectId)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 truncate max-w-xs">{entry.notes || '-'}</td>
                                            <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Only Supervisors, Managers, or the Tech who owns the entry can delete */}
                                                {['Supervisor', 'Manager'].includes(useStore.getState().userRole) || (
                                                    useStore.getState().userRole === 'Tech' && entry.personnelId === newEntry.personnelId /* using newEntry.personnelId as mock current user */
                                                ) ? (
                                                    <button
                                                        onClick={() => deleteTimesheet(entry.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors font-medium text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                ) : null}
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
