import { useStore } from '../../store/useStore';
import { Activity, Users, AlertCircle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function KPIRow() {
    const { projects, reports, userRole } = useStore();
    const navigate = useNavigate();

    // Only Managers and Supervisors see global KPIs
    if (userRole === 'Customer' || userRole === 'Tech') return null;

    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const activeProjectsDiff = "+2 this week";

    const techsDeployed = 24; // Mocked for now
    const techsDiff = "+4 this week";

    const openReports = reports.filter(r => r.state !== 'Approved' && r.state !== 'Closed').length;
    const reportsDiff = "-1 this week";

    const issuesThisWeek = reports.reduce((count, r) => {
        const report = r as any;
        if (report.values?.issues && Array.isArray(report.values.issues)) {
            return count + report.values.issues.length;
        }
        return count;
    }, 0);
    const criticalIssues = issuesThisWeek > 0 ? issuesThisWeek : 2; // Real fallback mock
    const issuesDiff = issuesThisWeek > 0 ? "+1 this week" : "-1 this week";

    const kpis = [
        { label: 'Active Projects', value: activeProjects, diff: activeProjectsDiff, icon: Activity, color: 'text-brand-teal', bg: 'bg-brand-teal/10', link: '/projects?q=Active' },
        { label: 'Techs Deployed', value: techsDeployed, diff: techsDiff, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', link: '/personnel' },
        { label: 'Open Reports', value: openReports, diff: reportsDiff, icon: FileText, color: 'text-status-warning', bg: 'bg-status-warning/10', link: '/reports?q=Pending' },
        { label: 'Reported Issues', value: criticalIssues, diff: issuesDiff, icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10', link: '/projects?status=Critical' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-2">
            {kpis.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                    <div 
                        key={i} 
                        onClick={() => navigate(kpi.link)}
                        className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start justify-between cursor-pointer hover:shadow-md transition-shadow hover:border-brand-teal/30"
                    >
                        <div>
                            <p className="text-xs font-semibold text-accent-greyLight mb-1">{kpi.label}</p>
                            <h3 className="text-2xl font-bold text-accent-greyDark">{kpi.value}</h3>
                            <p className="text-[10px] font-medium mt-1 text-gray-400">{kpi.diff}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                            <Icon size={20} className={kpi.color} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
