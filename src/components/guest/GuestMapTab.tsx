import { useMemo, useEffect, useState, useRef } from 'react';
import guestProjects from '../../data/guestProjects.json';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, Search, MapPin, Layers, SlidersHorizontal } from 'lucide-react';
import L from 'leaflet';

// Fix default icon assets for Vite bundling
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const KNOWN_LOGOS = [
    "acciona", "agencia_de_transporte_de_yucatan", "axial", "azvindi", "canadian_solar", "ceec",
    "cen_solutions", "cfe", "cjr_renewable", "cupisa", "eiffage_energia", "eks", "elecnor",
    "enel", "energoya", "engie", "entia", "entoria", "eosol", "ferrovial", "ge", "ges",
    "greening_group", "greensol", "grupo_cobra", "grupo_enhol", "grupo_ortiz", "grupotec",
    "hospital_di_maria", "ica", "imdut", "kempinski", "l_oreal", "maracof", "marriott",
    "mexibus", "negratin", "nextera_energy", "niko", "ohl", "opde", "plaza_nido",
    "power_electronics", "prodiel", "rtp", "saft", "solventia", "sterling_and_wilson", "sungrow",
    "tozzi", "trina_solar", "tsk", "vemo"
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
    if (name.includes("di_maria")) return "/Company Logos/hospital_di_maria.png";
    if (name.includes("yucatan")) return "/Company Logos/agencia_de_transporte_de_yucatan.png";
    if (name.includes("tesla")) return "/Company Logos/tesla.png";
    if (name.includes("oca")) return "/Company Logos/oca.jpg";
    if (name.includes("cobra")) return "/Company Logos/grupo_cobra.png";
    if (name.includes("ferrovial")) return "/Company Logos/ferrovial.png";
    if (name.includes("tozzi")) return "/Company Logos/tozzi.png";
    
    return null;
}

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
    return b.length > a.length ? b : a;
}

interface MergedProject {
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
}

function groupProjects(projects: typeof guestProjects): MergedProject[] {
    const grouped = new Map<string, MergedProject>();
    for (const n of projects) {
        if (n.lat === null || n.lng === null || isNaN(n.lat) || isNaN(n.lng)) continue;
        const key = projectGroupKey(n.name ?? "", n.lat, n.lng);
        const existing = grouped.get(key);
        if (existing) {
            existing.name = longerString(existing.name, n.name);
            const client = n.client ?? "";
            if (client && !existing.clients.includes(client)) {
                existing.clients.push(client);
            }
            if (!existing.client && client) {
                existing.client = client;
            }
            if (!existing.year && n.year) {
                existing.year = n.year;
            }
            if (!existing.status && n.status) {
                existing.status = n.status;
            }
            if (n.description && !existing.scopes.some(s => s.text === n.description)) {
                existing.scopes.push({ text: n.description, year: n.year ?? null, client: client || "No Client" });
            }
        } else {
            const client = n.client ?? "";
            grouped.set(key, {
                id: n.id,
                name: n.name,
                client,
                clients: client ? [client] : [],
                status: n.status ?? "",
                year: n.year ?? null,
                lat: n.lat,
                lng: n.lng,
                locationString: n.locationString ?? null,
                country: getLocationCountry(n.locationString),
                scopes: n.description ? [{ text: n.description, year: n.year ?? null, client: client || "No Client" }] : []
            });
        }
    }
    return Array.from(grouped.values());
}

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
    "In Progress": createColoredIcon("#14b8a6"),
    "Active": createColoredIcon("#14b8a6"),
    "En proceso": createColoredIcon("#14b8a6"),
    "En procceso": createColoredIcon("#14b8a6"),
    "On Hold": createColoredIcon("#f59e0b"),
    "Completed": createColoredIcon("#9ca3af"),
    "Finalizado": createColoredIcon("#9ca3af"),
};

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

function BoundsTracker({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
    const map = useMap();
    useEffect(() => {
        const handler = () => onBoundsChange(map.getBounds());
        map.on('moveend', handler);
        map.on('zoomend', handler);
        onBoundsChange(map.getBounds());
        return () => {
            map.off('moveend', handler);
            map.off('zoomend', handler);
        };
    }, [map, onBoundsChange]);
    return null;
}

export default function GuestMapTab() {
    const allProjects = useMemo(() => groupProjects(guestProjects), []);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterYear, setFilterYear] = useState("All");
    const [filterCountry, setFilterCountry] = useState("All");
    const [filterClient, setFilterClient] = useState("All");
    
    const [map, setMap] = useState<L.Map | null>(null);
    const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const markerRefs = useRef<{ [key: string]: L.Marker | null }>({});

    const yearsList = useMemo(() => {
        const years = allProjects.map(p => p.year).filter(y => y !== null && y !== "N/A");
        return Array.from(new Set(years.map(String))).sort((a, b) => Number(b) - Number(a));
    }, [allProjects]);

    const countriesList = useMemo(() => {
        const countries = allProjects.map(p => p.country).filter(c => !!c);
        return Array.from(new Set(countries)).sort() as string[];
    }, [allProjects]);

    const clientsList = useMemo(() => {
        const clients = guestProjects.map(p => p.client).filter(c => !!c);
        return Array.from(new Set(clients)).sort() as string[];
    }, []);

    const statusesList = useMemo(() => {
        const statuses = allProjects.map(p => p.status).filter(s => !!s);
        return Array.from(new Set(statuses)).sort() as string[];
    }, [allProjects]);

    const filteredProjects = useMemo(() => {
        return allProjects.filter(proj => {
            if (filterStatus !== "All" && proj.status !== filterStatus) return false;
            
            if (filterYear !== "All") {
                const matchYear = proj.year?.toString() === filterYear || 
                    proj.scopes.some(s => s.year?.toString() === filterYear);
                if (!matchYear) return false;
            }
            
            if (filterClient !== "All" && !proj.clients.includes(filterClient)) return false;
            if (filterCountry !== "All" && proj.country !== filterCountry) return false;

            if (searchTerm) {
                const query = searchTerm.toLowerCase();
                const matchName = proj.name.toLowerCase().includes(query);
                const matchClient = proj.clients.some(c => c.toLowerCase().includes(query));
                const matchScope = proj.scopes.some(s => s.text.toLowerCase().includes(query));
                const matchCountry = proj.country?.toLowerCase().includes(query);
                return matchName || matchClient || matchScope || matchCountry;
            }
            return true;
        });
    }, [allProjects, searchTerm, filterStatus, filterYear, filterCountry, filterClient]);

    const visibleProjectsList = useMemo(() => {
        return filteredProjects.filter(p => mapBounds ? mapBounds.contains([p.lat, p.lng]) : true);
    }, [filteredProjects, mapBounds]);

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

    const statusColor = (status: string) => {
        return status === 'Active' || status === 'In Progress' || status === 'En proceso'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : status === 'On Hold'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-gray-50 text-gray-600 border-gray-200';
    };

    return (
        <div className="absolute inset-0 flex flex-col pt-[84px]">
            {/* Filter Bar */}
            <div className="shrink-0 bg-white border-b border-gray-200 p-3 z-[400] relative">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input 
                            type="text" 
                            placeholder="Search projects…" 
                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Collapsible toggle button visible on mobile */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`md:hidden flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${
                            showFilters 
                                ? 'bg-brand-teal text-white border-brand-teal' 
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                    >
                        <SlidersHorizontal size={13} />
                        Filters
                    </button>
                    <span className="hidden md:inline-block text-[10px] font-bold bg-brand-teal/10 text-brand-teal px-2.5 py-1 rounded-full uppercase shrink-0">
                        {filteredProjects.length} Found
                    </span>
                </div>

                {/* Collapsible Filter Selectors list */}
                <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row flex-wrap gap-2 mt-2.5 pt-2.5 border-t border-gray-100 md:border-t-0 md:mt-2 md:pt-0`}>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 px-3 py-1.5 focus:outline-none focus:border-brand-teal cursor-pointer"
                        value={filterClient}
                        onChange={e => setFilterClient(e.target.value)}
                    >
                        <option value="All">All Customers</option>
                        {clientsList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 px-3 py-1.5 focus:outline-none focus:border-brand-teal cursor-pointer"
                        value={filterCountry}
                        onChange={e => setFilterCountry(e.target.value)}
                    >
                        <option value="All">All Countries</option>
                        {countriesList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 px-3 py-1.5 focus:outline-none focus:border-brand-teal cursor-pointer"
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                    >
                        <option value="All">All Years</option>
                        {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 px-3 py-1.5 focus:outline-none focus:border-brand-teal cursor-pointer"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="All">All Status</option>
                        {statusesList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {/* Found indicator inside filter bar on mobile */}
                    <div className="flex md:hidden items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-gray-400">STATUS PREVIEW</span>
                        <span className="text-[10px] font-bold bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded-full uppercase">
                            {filteredProjects.length} Found
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Map (2/3) */}
                <div className="flex-none h-[50vh] md:h-auto md:flex-[2] relative bg-gray-100 z-0">
                    <MapContainer
                        center={[22, -99]}
                        zoom={5}
                        style={{ height: "100%", width: "100%" }}
                        zoomControl={true}
                        ref={setMap}
                    >
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                        />
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        />
                        <BoundsTracker onBoundsChange={setMapBounds} />

                        {/* Offices */}
                        {OFFICES.map(off => (
                            <Marker key={off.id} position={[off.lat, off.lng]} icon={OfficeIcon}>
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

                        {/* Projects */}
                        {filteredProjects.map(proj => (
                            <Marker
                                key={proj.id}
                                position={[proj.lat, proj.lng]}
                                icon={MARKERS[proj.status as keyof typeof MARKERS] || DefaultIcon}
                                ref={r => { markerRefs.current[proj.id] = r; }}
                            >
                                <Popup>
                                    <div className="p-1 min-w-[270px]">
                                        <div className="flex items-start mb-2">
                                            <h3 className="font-black text-accent-greyDark flex-1 text-lg leading-tight">{proj.name}</h3>
                                        </div>
                                        <div className="mb-3">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${statusColor(proj.status)}`}>
                                                {proj.status}
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

                                            <div className="flex items-start gap-3 text-sm">
                                                <MapPin className="text-emerald-500 shrink-0 mt-0.5" size={15} />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Location Info</span>
                                                    <span className="font-semibold text-gray-700 font-mono text-xs">{proj.lat.toFixed(4)},  {proj.lng.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                    
                    {/* Legend */}
                    <div className="absolute bottom-6 left-6 z-[400] bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 hidden md:flex items-center gap-6 pointer-events-none">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Legend</span>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#14b8a6]" /><span className="text-xs font-bold text-gray-700">In Progress</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs font-bold text-gray-700">On Hold</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400" /><span className="text-xs font-bold text-gray-700">Completed</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white border-2 border-gray-300" /><span className="text-xs font-bold text-gray-700">LATNOVVA Office</span></div>
                        </div>
                    </div>
                </div>

                {/* List (1/3) */}
                <div className="flex-1 md:flex-none md:w-[340px] bg-white flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-gray-200">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0 flex justify-between items-center">
                        <h2 className="font-bold text-accent-greyDark text-sm">Projects List</h2>
                        <span className="text-[10px] font-bold bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded-full uppercase">
                            {visibleProjectsList.length} Visible
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {visibleProjectsList.map(proj => (
                            <div
                                key={proj.id}
                                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-brand-teal/30 transition-all group cursor-pointer"
                                onClick={() => {
                                    if (map) {
                                        map.setView([proj.lat, proj.lng], 10, { animate: true });
                                        const marker = markerRefs.current[proj.id];
                                        if (marker) marker.openPopup();
                                    }
                                }}
                            >
                                <div className="flex justify-between items-start mb-1.5 gap-2">
                                    <h3 className="font-bold text-accent-greyDark text-sm leading-tight group-hover:text-brand-teal transition-colors">{proj.name}</h3>
                                    <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusColor(proj.status)}`}>
                                        {proj.status}
                                    </span>
                                </div>

                                {/* Scopes preview */}
                                {proj.scopes.length > 0 && (
                                    <div className="mb-1.5 flex items-start gap-1 text-xs text-gray-500 w-full overflow-hidden">
                                        <Layers size={11} className="shrink-0 text-brand-teal mt-0.5" />
                                        {proj.scopes.length === 1
                                            ? <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                {proj.scopes[0].year && <span className="font-bold text-brand-teal/80 text-[10px]">{proj.scopes[0].year}</span>}
                                                <span className="truncate block text-gray-600">{proj.scopes[0].text}</span>
                                              </div>
                                            : <span className="font-semibold text-brand-teal">{proj.scopes.length} scopes</span>
                                        }
                                    </div>
                                )}

                                {proj.client && (
                                    <div className="flex items-center justify-between gap-1.5 mb-1.5 text-xs text-gray-500 w-full">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {getCustomerLogo(proj.client) ? (
                                                <img
                                                    src={getCustomerLogo(proj.client)!}
                                                    alt={proj.client}
                                                    className="w-4 h-4 rounded object-contain bg-gray-50 border border-gray-100 p-0.5 shrink-0"
                                                />
                                            ) : (
                                                <Building2 size={11} className="shrink-0" />
                                            )}
                                            <span className="truncate">{proj.client}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <MapPin size={11} className="shrink-0" />
                                    <span className="font-mono">{proj.lat.toFixed(4)}, {proj.lng.toFixed(4)}</span>
                                </div>
                            </div>
                        ))}
                        {visibleProjectsList.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">
                                No projects match your search criteria or are visible in the current map region.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
