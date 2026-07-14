import { useState, useMemo } from 'react';
import guestEquipment from '../../data/guestEquipment.json';
import { Search, Wrench } from 'lucide-react';

export default function GuestEquipmentTab() {
    const tools = guestEquipment;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClassification, setFilterClassification] = useState('All');

    const uniqueClassifications = useMemo(() => {
        const classes = tools.map(t => t.classification).filter(Boolean);
        return Array.from(new Set(classes)).sort();
    }, [tools]);

    const filteredTools = useMemo(() => {
        return tools.filter(tool => {
            if (filterClassification !== 'All' && tool.classification !== filterClassification) return false;
            if (!searchTerm) return true;
            const s = searchTerm.toLowerCase();
            return tool.description.toLowerCase().includes(s) || 
                   tool.brand.toLowerCase().includes(s) || 
                   tool.classification.toLowerCase().includes(s);
        });
    }, [tools, searchTerm, filterClassification]);

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

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search equipment..." 
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 rounded-xl text-sm font-medium transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 px-4 py-2 focus:outline-none focus:border-brand-teal cursor-pointer shadow-sm min-w-[160px]"
                            value={filterClassification}
                            onChange={e => setFilterClassification(e.target.value)}
                        >
                            <option value="All">All Classifications</option>
                            {uniqueClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {filteredTools.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <Wrench className="mx-auto text-gray-300 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-gray-700 mb-2">No equipment found</h3>
                        <p className="text-gray-500">Try adjusting your search criteria.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="p-4 pl-6 font-semibold">Equipment</th>
                                        <th className="p-4 font-semibold">Brand</th>
                                        <th className="p-4 font-semibold">Classification</th>
                                        <th className="p-4 font-semibold text-right pr-6">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTools.map(tool => (
                                        <tr key={tool.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                                                        <Wrench className="text-brand-teal" size={14} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm leading-tight">{tool.description}</p>
                                                        {tool.type && (
                                                            <span className="text-[10px] font-medium text-gray-500">{tool.type}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-gray-500">{tool.brand || '-'}</td>
                                            <td className="p-4 text-sm font-semibold text-gray-500">{tool.classification || '-'}</td>
                                            <td className="p-4 text-right pr-6">
                                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-brand-teal/10 text-brand-teal text-sm font-bold border border-brand-teal/20">
                                                    {tool.quantity} {tool.unit}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
