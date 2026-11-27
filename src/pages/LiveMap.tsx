import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  X,
  Building2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Briefcase,
  Radio,
  MapPin,
  Home,
  ExternalLink,
  PanelRightOpen,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import guestProjectsRaw from '../data/guestProjects.json';
import {
  LiveSiteCluster,
  LiveSiteDefinition,
  LiveWorkerEntry,
  buildLiveSiteClusters,
  formatElapsedDuration,
  isShiftActiveWithinCutoff,
  isValidCoordinate,
  parseCoordinates,
} from '../utils/liveMap.utils';

const LATNOVVA_OFFICES = [
  { id: 'office-merida', name: 'LATNOVVA Mérida (Oficina)', lat: 20.9854, lng: -89.6152, city: 'Mérida, Yucatán' },
  { id: 'office-cdmx', name: 'LATNOVVA CDMX (Oficina)', lat: 19.4326, lng: -99.1332, city: 'Ciudad de México' },
  { id: 'office-mty', name: 'LATNOVVA Monterrey', lat: 25.6866, lng: -100.3161, city: 'Monterrey, NL' },
  { id: 'office-gdl', name: 'LATNOVVA Guadalajara', lat: 20.6597, lng: -103.3496, city: 'Guadalajara, Jalisco' },
  { id: 'office-houston', name: 'LATNOVVA Houston (US HQ)', lat: 29.7604, lng: -95.3698, city: 'Houston, TX' },
];

interface PortfolioProjectPin {
  id: string;
  name: string;
  client: string;
  location: string;
  systemType: string;
  lat: number;
  lng: number;
  isOffice?: boolean;
}

export default function LiveMap() {
  const projects = useStore((s) => s.projects);
  const personnel = useStore((s) => s.personnel);
  const timesheets = useStore((s) => s.timesheets);
  const activeSubsidiary = useStore((s) => s.activeSubsidiary);
  const refreshAttendance = useStore((s) => s.refreshAttendance);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const liveLayerRef = useRef<L.LayerGroup | null>(null);
  const portfolioLayerRef = useRef<L.LayerGroup | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [liveWorkers, setLiveWorkers] = useState<LiveWorkerEntry[]>([]);
  const [extraLocations, setExtraLocations] = useState<LiveSiteDefinition[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [showLatnovvaProjects, setShowLatnovvaProjects] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Tick every 60s to keep live elapsed shift durations fresh
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Fetch real open V2 shifts + their CLOCK_IN GPS coordinates from attendance_events + attendance_locations
  const fetchLiveOperationsData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const cutoffIso = new Date(Date.now() - 14 * 3600 * 1000).toISOString();

      // 1. Secondary geofence locations (Supabase-backed: PK is location_id, name is location_name)
      try {
        const [{ data: locRows }, { data: projLocRows }] = await Promise.all([
          (supabase.from('attendance_locations') as any)
            .select('location_id, location_name, latitude, longitude, radius_meters, is_active')
            .eq('is_active', true),
          (supabase.from('attendance_project_locations') as any)
            .select('project_id, location_id'),
        ]);

        const projectByLocId = new Map<string, string>();
        if (Array.isArray(projLocRows)) {
          for (const pl of projLocRows) {
            if (pl?.location_id && pl?.project_id && !projectByLocId.has(pl.location_id)) {
              projectByLocId.set(pl.location_id, pl.project_id);
            }
          }
        }

        if (Array.isArray(locRows)) {
          const parsedLocs: LiveSiteDefinition[] = locRows
            .filter((r: any) => isValidCoordinate(r.latitude, r.longitude))
            .map((r: any) => ({
              id: r.location_id,
              projectId: projectByLocId.get(r.location_id),
              name: r.location_name || 'Sitio Registrado',
              lat: Number(r.latitude),
              lng: Number(r.longitude),
              radiusMeters: Number(r.radius_meters) || 300,
              assignedCount: 0,
            }));
          setExtraLocations(parsedLocs);
        }
      } catch {
        // non-fatal if table unavailable
      }

      // 2. Open Attendance V2 shifts
      const { data: openShifts, error: shiftsErr } = await (supabase.from('attendance_shifts') as any)
        .select('shift_id, personnel_id, project_id, work_type, first_clock_in_at, status')
        .eq('status', 'OPEN')
        .gte('first_clock_in_at', cutoffIso)
        .order('first_clock_in_at', { ascending: false });

      const personnelById = new Map(personnel.map((p) => [p.id, p]));
      const projectById = new Map(projects.map((pr) => [pr.id, pr]));
      const matchesSubsidiary = (p: any, projectId?: string | null) => {
        if (!activeSubsidiary) return true;
        const sub = p?.subsidiary || projectById.get(projectId || '')?.subsidiary || 'MX';
        return sub === activeSubsidiary;
      };

      // PASS 15D / Item 27: Authoritative V2 query — even when 0 open shifts, set [] and return
      // (never fall through to stale local timesheets when Supabase succeeded with 0 active shifts).
      if (!shiftsErr && Array.isArray(openShifts)) {
        const shiftIds = openShifts.map((s: any) => s.shift_id).filter(Boolean);

        // Fetch CLOCK_IN attendance_events for real GPS coordinates
        const eventByShift = new Map<string, any>();
        if (shiftIds.length > 0) {
          const { data: events } = await (supabase.from('attendance_events') as any)
            .select('shift_id, latitude, longitude, accuracy_meters, attendance_location_id, event_type, server_received_at')
            .in('shift_id', shiftIds)
            .eq('event_type', 'CLOCK_IN');

          if (Array.isArray(events)) {
            for (const ev of events) {
              if (!eventByShift.has(ev.shift_id)) {
                eventByShift.set(ev.shift_id, ev);
              }
            }
          }
        }

        const mapped: LiveWorkerEntry[] = openShifts
          .filter((s: any) => {
            if (!isShiftActiveWithinCutoff(s.first_clock_in_at)) return false;
            const p = personnelById.get(s.personnel_id);
            return matchesSubsidiary(p, s.project_id);
          })
          .map((s: any) => {
            const p = personnelById.get(s.personnel_id);
            const ev = eventByShift.get(s.shift_id);
            const lat = ev && isValidCoordinate(ev.latitude, ev.longitude) ? Number(ev.latitude) : null;
            const lng = ev && isValidCoordinate(ev.latitude, ev.longitude) ? Number(ev.longitude) : null;
            const d = new Date(s.first_clock_in_at);
            const clockInLabel = Number.isFinite(d.getTime())
              ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
              : '--:--';

            return {
              personnelId: s.personnel_id,
              name: p?.name || 'Personal LATNOVVA',
              role: p?.position || p?.appRole || 'Técnico',
              employeeNumber: p?.employeeNumber,
              avatarUrl: p?.image,
              clockInIso: s.first_clock_in_at,
              clockInLabel,
              workType: s.work_type || 'ON_SITE',
              projectId: s.project_id,
              attendanceLocationId: ev?.attendance_location_id || null,
              lat,
              lng,
              accuracyMeters: ev?.accuracy_meters ?? null,
            };
          });

        setLiveWorkers(mapped);
        return;
      }

      // 3. Fallback to open store timesheets (ONLY when V2 shifts query errored/offline)
      const fallbackWorkers: LiveWorkerEntry[] = [];
      for (const ts of timesheets) {
        if (!ts.timeIn || ts.timeOut) continue;
        const clockInPunch = ts.punches?.find((pu: any) => pu.type === 'clockIn');
        const clockInIso = clockInPunch?.timestamp || `${ts.date}T${ts.timeIn}:00`;
        if (!isShiftActiveWithinCutoff(clockInIso)) continue;
        const p = personnelById.get(ts.personnelId);
        if (!matchesSubsidiary(p, ts.projectId)) continue;
        const lat = clockInPunch && isValidCoordinate(clockInPunch.lat, clockInPunch.lng) ? clockInPunch.lat : null;
        const lng = clockInPunch && isValidCoordinate(clockInPunch.lat, clockInPunch.lng) ? clockInPunch.lng : null;

        fallbackWorkers.push({
          personnelId: ts.personnelId,
          name: p?.name || 'Personal LATNOVVA',
          role: p?.position || p?.appRole || 'Técnico',
          employeeNumber: p?.employeeNumber,
          avatarUrl: p?.image,
          clockInIso,
          clockInLabel: ts.timeIn,
          workType: ts.type === 'Home Office' ? 'HOME_OFFICE' : 'ON_SITE',
          projectId: ts.projectId,
          lat,
          lng,
        });
      }
      setLiveWorkers(fallbackWorkers);
    } catch (err) {
      console.warn('[LiveMap] Live operations fetch error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [personnel, projects, timesheets, activeSubsidiary]);

  useEffect(() => {
    fetchLiveOperationsData();
  }, [fetchLiveOperationsData]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await refreshAttendance();
      await fetchLiveOperationsData();
    } finally {
      setIsSyncing(false);
    }
  };

  // Build Supabase-backed operational sites from active projects + attendance_locations
  const operationalSites = useMemo<LiveSiteDefinition[]>(() => {
    const projectSites: LiveSiteDefinition[] = [];
    for (const proj of projects) {
      if (proj.status === 'Completed') continue;
      if (activeSubsidiary && proj.subsidiary && proj.subsidiary !== activeSubsidiary) continue;
      const coords = parseCoordinates(proj.location);
      if (!coords) continue;
      projectSites.push({
        id: proj.id,
        projectId: proj.id,
        name: proj.name,
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: (proj as any).geofenceRadius || 300,
        assignedCount: proj.assignedPersonnel?.length || 0,
      });
    }

    const existingIds = new Set(projectSites.map((s) => s.id));
    const merged = [...projectSites];
    for (const loc of extraLocations) {
      if (!existingIds.has(loc.id)) merged.push(loc);
    }
    return merged;
  }, [projects, extraLocations, activeSubsidiary]);

  const clusters = useMemo<LiveSiteCluster[]>(() => {
    return buildLiveSiteClusters(operationalSites, liveWorkers);
  }, [operationalSites, liveWorkers]);

  const filteredClusters = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return clusters;
    return clusters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.workers.some(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            w.role.toLowerCase().includes(q) ||
            (w.employeeNumber && w.employeeNumber.toLowerCase().includes(q))
        )
    );
  }, [clusters, searchTerm]);

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === selectedClusterId) || null,
    [clusters, selectedClusterId]
  );

  // Portfolio projects (shown when "Proyectos LATNOVVA" toggle is active)
  const portfolioPins = useMemo<PortfolioProjectPin[]>(() => {
    const pins: PortfolioProjectPin[] = LATNOVVA_OFFICES.map((o) => ({
      id: o.id,
      name: o.name,
      client: 'LATNOVVA',
      location: o.city,
      systemType: 'Oficina',
      lat: o.lat,
      lng: o.lng,
      isOffice: true,
    }));

    const rawList = Array.isArray(guestProjectsRaw) ? (guestProjectsRaw as any[]) : [];
    for (let i = 0; i < rawList.length; i++) {
      const gp = rawList[i];
      const lat = Number(gp.lat ?? gp.latitude);
      const lng = Number(gp.lng ?? gp.longitude);
      if (!isValidCoordinate(lat, lng)) continue;
      pins.push({
        id: gp.id || `gp-${i}`,
        name: gp.name || gp.projectName || 'Proyecto LATNOVVA',
        client: gp.client || gp.customer || 'Cliente LATNOVVA',
        location: gp.locationString || gp.location || gp.city || '',
        systemType: gp.year ? `${gp.status || 'Proyecto'} · ${gp.year}` : (gp.status || 'Proyecto'),
        lat,
        lng,
      });
    }
    return pins;
  }, []);

  const kpiStats = useMemo(() => {
    const totalActive = liveWorkers.length;
    const registeredSites = clusters.filter((c) => c.status !== 'offsite');
    const coveredSites = registeredSites.filter((c) => c.workers.length > 0).length;
    const emptySites = registeredSites.filter((c) => c.workers.length === 0).length;
    return {
      totalActive,
      coveredSites,
      emptySites,
      totalSites: registeredSites.length,
    };
  }, [clusters, liveWorkers]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [21.5, -99.5],
      zoom: 5,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    liveLayerRef.current = L.layerGroup().addTo(map);
    portfolioLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      liveLayerRef.current = null;
      portfolioLayerRef.current = null;
    };
  }, []);

  // Switch Streets vs Satellite tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url =
      mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution =
      mapStyle === 'satellite'
        ? 'Tiles &copy; Esri'
        : '&copy; OpenStreetMap contributors';

    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
  }, [mapStyle]);

  // Render Live Operations markers + geofence circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = liveLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const boundsPoints: L.LatLngExpression[] = [];

    for (const cluster of filteredClusters) {
      if (!isValidCoordinate(cluster.lat, cluster.lng)) continue;
      boundsPoints.push([cluster.lat, cluster.lng]);

      const color =
        cluster.status === 'covered'
          ? '#059669'
          : cluster.status === 'partial'
          ? '#d97706'
          : cluster.status === 'offsite'
          ? '#0284c7'
          : '#64748b';

      // Geofence radius circle for registered sites
      if (cluster.status !== 'offsite' && cluster.radiusMeters > 0) {
        L.circle([cluster.lat, cluster.lng], {
          radius: cluster.radiusMeters,
          color,
          fillColor: color,
          fillOpacity: 0.1,
          weight: 1.5,
          dashArray: cluster.workers.length > 0 ? undefined : '4 4',
        }).addTo(layer);
      }

      const isSelected = cluster.id === selectedClusterId;
      const badgeLabel =
        cluster.assignedCount > 0
          ? `${cluster.workers.length}/${cluster.assignedCount}`
          : `${cluster.workers.length}`;

      const icon = L.divIcon({
        className: 'latnovva-live-pin',
        html: `
          <div style="
            display:flex;align-items:center;gap:6px;
            background:${color};color:#fff;
            padding:5px 10px;border-radius:999px;
            font-size:11px;font-weight:800;white-space:nowrap;
            border:${isSelected ? '3px solid #0f172a' : '2px solid #fff'};
            box-shadow:0 4px 12px rgba(0,0,0,0.28);
            transform:translate(-50%,-50%);
          ">
            <span style="width:7px;height:7px;border-radius:50%;background:${cluster.workers.length > 0 ? '#bbf7d0' : '#e2e8f0'};"></span>
            <span>${badgeLabel}</span>
            <span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;font-weight:600;opacity:0.95;">${cluster.name.replace(/</g, '&lt;')}</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([cluster.lat, cluster.lng], { icon }).addTo(layer);
      marker.on('click', () => {
        setSelectedClusterId(cluster.id);
        setIsMobileDrawerOpen(true);
        map.flyTo([cluster.lat, cluster.lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
      });
    }

    if (boundsPoints.length > 0 && !selectedClusterId && !showLatnovvaProjects) {
      try {
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50], maxZoom: 13 });
      } catch {}
    }
  }, [filteredClusters, selectedClusterId, showLatnovvaProjects]);

  // Render LATNOVVA Commercial Portfolio Projects overlay when toggled ON
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = portfolioLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!showLatnovvaProjects) return;

    const bounds: L.LatLngExpression[] = [];
    for (const pin of portfolioPins) {
      bounds.push([pin.lat, pin.lng]);
      const bg = pin.isOffice ? '#0f172a' : '#0097A7';
      const size = pin.isOffice ? 14 : 10;

      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: size / 2,
        color: '#ffffff',
        weight: 2,
        fillColor: bg,
        fillOpacity: 0.9,
      }).addTo(layer);

      marker.bindPopup(`
        <div style="min-width:190px;font-family:sans-serif;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:${bg};letter-spacing:0.05em;">
            ${pin.isOffice ? 'Oficina LATNOVVA' : pin.systemType}
          </div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">
            ${pin.name.replace(/</g, '&lt;')}
          </div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">
            ${pin.client.replace(/</g, '&lt;')}${pin.location ? ' · ' + pin.location.replace(/</g, '&lt;') : ''}
          </div>
        </div>
      `);
    }

    if (bounds.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 7 });
      } catch {}
    }
  }, [showLatnovvaProjects, portfolioPins]);

  const focusCluster = (cluster: LiveSiteCluster) => {
    setSelectedClusterId(cluster.id);
    setIsMobileDrawerOpen(true);
    if (mapInstanceRef.current && isValidCoordinate(cluster.lat, cluster.lng)) {
      mapInstanceRef.current.flyTo([cluster.lat, cluster.lng], 14, { duration: 0.5 });
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Operational KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wide">Personal en Campo</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5" data-testid="kpi-active-workers">
              {kpiStats.totalActive}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sitios con Personal</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 font-mono mt-0.5">{kpiStats.coveredSites}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sitios sin Marcaje</p>
            <p className={`text-xl sm:text-2xl font-black font-mono mt-0.5 ${kpiStats.emptySites > 0 ? 'text-slate-600' : 'text-slate-400'}`}>
              {kpiStats.emptySites}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sitios Activos</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{kpiStats.totalSites}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
        </div>
      </div>

      {/* Main Map + Side Panel */}
      <div className="relative w-full h-[calc(100vh-250px)] min-h-[520px] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex shadow-sm">
        {/* Map Canvas */}
        <div className="relative flex-1 h-full">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Top Control Bar (Responsive — works on mobile & desktop) */}
          <div className="absolute top-3 left-3 right-3 z-[500] pointer-events-none flex flex-wrap items-center justify-between gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-md">
              <Radio size={14} className="text-emerald-500 animate-pulse shrink-0" />
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar sitio o colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 pr-2 py-1 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-200 focus:border-brand-teal focus:outline-none w-40 sm:w-64"
                />
              </div>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Mode & Layer Controls */}
            <div className="flex items-center gap-1.5 pointer-events-auto bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md">
              <button
                type="button"
                data-testid="toggle-latnovva-projects"
                onClick={() => setShowLatnovvaProjects((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  showLatnovvaProjects
                    ? 'bg-brand-teal text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
                title="Mostrar u ocultar el portafolio histórico de proyectos LATNOVVA"
              >
                <Briefcase size={13} />
                <span>Proyectos LATNOVVA</span>
              </button>

              <button
                type="button"
                data-testid="toggle-map-layer"
                onClick={() => setMapStyle((s) => (s === 'streets' ? 'satellite' : 'streets'))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors"
                title="Cambiar vista de mapa"
              >
                <Layers size={13} />
                <span className="hidden sm:inline">{mapStyle === 'streets' ? 'Satélite' : 'Calles'}</span>
              </button>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-colors"
                title="Sincronizar marcajes en vivo"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-brand-teal' : 'text-brand-teal'} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen((v) => !v)}
                className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                title="Ver lista de sitios"
              >
                <PanelRightOpen size={13} />
              </button>
            </div>
          </div>

          {/* Bottom Legend */}
          <div className="absolute bottom-3 left-3 z-[500] pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 shadow-md flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669] inline-block" />
              <span>En Sitio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] inline-block" />
              <span>Parcial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] inline-block" />
              <span>Externo / HO</span>
            </div>
            {showLatnovvaProjects && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0097A7] inline-block" />
                <span>Portafolio ({portfolioPins.length})</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Site Detail Drawer or Active Sites Directory */}
        <aside
          className={`${
            isMobileDrawerOpen ? 'flex absolute inset-y-0 right-0 w-80 max-w-[90vw] z-[600]' : 'hidden lg:flex w-80 xl:w-96'
          } h-full bg-white border-l border-slate-200 flex-col shadow-xl`}
        >
          {selectedCluster ? (
            <>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{selectedCluster.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold text-slate-500">
                    <span className="text-emerald-700 font-bold">
                      {selectedCluster.workers.length} en turno
                    </span>
                    {selectedCluster.assignedCount > 0 && (
                      <span>· {selectedCluster.assignedCount} asignados</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selectedCluster.projectId && (
                    <Link
                      to={`/projects/${selectedCluster.projectId}`}
                      className="p-1.5 rounded-lg text-brand-teal hover:bg-teal-50 transition-colors"
                      title="Abrir proyecto"
                    >
                      <ExternalLink size={15} />
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setSelectedClusterId(null);
                      setIsMobileDrawerOpen(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedCluster.workers.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Users size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-800">Sin personal con turno abierto</p>
                    <p className="text-[11px] text-slate-500">
                      Actualmente no hay colaboradores registrados en este sitio.
                    </p>
                  </div>
                ) : (
                  selectedCluster.workers.map((worker) => (
                    <div
                      key={worker.personnelId}
                      className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-start gap-3">
                        {worker.avatarUrl ? (
                          <img
                            src={worker.avatarUrl}
                            alt={worker.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal font-bold flex items-center justify-center text-xs shrink-0">
                            {worker.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{worker.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{worker.role}</p>
                          {worker.employeeNumber && (
                            <p className="text-[10px] text-slate-400 font-mono">No. {worker.employeeNumber}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Clock size={12} className="text-brand-teal" />
                          Entrada {worker.clockInLabel} · {formatElapsedDuration(worker.clockInIso, nowTick)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                          {worker.workType === 'HOME_OFFICE' ? <Home size={10} /> : <MapPin size={10} />}
                          {worker.workType === 'HOME_OFFICE' ? 'HO' : 'Sitio'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sitios en Operación</h3>
                  <p className="text-[11px] text-slate-500">
                    {filteredClusters.length} ubicaciones · {liveWorkers.length} turnos activos
                  </p>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredClusters.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No se encontraron sitios con ese filtro.
                  </div>
                ) : (
                  filteredClusters.map((cluster) => (
                    <button
                      key={cluster.id}
                      type="button"
                      onClick={() => focusCluster(cluster)}
                      className="w-full text-left p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{cluster.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {cluster.workers.length > 0
                            ? `${cluster.workers.length} en campo`
                            : 'Sin marcajes activos'}
                          {cluster.assignedCount > 0 ? ` / ${cluster.assignedCount} asignados` : ''}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono shrink-0 ${
                          cluster.workers.length > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {cluster.workers.length}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
