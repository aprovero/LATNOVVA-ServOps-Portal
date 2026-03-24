import { useState } from 'react';
import { useStore, Project, ProjectScope, ProjectActivity } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

interface ManageScopesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function ManageScopesModal({ open, onOpenChange, project }: ManageScopesModalProps) {
    const { addScopeToProject, addActivityToScope, projects } = useStore();
    const currentProject = projects.find(p => p.id === project.id) || project;

    const [newScopeName, setNewScopeName] = useState('');
    const [newActivityTitles, setNewActivityTitles] = useState<Record<string, string>>({});
    const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({});

    const handleAddScope = () => {
        if (!newScopeName.trim()) return;
        const newScope: ProjectScope = {
            id: `SCOPE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            name: newScopeName,
            activities: []
        };
        addScopeToProject(currentProject.id, newScope);
        setNewScopeName('');
    };

    const handleAddActivity = (scopeId: string) => {
        const title = newActivityTitles[scopeId];
        if (!title?.trim()) return;
        
        const newActivity: ProjectActivity = {
            id: `ACT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            title,
            status: 'Pending',
            progress: 0
        };
        
        addActivityToScope(currentProject.id, scopeId, newActivity);
        setNewActivityTitles(prev => ({ ...prev, [scopeId]: '' }));
        // Ensure it's expanded so user sees the new activity
        setExpandedScopes(prev => ({ ...prev, [scopeId]: true }));
    };

    const toggleScope = (scopeId: string) => {
        setExpandedScopes(prev => ({ ...prev, [scopeId]: !prev[scopeId] }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Scopes & Activities - {currentProject.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Add New Scope */}
                    <div className="flex items-end gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex-1 space-y-2">
                            <Label>New Scope Name</Label>
                            <Input 
                                placeholder="e.g. Civil Works, Commissioning..." 
                                value={newScopeName}
                                onChange={e => setNewScopeName(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleAddScope} className="shrink-0 bg-brand-teal hover:bg-brand-teal/90 text-white">
                            <Plus size={16} className="mr-2"/> Add Scope
                        </Button>
                    </div>

                    {/* Scopes List */}
                    <div className="space-y-4">
                        {currentProject.scopes?.map(scope => {
                            const isCompleted = scope.completedDate || (scope.activities.length > 0 && scope.activities.every(a => a.progress === 100 || a.status === 'Completed'));
                            const isExpanded = expandedScopes[scope.id] ?? !isCompleted;

                            return (
                                <div key={scope.id} className={`border ${isCompleted ? 'border-status-success/30 bg-status-success/5' : 'border-gray-200'} rounded-xl overflow-hidden transition-colors`}>
                                    <div 
                                        className={`px-4 py-3 border-b ${isCompleted ? 'border-status-success/20 hover:bg-status-success/10' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'} flex justify-between items-center cursor-pointer transition-colors`}
                                        onClick={() => toggleScope(scope.id)}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <h3 className="font-bold text-accent-greyDark">{scope.name}</h3>
                                            {isCompleted && (
                                                <span className="text-xs font-bold text-status-success bg-white/60 px-2 py-0.5 rounded-md border border-status-success/20">
                                                    Completed on {scope.completedDate ? new Date(scope.completedDate).toLocaleDateString() : 'Unknown Database State'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-gray-400">
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
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
                                                        <div key={act.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-brand-teal/30 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                {act.status === 'Completed' || act.progress === 100 ? (
                                                                    <CheckCircle2 size={16} className="text-status-success shrink-0" />
                                                                ) : (
                                                                    <Circle size={16} className="text-gray-300 shrink-0" />
                                                                )}
                                                                <span className={`text-sm ${(act.status === 'Completed' || act.progress === 100) ? 'text-gray-500 line-through' : 'font-medium text-accent-greyDark'}`}>
                                                                    {act.title}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <span className="text-xs text-brand-teal font-bold">{act.progress}%</span>
                                                                <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap hidden sm:block">
                                                                    {(act.status === 'Completed' || act.progress === 100) ? 'Completed' : act.status}
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
