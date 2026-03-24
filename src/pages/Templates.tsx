import { useState } from 'react';
import { Plus, Search, CheckSquare, Trash2, ListChecks, FolderGit2 } from 'lucide-react';
import { useStore, ChecklistTemplate, ScopeTemplate } from '../store/useStore';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';

export default function Templates() {
    const { templates, scopeTemplates, addTemplate, deleteTemplate, addScopeTemplate, deleteScopeTemplate } = useStore();
    const [activeTab, setActiveTab] = useState<'checklists' | 'scopes'>('scopes');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Checklist State
    const [isAddChecklistOpen, setIsAddChecklistOpen] = useState(false);
    const [newChecklist, setNewChecklist] = useState<{ name: string; items: string[] }>({
        name: '',
        items: [''],
    });

    // Scope Template State
    const [isAddScopeOpen, setIsAddScopeOpen] = useState(false);
    const [newScopeTemplate, setNewScopeTemplate] = useState<{ name: string; activities: string[] }>({
        name: '',
        activities: [''],
    });

    // --- Checklists Logic ---
    const handleAddChecklist = () => {
        if (!newChecklist.name.trim() || newChecklist.items.every(i => !i.trim())) return;
        const template: ChecklistTemplate = {
            id: `TPL-${Date.now()}`,
            name: newChecklist.name,
            items: newChecklist.items.filter(i => i.trim() !== ''),
        };
        addTemplate(template);
        setNewChecklist({ name: '', items: [''] });
        setIsAddChecklistOpen(false);
    };

    // --- Scopes Logic ---
    const handleAddScopeTemplate = () => {
        if (!newScopeTemplate.name.trim() || newScopeTemplate.activities.every(a => !a.trim())) return;
        const template: ScopeTemplate = {
            id: `STPL-${Date.now()}`,
            name: newScopeTemplate.name,
            activities: newScopeTemplate.activities.filter(a => a.trim() !== ''),
        };
        addScopeTemplate(template);
        setNewScopeTemplate({ name: '', activities: [''] });
        setIsAddScopeOpen(false);
    };

    // Derived filtering
    const filteredChecklists = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredScopes = (scopeTemplates || []).filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <ListChecks className="text-brand-teal" size={32} />
                        Templates Manager
                    </h1>
                    <p className="text-accent-grey mt-1">Manage reusable configurations for reports and projects.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Find a template..."
                            className="pl-10 w-full md:w-80 bg-white border-gray-200 focus-visible:ring-brand-teal h-11 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                <button 
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'scopes' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} 
                    onClick={() => setActiveTab('scopes')}
                >
                    <FolderGit2 size={16} /> Scope / WBS
                </button>
                <button 
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'checklists' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} 
                    onClick={() => setActiveTab('checklists')}
                >
                    <CheckSquare size={16} /> Checklists
                </button>
            </div>

            {/* Scopes Tab */}
            {activeTab === 'scopes' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Dialog open={isAddScopeOpen} onOpenChange={setIsAddScopeOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                                    <Plus size={18} /> Add Scope Template
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-accent-greyDark">Create Scope Template</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark text-left block">Template Name</label>
                                        <Input
                                            placeholder="e.g. Standard Commissioning"
                                            value={newScopeTemplate.name}
                                            onChange={(e) => setNewScopeTemplate({ ...newScopeTemplate, name: e.target.value })}
                                            className="rounded-xl border-gray-200"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-semibold text-accent-greyDark text-left block">
                                                Standard Activities
                                            </label>
                                            <Button variant="outline" size="sm" onClick={() => setNewScopeTemplate({ ...newScopeTemplate, activities: [...newScopeTemplate.activities, ''] })} className="h-7 text-xs px-2">
                                                <Plus size={14} className="mr-1" /> Add Activity
                                            </Button>
                                        </div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                            {newScopeTemplate.activities.map((act, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Input
                                                        placeholder={`Activity ${index + 1}`}
                                                        value={act}
                                                        onChange={(e) => {
                                                            const newActs = [...newScopeTemplate.activities];
                                                            newActs[index] = e.target.value;
                                                            setNewScopeTemplate({ ...newScopeTemplate, activities: newActs });
                                                        }}
                                                        className="rounded-xl border-gray-200"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const newActs = newScopeTemplate.activities.filter((_, i) => i !== index);
                                                            setNewScopeTemplate({ ...newScopeTemplate, activities: newActs.length ? newActs : [''] });
                                                        }}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddScopeTemplate}>
                                        Save Template
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredScopes.map(template => (
                            <div key={template.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft flex flex-col hover:border-brand-teal/30 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-brand-teal/10 text-brand-teal rounded-xl">
                                            <FolderGit2 size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-accent-greyDark text-lg">{template.name}</h3>
                                            <p className="text-sm text-gray-400">{template.activities.length} activities</p>
                                        </div>
                                    </div>
                                    <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" onClick={() => deleteScopeTemplate(template.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="space-y-2 flex-1 mt-2">
                                    {template.activities.slice(0, 4).map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <div className="mt-0.5 w-3 h-3 border border-gray-300 rounded flex-shrink-0 bg-white"></div>
                                            <span className="leading-tight">{item}</span>
                                        </div>
                                    ))}
                                    {template.activities.length > 4 && (
                                        <p className="text-xs text-brand-teal font-medium mt-2 pl-1">
                                            + {template.activities.length - 4} more activities...
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredScopes.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <FolderGit2 size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-500">No scope templates found</h3>
                                <p className="text-gray-400">Create a new template to standardize project WBS creation.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Checklists Tab */}
            {activeTab === 'checklists' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Dialog open={isAddChecklistOpen} onOpenChange={setIsAddChecklistOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                                    <Plus size={18} /> Add Checklist Template
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-accent-greyDark">Create Checklist Template</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark text-left block">Template Name</label>
                                        <Input
                                            placeholder="e.g. Substation Commissioning"
                                            value={newChecklist.name}
                                            onChange={(e) => setNewChecklist({ ...newChecklist, name: e.target.value })}
                                            className="rounded-xl border-gray-200"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-semibold text-accent-greyDark text-left block">
                                                Checklist Items
                                            </label>
                                            <Button variant="outline" size="sm" onClick={() => setNewChecklist({ ...newChecklist, items: [...newChecklist.items, ''] })} className="h-7 text-xs px-2">
                                                <Plus size={14} className="mr-1" /> Add Item
                                            </Button>
                                        </div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                            {newChecklist.items.map((item, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Input
                                                        placeholder={`Item ${index + 1}`}
                                                        value={item}
                                                        onChange={(e) => {
                                                            const newItems = [...newChecklist.items];
                                                            newItems[index] = e.target.value;
                                                            setNewChecklist({ ...newChecklist, items: newItems });
                                                        }}
                                                        className="rounded-xl border-gray-200"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const newItems = newChecklist.items.filter((_, i) => i !== index);
                                                            setNewChecklist({ ...newChecklist, items: newItems.length ? newItems : [''] });
                                                        }}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddChecklist}>
                                        Save Template
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredChecklists.map(template => (
                            <div key={template.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft flex flex-col hover:border-brand-teal/30 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-brand-teal/10 text-brand-teal rounded-xl">
                                            <CheckSquare size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-accent-greyDark text-lg">{template.name}</h3>
                                            <p className="text-sm text-gray-400">{template.items.length} items</p>
                                        </div>
                                    </div>
                                    <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" onClick={() => deleteTemplate(template.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="space-y-2 flex-1 mt-2">
                                    {template.items.slice(0, 4).map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <div className="mt-0.5 w-3 h-3 border border-gray-300 rounded flex-shrink-0 bg-white"></div>
                                            <span className="leading-tight">{item}</span>
                                        </div>
                                    ))}
                                    {template.items.length > 4 && (
                                        <p className="text-xs text-brand-teal font-medium mt-2 pl-1">
                                            + {template.items.length - 4} more items...
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredChecklists.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <CheckSquare size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-500">No checklist templates found</h3>
                                <p className="text-gray-400">Try adjusting your search or create a new template.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
