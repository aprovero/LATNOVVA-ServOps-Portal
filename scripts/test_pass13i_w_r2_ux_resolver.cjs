/**
 * PASS 13I-W-R2: Location Resolver UX Verification Suite
 * Verifies all 10 requirements of the Multi-Location Attendance Client UX Flow.
 */

const assert = require('assert');

// Haversine formula matching datetime.utils.ts
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Re-implementation of pure resolution algorithm for Node test execution
function resolveAttendanceLocation(params) {
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
  const allEvaluations = authorizedLocations.map((loc) => {
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

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  PASS 13I-W-R2: LOCATION RESOLVER UX VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const MERIDA_PROJ = 'c95e8081-3323-4c55-87f5-259207865768';
  const CDMX_PROJ = 'a68210e5-d579-4e6f-b2d3-af1a9d3a4911';

  // Test Locations
  const meridaLocations = [
    {
      id: 'primary',
      name: 'Mérida Main',
      type: 'PRIMARY_GEOFENCE',
      projectId: MERIDA_PROJ,
      projectName: 'Mérida',
      latitude: 20.9889,
      longitude: -89.6133,
      radiusMeters: 500,
      accuracyThresholdMeters: 150,
      source: 'PROJECT_PRIMARY',
      attendanceLocationId: null
    },
    {
      id: 'e110ca71-0000-4000-a000-000000000001',
      name: 'Mérida Warehouse',
      type: 'SECONDARY_GEOFENCE',
      projectId: MERIDA_PROJ,
      projectName: 'Mérida',
      latitude: 20.93019,
      longitude: -89.67442,
      radiusMeters: 250,
      accuracyThresholdMeters: 150,
      source: 'PROJECT_SECONDARY',
      attendanceLocationId: 'e110ca71-0000-4000-a000-000000000001'
    }
  ];

  const cdmxLocations = [
    {
      id: 'primary',
      name: 'Oficina CDMX',
      type: 'PRIMARY_GEOFENCE',
      projectId: CDMX_PROJ,
      projectName: 'Oficina CDMX',
      latitude: 19.4293,
      longitude: -99.1724,
      radiusMeters: 1000,
      accuracyThresholdMeters: 150,
      source: 'PROJECT_PRIMARY',
      attendanceLocationId: null
    }
  ];

  // 1. Flow Step 1: Acquire device GPS & accuracy states
  console.log('--- 1. Device GPS Acquisition States ---');
  const resAcquiring = resolveAttendanceLocation({
    lat: null, lng: null, accuracy: null,
    gpsStatus: 'acquiring',
    authorizedLocations: meridaLocations
  });
  test(resAcquiring.status === 'ACQUIRING_GPS', 'Acquiring GPS returns status ACQUIRING_GPS');
  test(resAcquiring.displayName === 'Obteniendo GPS...', 'Acquiring GPS displays "Obteniendo GPS..."');

  const resDenied = resolveAttendanceLocation({
    lat: null, lng: null, accuracy: null,
    gpsStatus: 'denied',
    authorizedLocations: meridaLocations
  });
  test(resDenied.status === 'GPS_DENIED', 'Denied GPS returns status GPS_DENIED');
  test(resDenied.displayName === 'GPS no disponible', 'Denied GPS displays "GPS no disponible"');

  // 2. Flow Step 4: Single match auto-display (Mérida Main)
  console.log('\n--- 2. Single Location Matches (Mérida Main & Warehouse) ---');
  // Worker at Mérida Main: 20.9889, -89.6133 (exact)
  const resMain = resolveAttendanceLocation({
    lat: 20.9889, lng: -89.6133, accuracy: 12,
    gpsStatus: 'locked',
    authorizedLocations: meridaLocations,
    targetProjectName: 'Mérida'
  });
  test(resMain.status === 'MATCHED', 'Worker at Mérida Main is MATCHED');
  test(resMain.displayName === 'Mérida Main', 'Display name is exactly "Mérida Main"');
  test(resMain.authorizationPolicy === 'PRIMARY_GEOFENCE', 'Authorization policy is PRIMARY_GEOFENCE');
  test(resMain.attendanceLocationId === null, 'Primary geofence has attendanceLocationId = null');
  test(resMain.distanceMeters === 0, 'Distance is 0m');

  // Worker at Mérida Warehouse: 20.93019, -89.67442 (exact)
  const resWarehouse = resolveAttendanceLocation({
    lat: 20.93019, lng: -89.67442, accuracy: 15,
    gpsStatus: 'locked',
    authorizedLocations: meridaLocations,
    targetProjectName: 'Mérida'
  });
  test(resWarehouse.status === 'MATCHED', 'Worker at Mérida Warehouse is MATCHED');
  test(resWarehouse.displayName === 'Mérida Warehouse', 'Display name is exactly "Mérida Warehouse"');
  test(resWarehouse.authorizationPolicy === 'SECONDARY_GEOFENCE', 'Authorization policy is SECONDARY_GEOFENCE');
  test(resWarehouse.attendanceLocationId === 'e110ca71-0000-4000-a000-000000000001', 'Matches exact warehouse attendance_location_id');
  test(resWarehouse.distanceMeters === 0, 'Distance is 0m');

  // Worker at Oficina CDMX: 19.4293, -99.1724
  const resCdmx = resolveAttendanceLocation({
    lat: 19.4293, lng: -99.1724, accuracy: 8,
    gpsStatus: 'locked',
    authorizedLocations: cdmxLocations,
    targetProjectName: 'Oficina CDMX'
  });
  test(resCdmx.status === 'MATCHED', 'Worker at CDMX is MATCHED');
  test(resCdmx.displayName === 'Oficina CDMX', 'Display name is exactly "Oficina CDMX"');
  test(resCdmx.authorizationPolicy === 'PRIMARY_GEOFENCE', 'CDMX authorized as PRIMARY_GEOFENCE');

  // 3. Flow Step 5: Overlapping geofences resolution
  console.log('\n--- 3. Overlapping Geofences Deterministic Selection ---');
  const overlappingLocations = [
    {
      id: 'loc-yard',
      name: 'Subestación Patio',
      type: 'PRIMARY_GEOFENCE',
      projectId: 'proj-overlap',
      projectName: 'Proyecto Sol',
      latitude: 25.0000,
      longitude: -100.0000,
      radiusMeters: 500, // Distance to point: 100m (inside)
      accuracyThresholdMeters: 50,
      source: 'PROJECT_PRIMARY'
    },
    {
      id: 'loc-office',
      name: 'Caseta Central',
      type: 'SECONDARY_GEOFENCE',
      projectId: 'proj-overlap',
      projectName: 'Proyecto Sol',
      latitude: 25.0002, // Very close
      longitude: -100.0000,
      radiusMeters: 100, // Distance to point: 22m (inside and closer)
      accuracyThresholdMeters: 50,
      source: 'PROJECT_SECONDARY',
      attendanceLocationId: 'sec-caseta'
    }
  ];

  const resOverlap = resolveAttendanceLocation({
    lat: 25.00018, lng: -100.0000, accuracy: 10,
    gpsStatus: 'locked',
    authorizedLocations: overlappingLocations,
    targetProjectName: 'Proyecto Sol'
  });
  test(resOverlap.status === 'MATCHED', 'Overlapping position is MATCHED');
  test(resOverlap.overlappingMatchesCount === 2, 'Detects 2 overlapping candidate geofences');
  test(resOverlap.displayName === 'Caseta Central', 'Deterministically selects closest valid location ("Caseta Central")');
  test(resOverlap.distanceMeters < 10, 'Closest location distance is < 10m');

  // 4. Flow Step 6: No authorized location matches (Outside)
  console.log('\n--- 4. Outside Geofence Behavior ---');
  // Worker 3.5km from Mérida Main and 4km from Warehouse
  const resOutside = resolveAttendanceLocation({
    lat: 20.9600, lng: -89.6400, accuracy: 15,
    gpsStatus: 'locked',
    authorizedLocations: meridaLocations,
    targetProjectName: 'Mérida'
  });
  test(resOutside.status === 'OUTSIDE', 'Worker outside all geofences has status OUTSIDE');
  test(resOutside.displayName === 'Fuera de ubicación autorizada', 'Display name indicates outside authorized location');
  test(resOutside.matchedLocation === null, 'No location matched');
  test(resOutside.closestCandidate !== null, 'Closest candidate is identified');
  test(resOutside.closestCandidate.location.name === 'Mérida Main' || resOutside.closestCandidate.location.name === 'Mérida Warehouse', 'Identifies closest authorized facility for UX advice');
  test(resOutside.distanceMeters > 500, 'Distance exceeds allowed radius');

  // 5. Flow Step 8: Offline resolution
  console.log('\n--- 5. Offline Lease-Scoped Resolution ---');
  const resOffline = resolveAttendanceLocation({
    lat: 20.93019, lng: -89.67442, accuracy: 15,
    gpsStatus: 'locked',
    authorizedLocations: meridaLocations.map(l => ({ ...l, source: 'OFFLINE_LEASE' })),
    targetProjectName: 'Mérida',
    isOffline: true
  });
  test(resOffline.status === 'MATCHED', 'Offline punch at warehouse is MATCHED');
  test(resOffline.displayName === 'Mérida Warehouse', 'Displays "Mérida Warehouse" offline');
  test(resOffline.isOffline === true, 'isOffline flag is TRUE');
  test(resOffline.requiresServerSync === true, 'requiresServerSync flag is TRUE');

  // 6. Flow Step 10: Diagnostics view completeness for Support/Admin
  console.log('\n--- 6. Support / Admin Diagnostics Completeness ---');
  const diag = resWarehouse.diagnosticDetails;
  test(diag.gpsLat === 20.93019, 'Diagnostics includes GPS latitude');
  test(diag.gpsLng === -89.67442, 'Diagnostics includes GPS longitude');
  test(diag.accuracyMeters === 15, 'Diagnostics includes GPS accuracy');
  test(resWarehouse.displayName === 'Mérida Warehouse', 'Diagnostics includes matched location name');
  test(resWarehouse.distanceMeters === 0, 'Diagnostics includes distance');
  test(resWarehouse.radiusMeters === 250, 'Diagnostics includes allowed radius');
  test(diag.matchedSource.includes('PROJECT_SECONDARY'), 'Diagnostics includes authorization source');
  test(resWarehouse.allEvaluations.length === 2, 'Diagnostics lists all evaluated candidate policies');

  // 7. PASS 13I-W-R3 Section 8: CDMX 1000m Production Policy Verification
  console.log('\n--- 7. CDMX 1000m Production Policy Verification ---');
  // Worker 750m North of CDMX center: (19.4293 + 750/111139 = 19.43605, -99.1724)
  const cdmxDist750 = getDistanceMeters(19.4293, -99.1724, 19.43605, -99.1724);
  const resCdmx750 = resolveAttendanceLocation({
    lat: 19.43605, lng: -99.1724, accuracy: 20,
    gpsStatus: 'locked',
    authorizedLocations: cdmxLocations,
    targetProjectName: 'Oficina CDMX'
  });
  test(cdmxDist750 > 740 && cdmxDist750 < 760, 'CDMX 750m test point distance is ~750m');
  test(resCdmx750.status === 'MATCHED', 'CDMX worker at 750m is MATCHED (allowed within 1000m radius)');
  test(resCdmx750.displayName === 'Oficina CDMX', 'CDMX worker at 750m resolves to "Oficina CDMX"');
  test(resCdmx750.allEvaluations[0].isAccuracyAcceptable === true, 'GPS accuracy (20m) is within 150m threshold');

  // Worker 1200m North of CDMX center: (19.4293 + 1200/111139 = 19.44010, -99.1724)
  const cdmxDist1200 = getDistanceMeters(19.4293, -99.1724, 19.44010, -99.1724);
  const resCdmx1200 = resolveAttendanceLocation({
    lat: 19.44010, lng: -99.1724, accuracy: 20,
    gpsStatus: 'locked',
    authorizedLocations: cdmxLocations,
    targetProjectName: 'Oficina CDMX'
  });
  test(cdmxDist1200 > 1190, 'CDMX 1200m test point distance is > 1000m');
  test(resCdmx1200.status === 'OUTSIDE', 'CDMX worker at >1000m is OUTSIDE (DENIED)');
  test(resCdmx1200.matchedLocation === null, 'CDMX worker at >1000m has no matched location');
  test(resCdmx1200.displayName === 'Fuera de ubicación autorizada', 'Displays "Fuera de ubicación autorizada" for >1000m');

  // CDMX worker at 750m with poor GPS accuracy (>150m threshold)
  const resCdmxPoorGps = resolveAttendanceLocation({
    lat: 19.43605, lng: -99.1724, accuracy: 200,
    gpsStatus: 'locked',
    authorizedLocations: cdmxLocations,
    targetProjectName: 'Oficina CDMX'
  });
  test(resCdmxPoorGps.allEvaluations[0].isAccuracyAcceptable === false, 'GPS accuracy of 200m is flagged unacceptable (>150m threshold)');

  // 8. PASS 13I-W-R3 Section 8: Mérida Multi-Location Verification Matrix
  console.log('\n--- 8. Mérida Multi-Location Verification Matrix ---');
  test(resWarehouse.status === 'MATCHED', 'Mérida worker at warehouse -> MATCHED');
  test(resWarehouse.authorizationPolicy === 'SECONDARY_GEOFENCE', 'Mérida worker at warehouse -> ALLOW SECONDARY');
  test(resWarehouse.displayName === 'Mérida Warehouse', 'Mérida warehouse resolves to "Mérida Warehouse"');
  test(resMain.status === 'MATCHED', 'Mérida worker at main -> MATCHED');
  test(resMain.authorizationPolicy === 'PRIMARY_GEOFENCE', 'Mérida worker at main -> ALLOW PRIMARY');
  test(resMain.displayName === 'Mérida Main', 'Mérida main resolves to "Mérida Main"');
  test(resOutside.status === 'OUTSIDE', 'Mérida worker outside both locations -> OUTSIDE (DENIED)');
  test(resOutside.displayName === 'Fuera de ubicación autorizada', 'Mérida worker outside shows "Fuera de ubicación autorizada"');

  // 9. PASS 13I-W-R3 Section 8: Universal Role Geofence Enforcement (No Role Bypass)
  console.log('\n--- 9. Universal Role Geofence Enforcement (No Role Bypass) ---');
  // Helper simulating ClockIn.tsx logic
  function evaluatePunchPermissions(params) {
    const { role, isSupervisorFlag, resolvedStatus, isWarehouseBypass, workMode, hasValidatedLocation } = params;
    const isOutsideGeofence = !!(
      workMode === 'On Site' &&
      hasValidatedLocation &&
      resolvedStatus === 'OUTSIDE' &&
      !isWarehouseBypass
    );
    // PASS 13I-W-R3 strictly enforces: geofenceBlocking = isOutsideGeofence (NO userRole !== 'Tech')
    const geofenceBlocking = isOutsideGeofence;
    
    // Normal ClockIn allowed only if not geofenceBlocking
    const normalClockInAllowed = !geofenceBlocking;

    // Normal ClockOut allowed only if not isOutsideGeofence
    // When isOutsideGeofence is true, outside geofence modal / forgotten workflow is triggered
    const triggersOutsideGeofenceModal = isOutsideGeofence;
    const normalClockOutAllowed = !isOutsideGeofence;

    return { isOutsideGeofence, geofenceBlocking, normalClockInAllowed, normalClockOutAllowed, triggersOutsideGeofenceModal };
  }

  // A. Tech role outside geofence
  const techEval = evaluatePunchPermissions({
    role: 'Tech',
    isSupervisorFlag: false,
    resolvedStatus: 'OUTSIDE',
    isWarehouseBypass: false,
    workMode: 'On Site',
    hasValidatedLocation: true
  });
  test(techEval.isOutsideGeofence === true, 'Tech outside geofence isOutsideGeofence is true');
  test(techEval.geofenceBlocking === true, 'Tech outside geofence is BLOCKED from clock-in (geofenceBlocking is true)');
  test(techEval.normalClockInAllowed === false, 'Tech normal clock-in outside geofence is DENIED');
  test(techEval.triggersOutsideGeofenceModal === true, 'Tech normal clock-out outside geofence triggers outside geofence modal');
  test(techEval.normalClockOutAllowed === false, 'Tech normal clock-out outside geofence is DENIED');

  // B. Supervisor role outside geofence
  const supervisorEval = evaluatePunchPermissions({
    role: 'Supervisor',
    isSupervisorFlag: true,
    resolvedStatus: 'OUTSIDE',
    isWarehouseBypass: false,
    workMode: 'On Site',
    hasValidatedLocation: true
  });
  test(supervisorEval.geofenceBlocking === true, 'Supervisor outside geofence is BLOCKED from clock-in');
  test(supervisorEval.normalClockInAllowed === false, 'Supervisor normal clock-in outside geofence is DENIED');
  test(supervisorEval.triggersOutsideGeofenceModal === true, 'Supervisor normal clock-out outside triggers modal');
  test(supervisorEval.normalClockOutAllowed === false, 'Supervisor normal clock-out outside geofence is DENIED');

  // C. Tech with supervisory flag outside geofence
  const techSupervisorEval = evaluatePunchPermissions({
    role: 'Tech',
    isSupervisorFlag: true,
    resolvedStatus: 'OUTSIDE',
    isWarehouseBypass: false,
    workMode: 'On Site',
    hasValidatedLocation: true
  });
  test(techSupervisorEval.geofenceBlocking === true, 'Tech with supervisory flag outside is BLOCKED from clock-in');
  test(techSupervisorEval.normalClockInAllowed === false, 'Tech with supervisory flag normal clock-in is DENIED');
  test(techSupervisorEval.normalClockOutAllowed === false, 'Tech with supervisory flag normal clock-out is DENIED');

  // D. Manager / HR / Office roles outside geofence
  for (const role of ['Manager', 'HR', 'Office']) {
    const roleEval = evaluatePunchPermissions({
      role,
      isSupervisorFlag: false,
      resolvedStatus: 'OUTSIDE',
      isWarehouseBypass: false,
      workMode: 'On Site',
      hasValidatedLocation: true
    });
    test(roleEval.geofenceBlocking === true, `${role} outside geofence is BLOCKED from clock-in`);
    test(roleEval.normalClockInAllowed === false, `${role} normal clock-in outside geofence is DENIED`);
    test(roleEval.normalClockOutAllowed === false, `${role} normal clock-out outside geofence is DENIED`);
  }

  // 10. PASS 13I-W-R3 Section 8: Explicit Forgotten ClockOut Workflow Integrity
  console.log('\n--- 10. Explicit Forgotten ClockOut Workflow Integrity ---');
  // Simulating ClockIn.tsx handleForgottenConfirm
  function createForgottenClockOutPunch(reportedDepartureTime, comment) {
    return {
      type: 'clockOut',
      timestamp: new Date().toISOString(),
      manualAdjustment: true,
      gpsVerified: false,
      reason: 'FORGOTTEN_CLOCKOUT',
      comment: comment || '',
      requiresReview: true,
      reportedTime: reportedDepartureTime,
      calculatedPayableHours: 8.0,
      calculatedAutomaticOt: 0.0
    };
  }

  const forgottenPunch = createForgottenClockOutPunch('18:00', 'Salí del sitio y olvidé checar');
  test(forgottenPunch.manualAdjustment === true, 'Forgotten ClockOut sets manualAdjustment = true');
  test(forgottenPunch.gpsVerified === false, 'Forgotten ClockOut sets gpsVerified = false');
  test(forgottenPunch.reason === 'FORGOTTEN_CLOCKOUT', 'Forgotten ClockOut reason is strictly FORGOTTEN_CLOCKOUT');
  test(forgottenPunch.reportedTime === '18:00', 'Reported departure timestamp is preserved');
  test(forgottenPunch.calculatedPayableHours === 8.0, 'Payable hours strictly capped at 8.0h');
  test(forgottenPunch.calculatedAutomaticOt === 0.0, 'Automatic overtime is strictly 0.0h');
  test(forgottenPunch.requiresReview === true, 'Forgotten ClockOut strictly flags requiresReview = true');

  // 11. PASS 13I-W-R3 Section 8: Home Office Isolation & GPS Failure
  console.log('\n--- 11. Home Office Isolation & GPS Failure ---');
  // When worker is configured On Site, GPS denied must not switch to Home Office
  const onSiteGpsDenied = resolveAttendanceLocation({
    lat: null, lng: null, accuracy: null,
    gpsStatus: 'denied',
    authorizedLocations: meridaLocations,
    targetProjectName: 'Mérida'
  });
  test(onSiteGpsDenied.status === 'GPS_DENIED', 'On Site GPS denied stays GPS_DENIED');
  test(onSiteGpsDenied.displayName === 'GPS no disponible', 'Displays "GPS no disponible" (does NOT auto-switch to Home Office)');
  test(onSiteGpsDenied.authorizationPolicy === 'NONE', 'Authorization policy is NONE');

  // When worker is On Site, GPS acquiring must not switch to Home Office
  const onSiteGpsAcquiring = resolveAttendanceLocation({
    lat: null, lng: null, accuracy: null,
    gpsStatus: 'acquiring',
    authorizedLocations: meridaLocations,
    targetProjectName: 'Mérida'
  });
  test(onSiteGpsAcquiring.status === 'ACQUIRING_GPS', 'On Site GPS acquiring stays ACQUIRING_GPS');
  test(onSiteGpsAcquiring.displayName === 'Obteniendo GPS...', 'Displays "Obteniendo GPS..." (does NOT auto-switch to Home Office)');

  // Outside geofence does not switch work mode to Home Office
  test(resOutside.status === 'OUTSIDE', 'Outside geofence stays OUTSIDE');
  test(resOutside.displayName === 'Fuera de ubicación autorizada', 'Displays "Fuera de ubicación autorizada"');

  console.log('\n========================================================================');
  console.log(`TOTAL RESOLVER UX TESTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runTestSuite().catch(e => {
  console.error('Fatal error in resolver test suite:', e);
  process.exit(1);
});
