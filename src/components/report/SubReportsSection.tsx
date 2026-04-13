 import { FileText, Trash2, ExternalLink } from 'lucide-react';
 import { useTranslation } from 'react-i18next';

import { SubReportInstance, useStore, Report } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';

interface SubReportsSectionProps {
    currentReport: Report;
    subReportIds: string[] | undefined;
    onChange: (subReportIds: string[]) => void;
    readOnly: boolean;
    onOpen?: (srId: string) => void;
}

export default function SubReportsSection({ currentReport, subReportIds = [], onChange, readOnly, onOpen }: SubReportsSectionProps) {
    const { t } = useTranslation();
    const { subReportTemplates, subReportInstances, addSubReportInstance, deleteSubReportInstance } = useStore();

    const navigate = useNavigate();

    const handleApplyTemplate = (templateId: string) => {
        const template = subReportTemplates.find(t => t.id === templateId);
        if (!template) return;

        const newInstance: SubReportInstance = {
            id: `SR-${Date.now()}`,
            templateId: template.id,
            templateName: template.name,
            projectId: currentReport.projectId,
            parentReportId: currentReport.id,
            createdAt: new Date().toISOString(),
            state: 'Draft',
            values: {}
        };
        
        addSubReportInstance(newInstance);
        onChange([...subReportIds, newInstance.id]);
    };

    const handleRemove = (id: string) => {
        onChange(subReportIds.filter(val => val !== id));
        deleteSubReportInstance(id);
    };

    return (
        <div className="card-container">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <FileText className="text-brand-teal" size={20} /> {t('subreports_section.title')}
                </h2>

                {!readOnly && subReportTemplates?.length > 0 && (
                    <div className="relative flex-1 sm:flex-none">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            className="pl-9 pr-8 py-2 w-full sm:w-56 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer"
                            onChange={(e) => {
                                if (e.target.value) {
                                    handleApplyTemplate(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                            value=""
                        >
                            <option value="" disabled>{t('subreports_section.add_form')}</option>

                            {subReportTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {subReportIds.map((id) => {
                    const sr = subReportInstances.find(inst => inst.id === id);
                    if (!sr) return null;
                    const template = subReportTemplates?.find(t => t.id === sr.templateId);

                    return (
                        <div key={sr.id} className="border border-gray-100 rounded-2xl bg-gray-50 p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-brand-teal/10 text-brand-teal rounded-xl">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-accent-greyDark text-lg">{sr.templateName}</h3>
                                    <p className="text-sm text-gray-500 font-mono mt-0.5">ID: {sr.id} • {t('subreports_section.fields_count', { count: template?.fields.length || 0 })}</p>
                                </div>

                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={(e) => { 
                                        e.preventDefault(); 
                                        if (onOpen) onOpen(sr.id);
                                        else navigate(`/sub-reports/${sr.id}`); 
                                    }} 
                                    className="btn-primary hover:bg-brand-teal/90 text-sm py-2 px-4 flex items-center gap-2 rounded-xl h-10"
                                >
                                    <ExternalLink size={16} /> {t('subreports_section.open_form')}
                                </button>

                                {!readOnly && (
                                    <button 
                                        onClick={(e) => { e.preventDefault(); handleRemove(sr.id); }} 
                                        className="p-2 text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 rounded-lg transition-colors border border-gray-200 h-10 w-10 flex items-center justify-center"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {subReportIds.length === 0 && (
                    <div className="p-8 text-center text-gray-400 bg-surface-alt rounded-2xl border border-dashed border-gray-200 flex flex-col items-center">
                        <FileText size={32} className="mb-3 opacity-50 text-gray-400" />
                        <p className="text-sm font-medium">{t('subreports_section.no_forms')}</p>
                    </div>

                )}
            </div>
        </div>
    );
}
