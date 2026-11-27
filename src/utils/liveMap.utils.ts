export interface LiveSiteDefinition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  assignedCount: number;
  isOffice?: boolean;
  projectId?: string;
}

export interface LiveWorkerEntry {
  personnelId: string;
  name: string;
  role: string;
  employeeNumber?: string;
  avatarUrl?: string;
  clockInIso: string;
  clockInLabel: string;
  workType: 'ON_SITE' | 'HOME_OFFICE' | string;
  projectId?: string | null;
  attendanceLocationId?: string | null;
  lat: number | null;
  lng: number | null;
  accuracyMeters?: number | null;
}

export interface LiveSiteCluster {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  assignedCount: number;
  workers: LiveWorkerEntry[];
  status: 'covered' | 'partial' | 'empty' | 'offsite';
  isOffice?: boolean;
  projectId?: string;
}

const CITY_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  'MERIDA': { lat: 20.9854, lng: -89.6152 },
  'ITZIMNA': { lat: 20.9854, lng: -89.6152 },
  'CDMX': { lat: 19.4326, lng: -99.1332 },
  'CIUDAD DE MEXICO': { lat: 19.4326, lng: -99.1332 },
  'MEXICO CITY': { lat: 19.4326, lng: -99.1332 },
  'MONTERREY': { lat: 25.6866, lng: -100.3161 },
  'GUADALAJARA': { lat: 20.6597, lng: -103.3496 },
  'PEROTE': { lat: 19.5622, lng: -97.2422 },
  'AGUASCALIENTES': { lat: 21.8853, lng: -102.2916 },
  'MEXICALI': { lat: 32.6245, lng: -115.4523 },
  'PLAYA DEL CARMEN': { lat: 20.6296, lng: -87.0739 },
  'CANCUN': { lat: 21.1619, lng: -86.8515 },
  'HOUSTON': { lat: 29.7604, lng: -95.3698 },
};

/**
 * Parses "lat, lng", JSON "{lat, lng}", or known city name strings into valid non-zero coordinates.
 */
export function parseCoordinates(raw?: string | null): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      const lat = Number(obj.lat ?? obj.latitude);
      const lng = Number(obj.lng ?? obj.lon ?? obj.longitude);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    } catch {
      return null;
    }
  }

  const match = trimmed.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    return isValidCoordinate(lat, lng) ? { lat, lng } : null;
  }

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  for (const [city, coords] of Object.entries(CITY_FALLBACK_COORDS)) {
    if (normalized.includes(city)) {
      return coords;
    }
  }

  return null;
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns true if a clock-in ISO timestamp is within the active shift window (default 14h).
 */
export function isShiftActiveWithinCutoff(
  clockInIso: string | null | undefined,
  nowMs: number = Date.now(),
  maxHours: number = 14
): boolean {
  if (!clockInIso) return false;
  const ts = new Date(clockInIso).getTime();
  if (!Number.isFinite(ts)) return false;
  const diffMs = nowMs - ts;
  return diffMs >= -5 * 60 * 1000 && diffMs <= maxHours * 3600 * 1000;
}

export function formatElapsedDuration(clockInIso: string, nowMs: number = Date.now()): string {
  const ts = new Date(clockInIso).getTime();
  if (!Number.isFinite(ts)) return 'En turno';
  const diffMs = Math.max(0, nowMs - ts);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m en turno`;
  return `${hours}h ${minutes}m en turno`;
}

/**
 * Clusters currently clocked-in workers onto registered sites (by locationId, projectId, or proximity <= 350m),
 * creating dynamic clusters for off-site / home-office workers who have valid GPS coordinates.
 */
export function buildLiveSiteClusters(
  sites: LiveSiteDefinition[],
  workers: LiveWorkerEntry[]
): LiveSiteCluster[] {
  const clusterMap = new Map<string, LiveSiteCluster>();

  for (const site of sites) {
    if (!isValidCoordinate(site.lat, site.lng)) continue;
    clusterMap.set(site.id, {
      id: site.id,
      name: site.name,
      lat: site.lat,
      lng: site.lng,
      radiusMeters: site.radiusMeters || 300,
      assignedCount: site.assignedCount || 0,
      workers: [],
      status: 'empty',
      isOffice: site.isOffice,
      projectId: site.projectId,
    });
  }

  for (const w of workers) {
    const hasGps = isValidCoordinate(w.lat, w.lng);
    const isHomeOffice = String(w.workType || '').toUpperCase() === 'HOME_OFFICE';

    // P1-5 Rule 1: HOME_OFFICE must NEVER be snapped to an on-site project pin merely because projectId matches
    if (isHomeOffice) {
      if (hasGps) {
        const dynKey = `homeoffice-${Math.round(w.lat! * 1000)}-${Math.round(w.lng! * 1000)}`;
        const existing = clusterMap.get(dynKey);
        if (existing) {
          existing.workers.push(w);
        } else {
          clusterMap.set(dynKey, {
            id: dynKey,
            name: 'Home Office / Remoto',
            lat: w.lat!,
            lng: w.lng!,
            radiusMeters: 150,
            assignedCount: 0,
            workers: [w],
            status: 'offsite',
          });
        }
      }
      continue;
    }

    let matchedCluster: LiveSiteCluster | undefined;

    // P1-5 Rule 2: Explicit validated attendance_location_id match (e.g. secondary location)
    if (w.attendanceLocationId && clusterMap.has(w.attendanceLocationId)) {
      const candidate = clusterMap.get(w.attendanceLocationId)!;
      // If GPS is present, verify worker is actually within the site's geofence (or 350m tolerance)
      if (!hasGps || haversineMeters(w.lat!, w.lng!, candidate.lat, candidate.lng) <= Math.max(candidate.radiusMeters, 350)) {
        matchedCluster = candidate;
      }
    }

    // P1-5 Rule 3: GPS-present workers MUST be physically within a site's geofence to snap to that site
    if (!matchedCluster && hasGps) {
      // Check ALL attributed project sites (primary + secondary locations for the same projectId)
      if (w.projectId) {
        let bestProjectDist = Infinity;
        for (const c of clusterMap.values()) {
          if (c.status === 'offsite') continue;
          if (c.projectId === w.projectId || c.id === w.projectId) {
            const d = haversineMeters(w.lat!, w.lng!, c.lat, c.lng);
            if (d <= Math.max(c.radiusMeters, 350) && d < bestProjectDist) {
              bestProjectDist = d;
              matchedCluster = c;
            }
          }
        }
      }

      // Otherwise check nearest registered site within geofence radius
      if (!matchedCluster) {
        let bestDist = Infinity;
        for (const c of clusterMap.values()) {
          if (c.status === 'offsite') continue;
          const d = haversineMeters(w.lat!, w.lng!, c.lat, c.lng);
          const threshold = Math.max(c.radiusMeters, 350);
          if (d <= threshold && d < bestDist) {
            bestDist = d;
            matchedCluster = c;
          }
        }
      }
    }

    // P1-5 Rule 4: GPS-less on-site worker falls back to project attribution
    if (!matchedCluster && !hasGps && w.projectId) {
      for (const c of clusterMap.values()) {
        if (c.status === 'offsite') continue;
        if (c.projectId === w.projectId || c.id === w.projectId) {
          matchedCluster = c;
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.workers.push(w);
    } else if (hasGps) {
      // Worker is physically outside all site geofences -> dynamic Off-Site pin at real GPS
      const dynKey = `offsite-${Math.round(w.lat! * 1000)}-${Math.round(w.lng! * 1000)}`;
      const existing = clusterMap.get(dynKey);
      if (existing) {
        existing.workers.push(w);
      } else {
        clusterMap.set(dynKey, {
          id: dynKey,
          name: 'Ubicación Externa (Fuera de Geocerca)',
          lat: w.lat!,
          lng: w.lng!,
          radiusMeters: 150,
          assignedCount: 0,
          workers: [w],
          status: 'offsite',
        });
      }
    }
  }

  // Classify site status
  const result: LiveSiteCluster[] = [];
  for (const c of clusterMap.values()) {
    if (c.status === 'offsite') {
      result.push(c);
      continue;
    }
    const active = c.workers.length;
    if (active === 0) {
      c.status = 'empty';
    } else if (c.assignedCount === 0 || active >= c.assignedCount) {
      c.status = 'covered';
    } else {
      c.status = 'partial';
    }
    result.push(c);
  }

  // Sort: active workers desc, then site name asc
  result.sort((a, b) => b.workers.length - a.workers.length || a.name.localeCompare(b.name));
  return result;
}
