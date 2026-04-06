import { useState } from 'react';
import { useStore, ScheduledEvent } from '../store/useStore';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { User, Wrench, Folder, AlertCircle, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Calendar() {
    const { events, addEvent, deleteEvent, projects, personnel, tools, reports } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state
    const [newEvent, setNewEvent] = useState<Partial<ScheduledEvent>>({
        title: '', 
        startDate: format(new Date(), 'yyyy-MM-dd'), 
        endDate: format(new Date(), 'yyyy-MM-dd'),
        type: 'Project'
    });

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const handleAddEvent = () => {
        if (!newEvent.title || !newEvent.startDate) return;
        addEvent({
            id: `EVT-${Date.now()}`,
            title: newEvent.title,
            startDate: newEvent.startDate,
            endDate: newEvent.endDate || newEvent.startDate,
            type: newEvent.type as any,
            projectId: newEvent.projectId,
            personnelId: newEvent.personnelId,
            toolId: newEvent.toolId,
        });
        setIsAddModalOpen(false);
        setNewEvent({ 
            title: '', 
            startDate: format(currentDate, 'yyyy-MM-dd'), 
            endDate: format(currentDate, 'yyyy-MM-dd'),
            type: 'Project' 
        });
    };

    const checkConflicts = (event: Partial<ScheduledEvent>) => {
        if (!event.startDate || !event.endDate) return [];
        const start = parseISO(event.startDate);
        const end = parseISO(event.endDate);
        const conflicts: string[] = [];

        events.forEach(e => {
            const eStart = parseISO(e.startDate);
            const eEnd = parseISO(e.endDate);
            const isOverlap = isWithinInterval(eStart, { start, end }) || 
                              isWithinInterval(eEnd, { start, end }) ||
                              (eStart <= start && eEnd >= end);

            if (isOverlap) {
                if (event.personnelId && e.personnelId === event.personnelId) {
                    conflicts.push(`Personnel conflict with "${e.title}"`);
                }
                if (event.toolId && e.toolId === event.toolId) {
                    conflicts.push(`Tool conflict with "${e.title}"`);
                }
            }
        });
        return [...new Set(conflicts)];
    };

    const currentConflicts = checkConflicts(newEvent);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <CalendarIcon className="text-brand-teal" size={32} />
                        Scheduling & Dispatch
                    </h1>
                    <p className="text-accent-grey mt-1">Manage personnel, tools, and project schedules.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 transition-colors">
                            <ChevronLeft size={20} className="text-gray-600" />
                        </button>
                        <div className="px-4 font-bold text-accent-greyDark min-w-[140px] text-center">
                            {format(currentDate, 'MMMM yyyy')}
                        </div>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 transition-colors">
                            <ChevronRight size={20} className="text-gray-600" />
                        </button>
                    </div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                                <Plus size={18} /> Schedule Event
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">New Schedule Entry</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Title</label>
                                    <Input
                                        placeholder="e.g. Site Visit"
                                        value={newEvent.title}
                                        onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">Start Date</label>
                                        <Input
                                            type="date"
                                            value={newEvent.startDate}
                                            onChange={e => setNewEvent({ ...newEvent, startDate: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark block">End Date</label>
                                        <Input
                                            type="date"
                                            value={newEvent.endDate}
                                            onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Type</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEvent.type}
                                        onChange={e => setNewEvent({ ...newEvent, type: e.target.value as any })}
                                    >
                                        <option value="Project">Project Assignment</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Project (Optional)</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEvent.projectId || ''}
                                        onChange={e => setNewEvent({ ...newEvent, projectId: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Personnel (Optional)</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEvent.personnelId || ''}
                                        onChange={e => setNewEvent({ ...newEvent, personnelId: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {personnel.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Tool (Optional)</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                        value={newEvent.toolId || ''}
                                        onChange={e => setNewEvent({ ...newEvent, toolId: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {tools.map(t => <option key={t.id} value={t.id}>{t.name} (SN: {t.serialNumber})</option>)}
                                    </select>
                                </div>
                                {currentConflicts.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2">
                                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">Scheduling Conflict Detected</p>
                                            {currentConflicts.map((c, i) => (
                                                <p key={i} className="text-xs text-amber-600">{c}</p>
                                            ))}
                                            <p className="text-[10px] text-amber-500 italic mt-1 font-medium">This is a soft warning. You can still save the event.</p>
                                        </div>
                                    </div>
                                )}
                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddEvent}>
                                    Schedule Event
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-3 text-center text-sm font-bold text-gray-400">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[120px]">
                    {days.map((day, idx) => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const dayEvents = events.filter(e => {
                            const start = e.startDate;
                            const end = e.endDate || e.startDate;
                            return dayStr >= start && dayStr <= end;
                        });
                        const dayReports = reports.filter(r => r.date === dayStr && r.activityLogs && r.activityLogs.length > 0);
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={idx} className={`border-b border-r border-gray-100 p-1 relative transition-colors hover:bg-gray-50/50 flex flex-col ${!isCurrentMonth ? 'bg-gray-50/10' : ''}`}>
                                <div className={`text-[10px] font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-teal text-white shadow-soft' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-0.5 overflow-y-auto flex-1 hide-scrollbar pb-1 flex flex-col gap-0.5">
                                    {dayEvents.map(evt => {
                                        const isEventStart = dayStr === evt.startDate;
                                        const isEventEnd = dayStr === (evt.endDate || evt.startDate);
                                        const projectData = projects.find(p => p.id === evt.projectId);
                                        const personnelData = personnel.find(p => p.id === evt.personnelId);

                                        let styleClasses = '';
                                        if (evt.type === 'Project') {
                                            styleClasses = 'bg-blue-50/80 text-blue-800 border-blue-400';
                                        } else if (evt.type === 'Maintenance') {
                                            styleClasses = 'bg-amber-50/80 text-amber-800 border-amber-400';
                                        } else {
                                            styleClasses = 'bg-gray-100 text-gray-700 border-gray-300';
                                        }

                                        const roundedLeft = isEventStart ? 'rounded-l-md border-l-2 ml-0 pl-1.5' : '-ml-1 pl-2 border-l-0 rounded-l-none';
                                        const roundedRight = isEventEnd ? 'rounded-r-md mr-0' : '-mr-1 rounded-r-none';

                                        return (
                                            <div key={evt.id} className={`text-[9px] py-0.5 truncate font-bold cursor-default group relative ${styleClasses} ${roundedLeft} ${roundedRight}`}>
                                                <span className="flex items-center gap-1">
                                                    {isEventStart && (evt.type === 'Project' ? <Folder size={8} className="shrink-0" /> : evt.type === 'Maintenance' ? <Wrench size={8} className="shrink-0" /> : null)}
                                                    {isEventStart ? evt.title : <span className="opacity-0">.</span>}
                                                </span>
                                                {isEventStart && (
                                                    <div className="flex flex-col gap-0.5 mt-0.5 border-t border-black/5 pt-0.5">
                                                        {projectData && <span className="text-[7px] text-gray-500 uppercase tracking-tighter opacity-80 italic">{projectData.name}</span>}
                                                        {personnelData && <span className="text-[7px] text-blue-700 flex items-center gap-0.5 uppercase tracking-tighter font-bold"><User size={6} className="shrink-0" /> {personnelData.name.split(' ')[0]}</span>}
                                                    </div>
                                                )}
                                                {isEventStart && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteEvent(evt.id); }}
                                                        className="absolute right-0 top-0 bottom-0 px-1 opacity-0 group-hover:opacity-100 bg-red-500/20 text-red-600 hover:bg-red-500 hover:text-white transition-all text-xs"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    {dayReports.map(rep => {
                                        const projectData = projects.find(p => p.id === rep.projectId);
                                        return (
                                            <div key={`rep-${rep.id}`} className="text-[9px] px-1.5 py-0.5 rounded-md truncate font-bold cursor-default group relative border-l-2 bg-emerald-50/80 text-emerald-800 border-emerald-400 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <FileText size={8} className="shrink-0" />
                                                    Report {rep.id.slice(-4)}
                                                </span>
                                                <div className="flex flex-col gap-0.5 mt-0.5 border-t border-black/5 pt-0.5">
                                                    {projectData && <span className="text-[7px] text-emerald-600 uppercase tracking-tighter opacity-80 italic">{projectData.name}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
