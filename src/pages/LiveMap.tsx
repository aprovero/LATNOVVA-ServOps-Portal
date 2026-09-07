import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Users, ArrowRight, Radio, Map as MapIcon, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import L from 'leaflet';
import guestProjects from '../data/guestProjects.json';

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
    Active:     createColoredIcon('#14b8a6'),  // teal
    'On Hold':  createColoredIcon('#f59e0b'),  // amber
    Completed:  createColoredIcon('#9ca3af'),  // gray
    Commercial: createColoredIcon('#3b82f6'),  // blue
};

const KNOWN_LOGOS = [
    "acciona", "agencia_de_transporte_de_yucatan", "axial", "azvindi", "canadian_solar", "ceec",
    "cen_solutions", "cfe", "cjr_renewable", "cupisa", "eiffage_energia", "eks", "elecnor",
    "enel", "energoya", "engie", "entia", "entoria", "eosol", "ferrovial", "ge", "ges",
    "greening_group", "greensol", "grupo_cobra", "grupo_enhol", "grupo_ortiz", "grupotec",
    "hospital_di_maria", "ica", "imdut", "kempinski", "l_oreal", "maracof", "marriott",
    "mexibus", "negratin", "nextera_energy", "niko", "ohl", "opde", "plaza_nido",
    "power_electronics", "prodiel", "rtp", "saft", "solventia", "sterling_and_wilson", "sungrow",
    "tozzi", "trina_solar", "tsk", "vemo", "barcelo", "hyatt", "riverstone", "tradeco", "cogeneracion",
    "tesla", "oca"
];

function getCustomerLogo(clientName: string | null | undefined): string | null {
    if (!clientName) return null;
    const name = clientName.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_-]/g, "_");
    
    if (KNOWN_LOGOS.includes(name)) {
        return `/Company Logos/${name}.png`;
    }
    if (name.includes("negratin")) return "/Company Logos/negratin.png";
    if (name.includes("greening")) return "/Company Logos/greening_group.png";
    if (name.includes("nextera")) return "/Company Logos/nextera_energy.png";
    if (name.includes("trina")) return "/Company Logos/trina_solar.png";
    if (name.includes("power_electronic")) return "/Company Logos/power_electronics.png";
    if (name.includes("sungrow")) return "/Company Logos/sungrow.png";
    if (name.includes("cfe")) return "/Company Logos/cfe.png";
    if (name.includes("yucatan")) return "/Company Logos/agencia_de_transporte_de_yucatan.png";
    if (name.includes("tesla")) return "/Company Logos/tesla.png";
    if (name.includes("oca")) return "/Company Logos/oca.jpg";
    if (name.includes("cobra")) return "/Company Logos/grupo_cobra.png";
    if (name.includes("ferrovial")) return "/Company Logos/ferrovial.png";
    if (name.includes("vemo")) return "/Company Logos/vemo.png";
    if (name.includes("greensol")) return "/Company Logos/greensol.png";
    if (name.includes("opde")) return "/Company Logos/opde.png";
    return null;
}

const CITY_COORDS: Record<string, [number, number]> = {
    'PEROTE': [19.5614, -97.2428],
    'MEXICALI': [32.6245, -115.4523],
    'PLAYA DEL CARMEN': [20.6296, -87.0739],
    'MERIDA': [20.9674, -89.6236],
    'MÉRIDA': [20.9674, -89.6236],
    'AGUASCALIENTES': [21.9167, -101.9667],
    'MONTERREY': [25.6866, -100.3161],
    'CDMX': [19.4293, -99.1724],
    'ITZIMNÁ': [20.9889, -89.6133]
};

export default function LiveMap() {
    const { projects, personnel, clients, activeSubsidiary } = useStore();

    const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
    const [showActive, setShowActive] = useState(true);
    const [showOnHold, setShowOnHold] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showCommercial, setShowCommercial] = useState(false);

    const activeStatuses = [
        ...(showActive ? ['Active'] : []),
        ...(showOnHold ? ['On Hold'] : []),
        ...(showCompleted ? ['Completed'] : []),
    ];

    const mapProjects = useMemo(() => {
        const operational = projects
            .filter(p => activeStatuses.includes(p.status))
            .map(p => {
                let lat: number | null = null, lng: number | null = null;
                if (p.location) {
                    const locTrimmed = p.location.trim();
                    if (locTrimmed.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(locTrimmed);
                            if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && (parsed.lat !== 0 || parsed.lng !== 0)) {
                                lat = parsed.lat;
                                lng = parsed.lng;
                            }
                        } catch {}
                    } else {
                        const parts = locTrimmed.split(',');
                        if (parts.length === 2) {
                            const pLat = parseFloat(parts[0].trim());
                            const pLng = parseFloat(parts[1].trim());
                            if (!isNaN(pLat) && !isNaN(pLng)) {
                                lat = pLat;
                                lng = pLng;
                            }
                        }
                    }
                    if (lat === null || lng === null) {
                        const locUpper = locTrimmed.toUpperCase();
                        for (const [key, coords] of Object.entries(CITY_COORDS)) {
                            if (locUpper.includes(key)) {
                                lat = coords[0];
                                lng = coords[1];
                                break;
                            }
                        }
                    }
                }
                const clientObj = clients.find(c => c.id === p.clientId);
                return {
                    ...p,
                    isCommercial: false,
                    lat, lng,
                    clientName: clientObj?.name || (p as any).client || null,
                    teams: (p.assignedPersonnel || [])
                        .map(id => personnel.find(u => u.id === id))
                        .filter(Boolean),
                };
            })
            .filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat!) && !isNaN(p.lng!));

        const commercialList = showCommercial ? guestProjects.map(gp => ({
            id: gp.id,
            name: gp.name,
            codeName: gp.id,
            status: 'Commercial',
            progress: 100,
            projectSize: (gp as any).year ? `Año ${gp.year}` : '',
            systemType: gp.locationString || '',
            location: `${gp.lat},${gp.lng}`,
            clientName: gp.client,
            description: gp.description,
            isCommercial: true,
            lat: gp.lat,
            lng: gp.lng,
            teams: [],
        })) : [];

        return [...operational, ...commercialList];
    }, [projects, personnel, clients, activeStatuses.join(','), showCommercial]);

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
    const totalTeams = new Set(mapProjects.filter(p => !p.isCommercial).flatMap(p => p.teams.map((t: any) => t.id))).size;

    const initialCenter: [number, number] = activeSubsidiary === 'MX'
        ? [23.6345, -102.5528]
        : [39.8283, -98.5795];

    return (
        <div className="h-[calc(100vh-64px)] w-full relative flex flex-col bg-surface-alt z-0">
            {/* Map Layer Switcher (Streets vs Satellite) */}
            <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setMapLayer('streets')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        mapLayer === 'streets'
                            ? 'bg-brand-teal text-white shadow-sm'
                            : 'text-gray-600 hover:text-brand-teal hover:bg-gray-50'
                    }`}
                >
                    <MapIcon size={14} />
                    <span>Mapa</span>
                </button>
                <button
                    type="button"
                    onClick={() => setMapLayer('satellite')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        mapLayer === 'satellite'
                            ? 'bg-brand-teal text-white shadow-sm'
                            : 'text-gray-600 hover:text-brand-teal hover:bg-gray-50'
                    }`}
                >
                    <Layers size={14} />
                    <span>Satélite</span>
                </button>
            </div>

            {/* Overlay Dashboard Card */}
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
                        { label: 'Active', checked: showActive, set: setShowActive, color: '#14b8a6', count: projects.filter(p => p.status === 'Active' && p.location).length },
                        { label: 'On Hold', checked: showOnHold, set: setShowOnHold, color: '#f59e0b', count: projects.filter(p => p.status === 'On Hold' && p.location).length },
                        { label: 'Completed', checked: showCompleted, set: setShowCompleted, color: '#9ca3af', count: projects.filter(p => p.status === 'Completed' && p.location).length },
                        { label: 'Track Record (Comercial)', checked: showCommercial, set: setShowCommercial, color: '#3b82f6', count: guestProjects.length },
                    ] as const).map(({ label, checked, set, color, count }) => (
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
                                        ({count})
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
                    center={initialCenter}
                    zoom={activeSubsidiary === 'MX' ? 5 : 4}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                >
                    {mapLayer === 'streets' ? (
                        <TileLayer
                            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            maxZoom={19}
                        />
                    ) : (
                        <>
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                                maxZoom={19}
                            />
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                                maxZoom={19}
                            />
                        </>
                    )}

                    {mapProjects.map(proj => (
                        <Marker
                            key={`${proj.isCommercial ? 'comm' : 'op'}-${proj.id}`}
                            position={[proj.lat!, proj.lng!]}
                            icon={MARKERS[proj.status as keyof typeof MARKERS] || DefaultIcon}
                            zIndexOffset={proj.status === 'Active' ? 1000 : proj.status === 'On Hold' ? 500 : 0}
                        >
                            <Popup>
                                <div className="p-1 min-w-[250px]">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div>
                                            <h3 className="font-bold text-accent-greyDark text-sm leading-tight">{proj.name}</h3>
                                            {proj.clientName && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    {getCustomerLogo(proj.clientName) ? (
                                                        <img 
                                                            src={getCustomerLogo(proj.clientName)!} 
                                                            alt={proj.clientName} 
                                                            className="h-4 max-w-[80px] object-contain"
                                                        />
                                                    ) : (
                                                        <span className="text-[11px] font-semibold text-gray-500">{proj.clientName}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                            proj.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            proj.status === 'On Hold' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                            proj.status === 'Commercial' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                            {proj.status === 'Commercial' ? 'Comercial' : proj.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] font-mono text-brand-teal mb-3 pb-2 border-b border-gray-100">
                                        <span>{proj.codeName || proj.id}</span>
                                        {proj.projectSize && (
                                            <>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-gray-600 font-semibold">{proj.projectSize}</span>
                                            </>
                                        )}
                                        {proj.systemType && (
                                            <>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-gray-600 font-semibold">{proj.systemType}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Description for Commercial Projects */}
                                    {(proj as any).description && (
                                        <p className="text-xs text-gray-600 leading-relaxed mb-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                            {(proj as any).description}
                                        </p>
                                    )}

                                    {/* Progress Bar & Teams for Operational Projects */}
                                    {!proj.isCommercial && (
                                        <>
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
                                                    <div className="space-y-1.5">
                                                        {[...proj.teams].sort((a: any, b: any) => {
                                                            const aIsLead = (proj as any).siteLeadIds?.includes(a.id) ? 1 : 0;
                                                            const bIsLead = (proj as any).siteLeadIds?.includes(b.id) ? 1 : 0;
                                                            return bIsLead - aIsLead;
                                                        }).map((t: any) => {
                                                            const isLead = (proj as any).siteLeadIds?.includes(t.id);
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
                                        </>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
