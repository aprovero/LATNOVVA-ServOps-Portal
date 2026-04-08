import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, ReportState, ChecklistGroup } from '../store/useStore';
import { ChevronLeft, Lock, Save, Ban, MessageSquare, Plus, Trash2, PenTool, FileText, Wrench, MapPin, FilePlus, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import gsap from 'gsap';

import WeatherWidget from '../components/weather/WeatherWidget';
import LaborSection from '../components/report/LaborSection';
import WBSProgressSection from '../components/report/WBSProgressSection';
import ToolDropdown from '../components/report/ToolDropdown';
import MediaGrid from '../components/report/MediaGrid';
import MultisignaturePad, { SignatureCanvasBox } from '../components/report/MultisignaturePad';
import Occurrences from '../components/report/Occurrences';
import Checklists from '../components/report/Checklists';
import SubReportsSection from '../components/report/SubReportsSection';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PrintableReportTemplate } from '../components/reports/PrintableReportTemplate';
import SectionCommentBubble from '../components/report/SectionCommentBubble';

// In-app notification toast state (M-01)
let _toastTimeout: ReturnType<typeof setTimeout> | null = null;

export default function ReportEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { reports, projects, personnel, timesheets, updateReport, updateActivityProgress, userRole, addComment, getCurrentUserName, addTimesheet } = useStore();

    // M-07: Timesheet batch-create state
    const [showTimesheetCreator, setShowTimesheetCreator] = useState(false);
    const [batchTsSignature, setBatchTsSignature] = useState('');
    const [batchTsSignerName, setBatchTsSignerName] = useState('');

    // In-app notification toast (M-01)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
    const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
        setToast({ message, type });
        if (_toastTimeout) clearTimeout(_toastTimeout);
        _toastTimeout = setTimeout(() => setToast(null), 4500);
    };

    const report = reports.find(r => r.id === id);
    const project = projects.find(p => p.id === report?.projectId);
    const [notes, setNotes] = useState('');

    const [weatherState, setWeatherState] = useState(report?.weather || null);
    const [locationState, setLocationState] = useState(report?.location || undefined);
    const [newComment, setNewComment] = useState('');

    // M-03: Auto-populate labor from project.assignedPersonnel, using GPS clock-in data if available
    const buildDefaultLabor = () => {
        if (!project?.assignedPersonnel?.length) return [];
        const reportDate = report?.date;
        return project.assignedPersonnel.map((persId, idx) => {
            const person = personnel.find(p => p.id === persId);
            // Look for a GPS-verified punch for this person on this report date
            const clockEntry = reportDate
                ? timesheets.find(t => t.personnelId === persId && t.date === reportDate)
                : null;
            const hasClockIn = !!clockEntry?.timeIn;
            return {
                id: `l-auto-${Date.now()}-${idx}`,
                personnelId: persId,
                role: person?.position || 'Technician',
                qty: 1,
                timeIn: clockEntry?.timeIn || '08:00',
                timeOut: clockEntry?.timeOut || '17:00',
                type: 'On Site' as const,
                hours: clockEntry?.hours || 9,
                isOutsourced: false,
                _autoFilledFromGPS: hasClockIn,
            };
        });
    };

    const [labor, setLabor] = useState(() => {
        const existing = report?.labor || [];
        if (existing.length > 0) return existing;
        return buildDefaultLabor();
    });
    const [media, setMedia] = useState(report?.media || []);
    const [checklists, setChecklists] = useState<ChecklistGroup[]>(report?.checklists || []);
    const [subReportIds, setSubReportIds] = useState<string[]>(report?.subReportIds || []);
    const [occurrences, setOccurrences] = useState(report?.occurrences || []);
    const currentSignature = report?.signatures?.find(s => s.role === userRole) || null;
    const [signatureBlob, setSignatureBlob] = useState(currentSignature?.blob || '');
    const [signatures, setSignatures] = useState(report?.signatures || []);
    const [usedTools, setUsedTools] = useState<string[]>(report?.usedTools || []);
    const [activityLogs, setActivityLogs] = useState(report?.activityLogs || []);
    const [discipline, setDiscipline] = useState(report?.discipline || (project?.disciplines?.length === 1 ? project.disciplines[0] : ''));

    // Custom Sections State
    const [sections, setSections] = useState<{ id: string, title: string, content: string }[]>([]);

    useEffect(() => {
        if (report) {
            setNotes(report.notes);
            setWeatherState(report.weather);
            setLocationState(report.location);
            setSections(report.customSections || []);
            setLabor(report.labor || []);
            setMedia(report.media || []);
            setOccurrences(report.occurrences || []);
            setChecklists(report.checklists || []);
            setSubReportIds(report.subReportIds || []);
            setSignatures(report.signatures || []);
            setUsedTools(report.usedTools || []);
            setActivityLogs(report.activityLogs || []);
            setDiscipline(report.discipline || (project?.disciplines?.length === 1 ? project.disciplines[0] : ''));
            setSignatureBlob(report.signatures?.find(s => s.role === userRole)?.blob || '');
        }
    }, [report]);

    // M-01: Dirty-state guard — warn on accidental browser close/refresh
    // Note: canEditFields is derived after the early return, so we re-derive inline here
    useEffect(() => {
        const isDraft = report?.state === 'Draft';
        const isEditable = isDraft && ['Tech', 'Supervisor', 'Manager'].includes(userRole);
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isEditable) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [report?.state, userRole]);

    useEffect(() => {
        gsap.fromTo('.editor-fade', { opacity: 0, y: 15 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' });
    }, []);

    if (!report) {
        return <div className="p-8 text-center text-gray-500">Report not found.</div>;
    }

    // Access Controls
    const isTech = userRole === 'Tech';
    const isSupervisor = userRole === 'Supervisor';
    const isManager = userRole === 'Manager';
    const isCustomer = userRole === 'Customer';

    const canEditFields = report.state === 'Draft' && (isTech || isSupervisor || isManager);

    const handleSave = () => {
        updateReport(report.id, {
            notes,
            weather: weatherState || { temp: 0, condition: 'Unknown' },
            location: locationState,
            customSections: sections,
            labor,
            media,
            occurrences,
            checklists,
            subReportIds,
            signatures,
            usedTools,
            activityLogs,
            discipline,
            externalAttachments: (report as any).externalAttachments || []
        });

        // Update project activity progress based on the logged activities
        if (project) {
            activityLogs.forEach(log => {
                if (log.scopeId && log.activityId && log.progressReported !== undefined) {
                    const newTotal = (log.priorProgress || 0) + log.progressReported;
                    updateActivityProgress(project.id, log.scopeId, log.activityId, {
                        progress: Math.min(newTotal, 100),
                        status: newTotal >= 100 ? 'Completed' : 'In Progress'
                    });
                }
            });
        }
    };

    const handleChangeState = (newState: ReportState) => {
        updateReport(report.id, { state: newState });
        navigate('/reports');
    };



    const handleActivityLogChange = (logs: any[]) => {
        if (!canEditFields) return;
        setActivityLogs(logs);
    };

    const handleAddSection = () => {
        setSections([...sections, { id: `sec-${Date.now()}`, title: 'New Custom Section', content: '' }]);
    };

    const handleUpdateSection = (idx: number, field: 'title' | 'content', val: string) => {
        const newSecs = [...sections];
        newSecs[idx] = { ...newSecs[idx], [field]: val };
        setSections(newSecs);
    };

    const handleDeleteSection = (idx: number) => {
        setSections(sections.filter((_, i) => i !== idx));
    };

    // M-06: use real user name + L-04: deduplicate by role
    const handleSignatureSave = (role: 'Supervisor' | 'Management' | 'Customer', blob: string) => {
        const newSigs = [
            ...signatures.filter(s => s.role !== role), // deduplicate
            {
                role,
                signedBy: getCurrentUserName(), // M-06: real name
                timestamp: new Date().toISOString(),
                blob
            }
        ];
        setSignatures(newSigs);
        updateReport(report.id, { signatures: newSigs });
    };

    // H-03: section-scoped comment submission
    const submitComment = () => {
        if (!newComment.trim()) return;
        addComment(report.id, newComment);
        setNewComment('');
    };

    // H-03: scoped comment from a section bubble
    const submitSectionComment = (text: string, sectionKey: string) => {
        if (!text.trim()) return;
        addComment(report.id, text, sectionKey);
    };

    return (
        <div className="space-y-6 pb-24 md:pb-10 max-w-4xl mx-auto">
            {/* In-App Notification Toast (M-01) */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-white font-semibold text-sm animate-in slide-in-from-top-4 fade-in duration-300 ${
                    toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
                    toast.type === 'warning' ? 'bg-amber-500 border-amber-400' : 'bg-brand-teal border-teal-400'
                }`}>
                    <CheckCircle size={18} className="shrink-0" />
                    {toast.message}
                </div>
            )}
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-brand-teal font-semibold hover:underline">
                <ChevronLeft size={20} /> Back to List
            </button>

            <div className="editor-fade flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-accent-greyDark">{report.projectName}</h1>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest
                ${report.state === 'Draft' ? 'bg-status-warning/10 text-status-warning' :
                                report.state.includes('Review') || report.state === 'Approved' ? 'bg-brand-teal/10 text-brand-teal' :
                                    'bg-status-success/10 text-status-success'}`}>
                            {report.state}
                        </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-1">
                        <p className="text-gray-500 font-mono text-sm">ID: {report.id} • Date: {report.date}</p>
                        {locationState && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-teal bg-brand-teal/10 px-2 py-1 rounded-md">
                                <MapPin size={12} />
                                {locationState.lat.toFixed(6)}, {locationState.lng.toFixed(6)}
                            </div>
                        )}
                        {project?.disciplines && project.disciplines.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Work Stream:</span>
                                <select 
                                    className="bg-brand-teal/5 border border-brand-teal/20 text-xs font-bold text-brand-teal rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand-teal h-7"
                                    value={discipline}
                                    onChange={(e) => setDiscipline(e.target.value)}
                                    disabled={!canEditFields}
                                >
                                    <option value="">Select Stream...</option>
                                    {project.disciplines.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {report.state === 'Closed' && (
                    <div className="flex items-center gap-2 text-status-error font-bold bg-status-error/10 px-4 py-2 rounded-xl">
                        <Lock size={18} /> Record Locked (Legal Validity)
                    </div>
                )}
            </div>

            {/* L-07: Rejection reason banner — shown when Draft has rejection comments */}
            {report.state === 'Draft' && (() => {
                const rejectionComments = (report.comments || []).filter((c: any) => c.sectionKey === 'rejection');
                if (!rejectionComments.length) return null;
                return (
                    <div className="editor-fade flex flex-col gap-2 p-4 bg-red-50 border-l-4 border-red-500 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-600 shrink-0" />
                            <span className="text-sm font-bold text-red-800 uppercase tracking-wide">Report Returned — Manager Feedback</span>
                        </div>
                        <div className="space-y-2 pl-6">
                            {rejectionComments.map((c: any, i: number) => (
                                <div key={i} className="text-sm text-red-700">
                                    <span className="font-semibold">{c.text.replace('[REJECTED] ', '')}</span>
                                    <span className="text-red-400 text-xs ml-2">
                                        &mdash; {new Date(c.timestamp).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-red-400 pl-6">Address the feedback above before resubmitting for review.</p>
                    </div>
                );
            })()}

            <div className="editor-fade">
                {weatherState && <WeatherWidget weather={weatherState} reportDate={report.date} projectLocation={project?.location} onChange={setWeatherState} readOnly={!canEditFields} />}
            </div>

            {/* M-07: Timesheet validation banner */}
            {(() => {
                if (!project?.assignedPersonnel?.length || !report.date) return null;
                const missing = project.assignedPersonnel.filter(pid =>
                    !timesheets.find(t => t.personnelId === pid && t.date === report.date)
                );
                if (!missing.length) return null;
                return (
                    <div className="editor-fade mx-0">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-amber-800">
                                    {missing.length} assigned personnel have no timesheet for {report.date}.
                                </p>
                                <p className="text-xs text-amber-600 mt-0.5">
                                    GPS clock-in records will be used if available. Otherwise manual entries will be created.
                                </p>
                            </div>
                            {(isSupervisor || isManager) && !showTimesheetCreator && (
                                <button
                                    onClick={() => setShowTimesheetCreator(true)}
                                    className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors"
                                >
                                    <Users size={14} /> Batch Create Timesheets
                                </button>
                            )}
                        </div>
                        {showTimesheetCreator && (
                            <div className="mt-3 p-4 bg-white border border-amber-200 rounded-2xl space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Authorize Timesheet Creation</p>
                                <p className="text-xs text-gray-500">Sign below to confirm these records are accurate. Both a name and signature are required.</p>
                                <input
                                    type="text"
                                    value={batchTsSignerName}
                                    onChange={e => setBatchTsSignerName(e.target.value)}
                                    placeholder="Your full name"
                                    className="input-field w-full text-sm"
                                />
                                {/* C-03: Signature canvas — blob required before confirming */}
                                <div className="h-28 border border-dashed border-amber-300 rounded-xl overflow-hidden bg-white">
                                    <SignatureCanvasBox onSign={(blob) => setBatchTsSignature(blob)} />
                                </div>
                                {batchTsSignature && (
                                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle size={10} /> Signature captured
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        disabled={!batchTsSignerName.trim() || !batchTsSignature}
                                        onClick={() => {
                                            const today = report.date;
                                            const userName = batchTsSignerName || getCurrentUserName();
                                            missing.forEach(pid => {
                                                const gpsEntry = timesheets.find(t => t.personnelId === pid && t.date === today);
                                                addTimesheet({
                                                    id: `TS-RPT-${Date.now()}-${pid}`,
                                                    personnelId: pid,
                                                    date: today,
                                                    timeIn: gpsEntry?.timeIn || labor.find(l => l.personnelId === pid)?.timeIn || '08:00',
                                                    timeOut: gpsEntry?.timeOut || labor.find(l => l.personnelId === pid)?.timeOut || '17:00',
                                                    hours: gpsEntry?.hours || labor.find(l => l.personnelId === pid)?.hours || 9,
                                                    type: 'On Site',
                                                    classification: 'Regular',
                                                    projectId: report.projectId,
                                                    status: 'Pending',
                                                    gpsVerified: !!gpsEntry,
                                                    source: gpsEntry ? 'gps' : 'manual',
                                                    manualReason: gpsEntry ? undefined : `Created from Report ${report.id} by ${userName}`,
                                                    signature: { name: userName, timestamp: new Date().toISOString(), blob: batchTsSignature }
                                                } as any);
                                            });
                                            setShowTimesheetCreator(false);
                                            setBatchTsSignature('');
                                            setBatchTsSignerName('');
                                            showToast(`${missing.length} timesheets created.`, 'success');
                                        }}
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors"
                                    >
                                        Confirm &amp; Create
                                    </button>
                                    <button onClick={() => { setShowTimesheetCreator(false); setBatchTsSignature(''); }} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            <div className="editor-fade">
                <LaborSection 
                    labor={labor} 
                    onChange={setLabor} 
                    readOnly={!canEditFields} 
                    currentReportId={report.id} 
                    currentDate={report.date} 
                    discipline={discipline}
                />
            </div>

            {project ? (
                <div className="editor-fade">
                    <WBSProgressSection 
                        project={project} 
                        readOnly={!canEditFields} 
                        activityLogs={activityLogs} 
                        onLogChange={handleActivityLogChange}
                        discipline={discipline}
                    />
                </div>
            ) : null}


            <div className="editor-fade card-container">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Field Notes & Observations</h3>
                        <SectionCommentBubble
                            sectionKey="notes"
                            sectionLabel="Field Notes"
                            comments={report.comments || []}
                            onAdd={submitSectionComment}
                            canComment={isManager || isSupervisor || isCustomer}
                        />
                    </div>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={!canEditFields}
                        className="input-field min-h-[150px] resize-y text-base"
                        placeholder="Enter daily remarks, incidents, or completion notes..."
                    />
                </div>


            <div className="editor-fade card-container">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                        <Wrench className="text-brand-teal" size={24} /> Equipment &amp; Tools Used
                    </h2>
                    <div className="flex items-center gap-3">
                        {/* H-05: Scoped comment bubble on Equipment */}
                        <SectionCommentBubble
                            sectionKey="equipment"
                            sectionLabel="Equipment & Tools"
                            comments={report.comments || []}
                            onAdd={submitSectionComment}
                            canComment={isManager || isSupervisor}
                        />
                        {canEditFields && (
                            <ToolDropdown
                                onAdd={(toolId) => setUsedTools([...usedTools, toolId])}
                                readOnly={!canEditFields}
                                alreadyAssigned={usedTools}
                                currentReportId={report.id}
                                currentDate={report.date}
                            />
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {usedTools.length === 0 ? (
                        <div className="text-center p-6 bg-surface-alt rounded-2xl border border-dashed border-gray-300 text-gray-400">
                            No tools selected.
                        </div>
                    ) : (
                        usedTools.map(toolId => {
                            const tool = useStore.getState().tools.find(t => t.id === toolId);
                            if (!tool) return null;
                            const isExpired = new Date(tool.certificationExpiry) < new Date();
                            if (userRole === 'Customer' && isExpired) return null;
                            return (
                                <div key={tool.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-alt rounded-2xl border border-gray-100 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="font-bold text-accent-greyDark">{tool.name} <span className="text-sm font-normal text-gray-500">({tool.model})</span></p>
                                        <p className="font-mono text-xs text-brand-teal">SN: {tool.serialNumber}</p>
                                        {isExpired && (
                                            <div className="text-xs font-bold text-status-warning mt-1 bg-orange-50 px-2 py-1 rounded-md border border-orange-100 inline-block w-fit">
                                                ⚠️ Certification Expired On: {new Date(tool.certificationExpiry).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    {canEditFields && (
                                        <button
                                            onClick={() => setUsedTools(usedTools.filter(id => id !== tool.id))}
                                            className="p-2 w-fit bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors shrink-0"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="editor-fade">
                {/* H-05: Scoped comment bubble on Occurrences */}
                <div className="flex items-center justify-between mb-2">
                    <span />
                    <SectionCommentBubble
                        sectionKey="occurrences"
                        sectionLabel="Field Issues & Occurrences"
                        comments={report.comments || []}
                        onAdd={submitSectionComment}
                        canComment={isManager || isSupervisor}
                    />
                </div>
                <Occurrences occurrences={occurrences} onChange={setOccurrences} readOnly={!canEditFields} />
            </div>

            <div className="editor-fade">
                {/* H-05: Scoped comment bubble on Checklists */}
                <div className="flex items-center justify-between mb-2">
                    <span />
                    <SectionCommentBubble
                        sectionKey="checklists"
                        sectionLabel="Safety Checklists"
                        comments={report.comments || []}
                        onAdd={submitSectionComment}
                        canComment={isManager || isSupervisor}
                    />
                </div>
                <Checklists checklists={checklists} onChange={setChecklists} readOnly={!canEditFields} />
            </div>

            <div className="editor-fade">
                <SubReportsSection currentReport={report} subReportIds={subReportIds} onChange={setSubReportIds} readOnly={!canEditFields} onOpen={(srId) => { handleSave(); navigate(`/sub-reports/${srId}`); }} />
            </div>

            <div className="editor-fade">
                <MediaGrid media={media} onChange={setMedia} readOnly={!canEditFields} report={report} />
            </div>

            {/* External / Managed Attachments */}
            {(isManager || isSupervisor || (report as any).externalAttachments?.length > 0) && (
                <div className="editor-fade card-container">
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                        <FilePlus size={24} className="text-brand-teal" /> Supporting Documents
                    </h2>
                    <div className="space-y-3">
                        {((report as any).externalAttachments || []).map((att: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                        <FileText size={20} className="text-brand-teal" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-accent-greyDark text-sm">{att.name}</p>
                                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{att.type} • {att.size}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a href={att.url} target="_blank" rel="noreferrer" className="btn-secondary h-9 px-3 text-xs bg-white">View</a>
                                    {(isManager || isSupervisor) && report.state !== 'Closed' && (
                                        <button 
                                            onClick={() => {
                                                const newAtts = (report as any).externalAttachments.filter((_: any, i: number) => i !== idx);
                                                updateReport(report.id, { externalAttachments: newAtts } as any);
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-red-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {(isManager || isSupervisor) && report.state !== 'Closed' && (
                            <div className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                <FilePlus size={32} className="text-gray-300" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-accent-greyDark">Upload Reference File</p>
                                    <p className="text-xs text-gray-400">Attach PDFs, site photos, or client check-ins.</p>
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    id="ext-att-upload" 
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                const newAtt = {
                                                    name: file.name,
                                                    type: file.type,
                                                    size: `${(file.size / 1024).toFixed(1)} KB`,
                                                    url: reader.result as string
                                                };
                                                const currentAtts = (report as any).externalAttachments || [];
                                                updateReport(report.id, { externalAttachments: [...currentAtts, newAtt] } as any);
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                                <label htmlFor="ext-att-upload" className="btn-primary h-10 px-6 text-sm cursor-pointer whitespace-nowrap">Choose File</label>
                            </div>
                        )}
                        {(!(report as any).externalAttachments?.length && !isManager && !isSupervisor) && (
                            <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No supporting documents attached.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Dynamic Report Builder */}
            <div className="editor-fade card-container">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                        <Plus size={20} className="text-brand-teal" /> Dynamic Sections
                    </h2>
                    {canEditFields && (
                        <button onClick={handleAddSection} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
                            <Plus size={16} /> Add Custom Module
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {sections.map((sec, idx) => (
                        <div key={sec.id} className="p-4 bg-surface-alt rounded-2xl border border-gray-100 relative">
                            {canEditFields && (
                                <button onClick={() => handleDeleteSection(idx)} className="absolute top-4 right-4 text-gray-400 hover:text-status-error transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <input
                                type="text"
                                value={sec.title}
                                onChange={(e) => handleUpdateSection(idx, 'title', e.target.value)}
                                disabled={!canEditFields}
                                className="w-full bg-transparent border-none font-bold text-accent-greyDark text-lg mb-2 outline-none focus:ring-0 px-0"
                                placeholder="Section Title (e.g. Daily Safety Talk)"
                            />
                            <textarea
                                value={sec.content}
                                onChange={(e) => handleUpdateSection(idx, 'content', e.target.value)}
                                disabled={!canEditFields}
                                className="input-field min-h-[100px] w-full"
                                placeholder="Section contents..."
                            />
                        </div>
                    ))}
                    {sections.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No custom modules added. Use this to attach specific technical parameters or daily talks.</p>
                    )}
                </div>
            </div>

            {/* Collaboration / Review Comments */}
            {(report.state.includes('Review') || report.state === 'Approved' || report.state === 'Closed' || report.comments?.length > 0) && (
                <div className="editor-fade card-container bg-blue-50/50 border-blue-100">
                    <h2 className="text-xl font-bold text-accent-greyDark mb-6 flex items-center gap-2">
                        <MessageSquare size={20} className="text-blue-500" /> Technical Review Comments
                    </h2>

                    <div className="space-y-4 mb-4">
                        {report.comments?.map(c => (
                            <div key={c.id} className={`p-4 rounded-2xl ${c.role === 'Customer' ? 'bg-white border border-gray-100 ml-4' : 'bg-blue-100/50 mr-4'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    {/* L-03: resolve user id to display name */}
                                    <span className="font-bold text-sm text-accent-greyDark">
                                        {personnel.find(p => p.id === c.userId)?.name || c.userId}
                                        <span className="text-xs font-normal text-gray-500 ml-1">({c.role})</span>
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">{new Date(c.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm text-accent-grey">{c.text}</p>
                            </div>
                        ))}
                        {(!report.comments || report.comments.length === 0) && <p className="text-sm text-gray-500 text-center py-4">No comments yet.</p>}
                    </div>

                    {(report.state.includes('Review') && (isManager || isCustomer)) && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Add annotative comment..."
                                className="input-field flex-1"
                                onKeyDown={e => e.key === 'Enter' && submitComment()}
                            />
                            <button onClick={submitComment} className="btn-primary py-2 px-4 rounded-xl">Post</button>
                        </div>
                    )}
                </div>
            )}

            {/* Cryptographic Signature lock */}
            {report.state === 'Closed' && report.signatures && report.signatures.length > 0 && (
                <div className="editor-fade p-6 rounded-3xl bg-gray-900 text-white flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                            <PenTool size={24} className="text-green-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">Cryptographically Sealed</h3>
                            <div className="text-sm text-gray-400 mt-1 space-y-1">
                                {report.signatures.map(sig => (
                                    <div key={sig.role} className="flex gap-2 items-center">
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono">{sig.role}</span>
                                        <span>{sig.signedBy} • {new Date(sig.timestamp).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <PDFDownloadLink 
                        document={<PrintableReportTemplate report={report} />} 
                        fileName={`${project?.codeName ? `${project.codeName.replace(/\s+/g, '_')}_` : ''}LATNOVVA_Report_${report.id}.pdf`}
                    >
                        {({ loading }) => (
                            <button className="bg-white/10 hover:bg-white/20 text-white py-2 px-6 rounded-xl font-semibold transition-colors flex items-center gap-2" disabled={loading}>
                                <FileText size={16} /> {loading ? 'Generating...' : 'Print PDF'}
                            </button>
                        )}
                    </PDFDownloadLink>
                </div>
            )}

            {/* Workflow Controls */}
            <div className="editor-fade card-container bg-surface flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <PDFDownloadLink 
                        document={<PrintableReportTemplate report={report} />} 
                        fileName={`${project?.codeName ? `${project.codeName.replace(/\s+/g, '_')}_` : ''}LATNOVVA_Report_${report.state.replace(/\s+/g, '_')}_${report.id}.pdf`}
                    >
                        {({ loading }) => (
                            <button className="w-full md:w-auto btn-secondary text-brand-teal border-brand-teal/20 bg-brand-teal/5 hover:bg-brand-teal/10 flex items-center justify-center gap-2" disabled={loading}>
                                <FileText size={18} /> {loading ? 'Generating PDF...' : 'Download PDF'}
                            </button>
                        )}
                    </PDFDownloadLink>
                    {canEditFields && (
                        <button onClick={handleSave} className="w-full md:w-auto btn-secondary flex items-center justify-center gap-2">
                            <Save size={18} /> Save Draft
                        </button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto justify-end items-center">
                    {canEditFields ? (
                        <button onClick={() => { 
                            if (isManager) {
                                // Manager bypass: auto-add 'Approved by Manager' to supervisor slot if needed
                                if (!signatures.some(s => s.role === 'Supervisor')) {
                                    const currentUserName = getCurrentUserName();
                                    const managerSig = {
                                        role: 'Supervisor' as const,
                                        signedBy: `Approved by Manager: ${currentUserName}`,
                                        timestamp: new Date().toISOString(),
                                        blob: ''
                                    };
                                    const updatedSigs = [...signatures, managerSig];
                                    setSignatures(updatedSigs);
                                    updateReport(report.id, { signatures: updatedSigs });
                                }
                                handleSave();
                                handleChangeState('Pending Manager Review');
                            } else {
                                if (!signatures.some(s => s.role === 'Supervisor')) {
                                    alert('A Tech or Supervisor signature is required before submitting the report for review.');
                                    return;
                                }
                                handleSave();
                                handleChangeState('Pending Manager Review');
                            }
                        }} className="w-full md:w-auto btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
                            Submit for Review
                        </button>
                    ) : isManager && report.state === 'Pending Manager Review' ? (
                        <>
                            <button onClick={() => {
                                // M-04: Prompt for rejection reason, store as a scoped comment
                                const reason = prompt('Optional: Enter a reason for returning this report to Draft. This will be visible to the field team.') ?? '';
                                if (reason.trim()) {
                                    addComment(report.id, `[REJECTED] ${reason.trim()}`, 'rejection');
                                }
                                handleChangeState('Draft');
                                showToast('Report returned to Draft.', 'warning');
                            }} className="w-full md:w-auto btn-secondary text-status-error hover:bg-red-50 hover:border-red-200 border-red-100 flex items-center justify-center gap-2">
                                <Ban size={18} /> Reject &amp; Return to Draft
                            </button>
                            <button onClick={() => {
                                // Manager bypass: if no Supervisor sig, auto-add 'Approved by Manager' comment to sig trail
                                if (!signatures.some(s => s.role === 'Supervisor')) {
                                    const currentUserName = getCurrentUserName();
                                    const managerSig = {
                                        role: 'Supervisor' as const,
                                        signedBy: `Approved by Manager: ${currentUserName}`,
                                        timestamp: new Date().toISOString(),
                                        blob: ''
                                    };
                                    const updatedSigs = [...signatures, managerSig];
                                    setSignatures(updatedSigs);
                                    updateReport(report.id, { signatures: updatedSigs });
                                }
                                // H-06: Save report content before state change
                                handleSave();
                                handleChangeState('Pending Customer Review');
                                showToast('Report sent to Customer for approval.', 'success');
                            }} className="w-full md:w-auto btn-primary bg-status-success hover:bg-green-700 shadow-status-success/20 flex items-center justify-center gap-2">
                                <Lock size={18} /> Approve & Send to Customer
                            </button>
                        </>
                    ) : isCustomer && report.state === 'Pending Customer Review' ? (
                         <>
                            <button onClick={() => handleChangeState('Pending Manager Review')} className="w-full md:w-auto btn-secondary text-status-error hover:bg-red-50 hover:border-red-200 border-red-100 flex items-center justify-center gap-2">
                                <Ban size={18} /> Reject
                            </button>
                            <button onClick={() => {
                                // C-01: use real user identity — not hardcoded string
                                const currentSigs = report.signatures || [];
                                const customerName = getCurrentUserName();
                                updateReport(report.id, {
                                    state: 'Approved',
                                    signatures: [
                                        ...currentSigs.filter(s => s.role !== 'Customer'),
                                        { role: 'Customer', signedBy: customerName, timestamp: new Date().toISOString(), blob: signatureBlob }
                                    ]
                                });
                                navigate('/reports');
                            }} className="w-full md:w-auto btn-primary bg-brand-teal hover:bg-brand-teal/90 shadow-sm flex items-center justify-center gap-2">
                                <Lock size={18} /> Approve Report
                            </button>
                        </>
                    ) : isManager && report.state === 'Approved' ? (
                         <>
                            <button onClick={() => {
                                handleChangeState('Closed');
                            }} className="w-full md:w-auto btn-primary bg-gray-900 hover:bg-black shadow-sm flex items-center justify-center gap-2">
                                <Lock size={18} /> Close & Seal Report
                            </button>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500 w-full text-right py-2">
                            Read-only workflow mode.
                        </p>
                    )}
                </div>
            </div>

            <div className="editor-fade mt-6 mb-10">
                <MultisignaturePad
                    onSave={handleSignatureSave}
                    readOnly={report.state === 'Closed' || report.state === 'Approved'}
                    existingSignatures={signatures}
                    userRole={userRole as any} // Ignoring type error as it wants Engineer but gets Tech/Supervisor
                />
            </div>
        </div>
    );
}
