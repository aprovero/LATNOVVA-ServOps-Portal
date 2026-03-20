import { useState } from 'react';
import { Settings as SettingsIcon, Users, Building2, PenTool, HardHat } from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState<string | null>(null);

    const configTabs = [
        { id: 'companies', name: 'Companies', description: 'Manage clients and contractors', icon: Building2 },
        { id: 'users', name: 'Users', description: 'Access control and roles', icon: Users },
        { id: 'labor', name: 'Labor Types', description: 'Define workforce categories (e.g. Electrician, Mason)', icon: HardHat },
        { id: 'checklists', name: 'Checklists', description: 'Quality control lists', icon: PenTool },
    ];

    if (activeTab) {
        const tab = configTabs.find(t => t.id === activeTab);
        return (
            <div className="space-y-6 pb-20 md:pb-0">
                <button 
                    onClick={() => setActiveTab(null)}
                    className="flex items-center gap-2 text-brand-teal font-semibold hover:opacity-80 transition-opacity"
                >
                    ← Back to Settings
                </button>
                <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                        {tab && <tab.icon size={32} />}
                    </div>
                    <h2 className="text-2xl font-bold text-accent-greyDark mb-2">{tab?.name} Settings</h2>
                    <p className="text-gray-500 max-w-md mx-auto">This section is currently under development. Here you will be able to configure {tab?.name.toLowerCase()} for the platform.</p>
                </div>
            </div>
        );
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
