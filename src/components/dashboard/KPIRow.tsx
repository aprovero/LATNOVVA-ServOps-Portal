import { useStore } from '../../store/useStore';
import { Activity, Users, AlertCircle, FileText } from 'lucide-react';

export function KPIRow() {
    const { projects, reports, userRole } = useStore();

    // Only Managers and Supervisors see global KPIs
    if (userRole === 'Customer' || userRole === 'Tech') return null;

    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const activeProjectsDiff = "+2 this week";

    const techsDeployed = 24; // Mocked for now
    const techsDiff = "+4 this week";

    const openReports = reports.filter(r => r.state !== 'Approved' && r.state !== 'Closed').length;
    const reportsDiff = "-1 this week";

    const criticalIssues = 3; // Mocked
    const issuesDiff = "+1 today";

    const kpis = [
        { label: 'Active Projects', value: activeProjects, diff: activeProjectsDiff, icon: Activity, color: 'text-brand-teal', bg: 'bg-brand-teal/10' },
        { label: 'Techs Deployed', value: techsDeployed, diff: techsDiff, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Open Reports', value: openReports, diff: reportsDiff, icon: FileText, color: 'text-status-warning', bg: 'bg-status-warning/10' },
        { label: 'Critical Issues', value: criticalIssues, diff: issuesDiff, icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-2">
            {kpis.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                    <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-start justify-between">
                        <div>
                            <p className="text-sm font-semibold text-accent-greyLight mb-1">{kpi.label}</p>
                            <h3 className="text-3xl font-bold text-accent-greyDark">{kpi.value}</h3>
                            <p className="text-xs font-medium mt-2 text-gray-400">{kpi.diff}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kpi.bg}`}>
                            <Icon size={24} className={kpi.color} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
