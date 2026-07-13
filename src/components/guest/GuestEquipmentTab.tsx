import { useState, useMemo } from 'react';
import guestEquipment from '../../data/guestEquipment.json';
import { Search, Wrench, ShieldCheck } from 'lucide-react';

export default function GuestEquipmentTab() {
    const tools = guestEquipment;
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTools = useMemo(() => {
        return tools.filter(tool => {
            if (!searchTerm) return true;
            const s = searchTerm.toLowerCase();
            return tool.description.toLowerCase().includes(s) || 
                   tool.brand.toLowerCase().includes(s) || 
                   tool.classification.toLowerCase().includes(s);
        });
    }, [tools, searchTerm]);

    // The JSON no longer has certification expiry dates, it has quantities and types
    // So we don't need isExpired anymore.

    return (
        <div className="flex flex-col w-full h-full bg-gray-50/50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto w-full">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <h2 className="text-3xl font-black text-accent-greyDark mb-2">Equipment Fleet</h2>
                        <p className="text-gray-500 font-medium">State-of-the-art testing and commissioning equipment at our disposal.</p>
                    </div>

                    <div className="relative w-full md:w-80 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search equipment..." 
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 rounded-xl text-sm font-medium transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {filteredTools.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <Wrench className="mx-auto text-gray-300 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-gray-700 mb-2">No equipment found</h3>
                        <p className="text-gray-500">Try adjusting your search criteria.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTools.map(tool => {
                            return (
                                <div key={tool.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-brand-teal/20 transition-all group flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <Wrench className="text-brand-teal" size={24} />
                                        </div>
                                        {tool.type && (
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                                                <ShieldCheck size={12} /> {tool.type}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <h3 className="text-lg font-black text-accent-greyDark mb-1 leading-tight">{tool.description}</h3>
                                    <p className="text-sm font-semibold text-gray-500 mb-6">{tool.brand || 'No Brand'}</p>
                                    
                                    <div className="mt-auto space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-400 uppercase tracking-wider">Classification</span>
                                            <span className="font-bold text-gray-700">{tool.classification || 'N/A'}</span>
                                        </div>
                                        <div className="w-full h-px bg-gray-200" />
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-400 uppercase tracking-wider">Available Quantity</span>
                                            <span className="font-bold text-brand-teal text-sm">
                                                {tool.quantity} {tool.unit}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
