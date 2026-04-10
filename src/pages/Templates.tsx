import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Plus, Search, CheckSquare, Trash2, ListChecks, FolderGit2, FileText, Pencil, X, Clock } from 'lucide-react';
import { useStore, ChecklistTemplate, ScopeTemplate, SubReportTemplate, SubReportFieldType, ScopeTemplateActivity } from '../store/useStore';
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
    const { t } = useTranslation();
    const { templates, scopeTemplates, subReportTemplates, addTemplate, deleteTemplate, addScopeTemplate, deleteScopeTemplate, addSubReportTemplate, deleteSubReportTemplate } = useStore();
    const [activeTab, setActiveTab] = useState<'checklists' | 'scopes' | 'subreports'>('scopes');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Checklist State
    const [isAddChecklistOpen, setIsAddChecklistOpen] = useState(false);
    const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
    const [newChecklist, setNewChecklist] = useState<{ name: string; items: string[] }>({
        name: '',
        items: [''],
    });

    // Scope Template State
    const [isAddScopeOpen, setIsAddScopeOpen] = useState(false);
    const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
    const [newScopeTemplate, setNewScopeTemplate] = useState<{ name: string; activities: Partial<ScopeTemplateActivity>[] }>({
        name: '',
        activities: [{ title: '', steps: [''], expectedDays: 1 }],
    });

    // Sub-Report Template State
    const [isAddSubReportOpen, setIsAddSubReportOpen] = useState(false);
    const [editingSubReportId, setEditingSubReportId] = useState<string | null>(null);
    const [newSubReportTemplate, setNewSubReportTemplate] = useState<{ name: string; fields: { name: string; type: SubReportFieldType }[] }>({
        name: '',
        fields: [{ name: '', type: 'text' }],
    });

    // --- Checklists Logic ---
    const { updateTemplate, updateScopeTemplate, updateSubReportTemplate } = useStore();

    const handleAddChecklist = () => {
        if (!newChecklist.name.trim() || newChecklist.items.every(i => !i.trim())) return;
        
        if (editingChecklistId) {
            updateTemplate(editingChecklistId, {
                name: newChecklist.name,
                items: newChecklist.items.filter(i => i.trim() !== '')
            });
            setEditingChecklistId(null);
        } else {
            const template: ChecklistTemplate = {
                id: `TPL-${Date.now()}`,
                name: newChecklist.name,
                items: newChecklist.items.filter(i => i.trim() !== ''),
            };
            addTemplate(template);
        }
        
        setNewChecklist({ name: '', items: [''] });
        setIsAddChecklistOpen(false);
    };

    const startEditingChecklist = (template: ChecklistTemplate) => {
        setEditingChecklistId(template.id);
        setNewChecklist({ name: template.name, items: [...template.items] });
        setIsAddChecklistOpen(true);
    };

    // --- Scopes Logic ---
    const handleAddScopeTemplate = () => {
        if (!newScopeTemplate.name.trim() || newScopeTemplate.activities.every(a => !a.title?.trim())) return;
        
        const cleanActivities: ScopeTemplateActivity[] = newScopeTemplate.activities
            .filter(a => a.title?.trim())
            .map((a, idx) => ({
                id: a.id || `S-ACT-${Date.now()}-${idx}`,
                title: a.title || '',
                steps: (a.steps || []).filter(s => s.trim() !== ''),
                expectedDays: a.expectedDays || 1
            }));

        if (editingScopeId) {
            updateScopeTemplate(editingScopeId, {
                name: newScopeTemplate.name,
                activities: cleanActivities
            });
            setEditingScopeId(null);
        } else {
            const template: ScopeTemplate = {
                id: `STPL-${Date.now()}`,
                name: newScopeTemplate.name,
                activities: cleanActivities,
            };
            addScopeTemplate(template);
        }
        
        setNewScopeTemplate({ name: '', activities: [{ title: '', steps: [''], expectedDays: 1 }] });
        setIsAddScopeOpen(false);
    };

    const startEditingScope = (template: ScopeTemplate) => {
        setEditingScopeId(template.id);
        setNewScopeTemplate({ 
            name: template.name, 
            activities: template.activities.map(a => ({ ...a, steps: [...a.steps] })) 
        });
        setIsAddScopeOpen(true);
    };

    // --- Sub-Reports Logic ---
    const handleAddSubReportTemplate = () => {
        if (!newSubReportTemplate.name.trim() || newSubReportTemplate.fields.length === 0) return;
        
        const cleanFields = newSubReportTemplate.fields.map((f, i) => ({ 
            id: (f as any).id || `f${i}`, 
            name: f.name || `Field ${i+1}`, 
            type: f.type 
        }));

        if (editingSubReportId) {
            updateSubReportTemplate(editingSubReportId, {
                name: newSubReportTemplate.name,
                fields: cleanFields
            });
            setEditingSubReportId(null);
        } else {
            const template: SubReportTemplate = {
                id: `SRT-${Date.now()}`,
                name: newSubReportTemplate.name,
                fields: cleanFields
            };
            addSubReportTemplate(template);
        }
        
        setNewSubReportTemplate({ name: '', fields: [{ name: '', type: 'text' }] });
        setIsAddSubReportOpen(false);
    };

    const startEditingSubReport = (template: SubReportTemplate) => {
        setEditingSubReportId(template.id);
        setNewSubReportTemplate({ name: template.name, fields: [...template.fields] });
        setIsAddSubReportOpen(true);
    };

    // Derived filtering
    const filteredChecklists = (templates || []).filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredScopes = (scopeTemplates || []).filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredSubReports = (subReportTemplates || []).filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <ListChecks className="text-brand-teal" size={28} />
                        {t('templates.title')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('templates.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder={t('templates.search')}
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
                    <FolderGit2 size={16} /> {t('templates.tabs.scopes')}
                </button>
                <button 
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'checklists' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} 
                    onClick={() => setActiveTab('checklists')}
                >
                    <CheckSquare size={16} /> {t('templates.tabs.checklists')}
                </button>
                <button 
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'subreports' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} 
                    onClick={() => setActiveTab('subreports')}
                >
                    <FileText size={16} /> {t('templates.tabs.subreports')}
                </button>
            </div>

            {/* Scopes Tab */}
            {activeTab === 'scopes' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                <Dialog open={isAddScopeOpen} onOpenChange={(open) => {
                    if (!open) {
                        setIsAddScopeOpen(false);
                        setEditingScopeId(null);
                        setNewScopeTemplate({ name: '', activities: [{ title: '', steps: [''], expectedDays: 1 }] });
                    } else {
                        setIsAddScopeOpen(true);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6">
                            <Plus size={18} /> {t('templates.scopes.add')}
                        </Button>
                    </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-accent-greyDark">
                                {editingScopeId ? t('templates.scopes.edit') : t('templates.scopes.create')}
                            </DialogTitle>
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
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-accent-greyDark text-left block">
                                            {t('templates.scopes.activities')}
                                        </label>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setNewScopeTemplate({ 
                                                ...newScopeTemplate, 
                                                activities: [...newScopeTemplate.activities, { title: '', steps: [''], expectedDays: 1 }] 
                                            })} 
                                            className="h-7 text-xs px-2"
                                        >
                                            <Plus size={14} className="mr-1" /> {t('templates.scopes.add_activity')}
                                        </Button>
                                    </div>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {newScopeTemplate.activities.map((act, index) => (
                                            <div key={index} className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group/act">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('templates.scopes.activity_title')}</label>
                                                            <Input
                                                                placeholder={`e.g. Electrical Installation`}
                                                                value={act.title}
                                                                onChange={(e) => {
                                                                    const newActs = [...newScopeTemplate.activities];
                                                                    newActs[index].title = e.target.value;
                                                                    setNewScopeTemplate({ ...newScopeTemplate, activities: newActs });
                                                                }}
                                                                className="rounded-xl border-gray-200 h-9"
                                                            />
                                                        </div>
                                                        <div className="w-24 space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('templates.scopes.days')}</label>
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    value={act.expectedDays}
                                                                    onChange={(e) => {
                                                                        const newActs = [...newScopeTemplate.activities];
                                                                        newActs[index].expectedDays = parseInt(e.target.value) || 1;
                                                                        setNewScopeTemplate({ ...newScopeTemplate, activities: newActs });
                                                                    }}
                                                                    className="rounded-xl border-gray-200 h-9"
                                                                />
                                                                <Clock size={14} className="text-gray-400" />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const newActs = newScopeTemplate.activities.filter((_, i) => i !== index);
                                                                setNewScopeTemplate({ ...newScopeTemplate, activities: newActs.length ? newActs : [{ title: '', steps: [''], expectedDays: 1 }] });
                                                            }}
                                                            className="mt-5 p-2 text-red-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                            <ListChecks size={10} /> {t('templates.scopes.tasks')}
                                                        </label>
                                                        <button 
                                                            onClick={() => {
                                                                const newActs = [...newScopeTemplate.activities];
                                                                newActs[index].steps = [...(newActs[index].steps || []), ''];
                                                                setNewScopeTemplate({ ...newScopeTemplate, activities: newActs });
                                                            }}
                                                            className="text-[10px] font-bold text-brand-teal hover:underline"
                                                        >
                                                            {t('templates.scopes.add_step')}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {(act.steps || []).map((step, sIdx) => (
                                                            <div key={sIdx} className="relative group/step">
                                                                <Input 
                                                                    placeholder={`Step ${sIdx + 1}`}
                                                                    value={step}
                                                                    onChange={(e) => {
                                                                        const newActs = [...newScopeTemplate.activities];
                                                                        newActs[index].steps![sIdx] = e.target.value;
                                                                        setNewScopeTemplate({ ...newScopeTemplate, activities: newActs });
                                                                    }}
                                                                    className="rounded-lg border-gray-100 h-8 text-xs pr-8"
                                                                />
                                                                <button 
                                                                    onClick={() => {
                                                                        const newActs = [...newScopeTemplate.activities];
                                                                        newActs[index].steps = newActs[index].steps!.filter((_, i) => i !== sIdx);
                                                                        setNewScopeTemplate({ ...newScopeTemplate, activities: newActs });
                                                                    }}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 opacity-0 group-hover/step:opacity-100 transition-opacity"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddScopeTemplate}>
                                        {editingScopeId ? t('templates.scopes.update') : t('templates.scopes.save')}
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
                                            <p className="text-sm text-gray-400">{t('templates.scopes.count', { count: template.activities.length })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-colors" onClick={() => startEditingScope(template)}>
                                            <Pencil size={16} />
                                        </button>
                                        <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => deleteScopeTemplate(template.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 flex-1 mt-2">
                                    {template.activities.slice(0, 4).map((item, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 text-sm bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                                            <div className="flex items-center gap-2 font-bold text-accent-greyDark">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0"></div>
                                                {item.title}
                                            </div>
                                            {item.steps.length > 0 && (
                                                <div className="pl-4 text-[10px] text-gray-400 font-medium">
                                                    {t('templates.scopes.count_steps', { count: item.steps.length }) /* Hack if key missing, using count for now */}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {template.activities.length > 4 && (
                                        <p className="text-xs text-brand-teal font-medium mt-2 pl-1">
                                            {t('templates.scopes.more', { count: template.activities.length - 4 })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredScopes.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <FolderGit2 size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-500">{t('templates.scopes.empty')}</h3>
                                <p className="text-gray-400">{t('templates.scopes.empty_desc')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Checklists Tab */}
            {activeTab === 'checklists' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Dialog open={isAddChecklistOpen} onOpenChange={(open) => {
                            if (!open) {
                                setIsAddChecklistOpen(false);
                                setEditingChecklistId(null);
                                setNewChecklist({ name: '', items: [''] });
                            } else {
                                setIsAddChecklistOpen(true);
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6">
                                    <Plus size={18} /> {t('templates.checklists.add')}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-accent-greyDark">
                                        {editingChecklistId ? t('templates.checklists.edit') : t('templates.checklists.create')}
                                    </DialogTitle>
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
                                                {t('templates.checklists.items')}
                                            </label>
                                            <Button variant="outline" size="sm" onClick={() => setNewChecklist({ ...newChecklist, items: [...newChecklist.items, ''] })} className="h-7 text-xs px-2">
                                                <Plus size={14} className="mr-1" /> {t('templates.checklists.add_item')}
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
                                        {editingChecklistId ? t('templates.checklists.update') : t('templates.checklists.save')}
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
                                            <p className="text-sm text-gray-400">{t('templates.checklists.count', { count: template.items.length })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-colors" onClick={() => startEditingChecklist(template)}>
                                            <Pencil size={16} />
                                        </button>
                                        <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => deleteTemplate(template.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
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
                                            {t('templates.checklists.more', { count: template.items.length - 4 })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredChecklists.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <CheckSquare size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-500">{t('templates.checklists.empty')}</h3>
                                <p className="text-gray-400">{t('templates.checklists.empty_desc')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Sub-Reports Tab */}
            {activeTab === 'subreports' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Dialog open={isAddSubReportOpen} onOpenChange={(open) => {
                            if (!open) {
                                setIsAddSubReportOpen(false);
                                setEditingSubReportId(null);
                                setNewSubReportTemplate({ name: '', fields: [{ name: '', type: 'text' }] });
                            } else {
                                setIsAddSubReportOpen(true);
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6">
                                    <Plus size={18} /> {t('templates.forms.add')}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] rounded-2xl p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-accent-greyDark">
                                        {editingSubReportId ? t('templates.forms.edit') : t('templates.forms.create')}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark text-left block">{t('templates.forms.name')}</label>
                                        <Input
                                            placeholder="e.g. Unit Commissioning Report"
                                            value={newSubReportTemplate.name}
                                            onChange={(e) => setNewSubReportTemplate({ ...newSubReportTemplate, name: e.target.value })}
                                            className="rounded-xl border-gray-200"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-semibold text-accent-greyDark text-left block">
                                                {t('templates.forms.fields')}
                                            </label>
                                            <Button variant="outline" size="sm" onClick={() => setNewSubReportTemplate({ ...newSubReportTemplate, fields: [...newSubReportTemplate.fields, { name: '', type: 'text' }] })} className="h-7 text-xs px-2">
                                                <Plus size={14} className="mr-1" /> {t('templates.forms.add_field')}
                                            </Button>
                                        </div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                            {newSubReportTemplate.fields.map((field, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Input
                                                        placeholder={`Field Name (e.g. Serial Number)`}
                                                        value={field.name}
                                                        onChange={(e) => {
                                                            const newFields = [...newSubReportTemplate.fields];
                                                            newFields[index].name = e.target.value;
                                                            setNewSubReportTemplate({ ...newSubReportTemplate, fields: newFields });
                                                        }}
                                                        className="rounded-xl border-gray-200 flex-1"
                                                    />
                                                    <select
                                                        className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-1 focus:ring-brand-teal"
                                                        value={field.type}
                                                        onChange={(e) => {
                                                            const newFields = [...newSubReportTemplate.fields];
                                                            newFields[index].type = e.target.value as SubReportFieldType;
                                                            setNewSubReportTemplate({ ...newSubReportTemplate, fields: newFields });
                                                        }}
                                                    >
                                                        <option value="text">{t('templates.field_types.text')}</option>
                                                        <option value="number">{t('templates.field_types.number')}</option>
                                                        <option value="checkbox">{t('templates.field_types.checkbox')}</option>
                                                        <option value="picture">{t('templates.field_types.picture')}</option>
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            const newFields = newSubReportTemplate.fields.filter((_, i) => i !== index);
                                                            setNewSubReportTemplate({ ...newSubReportTemplate, fields: newFields.length ? newFields : [{ name: '', type: 'text' }] });
                                                        }}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddSubReportTemplate}>
                                        {editingSubReportId ? t('templates.forms.update') : t('templates.forms.save')}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSubReports.map(template => (
                            <div key={template.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft flex flex-col hover:border-brand-teal/30 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-brand-teal/10 text-brand-teal rounded-xl">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-accent-greyDark text-lg">{template.name}</h3>
                                            <p className="text-sm text-gray-400">{t('templates.forms.count', { count: template.fields.length })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-colors" onClick={() => startEditingSubReport(template)}>
                                            <Pencil size={16} />
                                        </button>
                                        <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => deleteSubReportTemplate(template.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 flex-1 mt-2">
                                    {template.fields.slice(0, 4).map((field, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <span className="font-medium truncate">{field.name}</span>
                                            <span className="text-[10px] font-mono bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase">{field.type}</span>
                                        </div>
                                    ))}
                                    {template.fields.length > 4 && (
                                        <p className="text-xs text-brand-teal font-medium mt-2 pl-1">
                                            {t('templates.forms.more', { count: template.fields.length - 4 })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredSubReports.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-500">{t('templates.forms.empty')}</h3>
                                <p className="text-gray-400">{t('templates.forms.empty_desc')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
