 import { AlertCircle, Plus, Trash2, Clock, Hourglass, Activity, Target, PenTool, CheckCircle } from 'lucide-react';
 import { useTranslation } from 'react-i18next';

import { ReportOccurrence, useStore } from '../../store/useStore';
import { SignatureCanvasBox } from './MultisignaturePad';

interface OccurrenceSectionProps {
    occurrences: ReportOccurrence[];
    onChange: (occurrences: ReportOccurrence[]) => void;
    readOnly: boolean;
    userRole?: string;
}

const CATEGORIES = [
    'Customer delay',
    'Equipment failure',
    'Material Related',
    'Weather',
    'Access',
    'Crew',
    'Safety',
    'Other'
];

export default function Occurrences({ occurrences, onChange, readOnly, userRole }: OccurrenceSectionProps) {
    const { t } = useTranslation();
    const { userRole: storeRole } = useStore();

    const role = userRole ?? storeRole;
    const isCustomer = role === 'Customer';
    const isSupervisor = role === 'Supervisor' || role === 'Manager';

    const handleAdd = () => {
        onChange([...occurrences, { 
            id: `occ-${Date.now()}`, 
            time: new Date().toTimeString().slice(0, 5), 
            durationMinutes: 0,
            category: 'Customer delay',
            description: '',
            impact: {
                schedule: false,
                productivity: false,
                safety: false,
                clientVisible: false
            }
        }]);
    };

    const handleUpdate = (id: string, field: keyof ReportOccurrence, value: any) => {
        onChange(occurrences.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const handleImpactToggle = (id: string, impactField: keyof NonNullable<ReportOccurrence['impact']>) => {
        onChange(occurrences.map(o => {
            if (o.id === id) {
                const currentImpact = o.impact || { schedule: false, productivity: false, safety: false, clientVisible: false };
                return {
                    ...o,
                    impact: { ...currentImpact, [impactField]: !currentImpact[impactField] }
                };
            }
            return o;
        }));
    };

    const handleRemove = (id: string) => {
        onChange(occurrences.filter(o => o.id !== id));
    };

    if (occurrences.length === 0 && readOnly) return null;

    return (
        <div className="card-container border-l-4 border-l-orange-400">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <AlertCircle className="text-orange-500" size={20} /> {t('occurrence_section.field_issues_title')}
                </h2>

                {!readOnly && (
                    <button onClick={handleAdd} className="btn-secondary text-sm py-2 px-4 flex items-center justify-center gap-2 bg-white w-full sm:w-auto">
                        <Plus size={16} /> {t('occurrence_section.log_issue')}
                    </button>

                )}
            </div>

            <div className="space-y-4">
                {occurrences.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-4 p-5 bg-orange-50/50 rounded-2xl border border-orange-100 relative">
                        {!readOnly && (
                            <button onClick={() => handleRemove(entry.id)} className="absolute top-4 right-4 text-orange-300 hover:text-red-500 transition-colors z-10">
                                <Trash2 size={16} />
                            </button>
                        )}
                        
                        <div className="flex flex-col md:flex-row items-start gap-4 pr-6 md:pr-0">
                            {/* Category Dropdown */}
                            <div className="w-full md:w-1/3 shrink-0">
                                <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1.5">
                                    <Target size={12} /> {t('occurrence_section.category_label')}
                                </label>

                                <select
                                    value={entry.category || 'Other'}
                                    onChange={(e) => handleUpdate(entry.id, 'category', e.target.value)}
                                    disabled={readOnly}
                                    className="w-full bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-3 py-2 text-sm disabled:opacity-70"
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>
                                            {t(`occurrence_section.categories.${cat.toLowerCase().replace(/\s+/g, '_')}`)}
                                        </option>
                                    ))}

                                </select>
                            </div>

                            {/* Time & Duration */}
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-2/3 shrink-0">
                                <div>
                                    <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1.5">
                                        <Clock size={12} /> {t('occurrence_section.start_time_label')}
                                    </label>

                                    <input
                                        type="time"
                                        value={entry.time}
                                        onChange={(e) => handleUpdate(entry.id, 'time', e.target.value)}
                                        disabled={readOnly}
                                        className="w-24 bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-2 py-2 font-mono text-sm font-semibold disabled:opacity-70"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-1.5">
                                        <Hourglass size={12} /> {t('occurrence_section.duration_label')}
                                    </label>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={entry.durationMinutes || ''}
                                            onChange={(e) => handleUpdate(entry.id, 'durationMinutes', parseInt(e.target.value) || 0)}
                                            disabled={readOnly}
                                            placeholder="e.g. 60"
                                            className="w-24 bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-3 py-2 font-mono text-sm disabled:opacity-70"
                                        />
                                        {!readOnly && (
                                            <div className="hidden sm:flex gap-1">
                                                {[15, 30, 60, 120].map(mins => (
                                                    <button
                                                        key={mins}
                                                        type="button"
                                                        onClick={() => handleUpdate(entry.id, 'durationMinutes', mins)}
                                                        className="px-2 py-1 bg-white border border-orange-200 hover:bg-orange-100 text-xs font-bold text-orange-600 rounded-lg transition-colors"
                                                    >
                                                        {mins >= 60 ? `${mins/60}h` : `${mins}m`}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs font-bold text-orange-500 uppercase mb-1.5 block">{t('occurrence_section.description_label')}</label>
                            <input
                                type="text"
                                value={entry.description}
                                onChange={(e) => handleUpdate(entry.id, 'description', e.target.value)}
                                disabled={readOnly}
                                placeholder={t('occurrence_section.description_placeholder')}
                                className="w-full bg-white border border-orange-200 focus:border-orange-500 outline-none rounded-xl px-3 py-2 text-sm disabled:opacity-70"
                            />
                        </div>


                        {/* Impact Toggles */}
                        <div className="pt-2 border-t border-orange-200/50">
                            <label className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-2">
                                <Activity size={12} /> {t('occurrence_section.impact_toggle')}
                            </label>

                            <div className="flex flex-wrap gap-4">
                                {[
                                    { id: 'schedule', label: t('occurrence_section.impact_labels.schedule') },

                                    { id: 'productivity', label: t('occurrence_section.impact_labels.productivity') },

                                    { id: 'safety', label: t('occurrence_section.impact_labels.safety') },

                                    { id: 'clientVisible', label: t('occurrence_section.impact_labels.client_visible') }

                                ].map((impactOption) => {
                                    const key = impactOption.id as keyof NonNullable<typeof entry.impact>;
                                    const isChecked = !!entry.impact?.[key];
                                    return (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                            <div className="relative flex items-center justify-center w-5 h-5">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleImpactToggle(entry.id, key)}
                                                    disabled={readOnly}
                                                    className="appearance-none w-5 h-5 rounded border border-orange-300 checked:bg-orange-500 checked:border-orange-500 disabled:opacity-70 transition-colors"
                                                />
                                                {isChecked && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-1.5 h-2.5 border-b-2 border-r-2 border-white transform rotate-45 mb-0.5"></div></div>}
                                            </div>
                                            <span className={`text-sm font-semibold transition-colors ${isChecked ? 'text-orange-700' : 'text-gray-500 group-hover:text-orange-600'}`}>{impactOption.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* L-05: Supervisor countersign required for Safety occurrences */}
                        {entry.category === 'Safety' && entry.impact?.safety && (
                            <div className="pt-3 border-t-2 border-red-200 mt-1">
                                <p className="text-xs font-bold text-red-600 uppercase flex items-center gap-1.5 mb-2">
                                    <PenTool size={12} /> {t('occurrence_section.supervisor_countersign')}
                                </p>

                                {(entry as any).supervisorSignature ? (
                                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                        <CheckCircle size={14} />
                                        {!isCustomer && (
                                            <span>{t('occurrence_section.countersigned_by', { name: (entry as any).supervisorSignature.name, time: new Date((entry as any).supervisorSignature.timestamp).toLocaleTimeString() })}</span>
                                        )}
                                        {isCustomer && <span>{t('occurrence_section.countersigned_generic')}</span>}
                                    </div>

                                ) : isSupervisor && !readOnly ? (
                                    <div className="space-y-2">
                                        <input
                                            id={`sup-sig-name-${entry.id}`}
                                            type="text"
                                            placeholder={t('occurrence_section.supervisor_name_placeholder')}
                                            className="input-field w-full text-sm"
                                        />
                                        <div className="h-20 border border-dashed border-red-300 rounded-xl overflow-hidden bg-white">

                                            <SignatureCanvasBox onSign={(blob) => {
                                                const nameEl = document.getElementById(`sup-sig-name-${entry.id}`) as HTMLInputElement | null;
                                                const name = nameEl?.value?.trim();
                                                if (!name) { alert(t('occurrence_section.enter_name_alert')); return; }

                                                handleUpdate(entry.id, 'supervisorSignature' as any, {
                                                    name,
                                                    blob,
                                                    timestamp: new Date().toISOString()
                                                });
                                            }} />
                                        </div>
                                        <p className="text-[10px] text-red-400">{t('occurrence_section.draw_signature_help')}</p>
                                    </div>

                                ) : (
                                    <p className="text-xs text-red-500 italic">⚠ {t('occurrence_section.awaiting_countersign')}</p>
                                )}

                            </div>
                        )}

                    </div>
                ))}

                {occurrences.length === 0 && (
                    <div className="p-6 text-center text-orange-400 bg-orange-50/30 rounded-2xl border border-dashed border-orange-200">
                        <p className="text-sm">{t('occurrence_section.no_shift_entries')}</p>
                    </div>
                )}

            </div>
        </div>
    );
}
