/**
 * Attendance V2 Location Policy Resolver
 * 
 * Automatically resolves and displays the worker's current authorized attendance location.
 * Eliminates the need for workers to manually select between physical geofences (e.g. Main vs Warehouse).
 * 
 * FLOW:
 * 1. Acquire device GPS and accuracy.
 * 2. Obtain authorized location policies from:
 *    - current project geofence
 *    - project secondary attendance_locations
 *    - future personnel-specific temporary authorizations
 * 3. Calculate local distance to each permitted location.
 * 4. Exactly one match -> automatically display that location.
 * 5. Multiple overlapping geofences -> deterministically select closest valid location (subject to accuracy).
 * 6. No match -> show outside authorized On Site location (NO silent project change, NO auto Home Office).
 * 7. Display is UX evidence only; authoritative decision remains server-side in record_attendance_event.
 * 8. Offline mode uses only currently valid lease-scoped location policies.
 * 9. Diagnostics view for support/admin users.
 */

import { getDistanceMeters } from '../../utils/datetime.utils';
import { attendanceV2Db } from './db';
import { supabase } from '../supabase';

export type LocationAuthorizationSource =
  | 'PROJECT_PRIMARY'
  | 'PROJECT_SECONDARY'
  | 'OFFLINE_LEASE'
  | 'TEMPORARY_AUTHORIZATION';

export interface AuthorizedAttendanceLocation {
  id: string; // 'primary' or UUID of secondary location
  name: string; // e.g. "Mérida Main", "Mérida Warehouse", "Oficina CDMX"
  type: 'PRIMARY_GEOFENCE' | 'SECONDARY_GEOFENCE' | 'PERSONNEL_TEMPORARY';
  projectId: string;
  projectName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  accuracyThresholdMeters: number;
  source: LocationAuthorizationSource;
  attendanceLocationId?: string | null;
}

export interface CandidateEvaluation {
  location: AuthorizedAttendanceLocation;
  distanceMeters: number;
  isInside: boolean;
  isAccuracyAcceptable: boolean;
  accuracyMeters: number | null;
}

export type ResolvedLocationStatus =
  | 'MATCHED'
  | 'OUTSIDE'
  | 'NO_GEOFENCE'
  | 'ACCURACY_POOR'
  | 'ACQUIRING_GPS'
  | 'GPS_DENIED';

export interface ResolvedLocationResult {
  status: ResolvedLocationStatus;
  matchedLocation: AuthorizedAttendanceLocation | null;
  displayName: string;
  distanceMeters: number | null;
  radiusMeters: number | null;
  accuracyMeters: number | null;
  authorizationPolicy: 'PRIMARY_GEOFENCE' | 'SECONDARY_GEOFENCE' | 'PERSONNEL_TEMPORARY' | 'NONE';
  attendanceLocationId: string | null;
  isOffline: boolean;
  requiresServerSync: boolean;
  allEvaluations: CandidateEvaluation[];
  closestCandidate: CandidateEvaluation | null;
  overlappingMatchesCount: number;
  diagnosticDetails: {
    gpsLat: number | null;
    gpsLng: number | null;
    accuracyMeters: number | null;
    evaluatedPoliciesCount: number;
    matchedSource: string | null;
    resolvedAt: string;
  };
}

// In-memory cache for online secondary locations
interface CachedSecondaryLocation {
  project_id: string;
  location_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  accuracy_threshold_meters: number;
}

let secondaryLocationsCache: CachedSecondaryLocation[] | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Known fallback configuration for approved secondary locations.
 * Ensures immediate seamless resolution even if database network query is delayed.
 */
const KNOWN_APPROVED_SECONDARY_LOCATIONS: CachedSecondaryLocation[] = [
  {
    project_id: 'c95e8081-3323-4c55-87f5-259207865768', // Mérida
    location_id: 'e110ca71-0000-4000-a000-000000000001',
    name: 'Mérida Warehouse',
    latitude: 20.93019,
    longitude: -89.67442,
    radius_meters: 250,
    accuracy_threshold_meters: 150
  }
];

/**
 * Fetches secondary project locations from Supabase or cached fallback.
 */
export async function fetchOnlineSecondaryLocations(): Promise<CachedSecondaryLocation[]> {
  const now = Date.now();
  if (secondaryLocationsCache && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return secondaryLocationsCache;
  }

  try {
    const { data: mappings, error: mapErr } = await supabase
      .from('attendance_project_locations')
      .select(`
        project_id,
        location_id,
        is_active,
        attendance_locations (
          location_id,
          name,
          latitude,
          longitude,
          radius_meters,
          accuracy_threshold_meters,
          is_active
        )
      `)
      .eq('is_active', true);

    if (mapErr || !mappings) {
      secondaryLocationsCache = KNOWN_APPROVED_SECONDARY_LOCATIONS;
      lastCacheFetchTime = now;
      return secondaryLocationsCache;
    }

    const result: CachedSecondaryLocation[] = [];
    for (const m of mappings as any[]) {
      const loc = m.attendance_locations;
      if (loc && loc.is_active) {
        result.push({
          project_id: m.project_id,
          location_id: loc.location_id,
          name: loc.name,
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          radius_meters: Number(loc.radius_meters),
          accuracy_threshold_meters: Number(loc.accuracy_threshold_meters || 150)
        });
      }
    }

    secondaryLocationsCache = result.length > 0 ? result : KNOWN_APPROVED_SECONDARY_LOCATIONS;
    lastCacheFetchTime = now;
    return secondaryLocationsCache;
  } catch (err) {
    secondaryLocationsCache = KNOWN_APPROVED_SECONDARY_LOCATIONS;
    lastCacheFetchTime = now;
    return secondaryLocationsCache;
  }
}

/**
 * Obtains authorized location policies for a project.
 * Supports both online state and offline lease scopes.
 */
export async function getAuthorizedLocationsForProject(params: {
  projectId: string;
  projectName: string;
  primaryCoords: { lat: number; lng: number } | null;
  primaryRadius?: number;
  primaryAccuracyThreshold?: number;
  personnelId?: string;
  isOffline?: boolean;
}): Promise<AuthorizedAttendanceLocation[]> {
  const {
    projectId,
    projectName,
    primaryCoords,
    primaryRadius = 1000,
    primaryAccuracyThreshold = 150,
    personnelId,
    isOffline = false
  } = params;

  const locations: AuthorizedAttendanceLocation[] = [];

  // 1. OFFLINE RESOLUTION
  if (isOffline && personnelId) {
    try {
      const lease = await attendanceV2Db.getLatestOfflineLeaseForPersonnel(personnelId);
      const isLeaseValid = lease && !lease.is_revoked && new Date(lease.valid_until) > new Date();

      if (isLeaseValid && lease.scopes) {
        const scope = lease.scopes.find((s) => s.project_id === projectId);
        if (scope) {
          const hasSecondaries = scope.secondary_locations && scope.secondary_locations.length > 0;
          const primaryName = hasSecondaries
            ? `${scope.project_name || projectName} Main`
            : (scope.project_name || projectName);

          // Primary location from lease scope
          locations.push({
            id: 'primary',
            name: primaryName,
            type: 'PRIMARY_GEOFENCE',
            projectId,
            projectName: scope.project_name || projectName,
            latitude: scope.latitude,
            longitude: scope.longitude,
            radiusMeters: scope.radius_meters,
            accuracyThresholdMeters: scope.accuracy_threshold_meters,
            source: 'OFFLINE_LEASE',
            attendanceLocationId: null
          });

          // Secondary locations from lease scope
          if (scope.secondary_locations) {
            for (const sec of scope.secondary_locations) {
              locations.push({
                id: sec.location_id,
                name: sec.location_name,
                type: 'SECONDARY_GEOFENCE',
                projectId,
                projectName: scope.project_name || projectName,
                latitude: sec.latitude,
                longitude: sec.longitude,
                radiusMeters: sec.radius_meters,
                accuracyThresholdMeters: sec.accuracy_threshold_meters,
                source: 'OFFLINE_LEASE',
                attendanceLocationId: sec.location_id
              });
            }
          }

          return locations;
        }
      }
    } catch (e) {
      console.warn('[locationResolver] Error reading offline lease:', e);
    }
  }

  // 2. ONLINE RESOLUTION
  const secondaryList = await fetchOnlineSecondaryLocations();
  const projectSecondaries = secondaryList.filter((s) => s.project_id === projectId);
  const hasSecondaries = projectSecondaries.length > 0;

  // Add primary geofence if coordinates are defined
  if (primaryCoords && primaryCoords.lat && primaryCoords.lng) {
    const primaryName = hasSecondaries ? `${projectName} Main` : projectName;
    locations.push({
      id: 'primary',
      name: primaryName,
      type: 'PRIMARY_GEOFENCE',
      projectId,
      projectName,
      latitude: primaryCoords.lat,
      longitude: primaryCoords.lng,
      radiusMeters: primaryRadius,
      accuracyThresholdMeters: primaryAccuracyThreshold,
      source: 'PROJECT_PRIMARY',
      attendanceLocationId: null
    });
  }

  // Add secondary locations
  for (const sec of projectSecondaries) {
    locations.push({
      id: sec.location_id,
      name: sec.name,
      type: 'SECONDARY_GEOFENCE',
      projectId,
      projectName,
      latitude: sec.latitude,
      longitude: sec.longitude,
      radiusMeters: sec.radius_meters,
      accuracyThresholdMeters: sec.accuracy_threshold_meters,
      source: 'PROJECT_SECONDARY',
      attendanceLocationId: sec.location_id
    });
  }

  return locations;
}

/**
 * Pure calculation function to evaluate device GPS against a list of authorized locations.
 */
export function resolveAttendanceLocation(params: {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  gpsStatus: 'acquiring' | 'locked' | 'poor' | 'denied';
  authorizedLocations: AuthorizedAttendanceLocation[];
  targetProjectName?: string;
  isOffline?: boolean;
}): ResolvedLocationResult {
  const {
    lat,
    lng,
    accuracy,
    gpsStatus,
    authorizedLocations,
    targetProjectName = 'Proyecto',
    isOffline = false
  } = params;

  const nowIso = new Date().toISOString();

  // Handle GPS Denied
  if (gpsStatus === 'denied') {
    return {
      status: 'GPS_DENIED',
      matchedLocation: null,
      displayName: 'GPS no disponible',
      distanceMeters: null,
      radiusMeters: null,
      accuracyMeters: accuracy,
      authorizationPolicy: 'NONE',
      attendanceLocationId: null,
      isOffline,
      requiresServerSync: isOffline,
      allEvaluations: [],
      closestCandidate: null,
      overlappingMatchesCount: 0,
      diagnosticDetails: {
        gpsLat: lat,
        gpsLng: lng,
        accuracyMeters: accuracy,
        evaluatedPoliciesCount: authorizedLocations.length,
        matchedSource: null,
        resolvedAt: nowIso
      }
    };
  }

  // Handle Acquiring GPS
  if (gpsStatus === 'acquiring' || lat === null || lng === null) {
    return {
      status: 'ACQUIRING_GPS',
      matchedLocation: null,
      displayName: 'Obteniendo GPS...',
      distanceMeters: null,
      radiusMeters: null,
      accuracyMeters: accuracy,
      authorizationPolicy: 'NONE',
      attendanceLocationId: null,
      isOffline,
      requiresServerSync: isOffline,
      allEvaluations: [],
      closestCandidate: null,
      overlappingMatchesCount: 0,
      diagnosticDetails: {
        gpsLat: lat,
        gpsLng: lng,
        accuracyMeters: accuracy,
        evaluatedPoliciesCount: authorizedLocations.length,
        matchedSource: null,
        resolvedAt: nowIso
      }
    };
  }

  // Handle case where project has no geofence configured at all
  if (authorizedLocations.length === 0) {
    return {
      status: 'NO_GEOFENCE',
      matchedLocation: null,
      displayName: `Sin geocerca configurada (${targetProjectName})`,
      distanceMeters: null,
      radiusMeters: null,
      accuracyMeters: accuracy,
      authorizationPolicy: 'NONE',
      attendanceLocationId: null,
      isOffline,
      requiresServerSync: isOffline,
      allEvaluations: [],
      closestCandidate: null,
      overlappingMatchesCount: 0,
      diagnosticDetails: {
        gpsLat: lat,
        gpsLng: lng,
        accuracyMeters: accuracy,
        evaluatedPoliciesCount: 0,
        matchedSource: null,
        resolvedAt: nowIso
      }
    };
  }

  // Evaluate each authorized location
  const allEvaluations: CandidateEvaluation[] = authorizedLocations.map((loc) => {
    const dist = getDistanceMeters(lat, lng, loc.latitude, loc.longitude);
    const roundedDist = Math.round(dist);
    const isInside = roundedDist <= loc.radiusMeters;
    const isAccuracyAcceptable = accuracy !== null && accuracy <= loc.accuracyThresholdMeters;

    return {
      location: loc,
      distanceMeters: roundedDist,
      isInside,
      isAccuracyAcceptable,
      accuracyMeters: accuracy
    };
  });

  // Sort all evaluations by distance ascending to find closest candidate
  const sortedEvaluations = [...allEvaluations].sort((a, b) => a.distanceMeters - b.distanceMeters);
  const closestCandidate = sortedEvaluations[0] || null;

  // Filter candidate locations where the device is inside the radius
  const candidatesInside = sortedEvaluations.filter((c) => c.isInside);
  const overlappingMatchesCount = candidatesInside.length;

  // 1. MATCH FOUND
  if (overlappingMatchesCount >= 1) {
    // If multiple overlap, select deterministically using closest valid location
    // (candidatesInside is already sorted by distance ascending)
    const bestMatch = candidatesInside[0];
    const loc = bestMatch.location;

    const authPolicy = loc.type === 'PRIMARY_GEOFENCE' ? 'PRIMARY_GEOFENCE' : 'SECONDARY_GEOFENCE';

    return {
      status: 'MATCHED',
      matchedLocation: loc,
      displayName: loc.name,
      distanceMeters: bestMatch.distanceMeters,
      radiusMeters: loc.radiusMeters,
      accuracyMeters: accuracy,
      authorizationPolicy: authPolicy,
      attendanceLocationId: loc.attendanceLocationId || null,
      isOffline,
      requiresServerSync: isOffline,
      allEvaluations,
      closestCandidate,
      overlappingMatchesCount,
      diagnosticDetails: {
        gpsLat: lat,
        gpsLng: lng,
        accuracyMeters: accuracy,
        evaluatedPoliciesCount: authorizedLocations.length,
        matchedSource: `${loc.source} (${loc.type})`,
        resolvedAt: nowIso
      }
    };
  }

  // 2. NO MATCH (OUTSIDE ALL AUTHORIZED LOCATIONS)
  // Do NOT silently switch to another project.
  // Do NOT automatically switch to Home Office.
  return {
    status: 'OUTSIDE',
    matchedLocation: null,
    displayName: 'Fuera de ubicación autorizada',
    distanceMeters: closestCandidate ? closestCandidate.distanceMeters : null,
    radiusMeters: closestCandidate ? closestCandidate.location.radiusMeters : null,
    accuracyMeters: accuracy,
    authorizationPolicy: 'NONE',
    attendanceLocationId: null,
    isOffline,
    requiresServerSync: isOffline,
    allEvaluations,
    closestCandidate,
    overlappingMatchesCount: 0,
    diagnosticDetails: {
      gpsLat: lat,
      gpsLng: lng,
      accuracyMeters: accuracy,
      evaluatedPoliciesCount: authorizedLocations.length,
      matchedSource: null,
      resolvedAt: nowIso
    }
  };
}
