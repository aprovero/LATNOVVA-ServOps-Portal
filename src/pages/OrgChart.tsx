import { useState } from 'react';
import { useStore, Personnel } from '../store/useStore';
import { Network, User } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/card';

export default function OrgChart() {
    const { personnel, assignSupervisor } = useStore();
    const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);

    // Group personnel by roles
    const managers = personnel.filter(p => p.appRole === 'Manager');
    const supervisors = personnel.filter(p => p.appRole === 'Supervisor');
    const techs = personnel.filter(p => p.appRole === 'Tech');

    const handleAssign = (personId: string, supervisorId: string, managerId: string) => {
        assignSupervisor(personId, supervisorId, managerId);
        setSelectedPerson(null);
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <Network className="text-brand-teal" size={32} />
                        Organizational Chart
                    </h1>
                    <p className="text-gray-500 mt-1">Assign personnel to managers and supervisors.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual Representation */}
                <div className="lg:col-span-2 space-y-6 flex flex-col items-center overflow-x-auto p-4 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[500px]">
                    {managers.map(manager => (
                        <div key={manager.id} className="w-full flex flex-col items-center">
                            <Card className="w-64 border-brand-teal/30 bg-brand-teal/5 shadow-md">
                                <CardHeader className="py-3 px-4 flex flex-row items-center gap-3">
                                    <div className="bg-brand-teal p-2 rounded-lg text-white">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <CardTitle className="text-md">{manager.name}</CardTitle>
                                        <p className="text-xs text-brand-teal font-semibold">Manager</p>
                                    </div>
                                </CardHeader>
                            </Card>

                            <div className="w-px h-8 bg-gray-300"></div>
                            
                            <div className="flex gap-8 justify-center w-full">
                                {supervisors
                                    .filter(sup => sup.managerId === manager.id)
                                    .map(supervisor => (
                                    <div key={supervisor.id} className="flex flex-col items-center">
                                        <Card className="w-56 border-blue-200 bg-blue-50/50">
                                            <CardHeader className="py-2 px-3 flex flex-row items-center gap-2">
                                                <div className="bg-blue-500 p-1.5 rounded-lg text-white">
                                                    <User size={16} />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-sm">{supervisor.name}</CardTitle>
                                                    <p className="text-[10px] text-blue-600 font-semibold">Supervisor</p>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                        
                                        <div className="w-px h-6 bg-gray-300"></div>
                                        
                                        <div className="flex flex-col gap-2">
                                            {techs
                                                .filter(tech => tech.supervisorId === supervisor.id)
                                                .map(tech => (
                                                    <div key={tech.id} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 flex items-center justify-between w-48 shadow-sm">
                                                        {tech.name}
                                                    </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {managers.length === 0 && (
                        <div className="text-gray-400 text-sm mt-10">No managers found to build the chart.</div>
                    )}
                </div>

                {/* Assignment Panel */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit">
                    <h3 className="text-lg font-bold text-accent-greyDark mb-4">Assign Personnel</h3>
                    
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 mb-2 font-medium">1. Select Person to Assign</p>
                        <select 
                            className="w-full border-gray-200 rounded-lg text-sm mb-4"
                            value={selectedPerson?.id || ''}
                            onChange={(e) => setSelectedPerson(personnel.find(p => p.id === e.target.value) || null)}
                        >
                            <option value="" disabled>Select Tech or Supervisor</option>
                            {[...supervisors, ...techs].map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.appRole})</option>
                            ))}
                        </select>

                        {selectedPerson && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 mb-1">Current Assignment:</p>
                                    <p className="text-sm font-semibold">
                                        Manager: {personnel.find(p => p.id === selectedPerson.managerId)?.name || 'None'}<br/>
                                        Supervisor: {personnel.find(p => p.id === selectedPerson.supervisorId)?.name || 'None'}
                                    </p>
                                </div>

                                <p className="text-sm text-gray-500 font-medium">2. Choose New Assignment</p>
                                
                                {selectedPerson.appRole === 'Tech' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-700">Assign to Supervisor</label>
                                        <select 
                                            className="w-full border-gray-200 rounded-lg text-sm"
                                            id="sup-select"
                                        >
                                            <option value="">None</option>
                                            {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-700">Assign to Manager</label>
                                    <select 
                                        className="w-full border-gray-200 rounded-lg text-sm"
                                        id="man-select"
                                    >
                                        <option value="">None</option>
                                        {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>

                                <button 
                                    className="w-full bg-brand-teal text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-teal/90 transition-colors mt-4"
                                    onClick={() => {
                                        const supId = selectedPerson.appRole === 'Tech' ? (document.getElementById('sup-select') as HTMLSelectElement)?.value : undefined;
                                        const manId = (document.getElementById('man-select') as HTMLSelectElement)?.value;
                                        handleAssign(selectedPerson.id, supId || '', manId || '');
                                    }}
                                >
                                    Save Assignment
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
