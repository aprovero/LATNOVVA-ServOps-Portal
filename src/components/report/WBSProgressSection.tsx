import { useState } from 'react';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { Project } from '../../store/useStore';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

export interface ActivityLog {
    scopeId?: string;
    activityId?: string;
    customTaskName?: string;
    progressReported?: number;
    notes?: string;
}

interface WBSProgressSectionProps {
    project: Project;
    readOnly: boolean;
    activityLogs: ActivityLog[];
    onLogChange: (logs: ActivityLog[]) => void;
}

export default function WBSProgressSection({ project, readOnly, activityLogs, onLogChange }: WBSProgressSectionProps) {
    const [isCustom, setIsCustom] = useState(false);
    const [selectedScope, setSelectedScope] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [customTaskName, setCustomTaskName] = useState('');
    const [progressReported, setProgressReported] = useState<number | ''>('');
    const [notes, setNotes] = useState('');

    const availableScopes = project.scopes || [];
    const availableActivities = availableScopes.find(s => s.id === selectedScope)?.activities.filter(a => a.progress < 100) || [];

    const handleAddLog = () => {
        if (isCustom) {
            if (!customTaskName.trim()) return;
            onLogChange([...activityLogs, { customTaskName, notes, progressReported: progressReported ? Number(progressReported) : undefined }]);
        } else {
            if (!selectedScope || !selectedActivity) return;
            onLogChange([...activityLogs, { scopeId: selectedScope, activityId: selectedActivity, progressReported: progressReported ? Number(progressReported) : undefined, notes }]);
        }
        
        setSelectedScope('');
        setSelectedActivity('');
        setCustomTaskName('');
        setProgressReported('');
        setNotes('');
        setIsCustom(false);
    };

    const handleRemoveLog = (index: number) => {
        onLogChange(activityLogs.filter((_, i) => i !== index));
    };

    return (
        <div className="card-container">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <ClipboardList className="text-brand-teal" size={20} /> Today's Logged Activities
                </h2>
            </div>

            {/* List of logged activities */}
            <div className="space-y-3 mb-6">
                {activityLogs.length === 0 ? (
                    <div className="text-center p-6 bg-surface-alt rounded-2xl border border-dashed border-gray-300 text-gray-400 text-sm">
                        No activities have been logged for this report yet.
                    </div>
                ) : (
                    activityLogs.map((log, i) => {
                        const scope = availableScopes.find(s => s.id === log.scopeId);
                        const act = scope?.activities.find(a => a.id === log.activityId);
                        
                        return (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-alt rounded-2xl border border-gray-100 gap-4">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-accent-greyDark">
                                        {log.customTaskName ? log.customTaskName : act?.title || 'Unknown Activity'}
                                    </h4>
                                    {!log.customTaskName && scope && (
                                        <p className="text-xs font-semibold tracking-wide text-brand-teal uppercase">{scope.name}</p>
                                    )}
                                    {log.notes && <p className="text-sm text-gray-600 mt-1 italic">"{log.notes}"</p>}
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    {log.progressReported !== undefined && (
                                        <span className="text-sm font-bold bg-brand-teal/10 text-brand-teal px-3 py-1 rounded-lg">
                                            {log.progressReported}% Progress
                                        </span>
                                    )}
                                    {!readOnly && (
                                        <button onClick={() => handleRemoveLog(i)} className="text-gray-400 hover:text-status-error transition-colors p-2">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Log New Activity Form */}
            {!readOnly && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-sm text-accent-greyDark mb-4">Log New Activity</h3>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <Button 
                            variant={!isCustom ? 'default' : 'outline'} 
                            size="sm" 
                            className={!isCustom ? 'bg-brand-teal hover:bg-brand-teal/90 text-white' : ''}
                            onClick={() => setIsCustom(false)}
                        >
                            Select from WBS
                        </Button>
                        <Button 
                            variant={isCustom ? 'default' : 'outline'} 
                            size="sm" 
                            className={isCustom ? 'bg-brand-teal hover:bg-brand-teal/90 text-white' : ''}
                            onClick={() => setIsCustom(true)}
                        >
                            Custom/Ad-hoc Task
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {!isCustom ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Scope</Label>
                                    <select 
                                        className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-teal"
                                        value={selectedScope}
                                        onChange={e => setSelectedScope(e.target.value)}
                                    >
                                        <option value="">Select Scope...</option>
                                        {availableScopes.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Activity</Label>
                                    <select 
                                        className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-teal"
                                        value={selectedActivity}
                                        onChange={e => setSelectedActivity(e.target.value)}
                                        disabled={!selectedScope}
                                    >
                                        <option value="">Select Activity...</option>
                                        {availableActivities.map(a => (
                                            <option key={a.id} value={a.id}>{a.title} ({a.progress}% completed)</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2 md:col-span-2">
                                <Label>Task Description</Label>
                                <Input 
                                    placeholder="Enter ad-hoc task description..." 
                                    value={customTaskName}
                                    onChange={e => setCustomTaskName(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Progress Today (%)</Label>
                            <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                placeholder="e.g. 50" 
                                value={progressReported}
                                onChange={e => setProgressReported(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Input 
                                placeholder="Any additional notes..." 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <Button 
                        onClick={handleAddLog} 
                        className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white"
                        disabled={isCustom ? !customTaskName.trim() : (!selectedScope || !selectedActivity)}
                    >
                        <Plus size={16} className="mr-2"/> Add to Log
                    </Button>
                </div>
            )}
        </div>
    );
}
