import { ClipboardList, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Project } from '../../store/useStore';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

export interface ActivityLog {
    scopeId?: string;
    activityId?: string;
    customTaskName?: string;
    progressReported?: number;
    priorProgress?: number;
    notes?: string;
}

interface WBSProgressSectionProps {
    project: Project;
    readOnly: boolean;
    activityLogs: ActivityLog[];
    onLogChange: (logs: ActivityLog[]) => void;
    discipline?: string;
}

export default function WBSProgressSection({ project, readOnly, activityLogs, onLogChange, discipline }: WBSProgressSectionProps) {
    const { t } = useTranslation();
    const [isCustom, setIsCustom] = useState(false);

    const [selectedScope, setSelectedScope] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [customTaskName, setCustomTaskName] = useState('');
    const [progressReported, setProgressReported] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [editIndex, setEditIndex] = useState<number | null>(null);

    const availableScopes = (project.scopes || []).filter(s => 
        !discipline || s.discipline === discipline || s.discipline === 'Other'
    );
    const availableActivities = availableScopes.find(s => s.id === selectedScope)?.activities.filter(a => (a.progress || 0) < 100) || [];

    const handleAddLog = () => {
        let priorProgress = 0;
        if (!isCustom) {
            const scope = availableScopes.find(s => s.id === selectedScope);
            const act = scope?.activities.find(a => a.id === selectedActivity);
            priorProgress = act?.progress || 0;
        }

        const newLog: ActivityLog = {
            notes,
            progressReported: progressReported === '' ? 0 : Number(progressReported),
            priorProgress
        };

        if (isCustom) {
            if (!customTaskName.trim()) return;
            newLog.customTaskName = customTaskName;
            newLog.priorProgress = 0; // Custom tasks start at 0%
        } else {
            if (!selectedScope || !selectedActivity) return;
            newLog.scopeId = selectedScope;
            newLog.activityId = selectedActivity;
        }

        if (editIndex !== null) {
            const updatedLogs = [...activityLogs];
            updatedLogs[editIndex] = newLog;
            onLogChange(updatedLogs);
            setEditIndex(null);
        } else {
            onLogChange([...activityLogs, newLog]);
        }
        
        resetForm();
    };

    const resetForm = () => {
        setSelectedScope('');
        setSelectedActivity('');
        setCustomTaskName('');
        setProgressReported('');
        setNotes('');
        setIsCustom(false);
        setEditIndex(null);
    };

    const handleEditLog = (idx: number) => {
        const log = activityLogs[idx];
        setEditIndex(idx);
        setIsCustom(!!log.customTaskName);
        setCustomTaskName(log.customTaskName || '');
        setSelectedScope(log.scopeId || '');
        setSelectedActivity(log.activityId || '');
        setProgressReported(log.progressReported ?? '');
        setNotes(log.notes || '');
    };

    const handleRemoveLog = (index: number) => {
        onLogChange(activityLogs.filter((_, i) => i !== index));
        if (editIndex === index) resetForm();
    };

    return (
        <div className="card-container">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <ClipboardList className="text-brand-teal" size={20} /> {t('wbs_section.title')}
                </h2>

            </div>

            {/* List of logged activities */}
            <div className="space-y-3 mb-6">
                {activityLogs.length === 0 ? (
                    <div className="text-center p-6 bg-surface-alt rounded-2xl border border-dashed border-gray-300 text-gray-400 text-sm">
                        {t('wbs_section.no_entries')}
                    </div>

                ) : (
                    activityLogs.map((log, i) => {
                        const scope = availableScopes.find(s => s.id === log.scopeId);
                        const act = scope?.activities.find(a => a.id === log.activityId);
                        const totalProgress = (log.priorProgress || 0) + (log.progressReported || 0);
                        
                        return (
                            <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all ${editIndex === i ? 'bg-brand-teal/5 border-brand-teal ring-1 ring-brand-teal' : 'bg-surface-alt border-gray-100'}`}>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-accent-greyDark">
                                            {log.customTaskName ? log.customTaskName : act?.title || t('reports.unknown_state')}
                                        </h4>
                                        {editIndex === i && <span className="text-[10px] font-bold bg-brand-teal text-white px-1.5 py-0.5 rounded">{t('wbs_section.editing')}</span>}

                                    </div>
                                    {!log.customTaskName && scope && (
                                        <p className="text-xs font-semibold tracking-wide text-brand-teal uppercase">{scope.name}</p>
                                    )}
                                    {log.notes && <p className="text-sm text-gray-600 mt-1 italic">"{log.notes}"</p>}
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('wbs_section.new_total')}</div>
                                        <div className="text-sm font-bold text-brand-teal">
                                            {totalProgress}% 
                                            <span className="text-gray-400 font-medium ml-1">
                                                ({log.priorProgress}% + {log.progressReported}%)
                                            </span>
                                        </div>
                                    </div>

                                    {!readOnly && (
                                        <div className="flex items-center gap-1 border-l border-gray-200 pl-3 ml-2">
                                            <button 
                                                onClick={() => handleEditLog(i)} 
                                                className={`p-2 transition-colors ${editIndex === i ? 'text-brand-teal' : 'text-gray-400 hover:text-brand-teal'}`}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleRemoveLog(i)} className="text-gray-400 hover:text-status-error transition-colors p-2">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Log New Activity Form */}
            {!readOnly && (
                <div className={`p-4 rounded-xl border transition-all ${editIndex !== null ? 'bg-brand-teal/5 border-brand-teal shadow-md' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm text-accent-greyDark">
                            {editIndex !== null ? t('wbs_section.update_log') : t('wbs_section.log_new')}
                        </h3>
                        {editIndex !== null && (
                            <Button variant="ghost" size="sm" onClick={resetForm} className="h-7 text-gray-500 hover:text-gray-700 font-bold">
                                <X size={14} className="mr-1" /> {t('wbs_section.cancel_caps')}
                            </Button>
                        )}

                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <Button 
                            variant={!isCustom ? 'default' : 'outline'} 
                            size="sm" 
                            className={!isCustom ? 'bg-brand-teal hover:bg-brand-teal/90 text-white' : ''}
                            onClick={() => setIsCustom(false)}
                            disabled={editIndex !== null && !!activityLogs[editIndex].customTaskName}
                        >
                            {t('wbs_section.select_wbs')}
                        </Button>
                        <Button 
                            variant={isCustom ? 'default' : 'outline'} 
                            size="sm" 
                            className={isCustom ? 'bg-brand-teal hover:bg-brand-teal/90 text-white' : ''}
                            onClick={() => setIsCustom(true)}
                            disabled={editIndex !== null && !!activityLogs[editIndex].scopeId}
                        >
                            {t('wbs_section.custom_task')}
                        </Button>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {!isCustom ? (
                            <>
                                <div className="space-y-2">
                                    <Label>{t('wbs_section.scope')}</Label>
                                    <select 
                                        className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-teal"
                                        value={selectedScope}
                                        onChange={e => setSelectedScope(e.target.value)}
                                        disabled={editIndex !== null}
                                    >
                                        <option value="">{t('wbs_section.select_scope')}</option>

                                        {availableScopes.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('wbs_section.activity')}</Label>
                                    <select 
                                        className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-teal"
                                        value={selectedActivity}
                                        onChange={e => setSelectedActivity(e.target.value)}
                                        disabled={!selectedScope || editIndex !== null}
                                    >
                                        <option value="">{t('wbs_section.select_activity')}</option>

                                        {availableActivities.map(a => (
                                            <option key={a.id} value={a.id}>{a.title} ({a.progress}% current)</option>
                                        ))}
                                        {editIndex !== null && selectedActivity && (
                                            <option value={selectedActivity}>{t('wbs_section.keep_current')}</option>
                                        )}

                                    </select>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2 md:col-span-2">
                                <Label>{t('wbs_section.task_desc')}</Label>
                                <Input 
                                    placeholder={t('wbs_section.task_desc_placeholder')} 

                                    value={customTaskName}
                                    onChange={e => setCustomTaskName(e.target.value)}
                                    disabled={editIndex !== null}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>{t('wbs_section.added_today')}</Label>

                            <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                placeholder="e.g. 25" 
                                value={progressReported}
                                onChange={e => setProgressReported(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('wbs_section.notes_optional')}</Label>
                            <Input 
                                placeholder={t('wbs_section.notes_placeholder')} 

                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <Button 
                        onClick={handleAddLog} 
                        className={`w-full sm:w-auto text-white ${editIndex !== null ? 'bg-brand-teal hover:bg-brand-teal/90' : 'bg-gray-900 hover:bg-black'}`}
                        disabled={isCustom ? !customTaskName.trim() : (!selectedScope || !selectedActivity)}
                    >
                        {editIndex !== null ? (
                            <><Check size={16} className="mr-2"/> {t('wbs_section.update_entry')}</>
                        ) : (
                            <><Plus size={16} className="mr-2"/> {t('wbs_section.add_to_log')}</>
                        )}

                    </Button>
                </div>
            )}
        </div>
    );
}
