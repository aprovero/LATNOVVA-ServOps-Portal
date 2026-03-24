import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Wrench, AlertTriangle, Calendar, Clock, MapPin, Building2, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { useStore, Tool } from '../store/useStore';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';

export default function Tools() {
    const { tools, addTool, updateTool, deleteTool, projects } = useStore();
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('q') || '';
    });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('q');
        if (q !== null) {
            setSearchTerm(q);
        }
    }, [location.search]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [newTool, setNewTool] = useState<Partial<Tool>>({
        name: '', model: '', serialNumber: '', certificationExpiry: '', assignedProjectId: ''
    });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentTool, setCurrentTool] = useState<Tool | null>(null);
    const [newHistoryEntry, setNewHistoryEntry] = useState({ date: new Date().toISOString().split('T')[0], description: '', projectId: '' });

    const openEdit = (tool: Tool) => {
        setCurrentTool(tool);
        setTimeout(() => setIsEditModalOpen(true), 0);
    };

    const handleEditTool = () => {
        if (!currentTool?.id) return;
        updateTool(currentTool.id, currentTool);
        setIsEditModalOpen(false);
        setCurrentTool(null);
    };

    const handleAddHistory = () => {
        if (!currentTool || !newHistoryEntry.description) return;
        const updatedHistory = [...currentTool.history, newHistoryEntry];
        setCurrentTool({ ...currentTool, history: updatedHistory });
        setNewHistoryEntry({ date: new Date().toISOString().split('T')[0], description: '', projectId: '' });
    };

    const handleRemoveHistory = (index: number) => {
        if (!currentTool) return;
        const updatedHistory = currentTool.history.filter((_, i) => i !== index);
        setCurrentTool({ ...currentTool, history: updatedHistory });
    };

    const isExpired = (expiryStr: string) => {
        return new Date(expiryStr) < new Date();
    };

    const handleAddTool = () => {
        if (!newTool.name || !newTool.serialNumber) return;

        const tool: Tool = {
            id: `TOOL-${Date.now()}`,
            name: newTool.name!,
            model: newTool.model || '',
            serialNumber: newTool.serialNumber!,
            certificationExpiry: newTool.certificationExpiry || '',
            assignedProjectId: newTool.assignedProjectId || undefined,
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    description: 'Tool registered in system',
                    projectId: newTool.assignedProjectId
                }
            ]
        };
        addTool(tool);
        setNewTool({ name: '', model: '', serialNumber: '', certificationExpiry: '', assignedProjectId: '' });
        setIsAddModalOpen(false);
    };

    const filteredTools = tools.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Wrench className="text-brand-teal" size={32} />
                        Tools Management
                    </h1>
                    <p className="text-accent-grey mt-1">Manage your fleet of tools, certifications, and assignments.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Find a tool by name, model or serial..."
                            className="pl-10 w-full md:w-80 bg-white border-gray-200 focus-visible:ring-brand-teal h-11 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                                <Plus size={18} /> Add Tool
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">Add New Tool</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block">Name</label>
                                    <Input
                                        placeholder="e.g. Thermal Camera"
                                        value={newTool.name}
                                        onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                                        className="rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block">Model</label>
                                    <Input
                                        placeholder="e.g. Fluke Ti401"
                                        value={newTool.model}
                                        onChange={(e) => setNewTool({ ...newTool, model: e.target.value })}
                                        className="rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block">Serial Number</label>
                                    <Input
                                        placeholder="e.g. SN-12345"
                                        value={newTool.serialNumber}
                                        onChange={(e) => setNewTool({ ...newTool, serialNumber: e.target.value })}
                                        className="rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block">Certification Expiry</label>
                                    <Input
                                        type="date"
                                        value={newTool.certificationExpiry}
                                        onChange={(e) => setNewTool({ ...newTool, certificationExpiry: e.target.value })}
                                        className="rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block">Assign to Project (Optional)</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-accent-grey outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                                        value={newTool.assignedProjectId || ''}
                                        onChange={(e) => setNewTool({ ...newTool, assignedProjectId: e.target.value })}
                                    >
                                        <option value="">Unassigned</option>
                                        {projects.filter(p => p.status === 'Active').map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddTool}>
                                    Save Tool
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTools.map(tool => {
                    const expired = isExpired(tool.certificationExpiry);
                    const assignedProject = tool.assignedProjectId ? projects.find(p => p.id === tool.assignedProjectId) : null;
                    return (
                        <div key={tool.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft flex flex-col hover:border-brand-teal/30 hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-accent-greyDark text-lg block">{tool.name}</h3>
                                    <p className="text-sm text-gray-500">{tool.model} • SN: {tool.serialNumber}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-brand-teal/10 hover:text-brand-teal transition-colors" onClick={() => openEdit(tool)}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" onClick={() => deleteTool(tool.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 flex-1 mb-6">
                                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border ${expired ? 'bg-red-50 text-red-600 border-red-100 font-medium' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                    {expired ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                                    <span>{expired ? 'Certification Expired' : 'Certified'} until {new Date(tool.certificationExpiry).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-gray-50 border-gray-100 text-gray-600">
                                    <Building2 size={16} className="text-gray-400" />
                                    <span>
                                        {assignedProject ? `Assigned to: ${assignedProject.name}` : 'Available / Unassigned'}
                                    </span>
                                </div>
                            </div>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between items-center text-accent-greyDark bg-gray-50 hover:bg-white hover:border-brand-teal hover:text-brand-teal transition-all group">
                                        <span className="flex items-center gap-2"><Clock size={16} /> View History</span>
                                        <div className="bg-white group-hover:bg-brand-teal/10 px-2 py-0.5 rounded-full text-xs font-bold font-mono border">
                                            {tool.history.length}
                                        </div>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px] rounded-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                            <Wrench className="text-brand-teal" size={20} />
                                            {tool.name} History
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 py-4">
                                        {tool.history.slice().reverse().map((h, i) => {
                                            const hProj = h.projectId ? projects.find(p => p.id === h.projectId) : null;
                                            return (
                                                <div key={i} className="flex gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
                                                    <div className="shrink-0 pt-1">
                                                        <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                                                            <Calendar size={14} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-accent-greyDark">{h.description}</p>
                                                        <p className="text-xs text-brand-teal/80 font-mono mt-1 mb-2">{new Date(h.date).toLocaleDateString()}</p>
                                                        {hProj && (
                                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-600">
                                                                <MapPin size={10} className="text-gray-400" />
                                                                Project: {hProj.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {tool.history.length === 0 && (
                                            <p className="text-center text-gray-400 py-8">No history available for this tool.</p>
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    );
                })}
                {filteredTools.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                        <Wrench size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-500">No tools found</h3>
                        <p className="text-gray-400">Try adjusting your search or add a new tool.</p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Wrench className="text-brand-teal" size={20} />
                            Edit Tool
                        </DialogTitle>
                    </DialogHeader>
                    {currentTool && (
                        <div className="space-y-6 py-4">
                            <div className="space-y-4">
                                <h3 className="font-bold text-accent-greyDark border-b pb-2">Basic Info</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark">Name</label>
                                        <Input
                                            value={currentTool.name}
                                            onChange={(e) => setCurrentTool({ ...currentTool, name: e.target.value })}
                                            className="rounded-xl border-gray-200 h-9"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark">Model</label>
                                        <Input
                                            value={currentTool.model}
                                            onChange={(e) => setCurrentTool({ ...currentTool, model: e.target.value })}
                                            className="rounded-xl border-gray-200 h-9"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark">Serial Number</label>
                                        <Input
                                            value={currentTool.serialNumber}
                                            onChange={(e) => setCurrentTool({ ...currentTool, serialNumber: e.target.value })}
                                            className="rounded-xl border-gray-200 h-9"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark">Certification Expiry</label>
                                        <Input
                                            type="date"
                                            value={currentTool.certificationExpiry}
                                            onChange={(e) => setCurrentTool({ ...currentTool, certificationExpiry: e.target.value })}
                                            className="rounded-xl border-gray-200 h-9"
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-semibold text-accent-greyDark text-left block">Assign to Project (Optional)</label>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-accent-grey outline-none focus:ring-2 focus:ring-brand-teal transition-all"
                                            value={currentTool.assignedProjectId || ''}
                                            onChange={(e) => setCurrentTool({ ...currentTool, assignedProjectId: e.target.value })}
                                        >
                                            <option value="">Unassigned</option>
                                            {projects.filter(p => p.status === 'Active').map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-accent-greyDark border-b pb-2 flex justify-between items-center">
                                    <span>History & Tracking</span>
                                    <span className="text-xs font-normal text-gray-500">{currentTool.history.length} Entries</span>
                                </h3>
                                
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                                    <div className="text-xs font-bold text-gray-500 uppercase">Add New Entry</div>
                                    <Input
                                        placeholder="Description (e.g. Recalibrated, Repaired...)"
                                        value={newHistoryEntry.description}
                                        onChange={(e) => setNewHistoryEntry({ ...newHistoryEntry, description: e.target.value })}
                                        className="h-8 text-sm bg-white"
                                    />
                                    <div className="flex gap-2">
                                        <Input
                                            type="date"
                                            value={newHistoryEntry.date}
                                            onChange={(e) => setNewHistoryEntry({ ...newHistoryEntry, date: e.target.value })}
                                            className="h-8 text-sm bg-white flex-1"
                                        />
                                        <select
                                            className="h-8 text-sm bg-white border border-gray-200 rounded-md px-2 flex-1 outline-none focus:border-brand-teal"
                                            value={newHistoryEntry.projectId}
                                            onChange={(e) => setNewHistoryEntry({ ...newHistoryEntry, projectId: e.target.value })}
                                        >
                                            <option value="">No Project</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <Button size="sm" onClick={handleAddHistory} className="h-8 px-3 bg-brand-teal text-white rounded-md">Add</Button>
                                    </div>
                                </div>

                                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                                    {currentTool.history.slice().reverse().map((h, i) => {
                                        const actualIndex = currentTool.history.length - 1 - i;
                                        const hProj = h.projectId ? projects.find(p => p.id === h.projectId) : null;
                                        return (
                                            <div key={i} className="flex gap-3 p-2 bg-white border border-gray-100 rounded-lg relative group">
                                                <div className="text-brand-teal/50 pt-1"><Clock size={14}/></div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-accent-greyDark">{h.description}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-mono bg-gray-100 px-1 rounded text-gray-500">{new Date(h.date).toLocaleDateString()}</span>
                                                        {hProj && <span className="text-[10px] bg-brand-teal/10 text-brand-teal px-1 rounded truncate max-w-[120px]">{hProj.name}</span>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRemoveHistory(actualIndex)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleEditTool}>
                                Save Changes
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
