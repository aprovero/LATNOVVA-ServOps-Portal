import { useMemo, useEffect, useState } from 'react';
import guestProjects from '../../data/guestProjects.json';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, Search, MapPin } from 'lucide-react';
import L from 'leaflet';

// Fix default icon assets for Vite bundling
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Colored custom markers per status
function createColoredIcon(color: string) {
    return L.divIcon({
        className: '',
        html: `
            <div style="
                width: 28px; height: 28px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            "></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
    });
}

const MARKERS = {
    Active:    createColoredIcon('#14b8a6'),  // teal
    'On Hold': createColoredIcon('#f59e0b'),  // amber
    Completed: createColoredIcon('#9ca3af'),  // gray
    'In Progress': createColoredIcon('#3b82f6'), // blue
};

export default function GuestMapTab() {
    const projects = guestProjects;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');

    const mapProjects = useMemo(() => {
        return projects
            .filter(p => {
                if (filterStatus !== 'All' && p.status !== filterStatus) return false;
                if (searchTerm) {
                    const searchLower = searchTerm.toLowerCase();
                    return p.name.toLowerCase().includes(searchLower) || 
                           (p.locationString && p.locationString.toLowerCase().includes(searchLower)) ||
                           (p.client && p.client.toLowerCase().includes(searchLower));
                }
                return true;
            })
            .filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat!) && !isNaN(p.lng!));
    }, [projects, searchTerm, filterStatus]);

    useEffect(() => {
        const styles = document.createElement('style');
        styles.innerHTML = `
            .leaflet-popup-content-wrapper { border-radius: 1rem !important; padding: 0 !important; overflow: hidden; }
            .leaflet-popup-content { margin: 14px !important; }
            .leaflet-container { font-family: inherit !important; }
            .leaflet-control-attribution { display: none !important; }
        `;
        document.head.appendChild(styles);
        return () => { document.head.removeChild(styles); };
    }, []);

    return (
        <div className="h-full w-full relative flex flex-col bg-gray-50 z-0">
            {/* Search & Filter Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-full max-w-2xl px-4 pointer-events-auto">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 p-2 flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search projects by name, location..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:border-brand-teal focus:bg-white focus:ring-0 rounded-xl text-sm font-medium transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-px bg-gray-200 mx-1"></div>
                    <select 
                        className="bg-transparent border-none text-sm font-bold text-accent-greyDark focus:ring-0 cursor-pointer outline-none pr-8 py-2.5"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                    </select>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 w-full bg-gray-100 relative z-0">
                <MapContainer
                    center={[39.8283, -98.5795]}
                    zoom={4}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {mapProjects.map(proj => (
                        <Marker
                            key={proj.id}
                            position={[proj.lat!, proj.lng!]}
                            icon={MARKERS[proj.status as keyof typeof MARKERS] || DefaultIcon}
                        >
                            <Popup>
                                <div className="p-1 min-w-[260px]">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-accent-greyDark flex-1 text-lg leading-tight pr-2">{proj.name}</h3>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                                            proj.status === 'Active' || proj.status === 'In Progress' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            proj.status === 'On Hold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-gray-50 text-gray-600 border-gray-200'
                                        }`}>
                                            {proj.status}
                                        </span>
                                        {proj.year && (
                                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-teal/10 text-brand-teal border border-brand-teal/20 uppercase tracking-wider">
                                                {proj.year}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        {proj.description && (
                                            <p className="text-xs text-gray-600 mb-2">{proj.description}</p>
                                        )}
                                        {proj.client && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <Building2 className="text-brand-teal shrink-0" size={16} />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Client</span>
                                                    <span className="font-bold text-accent-greyDark">{proj.client}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-3 text-sm">
                                            <MapPin className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Location Info</span>
                                                <span className="font-semibold text-gray-700 leading-snug font-mono text-xs">{proj.lat?.toFixed(4)}, {proj.lng?.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
            
            {/* Legend Overlay */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 pointer-events-auto hidden md:flex items-center gap-6">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Legend</span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" /><span className="text-xs font-bold text-gray-700">Active</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" /><span className="text-xs font-bold text-gray-700">On Hold</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400 shadow-sm" /><span className="text-xs font-bold text-gray-700">Completed</span></div>
                </div>
            </div>
        </div>
    );
}
