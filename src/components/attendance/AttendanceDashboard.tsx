import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserCheck, Calendar, ShieldAlert, Home, AlertOctagon, UserX, Clock, HelpCircle } from 'lucide-react';

interface KPIProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<any>;
    colorClass: string;
    bgClass: string;
    onClick?: () => void;
    active?: boolean;
}

function KPICard({ title, value, icon: Icon, colorClass, bgClass, onClick, active }: KPIProps) {
    return (
        <div 
            onClick={onClick}
            className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between shadow-soft hover:shadow-md hover:scale-[1.02] ${
                active 
                    ? 'border-brand-teal bg-brand-teal/5 ring-1 ring-brand-teal' 
                    : 'border-gray-100 bg-white'
            }`}
        >
            <div className="space-y-1.5 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">{title}</p>
                <p className="text-3xl font-extrabold text-accent-greyDark">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
                <Icon size={24} />
            </div>
        </div>
    );
}

interface DashboardProps {
    stats: {
        activeCount: number;
        presentToday: number;
        onVacation: number;
        onSickLeave: number;
        onHomeOffice: number;
        absentToday: number;
        missingPunches: number;
        pendingConflicts: number;
        overtimeHours: number;
    };
    activeFilter: string | null;
    setActiveFilter: (filter: string | null) => void;
}

export default function AttendanceDashboard({ stats, activeFilter, setActiveFilter }: DashboardProps) {
    const { t } = useTranslation();

    const handleToggleFilter = (filter: string) => {
        if (activeFilter === filter) {
            setActiveFilter(null);
        } else {
            setActiveFilter(filter);
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <KPICard
                title={t('attendance.dashboard.active_employees', 'Active Employees')}
                value={stats.activeCount}
                icon={Users}
                colorClass="text-blue-600"
                bgClass="bg-blue-50"
                onClick={() => handleToggleFilter('active')}
                active={activeFilter === 'active'}
            />
            <KPICard
                title={t('attendance.dashboard.present_today', 'Present Today')}
                value={stats.presentToday}
                icon={UserCheck}
                colorClass="text-emerald-600"
                bgClass="bg-emerald-50"
                onClick={() => handleToggleFilter('present')}
                active={activeFilter === 'present'}
            />
            <KPICard
                title={t('attendance.dashboard.on_vacation', 'On Vacation')}
                value={stats.onVacation}
                icon={Calendar}
                colorClass="text-indigo-600"
                bgClass="bg-indigo-50"
                onClick={() => handleToggleFilter('vacation')}
                active={activeFilter === 'vacation'}
            />
            <KPICard
                title={t('attendance.dashboard.sick_leave', 'Sick Leave')}
                value={stats.onSickLeave}
                icon={ShieldAlert}
                colorClass="text-red-600"
                bgClass="bg-red-50"
                onClick={() => handleToggleFilter('sick_leave')}
                active={activeFilter === 'sick_leave'}
            />
            <KPICard
                title={t('attendance.dashboard.home_office', 'Home Office')}
                value={stats.onHomeOffice}
                icon={Home}
                colorClass="text-purple-600"
                bgClass="bg-purple-50"
                onClick={() => handleToggleFilter('home_office')}
                active={activeFilter === 'home_office'}
            />
            <KPICard
                title={t('attendance.dashboard.absent_today', 'Absent Today')}
                value={stats.absentToday}
                icon={UserX}
                colorClass="text-rose-600"
                bgClass="bg-rose-50"
                onClick={() => handleToggleFilter('absent')}
                active={activeFilter === 'absent'}
            />
            <KPICard
                title={t('attendance.dashboard.missing_punch', 'Missing Punches')}
                value={stats.missingPunches}
                icon={HelpCircle}
                colorClass="text-amber-600"
                bgClass="bg-amber-50"
                onClick={() => handleToggleFilter('missing_punch')}
                active={activeFilter === 'missing_punch'}
            />
            <KPICard
                title={t('attendance.dashboard.conflicts', 'Conflicts')}
                value={stats.pendingConflicts}
                icon={AlertOctagon}
                colorClass="text-orange-600"
                bgClass="bg-orange-50"
                onClick={() => handleToggleFilter('conflict')}
                active={activeFilter === 'conflict'}
            />
            <KPICard
                title={t('attendance.dashboard.overtime_hours', 'Overtime Today')}
                value={`${stats.overtimeHours.toFixed(1)} hrs`}
                icon={Clock}
                colorClass="text-teal-600"
                bgClass="bg-teal-50"
                onClick={() => handleToggleFilter('overtime')}
                active={activeFilter === 'overtime'}
            />
        </div>
    );
}
