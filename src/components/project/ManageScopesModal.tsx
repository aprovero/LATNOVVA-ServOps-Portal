import { useState } from 'react';
import { useStore, Project, ProjectScope, ProjectActivity } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, CheckCircle2, Circle } from 'lucide-react';

interface ManageScopesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function ManageScopesModal({ open, onOpenChange, project }: ManageScopesModalProps) {
    const { addScopeToProject, addActivityToScope } = useStore();
    const [newScopeName, setNewScopeName] = useState('');
    const [newActivityTitles, setNewActivityTitles] = useState<Record<string, string>>({});

    const handleAddScope = () => {
        if (!newScopeName.trim()) return;
        const newScope: ProjectScope = {
            id: `SCOPE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            name: newScopeName,
            activities: []
        };
        addScopeToProject(project.id, newScope);
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
        
        addActivityToScope(project.id, scopeId, newActivity);
        setNewActivityTitles(prev => ({ ...prev, [scopeId]: '' }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Scopes & Activities - {project.name}</DialogTitle>
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
                        <Button onClick={handleAddScope} className="shrink-0 bg-brand-teal hover:bg-brand-teal/90">
                            <Plus size={16} className="mr-2"/> Add Scope
                        </Button>
                    </div>

                    {/* Scopes List */}
                    <div className="space-y-4">
                        {project.scopes?.map(scope => (
                            <div key={scope.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-bold text-accent-greyDark">{scope.name}</h3>
                                </div>
                                
                                <div className="p-4 space-y-3">
                                    {/* Activities List */}
                                    {scope.activities.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">No activities defined yet.</p>
                                    ) : (
                                        <div className="space-y-2 mb-4">
                                            {scope.activities.map(act => (
                                                <div key={act.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-brand-teal/30 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        {act.status === 'Completed' ? (
                                                            <CheckCircle2 size={16} className="text-status-success" />
                                                        ) : (
                                                            <Circle size={16} className="text-gray-300" />
                                                        )}
                                                        <span className={`text-sm ${act.status === 'Completed' ? 'text-gray-500 line-through' : 'font-medium text-accent-greyDark'}`}>
                                                            {act.title}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-brand-teal font-bold">{act.progress}%</span>
                                                        <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">{act.status}</span>
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
                                        />
                                        <Button size="sm" variant="secondary" onClick={() => handleAddActivity(scope.id)}>
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
