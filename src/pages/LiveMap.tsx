import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Users, ArrowRight, Radio, Map as MapIcon, Layers, Search, Building2, MapPin } from 'lucide-react';
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
function createColoredIcon(color: string, isPulse = false) {
    return L.divIcon({
        className: '',
        html: `
            <div style="position: relative; width: 30px; height: 30px;">
                ${isPulse ? `
                    <div style="
                        position: absolute;
                        inset: -4px;
                        border-radius: 50%;
                        background: ${color};
                        opacity: 0.35;
                        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
                    "></div>
                ` : ''}
                <div style="
                    position: relative;
                    width: 26px; height: 26px;
                    background: ${color};
                    border: 2.5px solid white;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
                "></div>
            </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
    });
}

const OfficeIcon = L.divIcon({
    className: '',
    html: `<div style="
        width: 38px; height: 38px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "><img src="/latnovva-O-logo.png" style="width: 100%; height: 100%; object-fit: contain;" /></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
});

const MARKERS = {
    'Active': createColoredIcon('#14b8a6', true),
    'In Progress': createColoredIcon('#14b8a6', true),
    'En proceso': createColoredIcon('#14b8a6', true),
    'En procceso': createColoredIcon('#14b8a6', true),
    'On Hold': createColoredIcon('#f59e0b', false),
    'Completed': createColoredIcon('#9ca3af', false),
    'Finalizado': createColoredIcon('#9ca3af', false),
    'Office': OfficeIcon
};

const statusColor = (status: string) => {
    switch (status) {
        case 'Finalizado':
        case 'Completed':
            return 'bg-gray-100 text-gray-700 border-gray-300';
        case 'En proceso':
        case 'En procceso':
        case 'In Progress':
        case 'Active':
            return 'bg-teal-50 text-teal-700 border-teal-200';
        case 'On Hold':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        default:
            return 'bg-gray-100 text-gray-700 border-gray-300';
    }
};

const KNOWN_LOGOS = [
    "acciona", "agencia_de_transporte_de_yucatan", "axial", "azvindi", "canadian_solar", "ceec",
    "cen_solutions", "cfe", "cjr_renewable", "cupisa", "eiffage_energia", "eks", "elecnor",
    "enel", "energoya", "engie", "entia", "entoria", "eosol", "ferrovial", "ge", "ges",
    "greening_group", "greensol", "grupo_cobra", "grupo_enhol", "grupo_ortiz", "grupotec",
    "hospital_di_maria", "ica", "imdut", "kempinski", "l_oreal", "maracof", "marriott",
    "mexibus", "negratin", "nextera_energy", "niko", "ohl", "opde", "plaza_nido",
    "power_electronics", "prodiel", "rtp", "saft", "solventia", "sterling_and_wilson", "sungrow",
    "tozzi", "trina_solar", "tsk", "vemo", "barcelo", "hyatt", "riverstone", "tradeco", "cogeneracion"
];

function getCustomerLogo(clientName: string | null | undefined): string | null {
    if (!clientName) return null;
    const name = clientName.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_-]/g, "_");

    if (KNOWN_LOGOS.includes(name)) return `/Company Logos/${name}.png`;
    if (name.includes("negratin")) return "/Company Logos/negratin.png";
    if (name.includes("greening")) return "/Company Logos/greening_group.png";
    if (name.includes("nextera")) return "/Company Logos/nextera_energy.png";
    if (name.includes("trina")) return "/Company Logos/trina_solar.png";
    if (name.includes("power_electronic")) return "/Company Logos/power_electronics.png";
    if (name.includes("di_maria")) return "/Company Logos/hospital_di_maria.png";
    if (name.includes("yucatan")) return "/Company Logos/agencia_de_transporte_de_yucatan.png";
    if (name.includes("tesla")) return "/Company Logos/tesla.png";
    if (name.includes("oca")) return "/Company Logos/oca.jpg";
    if (name.includes("cobra")) return "/Company Logos/grupo_cobra.png";
    if (name.includes("ferrovial")) return "/Company Logos/ferrovial.png";
    if (name.includes("tozzi")) return "/Company Logos/tozzi.png";
    if (name.includes("barcelo")) return "/Company Logos/barcelo.png";
    if (name.includes("hyatt")) return "/Company Logos/hyatt.png";
    if (name.includes("riverstone")) return "/Company Logos/riverstone.png";
    if (name.includes("tradeco")) return "/Company Logos/tradeco.png";
    if (name.includes("cogeneracion")) return "/Company Logos/cogeneracion.png";
    if (name.includes("sungrow")) return "/Company Logos/sungrow.png";
    if (name.includes("cfe")) return "/Company Logos/cfe.png";
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

const OFFICES = [
    {
        id: "office-merida",
        name: "LATNOVVA Mérida Office",
        lat: 20.9674,
        lng: -89.5926,
        flag: "🇲🇽",
        country: "México",
        address: "Calle 56 #500, Oficina 1 Edificio 6, Itzimina, Mérida, Yuc."
    },
    {
        id: "office-cdmx",
        name: "LATNOVVA CDMX Office",
        lat: 19.4293,
        lng: -99.1724,
        flag: "🇲🇽",
        country: "México",
        address: "Río Nilo 80, Oficina 301, Cuauhtémoc, Ciudad de México"
    },
    {
        id: "office-miami",
        name: "LATNOVVA Miami Office",
        lat: 25.7617,
        lng: -80.1918,
        flag: "🇺🇸",
        country: "Estados Unidos",
        address: "1801 NE 123rd Street Suite 336, Miami, Florida"
    },
    {
        id: "office-bogota",
        name: "LATNOVVA Bogotá Office",
        lat: 4.6841,
        lng: -74.0478,
        flag: "🇨🇴",
        country: "Colombia",
        address: "Calle 93 #15-27, Ofic 702, Bogotá"
    },
    {
        id: "office-punta-cana",
        name: "LATNOVVA Punta Cana Office",
        lat: 18.5601,
        lng: -68.3725,
        flag: "🇩🇴",
        country: "República Dominicana",
        address: "C/ Ensanche 1B, Punta Cana"
    },
    {
        id: "office-santiago",
        name: "LATNOVVA Santiago Office",
        lat: -33.4172,
        lng: -70.6048,
        flag: "🇨🇱",
        country: "Chile",
        address: "Apoquindo 5950, Piso 21 Oficina 21-116, Las Condes, Santiago de Chile"
    }
];

function getLocationCountry(locationString: string | null | undefined): string | null {
    if (!locationString) return null;
    const str = locationString.trim();
    if (/^[\d\s,.-]+$/.test(str)) return null;
    const match = str.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : str;
}

function projectGroupKey(name: string, lat: number, lng: number): string {
    const cleanName = name.toLowerCase()
        .replace(/^(pfv|pf|pe|p\.e\.)\s+/g, "")
        .replace(/\b\d+(\s*mw[p]?)\b/gi, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
    return `${cleanName}_${lat.toFixed(1)},${lng.toFixed(1)}`;
}

function longerString(a: string, b: string): string {
    return (b || '').length > (a || '').length ? b : a;
}

interface MergedUnifiedProject {
    id: string;
    name: string;
    client: string;
    clients: string[];
    status: string;
    year: string | number | null;
    lat: number;
    lng: number;
    locationString: string | null;
    country: string | null;
    scopes: Array<{ text: string; year: string | number | null; client: string }>;
    isLiveOperational: boolean;
    operationalId: string | null;
    progress: number;
    siteLeadIds: string[];
    teams: any[];
}

function normalizeText(s: string | null | undefined): string {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

// Map center adjuster on filter change
function MapViewHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom, { animate: true });
    }, [center, zoom, map]);
    return null;
}

export default function LiveMap() {
    const { projects, personnel, clients, activeSubsidiary } = useStore();

    const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('satellite');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed'>('All');
    const [showOffices, setShowOffices] = useState(true);

    // Unify Commercial DB (269 projects) with Supabase Operational DB & Group multi-scopes
    const allUnifiedProjects = useMemo(() => {
        const matchedOpIds = new Set<string>();

        // 1. Process all projects from the commercial portal database
        const commercialList = guestProjects.map(gp => {
            const gpNorm = normalizeText(gp.name);

            // Find matching operational project in Supabase
            const opMatch = projects.find(op => {
                const opNorm = normalizeText(op.name);
                const opCode = normalizeText(op.codeName);
                if (opCode && gpNorm.includes(opCode)) return true;
                if (opNorm.length > 5 && (gpNorm.includes(opNorm) || opNorm.includes(gpNorm))) return true;
                return false;
            });

            if (opMatch) {
                matchedOpIds.add(opMatch.id);
            }

            const clientObj = opMatch?.clientId ? clients.find(c => c.id === opMatch.clientId) : null;
            const clientName = clientObj?.name || gp.client || null;

            const isOperationalActive = opMatch?.status === 'Active' || gp.status === 'Active';
            const status = isOperationalActive ? 'Active' : (opMatch?.status || gp.status || 'Completed');

            const assignedWorkers = (opMatch?.assignedPersonnel || [])
                .map(id => personnel.find(p => p.id === id))
                .filter(Boolean);

            return {
                id: opMatch?.id || gp.id,
                name: opMatch?.name || gp.name,
                codeName: opMatch?.codeName || gp.id,
                clientName,
                country: getLocationCountry(gp.locationString) || gp.locationString || 'Other',
                locationString: gp.locationString || null,
                year: (gp as any).year || null,
                description: gp.description || '',
                lat: gp.lat,
                lng: gp.lng,
                status,
                progress: opMatch?.progress ?? (isOperationalActive ? 65 : 100),
                isLiveOperational: !!opMatch,
                operationalId: opMatch?.id || null,
                siteLeadIds: opMatch?.siteLeadIds || [],
                teams: assignedWorkers,
            };
        });

        // 2. Include any operational project from Supabase not found in guestProjects
        const additionalOpList: typeof commercialList = [];
        for (const op of projects) {
            if (matchedOpIds.has(op.id)) continue;

            let lat: number | null = null, lng: number | null = null;
            if (op.location) {
                const locTrimmed = op.location.trim();
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

            if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) continue;

            const clientObj = clients.find(c => c.id === op.clientId);
            const assignedWorkers = (op.assignedPersonnel || [])
                .map(id => personnel.find(p => p.id === id))
                .filter(Boolean);

            additionalOpList.push({
                id: op.id,
                name: op.name,
                codeName: op.codeName || op.id,
                clientName: clientObj?.name || null,
                country: op.subsidiary === 'MX' ? 'México' : 'Estados Unidos',
                locationString: op.location || null,
                year: 2024,
                description: op.systemType ? `${op.systemType} - ${op.projectSize || ''}` : '',
                lat,
                lng,
                status: op.status,
                progress: op.progress || 0,
                isLiveOperational: true,
                operationalId: op.id,
                siteLeadIds: op.siteLeadIds || [],
                teams: assignedWorkers,
            });
        }

        const rawList = [...commercialList, ...additionalOpList];

        // 3. Group multi-scope / multi-client projects sharing the same facility
        const grouped = new Map<string, MergedUnifiedProject>();
        for (const n of rawList) {
            if (n.lat === null || n.lng === null || isNaN(n.lat) || isNaN(n.lng)) continue;
            const key = projectGroupKey(n.name ?? '', n.lat, n.lng);
            const existing = grouped.get(key);
            const client = n.clientName ?? '';

            if (existing) {
                existing.name = longerString(existing.name, n.name);
                if (client && !existing.clients.includes(client)) {
                    existing.clients.push(client);
                }
                if (!existing.client && client) {
                    existing.client = client;
                }
                if (!existing.year && n.year) {
                    existing.year = n.year;
                }
                if (n.status === 'Active' || n.status === 'In Progress') {
                    existing.status = 'Active';
                }
                if (n.description && !existing.scopes.some(s => s.text === n.description)) {
                    existing.scopes.push({ text: n.description, year: n.year ?? null, client: client || 'No Client' });
                }
                if (n.isLiveOperational) {
                    existing.isLiveOperational = true;
                }
                if (n.operationalId && !existing.operationalId) {
                    existing.operationalId = n.operationalId;
                }
                if (n.progress > existing.progress) {
                    existing.progress = n.progress;
                }
                if (n.siteLeadIds && n.siteLeadIds.length > 0) {
                    existing.siteLeadIds = Array.from(new Set([...existing.siteLeadIds, ...n.siteLeadIds]));
                }
                if (n.teams && n.teams.length > 0) {
                    const existingTeamIds = new Set(existing.teams.filter(Boolean).map((t: any) => t.id));
                    for (const t of n.teams) {
                        if (t && !existingTeamIds.has(t.id)) {
                            existing.teams.push(t);
                            existingTeamIds.add(t.id);
                        }
                    }
                }
            } else {
                grouped.set(key, {
                    id: n.id,
                    name: n.name,
                    client,
                    clients: client ? [client] : [],
                    status: n.status ?? 'Completed',
                    year: n.year ?? null,
                    lat: n.lat,
                    lng: n.lng,
                    locationString: n.locationString,
                    country: n.country || null,
                    scopes: n.description ? [{ text: n.description, year: n.year ?? null, client: client || 'No Client' }] : [],
                    isLiveOperational: !!n.isLiveOperational,
                    operationalId: n.operationalId || null,
                    progress: n.progress || 0,
                    siteLeadIds: n.siteLeadIds || [],
                    teams: n.teams ? [...n.teams] : []
                });
            }
        }

        return Array.from(grouped.values());
    }, [projects, personnel, clients]);

    // Filtered project list based on search and status
    const visibleProjects = useMemo(() => {
        return allUnifiedProjects.filter(p => {
            if (statusFilter === 'Active' && p.status !== 'Active') return false;
            if (statusFilter === 'Completed' && p.status === 'Active') return false;

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = p.name.toLowerCase().includes(term);
                const matchClients = p.clients.some(c => c.toLowerCase().includes(term));
                const matchScopes = p.scopes.some(s => s.text.toLowerCase().includes(term));
                const matchCountry = (p.country || '').toLowerCase().includes(term);
                if (!matchName && !matchClients && !matchScopes && !matchCountry) return false;
            }

            return true;
        });
    }, [allUnifiedProjects, statusFilter, searchTerm]);

    // Metrics for the floating HUD
    const totalProjectsCount = allUnifiedProjects.length;
    const activeSitesCount = allUnifiedProjects.filter(p => p.status === 'Active').length;
    const deployedTechCount = new Set(
        allUnifiedProjects.flatMap(p => p.teams.filter(Boolean).map((t: any) => t.id))
    ).size;
    const uniqueCountriesCount = new Set(allUnifiedProjects.map(p => p.country).filter(Boolean)).size;

    // Center calculation
    const mapCenter: [number, number] = useMemo(() => {
        return activeSubsidiary === 'MX' ? [23.6345, -102.5528] : [23.5, -85.0];
    }, [activeSubsidiary]);

    const mapZoom = useMemo(() => {
        return activeSubsidiary === 'MX' ? 5 : 4;
    }, [activeSubsidiary]);

    useEffect(() => {
        const styles = document.createElement('style');
        styles.innerHTML = `
            .leaflet-popup-content-wrapper { border-radius: 1.25rem !important; padding: 0 !important; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important; }
            .leaflet-popup-content { margin: 16px !important; }
            .leaflet-container { font-family: inherit !important; }
        `;
        document.head.appendChild(styles);
        return () => { document.head.removeChild(styles); };
    }, []);

    return (
        <div className="h-[calc(100vh-64px)] w-full relative flex flex-col bg-surface-alt z-0">
            {/* Top Toolbar: Search & Country Pills */}
            {/* Top Right: Layer Switcher & Offices Toggle */}
            <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 pointer-events-auto">
                {/* Offices Toggle */}
                <button
                    type="button"
                    onClick={() => setShowOffices(!showOffices)}
                    className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg border ${
                        showOffices
                            ? 'bg-slate-900 text-teal-400 border-slate-800'
                            : 'bg-white/95 text-gray-600 border-gray-200/80 hover:bg-gray-50'
                    }`}
                    title="Mostrar/Ocultar Oficinas Corporativas"
                >
                    <Building2 size={14} />
                    <span className="hidden sm:inline">Oficinas</span>
                </button>

                {/* Map Layer Switcher (Streets vs Satellite) */}
                <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-gray-200/80 flex items-center gap-1">
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
            </div>

            {/* Floating HUD: Operation KPIs & Status Filter */}
            <div className="absolute bottom-6 left-6 z-[400] bg-white/95 backdrop-blur-md px-5 py-4 rounded-3xl shadow-2xl border border-gray-200/80 max-w-xs pointer-events-auto select-none hidden md:block">
                <div className="flex items-center gap-3.5 mb-3">
                    <div className="bg-brand-teal/10 p-2.5 rounded-2xl">
                        <Radio className="text-brand-teal animate-pulse" size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-accent-greyDark leading-tight">Live Deployment</h1>
                        <p className="text-[11px] font-medium text-gray-500">Global Operations & Track Record</p>
                    </div>
                </div>

                {/* Search inside HUD */}
                <div className="relative bg-gray-50/80 rounded-xl border border-gray-200/80 flex items-center px-3 py-1.5 mb-3">
                    <Search size={13} className="text-gray-400 shrink-0 mr-2" />
                    <input
                        type="text"
                        placeholder="Buscar proyecto o cliente..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* 4 KPIs Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3.5">
                    <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Total Proyectos</p>
                        <p className="text-xl font-black text-accent-greyDark">{visibleProjects.length}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">Operación Activa</p>
                        <p className="text-xl font-black text-emerald-600">{activeSitesCount}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
                        <p className="text-[10px] text-brand-teal font-bold uppercase tracking-wider mb-0.5">En Campo</p>
                        <p className="text-xl font-black text-brand-teal">{deployedTechCount}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-0.5">Países</p>
                        <p className="text-xl font-black text-blue-600">{uniqueCountriesCount}</p>
                    </div>
                </div>

                {/* Status Filter Buttons */}
                <div className="border-t border-gray-100 pt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filtrar Estatus</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        <button
                            onClick={() => setStatusFilter('All')}
                            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center ${
                                statusFilter === 'All'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Todos ({totalProjectsCount})
                        </button>
                        <button
                            onClick={() => setStatusFilter('Active')}
                            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                                statusFilter === 'Active'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            Activos ({activeSitesCount})
                        </button>
                        <button
                            onClick={() => setStatusFilter('Completed')}
                            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center ${
                                statusFilter === 'Completed'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                        >
                            Histórico
                        </button>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 w-full bg-gray-100 relative z-0">
                <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                >
                    <MapViewHandler center={mapCenter} zoom={mapZoom} />

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

                    {/* LATNOVVA Offices Markers */}
                    {showOffices && OFFICES.map(off => (
                        <Marker
                            key={off.id}
                            position={[off.lat, off.lng]}
                            icon={MARKERS.Office}
                            zIndexOffset={2000}
                        >
                            <Popup>
                                <div className="p-1 min-w-[220px]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">{off.flag}</span>
                                        <div>
                                            <h3 className="font-black text-accent-greyDark text-sm leading-tight">{off.name}</h3>
                                            <span className="text-[10px] text-gray-500">{off.country}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 mb-2">
                                        <MapPin className="text-brand-teal shrink-0 mt-0.5" size={13} />
                                        <span className="text-xs text-gray-600 leading-snug">{off.address}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider bg-teal-50 text-teal-700 border-teal-200">
                                        LATNOVVA Office
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Unified 200+ Projects Markers */}
                    {visibleProjects.map(proj => {
                        const markerIcon = MARKERS[proj.status as keyof typeof MARKERS] || MARKERS.Completed;
                        const isLiveOp = proj.status === 'Active' || proj.isLiveOperational;

                        return (
                            <Marker
                                key={proj.id}
                                position={[proj.lat, proj.lng]}
                                icon={markerIcon}
                                zIndexOffset={proj.status === 'Active' ? 1000 : 100}
                            >
                                <Popup>
                                    <div className="p-1 min-w-[270px] max-w-[340px]">
                                        <div className="flex items-start mb-2">
                                            <h3 className="font-black text-accent-greyDark flex-1 text-lg leading-tight">{proj.name}</h3>
                                        </div>
                                        <div className="mb-3">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${statusColor(proj.status)}`}>
                                                {proj.status === 'Completed' || proj.status === 'Finalizado' ? 'FINALIZADO' : (proj.status === 'Active' || proj.status === 'In Progress' ? 'EN PROCESO' : proj.status)}
                                            </span>
                                        </div>

                                        <div className="space-y-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                            {/* Grouped by Customer (sorted chronologically: oldest first) */}
                                            {proj.clients && proj.clients.length > 0 ? (
                                                <div className="space-y-3.5">
                                                    {[...proj.clients]
                                                        .sort((a, b) => {
                                                            const scopesA = proj.scopes.filter(s => s.client === a);
                                                            const scopesB = proj.scopes.filter(s => s.client === b);
                                                            const getMinYear = (list: typeof proj.scopes) => {
                                                                const years = list.map(s => {
                                                                    if (!s.year) return Infinity;
                                                                    const match = String(s.year).match(/^\d+/);
                                                                    return match ? parseInt(match[0], 10) : Infinity;
                                                                });
                                                                return Math.min(...years);
                                                            };
                                                            return getMinYear(scopesA) - getMinYear(scopesB);
                                                        })
                                                        .map((c, idx) => {
                                                            const clientScopes = proj.scopes
                                                                .filter(s => s.client === c)
                                                                .sort((a, b) => {
                                                                    const getYearVal = (s: typeof proj.scopes[0]) => {
                                                                        if (!s.year) return Infinity;
                                                                        const match = String(s.year).match(/^\d+/);
                                                                        return match ? parseInt(match[0], 10) : Infinity;
                                                                    };
                                                                    return getYearVal(a) - getYearVal(b);
                                                                });

                                                            return (
                                                                <div key={idx} className="space-y-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                                                                    <div className="flex items-center gap-2 bg-white border border-gray-200/60 rounded-xl p-2 px-3 shadow-sm">
                                                                        {getCustomerLogo(c) ? (
                                                                            <img
                                                                                src={getCustomerLogo(c)!}
                                                                                alt={c}
                                                                                className="w-5 h-5 rounded object-contain bg-white border border-gray-100 p-0.5 shrink-0"
                                                                            />
                                                                        ) : (
                                                                            <Building2 className="text-brand-teal shrink-0" size={14} />
                                                                        )}
                                                                        <span className="font-bold text-accent-greyDark text-xs">{c}</span>
                                                                    </div>

                                                                    {clientScopes.length > 0 && (
                                                                        <div className="pl-3 space-y-1.5">
                                                                            <div className="flex items-center gap-1">
                                                                                <Layers className="text-brand-teal/80 shrink-0" size={11} />
                                                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Scopes</span>
                                                                            </div>
                                                                            <ul className="space-y-1.5 pl-1.5">
                                                                                {clientScopes.map((s, i) => (
                                                                                    <li key={i} className="flex gap-2 items-start">
                                                                                        <span className="text-brand-teal font-bold shrink-0 text-[10px] mt-0.5">·</span>
                                                                                        <div className="flex flex-col">
                                                                                            {s.year && (
                                                                                                <span className="text-[9px] font-bold text-brand-teal/70 uppercase tracking-wider leading-none mb-0.5">{s.year}</span>
                                                                                            )}
                                                                                            <span className="text-xs text-gray-600 leading-normal">{s.text}</span>
                                                                                        </div>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            ) : (
                                                /* Scopes with no client assigned (if any) */
                                                proj.scopes.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Layers className="text-brand-teal shrink-0" size={13} />
                                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Scopes</span>
                                                        </div>
                                                        <ul className="space-y-1.5 pl-1.5">
                                                            {proj.scopes
                                                                .sort((a, b) => {
                                                                    const getYearVal = (s: typeof proj.scopes[0]) => {
                                                                        if (!s.year) return Infinity;
                                                                        const match = String(s.year).match(/^\d+/);
                                                                        return match ? parseInt(match[0], 10) : Infinity;
                                                                    };
                                                                    return getYearVal(a) - getYearVal(b);
                                                                })
                                                                .map((s, i) => (
                                                                    <li key={i} className="flex gap-2 items-start">
                                                                        <span className="text-brand-teal font-bold shrink-0 text-[10px] mt-0.5">·</span>
                                                                        <div className="flex flex-col">
                                                                            {s.year && (
                                                                                <span className="text-[9px] font-bold text-brand-teal/70 uppercase tracking-wider leading-none mb-0.5">{s.year}</span>
                                                                            )}
                                                                            <span className="text-xs text-gray-600 leading-normal">{s.text}</span>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    </div>
                                                )
                                            )}

                                            {/* Location Info */}
                                            <div className="flex items-start gap-3 text-sm">
                                                <MapPin className="text-emerald-500 shrink-0 mt-0.5" size={15} />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Location Info</span>
                                                    <span className="font-semibold text-gray-700 font-mono text-xs">{proj.lat.toFixed(4)},  {proj.lng.toFixed(4)}</span>
                                                </div>
                                            </div>

                                            {/* Operational Details (if active or operational project) */}
                                            {isLiveOp && proj.teams && proj.teams.length > 0 && (
                                                <div className="bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-100">
                                                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Users size={13} className="text-emerald-600" />
                                                            <span>Personal en Sitio ({proj.teams.length})</span>
                                                        </div>
                                                        {proj.progress > 0 && (
                                                            <span className="text-[10px] text-emerald-700 font-black">{proj.progress}%</span>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                                        {proj.teams.map((t: any) => {
                                                            const isLead = proj.siteLeadIds?.includes(t.id);
                                                            return (
                                                                <div key={t.id} className="flex justify-between items-center text-xs">
                                                                    <span className={`font-semibold truncate ${isLead ? 'text-emerald-900 font-bold' : 'text-gray-700'}`}>
                                                                        {t.name}
                                                                    </span>
                                                                    {isLead && (
                                                                        <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-black uppercase">
                                                                            Lead
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Link to Operational Detail if matched */}
                                            {proj.operationalId && (
                                                <Link to={`/projects/${proj.operationalId}`}>
                                                    <Button className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-8 text-xs font-bold flex items-center justify-center gap-1.5">
                                                        Ver en Operaciones <ArrowRight size={13} />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}
