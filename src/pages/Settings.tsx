import { useState } from 'react';
import { Settings as SettingsIcon, Users, Building2, ClipboardList, PenTool, HardHat } from 'lucide-react';
import PersonnelManager from '../components/settings/PersonnelManager';

export default function Settings() {
    const [activeTab, setActiveTab] = useState<string | null>(null);

    const configTabs = [
        { id: 'companies', name: 'Companies', description: 'Manage clients and contractors', icon: Building2 },
        { id: 'users', name: 'Users', description: 'Access control and roles', icon: Users },
        { id: 'personnel', name: 'Personnel', description: 'Manage employees and certifications', icon: HardHat },
        { id: 'templates', name: 'Templates', description: 'Report and field templates', icon: ClipboardList },
        { id: 'labor', name: 'Labor Types', description: 'Define workforce categories (e.g. Electrician, Mason)', icon: Users },
        { id: 'checklists', name: 'Checklists', description: 'Quality control lists', icon: PenTool },
    ];

    if (activeTab === 'personnel') {
        return <PersonnelManager onBack={() => setActiveTab(null)} />;
    }

    return (
        <div className="space-y-8 pb-20 md:pb-0">
            <div>
                <h1 className="text-3xl font-bold text-accent-greyDark mb-1 flex items-center gap-3">
                    <SettingsIcon size={32} className="text-brand-teal" />
                    Global Settings
                </h1>
                <p className="text-gray-500">Configure platform rules, users, and templates across all projects.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <div key={tab.name} onClick={() => setActiveTab(tab.id)} className="card-container flex gap-4 items-start border border-gray-100 hover:border-brand-teal/40 hover:shadow-soft transition-all cursor-pointer group">
                            <div className="p-3 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-brand-teal/10 group-hover:text-brand-teal transition-colors">
                                <Icon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-accent-greyDark group-hover:text-brand-teal transition-colors mb-1">{tab.name}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{tab.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
