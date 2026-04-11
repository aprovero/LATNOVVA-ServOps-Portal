import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Wrench, AlertTriangle, Calendar, Clock, MapPin, Building2, CheckCircle2, Trash2, Save, ChevronDown, ArrowLeft, X } from 'lucide-react';
import { useStore, Tool } from '../store/useStore';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';

export default function Tools() {
    const { t } = useTranslation();
    const { tools, addTool, updateTool, deleteTool, projects } = useStore();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('q') || '';
    });

    const [filterProject, setFilterProject] = useState<string>('All');
    
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('q');
        if (q !== null) setSearchTerm(q);
    }, [location.search]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newTool, setNewTool] = useState<Partial<Tool>>({
        name: '', model: '', serialNumber: '', certificationExpiry: '', assignedProjectId: ''
    });

    const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<Tool | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [newHistoryEntry, setNewHistoryEntry] = useState({
        date: new Date().toISOString().split('T')[0],
        description: '',
        projectId: ''
    });

    useEffect(() => {
        if (location.state?.selectedToolId && tools.length > 0) {
            const toolToSelect = tools.find(t => t.id === location.state.selectedToolId);
            if (toolToSelect && selectedToolId !== toolToSelect.id) {
                setSelectedToolId(toolToSelect.id);
                setEditDraft({ ...toolToSelect, history: [...toolToSelect.history] });
                setIsSaved(false);
                setNewHistoryEntry({ date: new Date().toISOString().split('T')[0], description: '', projectId: '' });
                // Clean up state so we don't re-select if something else triggers a tools update
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, tools, selectedToolId]);

    const isExpired = (expiryStr: string) => !!expiryStr && new Date(expiryStr) < new Date();

    const handleSelectTool = (tool: Tool) => {
        setSelectedToolId(tool.id);
        setEditDraft({ ...tool, history: [...tool.history] });
        setIsSaved(false);
        setNewHistoryEntry({ date: new Date().toISOString().split('T')[0], description: '', projectId: '' });
    };

    const handleSave = async () => {
        if (!editDraft?.id) return;
        await updateTool(editDraft.id, editDraft);
        setIsSaved(true);
        
        // Refresh local state from the store to pick up auto-generated history entries
        const updatedTool = useStore.getState().tools.find(t => t.id === editDraft.id);
        if (updatedTool) {
            setEditDraft({ ...updatedTool });
        }
        
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleAddHistory = () => {
        if (!editDraft || !newHistoryEntry.description) return;
        setEditDraft({ ...editDraft, history: [...editDraft.history, { ...newHistoryEntry }] });
        setNewHistoryEntry({ date: new Date().toISOString().split('T')[0], description: '', projectId: '' });
    };

    const handleRemoveHistory = (index: number) => {
        if (!editDraft) return;
        setEditDraft({ ...editDraft, history: editDraft.history.filter((_, i) => i !== index) });
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
            history: [{ date: new Date().toISOString().split('T')[0], description: t('inventory.registered'), projectId: newTool.assignedProjectId }]
        };
        addTool(tool);
        setNewTool({ name: '', model: '', serialNumber: '', certificationExpiry: '', assignedProjectId: '' });
        setIsAddModalOpen(false);
        setSelectedToolId(tool.id);
        setEditDraft({ ...tool });
    };

    const filteredTools = tools
        .filter(t => filterProject === 'All' || (filterProject === 'None' ? !t.assignedProjectId : t.assignedProjectId === filterProject))
        .filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.model.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            // Expired tools sink to bottom
            const aExp = isExpired(a.certificationExpiry);
            const bExp = isExpired(b.certificationExpiry);
            if (aExp !== bExp) return aExp ? 1 : -1;
            return a.name.localeCompare(b.name);
        });

    const selectedTool = tools.find(t => t.id === selectedToolId) ?? null;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Wrench className="text-brand-teal" size={28} />
                        {t('inventory.title')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('inventory.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6">
                                <Plus size={18} /> {t('inventory.add_tool')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">{t('inventory.new_tool')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.name')}</label>
                                    <Input placeholder="e.g. Thermal Camera" value={newTool.name} onChange={e => setNewTool({ ...newTool, name: e.target.value })} className="rounded-xl border-gray-200" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.model')}</label>
                                    <Input placeholder="e.g. Fluke Ti401" value={newTool.model} onChange={e => setNewTool({ ...newTool, model: e.target.value })} className="rounded-xl border-gray-200" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.serial')}</label>
                                    <Input placeholder="e.g. SN-12345" value={newTool.serialNumber} onChange={e => setNewTool({ ...newTool, serialNumber: e.target.value })} className="rounded-xl border-gray-200" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.cert_expiry')}</label>
                                    <Input type="date" value={newTool.certificationExpiry} onChange={e => setNewTool({ ...newTool, certificationExpiry: e.target.value })} className="rounded-xl border-gray-200" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.assign_to_project')}</label>
                                    <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newTool.assignedProjectId || ''} onChange={e => setNewTool({ ...newTool, assignedProjectId: e.target.value })}>
                                        <option value="">{t('inventory.no_project')}</option>
                                        {projects.filter(p => p.status === 'Active').map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button className="w-full mt-2 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddTool}>
                                    {t('inventory.save_tool')}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-[1.5] min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Search size={12} /> SEARCH INVENTORY</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                            placeholder={t('inventory.search')}
                            className="pl-10 w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal h-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Building2 size={12} /> FILTER PROJECT</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer h-10"
                            value={filterProject}
                            onChange={e => setFilterProject(e.target.value)}
                        >
                            <option value="All">All Projects</option>
                            <option value="None">None (Unassigned)</option>
                            {projects.filter(p => p.status === 'Active').map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            {/* Master / Detail Layout */}
            <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: '560px' }}>
                {/* LEFT: Tool List */}
                <div className={`w-full md:w-64 shrink-0 flex flex-col bg-gray-50 rounded-2xl border border-gray-100 p-2 overflow-y-auto gap-0.5 ${selectedToolId ? 'hidden md:flex' : 'flex'}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">
                        {t('inventory.inventory_count', { count: filteredTools.length })}
                    </p>

                    {filteredTools.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 px-4 text-center">
                            <Wrench size={28} className="mb-2 opacity-30" />
                            <p className="text-xs font-medium">{t('inventory.no_tools')}</p>
                        </div>
                    )}

                    {filteredTools.map(tool => {
                        const isSelected = selectedToolId === tool.id;
                        const expired = isExpired(tool.certificationExpiry);
                        const assignedProject = tool.assignedProjectId ? projects.find(p => p.id === tool.assignedProjectId) : null;

                        return (
                            <button
                                key={tool.id}
                                onClick={() => handleSelectTool(tool)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                                    isSelected
                                        ? 'bg-brand-teal text-white shadow-md'
                                        : expired
                                            ? 'hover:bg-white hover:shadow-sm opacity-60'
                                            : 'hover:bg-white hover:shadow-sm'
                                }`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-white/20' : expired ? 'bg-red-100' : 'bg-brand-teal/10'
                                }`}>
                                    <Wrench size={13} className={isSelected ? 'text-white' : expired ? 'text-red-500' : 'text-brand-teal'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-accent-greyDark'}`}>
                                        {tool.name}
                                    </p>
                                    <p className={`text-[10px] font-semibold mt-0.5 truncate ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                        {tool.model || tool.serialNumber}
                                    </p>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                    isSelected
                                        ? 'bg-white/20 text-white'
                                        : assignedProject
                                            ? 'bg-brand-teal/10 text-brand-teal'
                                            : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {assignedProject ? t('inventory.status.on_site') : t('inventory.status.free')}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* RIGHT: Detail / Edit Panel */}
                <div className={`flex-1 min-w-0 ${!selectedToolId ? 'hidden md:block' : 'block'}`}>
                    {editDraft && selectedTool ? (() => {
                        const expired = isExpired(editDraft.certificationExpiry);
                        const assignedProject = editDraft.assignedProjectId ? projects.find(p => p.id === editDraft.assignedProjectId) : null;
                        return (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                                {/* Tool Header */}
                                <div className={`p-5 border-b border-gray-100 shrink-0 ${expired ? 'bg-red-50/50' : 'bg-gradient-to-r from-brand-teal/5 to-transparent'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => setSelectedToolId(null)}
                                                className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
                                            >
                                                <ArrowLeft size={20} className="text-accent-greyDark" />
                                            </button>
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${expired ? 'bg-red-100' : 'bg-brand-teal/10'}`}>
                                                <Wrench size={24} className={expired ? 'text-red-500' : 'text-brand-teal'} />
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="text-xl font-bold text-accent-greyDark truncate">{selectedTool.name}</h2>
                                                <p className="text-sm text-gray-500 mt-0.5 truncate">{selectedTool.model} · SN: <span className="font-mono">{selectedTool.serialNumber}</span></p>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                                        expired
                                                            ? 'bg-red-50 text-red-600 border-red-200'
                                                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                    }`}>
                                                        {expired ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                                                        {expired ? t('inventory.status.expired') : t('inventory.status.certified')} · {selectedTool.certificationExpiry ? new Date(selectedTool.certificationExpiry).toLocaleDateString() : t('inventory.no_date')}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                                        assignedProject ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/20' : 'bg-amber-50 text-amber-600 border-amber-200'
                                                    }`}>
                                                        <Building2 size={10} />
                                                        {assignedProject ? assignedProject.name : t('inventory.no_project')}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200 flex items-center gap-1">
                                                        <Clock size={10} /> {selectedTool.history.length} {t('inventory.entries_count')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-3 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => { setEditDraft({ ...selectedTool }); setIsSaved(false); }}
                                                    className="h-9 px-4 rounded-xl text-xs gap-1.5 border-gray-200 hover:bg-gray-50"
                                                >
                                                    <X size={14} /> {t('common.cancel', 'Cancel')}
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    onClick={handleSave}
                                                    className={`h-9 px-5 rounded-xl text-xs font-bold gap-1.5 transition-all ${isSaved ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-brand-teal hover:bg-brand-teal/90'} text-white shadow-soft`}
                                                >
                                                    {isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                                    {isSaved ? t('inventory.saved') : t('inventory.save_tool')}
                                                </Button>
                                            </div>

                                            <button
                                                onClick={() => { deleteTool(selectedTool.id); setSelectedToolId(null); setEditDraft(null); }}
                                                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors shrink-0"
                                                title={t('inventory.delete_tool')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Body */}
                                <div className="p-5 flex-1 overflow-y-auto space-y-5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('inventory.edit_info')}</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.name')}</label>
                                            <Input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} className="rounded-xl border-gray-200" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.model')}</label>
                                            <Input value={editDraft.model} onChange={e => setEditDraft({ ...editDraft, model: e.target.value })} className="rounded-xl border-gray-200" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.serial')}</label>
                                            <Input value={editDraft.serialNumber} onChange={e => setEditDraft({ ...editDraft, serialNumber: e.target.value })} className="rounded-xl border-gray-200" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.cert_expiry')}</label>
                                            <Input type="date" value={editDraft.certificationExpiry} onChange={e => setEditDraft({ ...editDraft, certificationExpiry: e.target.value })} className="rounded-xl border-gray-200" />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('inventory.assign_to_project')}</label>
                                            <select
                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                                value={editDraft.assignedProjectId || ''}
                                                onChange={e => setEditDraft({ ...editDraft, assignedProjectId: e.target.value || undefined })}
                                            >
                                                <option value="">{t('inventory.no_project')}</option>
                                                {projects.filter(p => p.status === 'Active').map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* History */}
                                    <div className="space-y-3 pt-4 border-t border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock size={12} /> {t('inventory.history_tracking')} · {editDraft.history.length} {t('inventory.entries_count')}
                                        </p>

                                        {/* Add entry */}
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                                            <p className="text-xs font-bold text-gray-500">{t('inventory.add_entry')}</p>
                                            <Input
                                                placeholder={t('inventory.desc_placeholder')}
                                                value={newHistoryEntry.description}
                                                onChange={e => setNewHistoryEntry({ ...newHistoryEntry, description: e.target.value })}
                                                className="h-8 text-sm bg-white"
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    type="date"
                                                    value={newHistoryEntry.date}
                                                    onChange={e => setNewHistoryEntry({ ...newHistoryEntry, date: e.target.value })}
                                                    className="h-8 text-sm bg-white flex-1"
                                                />
                                                <select
                                                    className="h-8 text-sm bg-white border border-gray-200 rounded-md px-2 flex-1 outline-none focus:border-brand-teal"
                                                    value={newHistoryEntry.projectId}
                                                    onChange={e => setNewHistoryEntry({ ...newHistoryEntry, projectId: e.target.value })}
                                                >
                                                    <option value="">{t('inventory.no_project')}</option>
                                                    {projects.filter(p => p.status === 'Active').map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                                </select>
                                                <Button size="sm" onClick={handleAddHistory} className="h-8 px-4 bg-brand-teal text-white rounded-lg">{t('common.add')}</Button>
                                            </div>
                                        </div>

                                        {/* Entry list */}
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {editDraft.history.slice().reverse().map((h, i) => {
                                                const actualIndex = editDraft.history.length - 1 - i;
                                                const hProj = h.projectId ? projects.find(p => p.id === h.projectId) : null;
                                                return (
                                                    <div key={i} className="flex gap-3 p-2.5 bg-gray-50 border border-gray-100 rounded-xl group relative">
                                                        <div className="w-7 h-7 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                                                            <Calendar size={13} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-accent-greyDark">{h.description}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{new Date(h.date).toLocaleDateString()}</span>
                                                                {hProj && <span className="text-[10px] bg-brand-teal/10 text-brand-teal px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin size={9} />{hProj.name}</span>}
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleRemoveHistory(actualIndex)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {editDraft.history.length === 0 && (
                                                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">{t('inventory.no_history')}</p>
                                            )}
                                        </div>
                                    </div>


                                </div>
                            </div>
                        );
                    })() : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <Wrench size={36} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium text-accent-greyDark">{t('inventory.select_tool')}</p>
                            <p className="text-xs mt-1">{t('inventory.select_tool_desc')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
