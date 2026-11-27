import { useStore } from '../../store/useStore';
import { Activity, Users, AlertCircle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function KPIRow() {
    const { projects, personnel, userRole } = useStore();
    const navigate = useNavigate();

    // Only Managers and Supervisors see global KPIs
    if (userRole === 'Customer' || userRole === 'Tech') return null;

    const activeProjectsList = projects.filter(p => p.status === 'Active');
    const activeProjects = activeProjectsList.length;
    const onHoldProjects = projects.filter(p => p.status === 'On Hold').length;

    const personnelIds = new Set(personnel.map(p => p.id));
    const techsDeployed = new Set(
        activeProjectsList
            .flatMap(p => {
                const list = p.assignedPersonnel || (p as any).assigned_personnel || [];
                return Array.isArray(list) ? list : [];
            })
            .filter(id => personnelIds.has(id))
    ).size;

    const kpis = [
        { label: 'Active Projects', value: activeProjects, diff: 'Live count', icon: Activity, color: 'text-brand-teal', bg: 'bg-brand-teal/10', link: '/projects?q=Active' },
        { label: 'Techs Deployed', value: techsDeployed, diff: 'Active field staff', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', link: '/personnel?view=assignments' },
        { label: 'Live Operations', value: activeProjects, diff: 'View live map', icon: FileText, color: 'text-status-warning', bg: 'bg-status-warning/10', link: '/live-map' },
        { label: 'Projects On Hold', value: onHoldProjects, diff: onHoldProjects === 0 ? 'All active on track' : `${onHoldProjects} paused`, icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10', link: '/projects?q=On%20Hold' },
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
