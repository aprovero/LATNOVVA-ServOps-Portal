import { useState } from 'react';
import { useStore, Project, ProjectScope, ProjectActivity } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, ListChecks } from 'lucide-react';

interface AddScopeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function AddScopeModal({ open, onOpenChange, project }: AddScopeModalProps) {
    const { addScopeToProject, scopeTemplates } = useStore();
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
    const [customScopeName, setCustomScopeName] = useState('');

    const handleAdd = () => {
        let newScopeName = '';
        let initialActivities: ProjectActivity[] = [];

        if (selectedTemplateId === 'custom') {
            if (!customScopeName.trim()) return;
            newScopeName = customScopeName;
        } else {
            const template = scopeTemplates.find(t => t.id === selectedTemplateId);
            if (!template) return;
            newScopeName = template.name;
            initialActivities = template.activities.map(actTitle => ({
                id: `ACT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                title: actTitle,
                status: 'Pending',
                progress: 0
            }));
        }

        const newScope: ProjectScope = {
            id: `SCOPE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            name: newScopeName,
            activities: initialActivities
        };

        addScopeToProject(project.id, newScope);
        
        // Reset and close
        setCustomScopeName('');
        setSelectedTemplateId('custom');
        onOpenChange(false);
    };

    const activeTemplate = scopeTemplates.find(t => t.id === selectedTemplateId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Scope to Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Scope Source</Label>
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
                        <div className="space-y-2">
                            <Label>New Scope Name</Label>
                            <Input 
                                placeholder="e.g. Civil Works, Commissioning..." 
                                value={customScopeName}
                                onChange={e => setCustomScopeName(e.target.value)}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h4 className="text-sm font-bold text-accent-greyDark flex items-center gap-2 mb-3">
                                <ListChecks size={16} className="text-brand-teal" />
                                Included Activities
                            </h4>
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                {activeTemplate?.activities.map((act, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-white px-2 py-1.5 rounded-lg border border-gray-100">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0" />
                                        <span className="leading-tight">{act}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleAdd} 
                        className="bg-brand-teal hover:bg-brand-teal/90 text-white"
                        disabled={selectedTemplateId === 'custom' && !customScopeName.trim()}
                    >
                        <Plus size={16} className="mr-2"/> Add Scope
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
