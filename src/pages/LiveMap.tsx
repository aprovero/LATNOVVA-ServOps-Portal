import { useMemo, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Users, ArrowRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import L from 'leaflet';

// Fix for default Leaflet marker icons when bundled with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function LiveMap() {
    const { projects, personnel } = useStore();

    // Only allow Tech/Supervisor/Manager to see full operations map natively
    const mapProjects = useMemo(() => {
        let filtered = projects.filter(p => p.status === 'Active' || p.status === 'On Hold');

        return filtered.map(p => {
            let lat = null, lng = null;
            if (p.location) {
                const parts = p.location.split(',');
                if (parts.length === 2) {
                    lat = parseFloat(parts[0].trim());
                    lng = parseFloat(parts[1].trim());
                }
            }
            return {
                ...p,
                lat,
                lng,
                teams: p.assignedPersonnel?.map(id => personnel.find(user => user.id === id)).filter(Boolean) || []
            };
        }).filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng));
    }, [projects, personnel]);

    useEffect(() => {
        const styles = document.createElement('style');
        styles.innerHTML = `
            .leaflet-popup-content-wrapper {
                border-radius: 1rem !important;
                padding: 0 !important;
                overflow: hidden;
            }
            .leaflet-popup-content {
                margin: 14px !important;
            }
            .leaflet-container {
                font-family: inherit !important;
            }
        `;
        document.head.appendChild(styles);
        return () => {
            document.head.removeChild(styles);
        }
    }, []);

    return (
        <div className="h-[calc(100vh-64px)] w-full relative left-0 top-0 flex flex-col bg-surface-alt z-0">
            {/* Overlay Dashboard Card */}
            <div className="absolute top-6 left-6 z-[400] bg-white/95 backdrop-blur-md px-6 py-5 rounded-3xl shadow-xl border border-gray-100 max-w-sm pointer-events-auto">
                <div className="flex items-center gap-4 mb-5">
                    <div className="bg-brand-teal/10 p-3 rounded-2xl relative">
                        <Radio className="text-brand-teal animate-pulse" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-accent-greyDark leading-tight">Live Deployment</h1>
                        <p className="text-sm font-medium text-gray-500">Global Operations Map</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-center">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Active Sites</p>
                        <p className="text-3xl font-bold text-accent-greyDark">{mapProjects.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-center">
                        <p className="text-xs text-brand-teal/70 font-bold uppercase tracking-wider mb-1">Teams</p>
                        <p className="text-3xl font-bold text-brand-teal">
                            {new Set(mapProjects.flatMap(p => p.teams.map((t: any) => t.id))).size}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full bg-gray-100 relative z-0">
                <MapContainer 
                    center={[39.8283, -98.5795]} 
                    zoom={4} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />

                    {mapProjects.map((proj) => (
                        <Marker key={proj.id} position={[proj.lat!, proj.lng!]}>
                            <Popup className="rounded-2xl shadow-xl border-none">
                                <div className="p-1 min-w-[240px]">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-accent-greyDark flex-1 text-base leading-tight pr-2">{proj.name}</h3>
                                        <Badge variant="outline" className={`ml-2 text-[10px] ${proj.status === 'Active' ? 'bg-status-success/10 text-status-success border-status-success/20' : 'bg-status-warning/10 text-status-warning border-status-warning/20'}`}>
                                            {proj.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs font-mono text-brand-teal mb-4 block pb-2 border-b border-gray-100">{proj.codeName || proj.id}</p>
                                    
                                    <div className="space-y-3 mb-4">
                                        <div className="bg-gray-50 rounded-xl p-3 w-full border border-gray-100">
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                <Users size={14} className="text-brand-teal" /> 
                                                <span>Deployed Resources ({proj.teams?.length || 0})</span>
                                            </div>
                                            {proj.teams && proj.teams.length > 0 ? (
                                                <div className="space-y-2 mt-3">
                                                    {proj.teams.map((t: any) => (
                                                        <div key={t.id} className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-accent-greyDark truncate mr-2">{t.name}</span>
                                                            <span className="text-gray-500 font-medium">{t.position}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 mt-2 italic">No assigned personnel</p>
                                            )}
                                        </div>
                                    </div>

                                    <Link to={`/projects`}>
                                        <Button className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-10 text-xs font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]">
                                            Open Project <ArrowRight size={14} />
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
