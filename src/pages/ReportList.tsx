import { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import gsap from 'gsap';
import { useStore } from '../store/useStore';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ReportList() {
    const { reports, userRole, clientId } = useStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectIdFilter = searchParams.get('project');
    const [filter, setFilter] = useState<'All' | 'Draft' | 'Review' | 'Closed'>('All');
    const [search, setSearch] = useState('');

    useEffect(() => {
        gsap.fromTo(
            '.report-item',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
        );
    }, [reports, filter, search]);

    // Multi-Tenant Isolation Logic:
    // Customers only see their own Closed/Review reports.
    // Managers and Supervisors see all.
    // Techs shouldn't be here (navlink hidden), but if they navigate directly we'll show nothing.
    const visibleReports = reports.filter((r) => {
        if (projectIdFilter && r.projectId !== projectIdFilter) return false;
        if (userRole === 'Customer') {
            return r.clientId === clientId && r.state !== 'Draft';
        }
        if (userRole === 'Tech') {
            return false;
        }
        return true; // Manager and Supervisor see all
    }).filter((r) => {
        if (filter !== 'All' && r.state !== filter) return false;
        if (search && !r.projectName.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark mb-1">Reports Database</h1>
                    <p className="text-gray-500">Manage all site documentation and lifecycle states.</p>
                </div>
            </div>

            <div className="card-container flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by ID or Project..."
                        className="input-field pl-12 h-12"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    {['All', 'Draft', 'Review', 'Closed'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${filter === f
                                ? 'bg-brand-teal text-white shadow-soft'
                                : 'bg-surface-alt text-accent-grey hover:bg-gray-100'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleReports.map((report) => (
                    <div
                        key={report.id}
                        className="report-item card-container cursor-pointer hover:border-brand-teal/50 hover:shadow-float transition-all group relative overflow-hidden flex flex-col h-full"
                        onClick={() => navigate(`/reports/${report.id}`)}
                    >
                        <div className={`absolute top-0 left-0 w-1 h-full 
              ${report.state === 'Draft' ? 'bg-status-warning' :
                                report.state.includes('Review') || report.state === 'Approved' ? 'bg-brand-teal' :
                                    'bg-status-success'}`}>
                        </div>

                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest
                ${report.state === 'Draft' ? 'bg-status-warning/10 text-status-warning' :
                                    report.state.includes('Review') || report.state === 'Approved' ? 'bg-brand-teal/10 text-brand-teal' :
                                        'bg-status-success/10 text-status-success'}`}>
                                {report.state}
                            </span>
                            <span className="text-xs text-brand-teal font-mono font-bold bg-brand-teal/5 px-2 py-1 rounded-md">
                                {report.id}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-accent-greyDark mb-2 group-hover:text-brand-teal transition-colors line-clamp-2 leading-tight">
                            {report.projectName}
                        </h3>

                        <div className="mt-auto pt-6 border-t border-gray-100 flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-medium">Date</span>
                            <span className="font-mono font-bold text-accent-grey">{report.date}</span>
                        </div>
                    </div>
                ))}

                {visibleReports.length === 0 && (
                    <div className="col-span-full card-container py-12 text-center text-gray-500">
                        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-bold text-accent-grey">No reports found.</p>
                        <p className="text-sm">Try adjusting your filters or search terms.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
