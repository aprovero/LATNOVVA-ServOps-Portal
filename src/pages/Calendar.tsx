import { useState } from 'react';
import { useStore, ScheduledEvent } from '../store/useStore';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Calendar() {
    const { events, addEvent, deleteEvent, projects, personnel, tools } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state
    const [newEvent, setNewEvent] = useState<Partial<ScheduledEvent>>({
        title: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'Project'
    });

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const handleAddEvent = () => {
        if (!newEvent.title || !newEvent.date) return;
        addEvent({
            id: `EVT-${Date.now()}`,
            title: newEvent.title,
            date: newEvent.date,
            type: newEvent.type as any,
            projectId: newEvent.projectId,
            personnelId: newEvent.personnelId,
            toolId: newEvent.toolId,
        });
        setIsAddModalOpen(false);
        setNewEvent({ title: '', date: format(currentDate, 'yyyy-MM-dd'), type: 'Project' });
    };

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
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark block">Date</label>
                                    <Input
                                        type="date"
                                        value={newEvent.date}
                                        onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                        className="rounded-xl"
                                    />
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
                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddEvent}>
                                    Save Event
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
                        const dayEvents = events.filter(e => e.date === format(day, 'yyyy-MM-dd'));
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={idx} className={`border-b border-r border-gray-100 p-2 relative transition-colors hover:bg-gray-50/50 ${!isCurrentMonth ? 'bg-gray-50/30' : ''}`}>
                                <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-teal text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1 overflow-y-auto max-h-[80px] hide-scrollbar">
                                    {dayEvents.map(evt => (
                                        <div key={evt.id} className={`text-[10px] px-2 py-1 rounded-md truncate font-semibold cursor-default group relative ${evt.type === 'Project' ? 'bg-blue-50 text-blue-700 border border-blue-100' : evt.type === 'Maintenance' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                            {evt.title}
                                            <button
                                                onClick={() => deleteEvent(evt.id)}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
