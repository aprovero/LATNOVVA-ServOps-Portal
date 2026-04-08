import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Users, ArrowRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
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
};

export default function LiveMap() {
    const { projects, personnel } = useStore();

    const [showActive, setShowActive] = useState(true);
    const [showOnHold, setShowOnHold] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);

    const activeStatuses = [
        ...(showActive ? ['Active'] : []),
        ...(showOnHold ? ['On Hold'] : []),
        ...(showCompleted ? ['Completed'] : []),
    ];

    const mapProjects = useMemo(() => {
        return projects
            .filter(p => activeStatuses.includes(p.status))
            .map(p => {
                let lat: number | null = null, lng: number | null = null;
                if (p.location) {
                    const parts = p.location.split(',');
                    if (parts.length === 2) {
                        lat = parseFloat(parts[0].trim());
                        lng = parseFloat(parts[1].trim());
                    }
                }
                return {
                    ...p,
                    lat, lng,
                    teams: (p.assignedPersonnel || [])
                        .map(id => personnel.find(u => u.id === id))
                        .filter(Boolean),
                };
            })
            .filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat!) && !isNaN(p.lng!));
    }, [projects, personnel, activeStatuses.join(',')]);

    useEffect(() => {
        const styles = document.createElement('style');
        styles.innerHTML = `
            .leaflet-popup-content-wrapper { border-radius: 1rem !important; padding: 0 !important; overflow: hidden; }
            .leaflet-popup-content { margin: 14px !important; }
            .leaflet-container { font-family: inherit !important; }
        `;
        document.head.appendChild(styles);
        return () => { document.head.removeChild(styles); };
    }, []);

    const activeSites = projects.filter(p => p.status === 'Active' && p.location).length;
    const totalTeams = new Set(mapProjects.flatMap(p => p.teams.map((t: any) => t.id))).size;

    return (
        <div className="h-[calc(100vh-64px)] w-full relative flex flex-col bg-surface-alt z-0">
            {/* Overlay Dashboard Card (Relocated to bottom-left) */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/95 backdrop-blur-md px-6 py-5 rounded-3xl shadow-xl border border-gray-100 max-w-xs pointer-events-auto select-none hidden md:block">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-brand-teal/10 p-3 rounded-2xl">
                        <Radio className="text-brand-teal animate-pulse" size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-accent-greyDark leading-tight">Live Deployment</h1>
                        <p className="text-xs font-medium text-gray-500">Global Operations Map</p>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">Active Sites</p>
                        <p className="text-2xl font-bold text-accent-greyDark">{activeSites}</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                        <p className="text-xs text-brand-teal/70 font-bold uppercase tracking-wider mb-0.5">Deployed</p>
                        <p className="text-2xl font-bold text-brand-teal">{totalTeams}</p>
                    </div>
                </div>

                {/* Filter checkboxes */}
                <div className="border-t border-gray-100 pt-4 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Show on Map</p>
                    {([
                        { label: 'Active', checked: showActive, set: setShowActive, color: '#14b8a6' },
                        { label: 'On Hold', checked: showOnHold, set: setShowOnHold, color: '#f59e0b' },
                        { label: 'Completed', checked: showCompleted, set: setShowCompleted, color: '#9ca3af' },
                    ] as const).map(({ label, checked, set, color }) => (
                        <label key={label} className="flex items-center gap-3 cursor-pointer group">
                            <div
                                className="relative w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center shrink-0"
                                style={{
                                    borderColor: checked ? color : '#d1d5db',
                                    backgroundColor: checked ? color : 'transparent',
                                }}
                                onClick={() => set(!checked)}
                            >
                                {checked && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                                <span className="text-sm font-semibold text-accent-greyDark">
                                    {label}
                                    <span className="ml-1.5 text-xs text-gray-400 font-medium">
                                        ({projects.filter(p => p.status === label && p.location).length})
                                    </span>
                                </span>
                            </div>
                        </label>
                    ))}
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
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />

                    {mapProjects.map(proj => (
                        <Marker
                            key={proj.id}
                            position={[proj.lat!, proj.lng!]}
                            icon={MARKERS[proj.status as keyof typeof MARKERS] || DefaultIcon}
                            zIndexOffset={proj.status === 'Active' ? 1000 : proj.status === 'On Hold' ? 500 : 0}
                        >
                            <Popup>
                                <div className="p-1 min-w-[240px]">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-accent-greyDark flex-1 text-base leading-tight pr-2">{proj.name}</h3>
                                        <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            proj.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            proj.status === 'On Hold' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                            {proj.status}
                                        </span>
                                    </div>
                                    <p className="text-xs font-mono text-brand-teal mb-3 pb-2 border-b border-gray-100">
                                        {proj.codeName || proj.id}
                                    </p>

                                    {/* Progress Bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project Progress</span>
                                            <span className="text-[10px] font-bold text-brand-teal">{proj.progress}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-brand-teal transition-all duration-700" 
                                                style={{ width: `${proj.progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                                            <Users size={13} className="text-brand-teal" />
                                            Deployed Resources ({proj.teams?.length || 0})
                                        </div>
                                        {proj.teams && proj.teams.length > 0 ? (
                                            <div className="space-y-2">
                                                {[...proj.teams].sort((a: any, b: any) => {
                                                    const aIsLead = proj.siteLeadIds?.includes(a.id) ? 1 : 0;
                                                    const bIsLead = proj.siteLeadIds?.includes(b.id) ? 1 : 0;
                                                    return bIsLead - aIsLead;
                                                }).map((t: any) => {
                                                    const isLead = proj.siteLeadIds?.includes(t.id);
                                                    return (
                                                        <div key={t.id} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold truncate ${isLead ? 'text-status-success' : 'text-accent-greyDark'}`}>{t.name}</span>
                                                                {isLead && (
                                                                    <div className="w-4 h-4 rounded-full bg-status-success text-white flex items-center justify-center text-[10px] font-black shrink-0" title="Site Lead">
                                                                        L
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">No assigned personnel</p>
                                        )}
                                    </div>

                                    <Link to={`/projects/${proj.id}`}>
                                        <Button className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-9 text-xs font-bold flex items-center justify-center gap-2">
                                            Open Project <ArrowRight size={13} />
                                        </Button>
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>

    );
}
