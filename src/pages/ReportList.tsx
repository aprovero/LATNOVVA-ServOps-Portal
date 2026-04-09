import { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Search, FileSpreadsheet, Filter, ChevronDown, Plus, ArrowRight, Clock, Calendar, Link2, AlertCircle, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

type ReportEntry = {
    type: 'Daily' | 'Form';
    id: string;
    projectId: string;
    clientId: string | undefined;
    projectName: string;
    templateName?: string;
    date: string;
    state: string;
    isOverdue: boolean;
};

const STATE_STYLES: Record<string, string> = {
    'Draft': 'bg-amber-50 text-amber-600 border-amber-200',
    'Pending Manager Review': 'bg-brand-teal/10 text-brand-teal border-brand-teal/20',
    'Pending Customer Review': 'bg-blue-50 text-blue-600 border-blue-200',
    'Approved': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'Closed': 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATE_BAR: Record<string, string> = {
    'Draft': 'bg-amber-400',
    'Pending Manager Review': 'bg-brand-teal',
    'Pending Customer Review': 'bg-blue-400',
    'Approved': 'bg-emerald-400',
    'Closed': 'bg-gray-300',
};

function getStateDisplay(state: string, isOverdue: boolean, t: any) {
    if (isOverdue) return t('reports.overdue');
    if (state === 'Pending Manager Review') return t('reports.statuses.mgr_review');
    if (state === 'Pending Customer Review') return t('reports.statuses.cust_review');
    // Map status key if possible, or fallback to state
    const statusKey = state.toLowerCase().replace(/\s+/g, '_');
    return t(`reports.${statusKey}`, { defaultValue: state });
}

export default function ReportList() {
    const { t } = useTranslation();
    const { reports, subReportInstances, projects, userRole, clientId, addReport, clients, userId, deleteReport, deleteSubReportInstance } = useStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectIdFilter = searchParams.get('project');

    const [filter, setFilter] = useState<'All' | 'Draft' | 'Pending Manager Review' | 'Pending Customer Review' | 'Approved' | 'Closed' | 'Overdue'>('All');
    const [typeFilter, setTypeFilter] = useState<'All' | 'Daily' | 'Form'>('All');
    const [projectFilter, setProjectFilter] = useState<string>(projectIdFilter || 'All');
    const [search, setSearch] = useState('');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [projectSearchDropdown, setProjectSearchDropdown] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
    const [newReportProject, setNewReportProject] = useState('');
    const [newReportDate, setNewReportDate] = useState(new Date().toISOString().split('T')[0]);

    const handleCreateReport = () => {
        if (!newReportProject) return;
        const selectedProj = projects.find(p => p.id === newReportProject);
        if (!selectedProj) return;

        const reportDate = newReportDate || new Date().toISOString().split('T')[0];
        const duplicate = reports.find(r => r.projectId === newReportProject && r.date === reportDate);
        if (duplicate) {
            if (window.confirm(t('reports.alerts.exists', { project: selectedProj.name, date: reportDate }))) {
                navigate(`/reports/${duplicate.id}`);
            }
            setIsCreateReportOpen(false);
            return;
        }

        const reportId = `REP-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date().toISOString();
        addReport({
            id: reportId,
            projectId: selectedProj.id,
            projectName: selectedProj.name,
            clientId: selectedProj.clientId,
            date: reportDate,
            state: 'Draft',
            weather: { temp: 0, condition: 'Unknown' },
            equipment: [],
            customSections: [],
            comments: [],
            notes: '',
            createdBy: userId,
            createdAt: now,
            updatedBy: userId,
            updatedAt: now,
        });
        setIsCreateReportOpen(false);
        setNewReportProject('');
        setNewReportDate(new Date().toISOString().split('T')[0]);
        navigate(`/reports/${reportId}`);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProjectDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const today = new Date().toISOString().split('T')[0];

    const combinedReports = useMemo<ReportEntry[]>(() => {
        const unified: ReportEntry[] = [];

        reports.forEach(r => {
            const isOverdue = r.date < today && r.state !== 'Approved' && r.state !== 'Closed';
            unified.push({ type: 'Daily', id: r.id, projectId: r.projectId, clientId: r.clientId, projectName: r.projectName, date: r.date, state: r.state, isOverdue });
        });

        subReportInstances.forEach(sr => {
            const project = projects.find(p => p.id === sr.projectId);
            const date = sr.createdAt.split('T')[0];
            const isOverdue = date < today && sr.state !== 'Approved' && sr.state !== 'Closed';
            unified.push({
                type: 'Form', id: sr.id, projectId: sr.projectId, clientId: project?.clientId,
                projectName: project?.name || 'Unknown Project',
                templateName: sr.templateName,
                date, state: sr.state, isOverdue
            });
        });

        return unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reports, subReportInstances, projects, today]);

    const visibleReports = combinedReports.filter(r => {
        if (projectFilter !== 'All' && r.projectId !== projectFilter) return false;
        if (typeFilter !== 'All' && r.type !== typeFilter) return false;
        if (userRole === 'Customer') return r.clientId === clientId && ['Approved', 'Closed', 'Pending Customer Review'].includes(r.state);
        if (userRole === 'Tech') return false;
        if (filter === 'Overdue') return r.isOverdue;
        if (filter !== 'All' && r.state !== filter) return false;
        if (search && !r.projectName.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const selectedReport = visibleReports.find(r => r.id === selectedReportId) ?? null;

    // If selected report gets filtered out, clear it
    useEffect(() => {
        if (selectedReportId && !visibleReports.find(r => r.id === selectedReportId)) {
            setSelectedReportId(null);
        }
    }, [visibleReports, selectedReportId]);

    // Auto-select first when list changes and nothing selected
    useEffect(() => {
        if (!selectedReportId && visibleReports.length > 0) {
            setSelectedReportId(visibleReports[0].id);
        }
    }, [visibleReports.length]);

    // Sub-reports linked to the selected Daily report
    const linkedSubReports = useMemo(() => {
        if (!selectedReport || selectedReport.type !== 'Daily') return [];
        const parentReport = reports.find(r => r.id === selectedReport.id);
        if (!parentReport) return [];
        return subReportInstances.filter(sr =>
            sr.projectId === parentReport.projectId &&
            sr.createdAt.split('T')[0] === parentReport.date
        );
    }, [selectedReport, reports, subReportInstances]);

    // Full Daily report data for the selected
    const selectedDailyReport = selectedReport?.type === 'Daily'
        ? reports.find(r => r.id === selectedReport.id)
        : null;

    const selectedSubReport = selectedReport?.type === 'Form'
        ? subReportInstances.find(sr => sr.id === selectedReport.id)
        : null;

    return (
        <div className="space-y-5 pb-20 md:pb-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <FileText className="text-brand-teal" size={28} />
                        {t('reports.title')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('reports.subtitle')}</p>
                </div>
                {['Manager', 'Supervisor', 'Tech'].includes(userRole) && (
                    <Dialog open={isCreateReportOpen} onOpenChange={setIsCreateReportOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white gap-2 font-bold shadow-soft h-11 px-6 rounded-xl">
                                <Plus size={18} /> {t('reports.new_report')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader><DialogTitle>{t('reports.new_report')}</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-semibold">{t('projects.table.project')}</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-brand-teal outline-none cursor-pointer"
                                        value={newReportProject}
                                        onChange={e => setNewReportProject(e.target.value)}
                                    >
                                        <option value="" disabled>{t('projects.manage_scopes.source')}</option>
                                        {clients.map(client => {
                                            const cp = projects.filter(p => p.clientId === client.id && p.status === 'Active');
                                            if (!cp.length) return null;
                                            return (
                                                <optgroup key={client.id} label={client.name}>
                                                    {cp.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-semibold">{t('reports.labels.date')}</label>
                                    <Input type="date" value={newReportDate} onChange={e => setNewReportDate(e.target.value)} max={today} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateReportOpen(false)}>{t('common.cancel')}</Button>
                                <Button onClick={handleCreateReport} disabled={!newReportProject}>{t('reports.new_report')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[180px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Search size={12} /> {t('common.search')}</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="text" placeholder={t('reports.search')} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>
                <div className="space-y-1.5 min-w-[140px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><FileText size={12} /> {t('reports.category')}</label>
                    <div className="relative">
                        <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
                            <option value="All">{t('common.all')}</option>
                            <option value="Daily">{t('reports.categories.daily')}</option>
                            <option value="Form">{t('reports.categories.forms')}</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>
                <div className="space-y-1.5 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> {t('common.status')}</label>
                    <div className="relative">
                        <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none" value={filter} onChange={e => setFilter(e.target.value as any)}>
                            <option value="All">{t('reports.all_states')}</option>
                            <option value="Draft">{t('reports.draft')}</option>
                            <option value="Pending Manager Review">{t('reports.pending_manager')}</option>
                            <option value="Pending Customer Review">{t('reports.pending_customer')}</option>
                            <option value="Approved">{t('reports.approved')}</option>
                            <option value="Closed">{t('reports.closed')}</option>
                            <option value="Overdue">{t('reports.overdue')}</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>
                <div className="space-y-1.5 flex-1 min-w-[180px] relative z-20" ref={dropdownRef}>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Filter size={12} /> {t('projects.table.project')}</label>
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center justify-between cursor-pointer" onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}>
                        <span className="truncate">{projectFilter === 'All' ? t('projects.all_projects') : (projects.find(p => p.id === projectFilter)?.codeName || projects.find(p => p.id === projectFilter)?.name || t('projects.all_projects'))}</span>
                        <ChevronDown className={`text-gray-400 transition-transform shrink-0 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} size={16} />
                    </div>
                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 border-b border-gray-100">
                                <input type="text" placeholder={t('projects.manage_scopes.source')} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-teal/50" value={projectSearchDropdown} onChange={e => setProjectSearchDropdown(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
                            </div>
                            <div className="max-h-[240px] overflow-y-auto p-1">
                                <div className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold ${projectFilter === 'All' ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`} onClick={() => { setProjectFilter('All'); setIsProjectDropdownOpen(false); setProjectSearchDropdown(''); }}>{t('projects.all_projects')}</div>
                                {projects.filter(p => !projectSearchDropdown || ((p.name || '') + (p.codeName || '')).toLowerCase().includes(projectSearchDropdown.toLowerCase())).map(p => (
                                    <div key={p.id} className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold ${projectFilter === p.id ? 'bg-brand-teal/10 text-brand-teal' : 'hover:bg-gray-50 text-gray-700'}`} onClick={() => { setProjectFilter(p.id); setIsProjectDropdownOpen(false); setProjectSearchDropdown(''); }}>
                                        {p.codeName || p.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Master / Detail */}
            <div className="flex gap-4" style={{ minHeight: '560px' }}>
                {/* LEFT: Report List */}
                <div className="w-72 shrink-0 flex flex-col bg-gray-50 rounded-2xl border border-gray-100 p-2 overflow-y-auto gap-0.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">
                        {t('reports.title')} · {visibleReports.length}
                    </p>

                    {visibleReports.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 px-4 text-center">
                            <FileText size={28} className="mb-2 opacity-30" />
                            <p className="text-xs font-medium">{t('reports.empty.title')}</p>
                            <p className="text-[10px] mt-1">{t('reports.empty.subtitle')}</p>
                        </div>
                    )}

                    {visibleReports.map(report => {
                        const isSelected = selectedReportId === report.id;
                        return (
                            <button
                                key={report.id}
                                onClick={() => setSelectedReportId(report.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                                    isSelected
                                        ? 'bg-brand-teal text-white shadow-md'
                                        : report.isOverdue
                                            ? 'hover:bg-white hover:shadow-sm border border-red-100'
                                            : 'hover:bg-white hover:shadow-sm'
                                }`}
                            >
                                {/* Left accent bar */}
                                <div className={`w-1 h-8 rounded-full shrink-0 ${isSelected ? 'bg-white/40' : report.isOverdue ? 'bg-red-400' : (STATE_BAR[report.state] || 'bg-gray-300')}`} />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {report.type === 'Form'
                                            ? <FileSpreadsheet size={11} className={isSelected ? 'text-white/70' : 'text-blue-400'} />
                                            : <FileText size={11} className={isSelected ? 'text-white/70' : 'text-brand-teal'} />
                                        }
                                        <p className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                            {report.type === 'Form' ? (report.templateName || 'Form') : 'Daily'}
                                        </p>
                                    </div>
                                    <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-accent-greyDark'}`}>
                                        {report.projectName}
                                    </p>
                                    <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                                        {report.date}
                                    </p>
                                </div>

                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border ${
                                    isSelected
                                        ? 'bg-white/20 text-white border-white/20'
                                        : report.isOverdue
                                            ? 'bg-red-50 text-red-600 border-red-200'
                                            : (STATE_STYLES[report.state] || 'bg-gray-100 text-gray-500 border-gray-200')
                                }`}>
                                    {getStateDisplay(report.state, report.isOverdue, t)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* RIGHT: Report Preview Panel */}
                <div className="flex-1 min-w-0">
                    {selectedReport ? (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                            {/* Report Header */}
                            <div className={`p-5 border-b border-gray-100 shrink-0 relative overflow-hidden ${selectedReport.isOverdue ? 'bg-red-50/60' : 'bg-gradient-to-r from-brand-teal/5 to-transparent'}`}>
                                {/* Accent bar */}
                                <div className={`absolute top-0 left-0 w-1 h-full ${selectedReport.isOverdue ? 'bg-red-400' : (STATE_BAR[selectedReport.state] || 'bg-gray-300')}`} />
                                <div className="pl-4 flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${selectedReport.isOverdue ? 'bg-red-50 text-red-600 border-red-200' : (STATE_STYLES[selectedReport.state] || 'bg-gray-100 text-gray-500 border-gray-200')}`}>
                                                {selectedReport.type === 'Form' ? <FileSpreadsheet size={10} /> : <FileText size={10} />}
                                                {getStateDisplay(selectedReport.state, selectedReport.isOverdue, t)}
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                                {selectedReport.type === 'Daily' ? t('reports.categories.daily') : `${t('reports.categories.forms')} · ${selectedReport.templateName || ''}`}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-bold text-accent-greyDark leading-tight">{selectedReport.projectName}</h2>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-brand-teal font-mono font-bold">{selectedReport.id}</span>
                                            <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={11} /> {selectedReport.date}</span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => navigate(selectedReport.type === 'Daily' ? `/reports/${selectedReport.id}` : `/sub-reports/${selectedReport.id}`)}
                                        className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold h-10 px-5 shrink-0"
                                    >
                                        {t('common.open')} <ArrowRight size={16} />
                                    </Button>
                                    {userRole === 'Manager' && (
                                        <button
                                            onClick={() => {
                                                if (!window.confirm(t('reports.alerts.delete_confirm', { type: selectedReport.type === 'Daily' ? t('reports.categories.daily').toLowerCase() : t('reports.categories.forms').toLowerCase() }))) return;
                                                if (selectedReport.type === 'Daily') {
                                                    deleteReport(selectedReport.id);
                                                } else {
                                                    deleteSubReportInstance(selectedReport.id);
                                                }
                                                setSelectedReportId(null);
                                            }}
                                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors shrink-0"
                                            title="Delete Report"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Report Body */}
                            <div className="p-5 flex-1 overflow-y-auto space-y-5">
                                {/* Daily report: show summary info + linked forms */}
                                {selectedReport.type === 'Daily' && selectedDailyReport && (
                                    <>
                                        {/* Metadata grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {[
                                                { label: t('reports.editor_sections.weather'), value: `${selectedDailyReport.weather?.condition || '—'} · ${selectedDailyReport.weather?.temp ?? '—'}°` },
                                                { label: t('reports.editor_sections.equipment'), value: `${selectedDailyReport.equipment?.length ?? 0} ${t('common.other').toLowerCase()}` },
                                                { label: t('common.notes'), value: selectedDailyReport.notes ? t('common.success') : t('common.error') },
                                            ].map(item => (
                                                <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                                                    <p className="text-sm font-semibold text-accent-greyDark">{item.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Linked sub-reports */}
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                <Link2 size={12} /> {t('reports.editor_sections.checklist')} · {linkedSubReports.length}
                                            </p>
                                            {linkedSubReports.length > 0 ? (
                                                <div className="space-y-2">
                                                    {linkedSubReports.map(sr => {
                                                        const srDate = sr.createdAt.split('T')[0];
                                                        const srOverdue = srDate < today && sr.state !== 'Approved' && sr.state !== 'Closed';
                                                        return (
                                                            <div
                                                                key={sr.id}
                                                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-teal/30 hover:bg-white transition-all cursor-pointer group"
                                                                onClick={() => navigate(`/sub-reports/${sr.id}`)}
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                                    <FileSpreadsheet size={14} className="text-blue-500" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-accent-greyDark truncate">{sr.templateName}</p>
                                                                    <p className="text-[10px] font-mono text-gray-400">{sr.id}</p>
                                                                </div>
                                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${srOverdue ? 'bg-red-50 text-red-600 border-red-200' : (STATE_STYLES[sr.state] || 'bg-gray-100 text-gray-500 border-gray-200')}`}>
                                                                    {getStateDisplay(sr.state, srOverdue, t)}
                                                                </span>
                                                                <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-teal transition-colors shrink-0" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="py-6 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                                    <FileSpreadsheet size={20} className="mb-1.5 opacity-40" />
                                                    <p className="text-xs font-medium">{t('reports.empty.subtitle')}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Comments preview */}
                                        {(selectedDailyReport.comments?.length ?? 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Clock size={12} /> {t('common.actions')} · {selectedDailyReport.comments?.length} {t('common.other').toLowerCase()}
                                                </p>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {(selectedDailyReport.comments || []).slice(-3).map((c: any, i: number) => (
                                                        <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                            <div className="w-6 h-6 rounded-full bg-brand-teal/10 text-brand-teal flex items-center justify-center text-xs font-bold shrink-0">
                                                                {(c.author || 'U').charAt(0)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-semibold text-accent-greyDark">{c.text || c.content}</p>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">{c.author} · {c.timestamp?.split('T')[0]}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Form report preview */}
                                {selectedReport.type === 'Form' && selectedSubReport && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('reports.categories.forms')}</p>
                                                <p className="text-sm font-semibold text-accent-greyDark">{selectedSubReport.templateName}</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('reports.labels.date')}</p>
                                                <p className="text-sm font-semibold text-accent-greyDark font-mono">{selectedSubReport.createdAt?.split('T')[0]}</p>
                                            </div>
                                        </div>
                                        {selectedReport.isOverdue && (
                                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                                <AlertCircle size={16} className="text-red-500 shrink-0" />
                                                <p className="text-sm text-red-600 font-medium">{t('reports.overdue')}</p>
                                            </div>
                                        )}
                                        <div className="py-8 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                            <FileSpreadsheet size={24} className="mb-2 opacity-40" />
                                            <p className="text-sm font-medium text-accent-greyDark">{t('reports.editor_sections.checklist')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <FileText size={36} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium text-accent-greyDark">{t('reports.labels.summary')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
