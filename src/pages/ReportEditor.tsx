import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, ReportState } from '../store/useStore';
import { ChevronLeft, Camera, ShieldCheck, Lock, Save, Ban, MessageSquare, Plus, Trash2, PenTool, FileText, Wrench, MapPin } from 'lucide-react';
import gsap from 'gsap';
import OCRScanner from '../components/scanner/OCRScanner';
import WeatherWidget from '../components/weather/WeatherWidget';
import LaborSection from '../components/report/LaborSection';
import WBSProgressSection from '../components/report/WBSProgressSection';
import EquipmentDropdown from '../components/report/EquipmentDropdown';
import ToolDropdown from '../components/report/ToolDropdown';
import MediaGrid from '../components/report/MediaGrid';
import MultisignaturePad from '../components/report/MultisignaturePad';
import WorkSchedule from '../components/report/WorkSchedule';
import Occurrences from '../components/report/Occurrences';
import Checklists from '../components/report/Checklists';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PrintableReportTemplate } from '../components/reports/PrintableReportTemplate';

export default function ReportEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { reports, projects, updateReport, updateActivityProgress, userRole, addComment } = useStore();

    const report = reports.find(r => r.id === id);
    const project = projects.find(p => p.id === report?.projectId);
    const [notes, setNotes] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [weatherState, setWeatherState] = useState(report?.weather || null);
    const [locationState, setLocationState] = useState(report?.location || undefined);
    const [newComment, setNewComment] = useState('');

    // Complex state modules
    const [schedule, setSchedule] = useState(report?.schedule || { arrival: '', departure: '', shift: 'Morning' as const });
    const currentSignature = report?.signatures?.find(s => s.role === userRole) || null;
    const [labor, setLabor] = useState(report?.labor || []);
    const [media, setMedia] = useState(report?.media || []);
    const [checklists, setChecklists] = useState(report?.checklists || []);
    const [occurrences, setOccurrences] = useState(report?.occurrences || []);
    const [signatureBlob, setSignatureBlob] = useState(currentSignature?.blob || '');
    const [signatures, setSignatures] = useState(report?.signatures || []);
    const [usedTools, setUsedTools] = useState<string[]>(report?.usedTools || []);
    const [activityLogs, setActivityLogs] = useState(report?.activityLogs || []);

    // Custom Sections State
    const [sections, setSections] = useState<{ id: string, title: string, content: string }[]>([]);

    useEffect(() => {
        if (report) {
            setNotes(report.notes);
            setWeatherState(report.weather);
            setLocationState(report.location);
            setSections(report.customSections || []);
            setSchedule(report.schedule || { arrival: '', departure: '', shift: 'Morning' });
            setLabor(report.labor || []);
            setMedia(report.media || []);
            setOccurrences(report.occurrences || []);
            setChecklists(report.checklists || []);
            setSignatures(report.signatures || []);
            setUsedTools(report.usedTools || []);
            setActivityLogs(report.activityLogs || []);
            setSignatureBlob(report.signatures?.find(s => s.role === userRole)?.blob || '');
        }
    }, [report]);

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
            schedule,
            weather: weatherState || { temp: 0, condition: 'Unknown' },
            location: locationState,
            customSections: sections,
            labor,
            media,
            occurrences,
            checklists,
            signatures,
            usedTools,
            activityLogs
        });

        // Update project activity progress based on the logged activities
        if (project) {
            activityLogs.forEach(log => {
                if (log.scopeId && log.activityId && log.progressReported !== undefined) {
                    updateActivityProgress(project.id, log.scopeId, log.activityId, {
                        progress: log.progressReported,
                        status: log.progressReported === 100 ? 'Completed' : 'In Progress'
                    });
                }
            });
        }
    };

    const handleChangeState = (newState: ReportState) => {
        updateReport(report.id, { state: newState });
        navigate('/reports');
    };

    const handleScanComplete = (serial: string) => {
        const updatedEq = [...report.equipment, { serialNumber: serial, scanned: true, type: 'Identified Asset' }];
        updateReport(report.id, { equipment: updatedEq });
        setShowScanner(false);
    };

    const handleAddEquipmentDropdown = (type: string, serial: string) => {
        const updatedEq = [...report.equipment, { serialNumber: serial, scanned: false, type }];
        updateReport(report.id, { equipment: updatedEq });
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

    const handleSignatureSave = (role: 'Supervisor' | 'Management' | 'Customer', blob: string) => {
        const newSigs = [...signatures, {
            role,
            signedBy: (userRole === 'Tech' || userRole === 'Supervisor') ? 'Field Engineer' : userRole,
            timestamp: new Date().toISOString(),
            blob
        }];
        setSignatures(newSigs);
        updateReport(report.id, { signatures: newSigs });
    };

    const submitComment = () => {
        if (!newComment.trim()) return;
        addComment(report.id, newComment);
        setNewComment('');
    };

    return (
        <div className="space-y-6 pb-24 md:pb-10 max-w-4xl mx-auto">
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
                    </div>
                </div>

                {report.state === 'Closed' && (
                    <div className="flex items-center gap-2 text-status-error font-bold bg-status-error/10 px-4 py-2 rounded-xl">
                        <Lock size={18} /> Record Locked (Legal Validity)
                    </div>
                )}
            </div>



            <div className="editor-fade">
                {weatherState && <WeatherWidget weather={weatherState} reportDate={report.date} onChange={setWeatherState} readOnly={!canEditFields} />}
            </div>

            <div className="editor-fade">
                <WorkSchedule schedule={schedule} onChange={setSchedule} readOnly={!canEditFields} />
            </div>

            <div className="editor-fade">
                <LaborSection labor={labor} onChange={setLabor} readOnly={!canEditFields} currentReportId={report.id} currentDate={report.date} />
            </div>

            {project ? (
                <div className="editor-fade">
                    <WBSProgressSection 
                        project={project} 
                        readOnly={!canEditFields} 
                        activityLogs={activityLogs} 
                        onLogChange={handleActivityLogChange}
                    />
                </div>
            ) : null}

            <div className="editor-fade card-container">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-accent-greyDark">Equipment Telemetry & Log</h2>
                    {canEditFields && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <EquipmentDropdown onAdd={handleAddEquipmentDropdown} readOnly={!canEditFields} />
                            <div className="w-px h-10 bg-gray-200 hidden sm:block mx-1"></div>
                            <button
                                onClick={() => setShowScanner(true)}
                                className="btn-secondary flex items-center justify-center gap-2 text-sm py-2 px-4 shadow-sm"
                            >
                                <Camera size={16} /> Scan Plate
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-3 mb-6">
                    {report.equipment.length === 0 ? (
                        <div className="text-center p-6 bg-surface-alt rounded-2xl border border-dashed border-gray-300 text-gray-400">
                            No equipment scanned yet.
                        </div>
                    ) : (
                        report.equipment.map((eq, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-surface-alt rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="text-brand-teal" size={24} />
                                    <div>
                                        <p className="font-bold text-accent-greyDark">{eq.type}</p>
                                        <p className="font-mono text-xs text-gray-500">{eq.serialNumber}</p>
                                    </div>
                                </div>
                                {eq.scanned && (
                                    <span className="text-xs font-bold text-status-success bg-status-success/10 px-2 py-1 rounded-md">
                                        VERIFIED
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Field Notes & Observations</h3>
                        {canEditFields && (
                            <button
                                onClick={() => {
                                    if (navigator.geolocation) {
                                        navigator.geolocation.getCurrentPosition((position) => {
                                            setLocationState({ lat: position.coords.latitude, lng: position.coords.longitude });
                                        }, (error) => {
                                            alert("Unable to retrieve location: " + error.message);
                                        });
                                    } else {
                                        alert("Geolocation is not supported by this browser.");
                                    }
                                }}
                                className="text-xs font-bold flex items-center gap-1.5 text-brand-teal hover:underline"
                            >
                                <MapPin size={14} /> {locationState ? 'Update Location' : 'Capture Location'}
                            </button>
                        )}
                    </div>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={!canEditFields}
                        className="input-field min-h-[150px] resize-y text-base"
                        placeholder="Enter daily remarks, incidents, or completion notes..."
                    />
                </div>
            </div>

            <div className="editor-fade card-container">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                        <Wrench className="text-brand-teal" size={24} /> Tools Used
                    </h2>
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
                <Occurrences occurrences={occurrences} onChange={setOccurrences} readOnly={!canEditFields} />
            </div>

            <div className="editor-fade">
                <Checklists checklists={checklists} onChange={setChecklists} readOnly={!canEditFields} />
            </div>

            <div className="editor-fade">
                <MediaGrid media={media} onChange={setMedia} readOnly={!canEditFields} />
            </div>

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
                                    <span className="font-bold text-sm text-accent-greyDark">{c.userId} <span className="text-xs font-normal text-gray-500">({c.role})</span></span>
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
                        fileName={`LATNOVVA_Report_${report.id}.pdf`}
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
                {canEditFields ? (
                    <>
                        <button onClick={handleSave} className="w-full md:w-auto btn-secondary flex items-center justify-center gap-2">
                            <Save size={18} /> Save Draft
                        </button>
                        <div className="flex gap-2 w-full md:w-auto">
                            <PDFDownloadLink 
                                document={<PrintableReportTemplate report={report} />} 
                                fileName={`LATNOVVA_Report_Draft_${report.id}.pdf`}
                            >
                                {({ loading }) => (
                                    <button className="w-full btn-secondary text-brand-teal border-brand-teal/20 bg-brand-teal/5 hover:bg-brand-teal/10 flex items-center justify-center gap-2" disabled={loading}>
                                        <FileText size={18} /> {loading ? 'Gen...' : 'PDF'}
                                    </button>
                                )}
                            </PDFDownloadLink>
                            <button onClick={() => { 
                                if (!signatures.some(s => s.role === 'Supervisor')) {
                                    alert('A Tech or Supervisor signature is required before submitting the report for review.');
                                    return;
                                }
                                handleSave(); 
                                handleChangeState('Pending Manager Review'); 
                            }} className="w-full btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
                                Submit for Review
                            </button>
                        </div>
                    </>
                ) : isManager && report.state === 'Pending Manager Review' ? (
                    <>
                        <button onClick={() => handleChangeState('Draft')} className="w-full md:w-auto btn-secondary text-status-error hover:bg-red-50 hover:border-red-200 border-red-100 flex items-center justify-center gap-2">
                            <Ban size={18} /> Reject & Return to Draft
                        </button>
                        <button onClick={() => {
                            if (!signatures.some(s => s.role === 'Supervisor') || !signatures.some(s => s.role === 'Management')) {
                                alert('Both Tech/Supervisor and Management signatures are required before sending to the Customer.');
                                return;
                            }
                            handleChangeState('Pending Customer Review');
                            // Mock Email Notification
                            alert("Mock: Email sent via Resend to the Customer to review and approve the report.");
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
                            // Mocking Digital Signature Apply on Approved
                            const currentSigs = report.signatures || [];
                            updateReport(report.id, {
                                state: 'Approved',
                                signatures: [
                                    ...currentSigs.filter(s => s.role !== 'Customer'),
                                    { role: 'Customer', signedBy: 'Client Representative', timestamp: new Date().toISOString(), blob: signatureBlob }
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
                    <p className="text-sm text-gray-500 w-full text-center py-2">
                        Read-only mode. You do not have permissions to alter this report in its current state.
                    </p>
                )}
            </div>

            <div className="editor-fade mt-6 mb-10">
                <MultisignaturePad
                    onSave={handleSignatureSave}
                    readOnly={report.state === 'Closed' || report.state === 'Approved'}
                    existingSignatures={signatures}
                    userRole={userRole as any} // Ignoring type error as it wants Engineer but gets Tech/Supervisor
                />
            </div>

            {showScanner && <OCRScanner onCancel={() => setShowScanner(false)} onScanComplete={handleScanComplete} />}
        </div>
    );
}
