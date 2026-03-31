import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ChevronLeft, FileText, Camera, Trash2, ShieldCheck, Printer } from 'lucide-react';
import gsap from 'gsap';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PrintableSubReportTemplate } from '../components/reports/PrintableSubReportTemplate';

export default function SubReportEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { subReportInstances, subReportTemplates, reports, updateSubReportInstance, userRole } = useStore();

    const subReport = subReportInstances.find(sr => sr.id === id);
    const parentReport = reports.find(r => r.id === subReport?.parentReportId);
    const template = subReportTemplates.find(t => t.id === subReport?.templateId);

    const [values, setValues] = useState<Record<string, any>>(subReport?.values || {});

    useEffect(() => {
        if (subReport) {
            setValues(subReport.values);
        }
    }, [subReport]);

    useEffect(() => {
        gsap.fromTo('.editor-fade', { opacity: 0, y: 15 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' });
    }, []);

    if (!subReport || !parentReport) {
        return <div className="p-8 text-center text-gray-500">Form not found or parent report is missing.</div>;
    }

    // Access Controls inherited from parent report
    const isTech = userRole === 'Tech';
    const isSupervisor = userRole === 'Supervisor';
    const isManager = userRole === 'Manager';

    const canEditFields = parentReport.state === 'Draft' && (isTech || isSupervisor || isManager);

    const handleUpdateValue = (fieldId: string, val: any) => {
        const newValues = { ...values, [fieldId]: val };
        setValues(newValues);
        updateSubReportInstance(subReport.id, { values: newValues });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleUpdateValue(fieldId, reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-6 pb-24 md:pb-10 max-w-4xl mx-auto">
            <button onClick={() => navigate(`/reports/${parentReport.id}`)} className="flex items-center gap-2 text-brand-teal font-semibold hover:underline">
                <ChevronLeft size={20} /> Back to Master Report
            </button>

            <div className="editor-fade flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <FileText className="text-brand-teal" size={32} />
                        <h1 className="text-3xl font-bold text-accent-greyDark">{subReport.templateName}</h1>
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-gray-100 text-gray-600">
                            Attached Form
                        </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2">
                        <p className="text-gray-500 font-mono text-sm max-w-sm sm:max-w-none break-words">ID: {subReport.id}</p>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-teal bg-brand-teal/10 px-2 py-1 rounded-md">
                            Linked: {parentReport.projectName}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <PDFDownloadLink
                        document={<PrintableSubReportTemplate subReport={subReport} />}
                        fileName={`Form_${subReport.templateName.replace(/\s+/g, '_')}_${subReport.id}.pdf`}
                    >
                        {/* @ts-ignore */}
                        {({ loading }) => (
                            <button className="btn-secondary py-2 px-4 text-sm flex items-center gap-2 shadow-sm whitespace-nowrap" disabled={loading}>
                                <Printer size={16} /> {loading ? 'Preparing PDF...' : 'Export Form PDF'}
                            </button>
                        )}
                    </PDFDownloadLink>
                </div>
            </div>

            <div className="editor-fade card-container">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                        <ShieldCheck className="text-brand-teal" size={24} /> Form Details
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {!template ? (
                        <div className="col-span-full p-4 text-center text-status-warning bg-status-warning/10 rounded-xl">
                            The template for this sub-report is no longer available. Data is isolated.
                        </div>
                    ) : (
                        template.fields.map(field => (
                            <div key={field.id} className="space-y-3">
                                <label className="text-sm font-bold text-accent-greyDark block">{field.name}</label>
                                
                                {field.type === 'text' && (
                                    <input
                                        type="text"
                                        value={values[field.id] || ''}
                                        onChange={(e) => handleUpdateValue(field.id, e.target.value)}
                                        disabled={!canEditFields}
                                        className="w-full input-field border-gray-200"
                                        placeholder="Enter value..."
                                    />
                                )}
                                {field.type === 'number' && (
                                    <input
                                        type="number"
                                        value={values[field.id] || ''}
                                        onChange={(e) => handleUpdateValue(field.id, e.target.value)}
                                        disabled={!canEditFields}
                                        className="w-full input-field border-gray-200"
                                        placeholder="Enter number..."
                                    />
                                )}
                                {field.type === 'checkbox' && (
                                    <div className="flex gap-2 items-center h-12">
                                        {(['Pass', 'Fail', 'N/A'] as const).map(opt => (
                                            <button
                                                key={opt}
                                                disabled={!canEditFields}
                                                onClick={() => handleUpdateValue(field.id, opt)}
                                                className={`px-5 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                                                    values[field.id] === opt 
                                                    ? opt === 'Pass' ? 'bg-status-success text-white border-status-success' : opt === 'Fail' ? 'bg-status-error text-white border-status-error' : 'bg-gray-500 text-white border-gray-500'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {field.type === 'picture' && (
                                    <div className="mt-1">
                                        {values[field.id] ? (
                                            <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                                                <img src={values[field.id]} alt={field.name} className="w-full h-full object-contain" />
                                                {canEditFields && (
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                        <label className="cursor-pointer bg-white text-accent-greyDark p-2 rounded-full hover:scale-110 transition-transform">
                                                            <Camera size={20} />
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, field.id)} />
                                                        </label>
                                                        <button 
                                                            onClick={() => handleUpdateValue(field.id, '')}
                                                            className="bg-red-500 text-white p-2 rounded-full hover:scale-110 transition-transform"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <label className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors ${!canEditFields ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-brand-teal hover:bg-brand-teal/5 bg-gray-50 cursor-pointer'}`}>
                                                <Camera size={32} className="text-gray-400 mb-3" />
                                                <span className="text-sm font-medium text-gray-500 text-center">Click to Upload {field.name} Picture</span>
                                                <input type="file" accept="image/*" className="hidden" disabled={!canEditFields} onChange={(e) => handleImageUpload(e, field.id)} />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {!canEditFields && (
                <div className="text-center text-sm font-bold text-status-warning bg-orange-50 p-4 rounded-xl border border-warning/20">
                    Editing is disabled because the Parent Daily Report is no longer in Draft state.
                </div>
            )}
        </div>
    );
}
