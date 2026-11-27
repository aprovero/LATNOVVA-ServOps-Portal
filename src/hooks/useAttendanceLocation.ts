import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AuthorizedAttendanceLocation,
  ResolvedLocationResult,
  getAuthorizedLocationsForProject,
  resolveAttendanceLocation
} from '../lib/attendanceV2/locationResolver';

interface UseAttendanceLocationProps {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  gpsStatus: 'acquiring' | 'locked' | 'poor' | 'denied';
  projectId: string;
  projectName: string;
  primaryCoords: { lat: number; lng: number } | null;
  primaryRadius?: number;
  personnelId?: string;
  workMode?: string;
}

export function useAttendanceLocation(props: UseAttendanceLocationProps) {
  const {
    lat,
    lng,
    accuracy,
    gpsStatus,
    projectId,
    projectName,
    primaryCoords,
    primaryRadius,
    personnelId,
    workMode = 'On Site'
  } = props;

  const [authorizedLocations, setAuthorizedLocations] = useState<AuthorizedAttendanceLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Extract primitive numbers to prevent object reference churn from triggering infinite render loops
  const primaryLat = primaryCoords?.lat ?? null;
  const primaryLng = primaryCoords?.lng ?? null;

  const stablePrimaryCoords = useMemo(() => {
    return (primaryLat !== null && primaryLng !== null) ? { lat: primaryLat, lng: primaryLng } : null;
  }, [primaryLat, primaryLng]);

  // Detect offline status
  const isOffline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;

  // Load authorized location policies whenever project or network mode changes
  const loadLocations = useCallback(async () => {
    if (!projectId || workMode !== 'On Site') {
      setAuthorizedLocations([]);
      return;
    }

    setIsLoadingLocations(true);
    try {
      const locs = await getAuthorizedLocationsForProject({
        projectId,
        projectName,
        primaryCoords: stablePrimaryCoords,
        primaryRadius,
        personnelId,
        isOffline
      });
      setAuthorizedLocations(locs);
    } catch (err) {
      console.warn('[useAttendanceLocation] Error loading locations:', err);
    } finally {
      setIsLoadingLocations(false);
    }
  }, [projectId, projectName, stablePrimaryCoords, primaryRadius, personnelId, isOffline, workMode]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Compute resolved location reactively with memoization to avoid thrashing consumer renders
  const result: ResolvedLocationResult = useMemo(() => {
    return resolveAttendanceLocation({
      lat,
      lng,
      accuracy,
      gpsStatus,
      authorizedLocations,
      targetProjectName: projectName,
      isOffline
    });
  }, [lat, lng, accuracy, gpsStatus, authorizedLocations, projectName, isOffline]);

  return {
    result,
    authorizedLocations,
    isLoadingLocations,
    refreshLocations: loadLocations
  };
}
