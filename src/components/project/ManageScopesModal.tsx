import { useState } from 'react';
import { useStore, Project, ProjectScope, ProjectActivity } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, CheckCircle2, Circle, ChevronDown, ChevronUp, ListChecks, Trash2, Pencil, X, Check } from 'lucide-react';

interface ManageScopesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function ManageScopesModal({ open, onOpenChange, project }: ManageScopesModalProps) {
    const { addScopeToProject, addActivityToScope, projects, scopeTemplates } = useStore();
    const currentProject = projects.find(p => p.id === project.id) || project;

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
    const [newScopeName, setNewScopeName] = useState('');
    const [newActivityTitles, setNewActivityTitles] = useState<Record<string, string>>({});
    const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({});
    
    // Editing states
    const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
    const [editScopeName, setEditScopeName] = useState('');
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [editActivityTitle, setEditActivityTitle] = useState('');
    const [editActivitySteps, setEditActivitySteps] = useState<string[]>([]);
    const [newStepText, setNewStepText] = useState('');
    const [newScopeDiscipline, setNewScopeDiscipline] = useState<'Mechanical' | 'Commissioning' | 'Civil' | 'Electrical' | 'Other'>('Other');
    const [editScopeDiscipline, setEditScopeDiscipline] = useState<'Mechanical' | 'Commissioning' | 'Civil' | 'Electrical' | 'Other' | undefined>();

    const DISCIPLINE_OPTIONS = ['Mechanical', 'Commissioning', 'Civil', 'Electrical', 'Other'];

    const handleAddScope = () => {
        let finalScopeName = '';
        let initialActivities: ProjectActivity[] = [];

        if (selectedTemplateId === 'custom') {
            if (!newScopeName.trim()) return;
            finalScopeName = newScopeName;
        } else {
            const template = scopeTemplates.find(t => t.id === selectedTemplateId);
            if (!template) return;
            finalScopeName = template.name;
            initialActivities = template.activities.map(act => ({
                id: `ACT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                title: act.title,
                status: 'Pending',
                progress: 0,
                expectedDays: act.expectedDays,
                steps: act.steps.map(s => ({ name: s, completed: false }))
            }));
        }

        const newScope: ProjectScope = {
            id: `SCOPE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            name: finalScopeName,
            discipline: newScopeDiscipline,
            activities: initialActivities
        };
        addScopeToProject(currentProject.id, newScope);
        setNewScopeName('');
        setNewScopeDiscipline('Other');
        setSelectedTemplateId('custom');
    };

    const handleAddActivity = (scopeId: string) => {
        const title = newActivityTitles[scopeId];
        if (!title?.trim()) return;
        
        const newActivity: ProjectActivity = {
            id: `ACT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            title,
            status: 'Pending',
            progress: 0,
            steps: []
        };
        
        addActivityToScope(currentProject.id, scopeId, newActivity);
        setNewActivityTitles(prev => ({ ...prev, [scopeId]: '' }));
        setExpandedScopes(prev => ({ ...prev, [scopeId]: true }));
    };

    const { updateProjectScope, deleteProjectScope, deleteProjectActivity, updateActivityProgress } = useStore();

    const handleUpdateScopeName = (scopeId: string) => {
        if (!editScopeName.trim()) return;
        updateProjectScope(currentProject.id, scopeId, { 
            name: editScopeName,
            discipline: editScopeDiscipline
        });
        setEditingScopeId(null);
    };

    const handleUpdateActivityTitle = (scopeId: string, activityId: string) => {
        if (!editActivityTitle.trim()) return;
        updateActivityProgress(currentProject.id, scopeId, activityId, { 
            title: editActivityTitle,
            steps: editActivitySteps.map(s => ({ name: s, completed: false }))
        });
        setEditingActivityId(null);
        setEditActivitySteps([]);
    };

    const addStepToEdit = () => {
        if (!newStepText.trim()) return;
        setEditActivitySteps([...editActivitySteps, newStepText.trim()]);
        setNewStepText('');
    };

    const removeStepFromEdit = (index: number) => {
        setEditActivitySteps(editActivitySteps.filter((_, i) => i !== index));
    };

    const toggleScope = (scopeId: string) => {
        setExpandedScopes(prev => ({ ...prev, [scopeId]: !prev[scopeId] }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Scopes & Activities - {currentProject.codeName ? `${currentProject.codeName} • ` : ''}{currentProject.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Add New Scope */}
                    <div className="flex flex-col gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="space-y-2">
                            <Label>Source</Label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none transition-all"
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                            >
                                <option value="custom">Blank Custom Scope</option>
                                {scopeTemplates.length > 0 && (
                                    <optgroup label="Templates">
                                        {scopeTemplates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.activities.length} tasks)</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        
                        {selectedTemplateId === 'custom' ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>New Scope Name</Label>
                                        <Input 
                                            placeholder="e.g. Civil Works, Commissioning..." 
                                            value={newScopeName}
                                            onChange={e => setNewScopeName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Discipline</Label>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none transition-all"
                                            value={newScopeDiscipline}
                                            onChange={(e) => setNewScopeDiscipline(e.target.value as any)}
                                        >
                                            {DISCIPLINE_OPTIONS.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <Button onClick={handleAddScope} className="shrink-0 bg-brand-teal hover:bg-brand-teal/90 text-white" disabled={!newScopeName.trim()}>
                                        <Plus size={16} className="mr-2"/> Add Scope
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white p-3 rounded-lg border border-gray-100">
                                    <h4 className="text-sm font-bold text-accent-greyDark flex items-center gap-2 mb-2">
                                        <ListChecks size={16} className="text-brand-teal" />
                                        Activities to be added
                                    </h4>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2">
                                        {scopeTemplates.find(t => t.id === selectedTemplateId)?.activities.map((act, i) => (
                                            <div key={i} className="flex flex-col gap-1 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="flex items-center gap-2 text-xs font-bold text-accent-greyDark">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0" />
                                                    {act.title} <span className="text-[10px] text-gray-400 font-normal">({act.expectedDays} days)</span>
                                                </div>
                                                {act.steps.length > 0 && (
                                                    <div className="pl-4 flex flex-wrap gap-x-3 gap-y-1">
                                                        {act.steps.map((step, si) => (
                                                            <span key={si} className="text-[10px] text-gray-500 italic flex items-center gap-1">
                                                                <Circle size={8} /> {step}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handleAddScope} className="shrink-0 bg-brand-teal hover:bg-brand-teal/90 text-white">
                                        <Plus size={16} className="mr-2"/> Add Scope from Template
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Scopes List */}
                    <div className="space-y-4">
                        {currentProject.scopes?.map(scope => {
                            const isCompleted = scope.completedDate || (scope.activities.length > 0 && scope.activities.every(a => a.progress === 100 || a.status === 'Completed'));
                            const isExpanded = expandedScopes[scope.id] ?? !isCompleted;

                            return (
                                <div key={scope.id} className={`border ${isCompleted ? 'border-status-success/30 bg-status-success/5' : 'border-gray-200'} rounded-xl overflow-hidden transition-colors`}>
                                    <div 
                                        className={`px-4 py-3 border-b ${isCompleted ? 'border-status-success/20 hover:bg-status-success/10' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'} flex justify-between items-center transition-colors`}
                                    >
                                        <div className="flex items-center gap-3 flex-1" onClick={() => toggleScope(scope.id)}>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                {editingScopeId === scope.id ? (
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <Input 
                                                            value={editScopeName}
                                                            onChange={e => setEditScopeName(e.target.value)}
                                                            className="h-8 py-0 focus-visible:ring-brand-teal"
                                                            autoFocus
                                                        />
                                                        <select
                                                            className="h-8 bg-white border border-gray-200 rounded-lg px-2 text-[10px] font-bold focus:ring-1 focus:ring-brand-teal outline-none border-gray-200"
                                                            value={editScopeDiscipline}
                                                            onChange={(e) => setEditScopeDiscipline(e.target.value as any)}
                                                        >
                                                            {DISCIPLINE_OPTIONS.map(d => (
                                                                <option key={d} value={d}>{d}</option>
                                                            ))}
                                                        </select>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-status-success" onClick={() => handleUpdateScopeName(scope.id)}>
                                                            <Check size={16} />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-status-error" onClick={() => setEditingScopeId(null)}>
                                                            <X size={16} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <h3 className="font-bold text-accent-greyDark flex items-center gap-2">
                                                            {scope.name}
                                                            {scope.discipline && (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal border border-brand-teal/20 uppercase tracking-tighter">
                                                                    {scope.discipline}
                                                                </span>
                                                            )}
                                                        </h3>
                                                    </div>
                                                )}
                                                {isCompleted && (
                                                    <span className="text-xs font-bold text-status-success bg-white/60 px-2 py-0.5 rounded-md border border-status-success/20">
                                                        Completed on {scope.completedDate ? new Date(scope.completedDate).toLocaleDateString() : 'Unknown Database State'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingScopeId !== scope.id && (
                                                <>
                                                    <button 
                                                        className="p-1.5 text-gray-400 hover:text-brand-teal hover:bg-white rounded transition-colors"
                                                        onClick={() => {
                                                            setEditingScopeId(scope.id);
                                                            setEditScopeName(scope.name);
                                                            setEditScopeDiscipline(scope.discipline || 'Other');
                                                        }}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button 
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        onClick={() => {
                                                            if (window.confirm(`Are you sure you want to delete the scope "${scope.name}" and all its activities?`)) {
                                                                deleteProjectScope(currentProject.id, scope.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                            <div className="text-gray-400 ml-2" onClick={() => toggleScope(scope.id)}>
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-4 space-y-3 bg-white">
                                            {/* Activities List */}
                                            {scope.activities.length === 0 ? (
                                                <p className="text-sm text-gray-400 italic">No activities defined yet.</p>
                                            ) : (
                                                <div className="space-y-2 mb-4">
                                                    {scope.activities.map(act => (
                                                        <div key={act.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-brand-teal/30 transition-colors group">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                {act.status === 'Completed' || act.progress === 100 ? (
                                                                    <CheckCircle2 size={16} className="text-status-success shrink-0" />
                                                                ) : (
                                                                    <Circle size={16} className="text-gray-300 shrink-0" />
                                                                )}
                                                                
                                                                {editingActivityId === act.id ? (
                                                                    <div className="flex flex-col gap-2 flex-1 pt-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <Input 
                                                                                value={editActivityTitle}
                                                                                onChange={e => setEditActivityTitle(e.target.value)}
                                                                                className="h-8 py-0 text-sm font-bold focus-visible:ring-brand-teal"
                                                                                autoFocus
                                                                                placeholder="Activity Title"
                                                                            />
                                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-status-success shrink-0" onClick={() => handleUpdateActivityTitle(scope.id, act.id)}>
                                                                                <Check size={16} />
                                                                            </Button>
                                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-status-error shrink-0" onClick={() => setEditingActivityId(null)}>
                                                                                <X size={16} />
                                                                            </Button>
                                                                        </div>
                                                                        
                                                                        <div className="space-y-1.5 pl-2">
                                                                            <Label className="text-[10px] font-bold text-gray-400 uppercase">Checklist Steps</Label>
                                                                            <div className="space-y-1">
                                                                                {editActivitySteps.map((step, idx) => (
                                                                                    <div key={idx} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs border border-gray-100">
                                                                                        <span>{step}</span>
                                                                                        <button onClick={() => removeStepFromEdit(idx)} className="text-gray-400 hover:text-red-500">
                                                                                            <Trash2 size={12} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                                <div className="flex gap-1">
                                                                                    <Input 
                                                                                        value={newStepText}
                                                                                        onChange={e => setNewStepText(e.target.value)}
                                                                                        placeholder="New step..."
                                                                                        className="h-7 text-[11px] py-0"
                                                                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStepToEdit())}
                                                                                    />
                                                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-brand-teal" onClick={addStepToEdit}>
                                                                                        <Plus size={12} />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-sm ${(act.status === 'Completed' || act.progress === 100) ? 'text-gray-500 line-through' : 'font-medium text-accent-greyDark'}`}>
                                                                            {act.title}
                                                                        </span>
                                                                        {act.steps.length > 0 && (
                                                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                                <ListChecks size={10} /> {act.steps.filter(s => s.completed).length}/{act.steps.length} steps completed
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {editingActivityId !== act.id && (
                                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                                                                        <button 
                                                                            className="p-1 text-gray-400 hover:text-brand-teal rounded"
                                                                            onClick={() => {
                                                                                setEditingActivityId(act.id);
                                                                                setEditActivityTitle(act.title);
                                                                                setEditActivitySteps(act.steps.map(s => s.name));
                                                                            }}
                                                                        >
                                                                            <Pencil size={12} />
                                                                        </button>
                                                                        <button 
                                                                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                                                                            onClick={() => {
                                                                                if (window.confirm(`Delete activity "${act.title}"?`)) {
                                                                                    deleteProjectActivity(currentProject.id, scope.id, act.id);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <span className="text-xs text-brand-teal font-bold">{act.progress}%</span>
                                                                <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap hidden sm:block">
                                                                    {act.expectedDays ? `${act.expectedDays}d • ` : ''}{(act.status === 'Completed' || act.progress === 100) ? 'Completed' : act.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Add Activity */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <Input 
                                                    placeholder="Add an activity (e.g. Step 1: Excavation)..." 
                                                    value={newActivityTitles[scope.id] || ''}
                                                    onChange={e => setNewActivityTitles(prev => ({ ...prev, [scope.id]: e.target.value }))}
                                                    className="h-8 text-sm"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleAddActivity(scope.id);
                                                    }}
                                                />
                                                <Button size="sm" variant="secondary" onClick={() => handleAddActivity(scope.id)}>
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
