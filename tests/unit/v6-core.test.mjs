import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FACE_MATCH_THRESHOLD,
  FACE_BYPASS_STRIKE_LIMIT,
  getFaceDescriptorCacheKey,
  shouldShowBypassButton,
  normalizeDescriptor,
  matchDescriptors,
} from '../../src/utils/faceIdCore.utils.ts';

import {
  shouldPreserveStorageKeyOnUpgrade,
  runVersionUpgradeStorageCleanup,
} from '../../src/lib/storageMigration.ts';

import {
  formatLocalYMD,
  getDefaultNominaWeekRange,
} from '../../src/utils/nominaDates.utils.ts';

import {
  parseCoordinates,
  isValidCoordinate,
  haversineMeters,
  isShiftActiveWithinCutoff,
  formatElapsedDuration,
  buildLiveSiteClusters,
} from '../../src/utils/liveMap.utils.ts';

import { compareSemver } from '../../src/lib/semver.ts';

// ── 1. Face ID Core & 3-Strike "Omitir" Policy ──────────────────────────────
describe('Face ID Core & Policy (v6.0.0)', () => {
  const vecA = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.1 : -0.1));
  const vecAPlusNoise = vecA.map((v, i) => v + (i % 3 === 0 ? 0.01 : -0.01));
  const vecDifferent = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? -0.25 : 0.25));

  it('uses calibrated 0.53 threshold and 3-strike limit', () => {
    assert.equal(FACE_MATCH_THRESHOLD, 0.53);
    assert.equal(FACE_BYPASS_STRIKE_LIMIT, 3);
  });

  it('scopes local descriptor cache key per user ID (v6)', () => {
    assert.equal(getFaceDescriptorCacheKey('user-123'), 'v6_face_descriptor_user-123');
    assert.notEqual(getFaceDescriptorCacheKey('user-1'), getFaceDescriptorCacheKey('user-2'));
  });

  it('shows "Omitir" only after 3 failures or immediate camera error', () => {
    assert.equal(shouldShowBypassButton(0, false, true), false);
    assert.equal(shouldShowBypassButton(1, false, true), false);
    assert.equal(shouldShowBypassButton(2, false, true), false);
    assert.equal(shouldShowBypassButton(3, false, true), true);
    assert.equal(shouldShowBypassButton(5, false, true), true);
    // Hard camera error shows Omitir immediately
    assert.equal(shouldShowBypassButton(0, true, true), true);
    // LockScreen (allowBypass=false) never shows Omitir
    assert.equal(shouldShowBypassButton(5, true, false), false);
  });

  it('normalizes arrays, JSON strings, Float32Arrays, and index objects; rejects bad inputs', () => {
    assert.equal(normalizeDescriptor(vecA)?.length, 128);
    assert.equal(normalizeDescriptor(JSON.stringify(vecA))?.length, 128);
    assert.equal(normalizeDescriptor(new Float32Array(vecA))?.length, 128);
    const indexed = Object.fromEntries(vecA.map((v, i) => [String(i), v]));
    assert.equal(normalizeDescriptor(indexed)?.length, 128);

    assert.equal(normalizeDescriptor(null), null);
    assert.equal(normalizeDescriptor(undefined), null);
    assert.equal(normalizeDescriptor([1, 2, 3]), null);
    assert.equal(normalizeDescriptor('not-json'), null);
    const withNaN = [...vecA];
    withNaN[10] = Number.NaN;
    assert.equal(normalizeDescriptor(withNaN), null);
  });

  it('matches genuine faces and FAILS CLOSED on missing/invalid descriptors or impostors', () => {
    const selfMatch = matchDescriptors(vecA, vecAPlusNoise);
    assert.equal(selfMatch.isMatch, true);
    assert.ok(selfMatch.distance < 0.53);

    const impostor = matchDescriptors(vecA, vecDifferent);
    assert.equal(impostor.isMatch, false);
    assert.ok(impostor.distance >= 0.53);

    assert.equal(matchDescriptors(vecA, undefined).isMatch, false);
    assert.equal(matchDescriptors(undefined, vecA).isMatch, false);
    assert.equal(matchDescriptors(null, null).isMatch, false);
  });
});

// ── 2. Version Upgrade Storage Migration (5.1.4 -> 6.0.0) ───────────────────
describe('Storage Migration on Version Upgrade', () => {
  it('preserves active shifts, auth tokens, push endpoint, fast-login, and v6 Face ID cache; clears v5 Face ID cache', () => {
    const store = new Map([
      ['latnovva_app_version', '5.1.4'],
      ['latnovva-storage', '{"state":{}}'],
      ['latnovva-active-shift-user-1', '{"shiftId":"s1"}'],
      ['sb-proj-auth-token', 'jwt-token'],
      ['device_fast_login_enabled', 'true'],
      ['registered_push_endpoint', 'https://push.example'],
      ['v6_face_descriptor_user-1', '[0.1]'],
      ['cached_user_descriptor', '[old-v5-descriptor]'],
      ['face_id_enrolled_tech@latnovva.com', 'true'],
      ['stale_scratch_key', 'junk'],
    ]);

    const mockStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };

    const res = runVersionUpgradeStorageCleanup(mockStorage, '6.0.0', Array.from(store.keys()));
    assert.equal(res.upgraded, true);
    assert.equal(store.get('latnovva_app_version'), '6.0.0');
    assert.equal(store.has('latnovva-active-shift-user-1'), true);
    assert.equal(store.has('sb-proj-auth-token'), true);
    assert.equal(store.has('device_fast_login_enabled'), true);
    assert.equal(store.has('registered_push_endpoint'), true);
    assert.equal(store.has('v6_face_descriptor_user-1'), true);
    // Legacy v5 unscoped Face ID keys MUST be cleared for forced v6 re-enrollment
    assert.equal(store.has('cached_user_descriptor'), false);
    assert.equal(store.has('face_id_enrolled_tech@latnovva.com'), false);
    assert.equal(store.has('stale_scratch_key'), false);
  });

  it('disables device_fast_login_enabled when upgrading v5 -> v6 without a v6 Face ID descriptor (prevents Dec 1 lockout)', () => {
    const store = new Map([
      ['latnovva_app_version', '5.1.4'],
      ['device_fast_login_enabled', 'true'],
      ['cached_user_descriptor', '[old-v5-descriptor]'],
      ['latnovva-active-shift-user-1', '{"shiftId":"s1"}'],
    ]);
    const mockStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
    runVersionUpgradeStorageCleanup(mockStorage, '6.0.0', Array.from(store.keys()));
    assert.equal(store.has('device_fast_login_enabled'), false);
    assert.equal(store.has('cached_user_descriptor'), false);
    assert.equal(store.has('latnovva-active-shift-user-1'), true);
  });

  it('preserves required keys correctly via predicate', () => {
    assert.equal(shouldPreserveStorageKeyOnUpgrade('latnovva-active-shift-abc'), true);
    assert.equal(shouldPreserveStorageKeyOnUpgrade('v6_face_descriptor_abc'), true);
    assert.equal(shouldPreserveStorageKeyOnUpgrade('cached_user_descriptor'), false);
  });
});

// ── 3. Nomina Date Range Bug Regression ─────────────────────────────────────
describe('Nomina Local Week Range Calculation', () => {
  it('handles Sunday without jumping to next week', () => {
    // Sunday Nov 29, 2026 at 23:30 local time
    const sundayNight = new Date(2026, 10, 29, 23, 30, 0);
    const range = getDefaultNominaWeekRange(sundayNight);
    assert.equal(range.startDate, '2026-11-23'); // Monday
    assert.equal(range.endDate, '2026-11-29');   // Sunday
  });

  it('handles Wednesday late evening without UTC+1 day drift', () => {
    // Wednesday Nov 25, 2026 at 22:00 local time
    const wedNight = new Date(2026, 10, 25, 22, 0, 0);
    const range = getDefaultNominaWeekRange(wedNight);
    assert.equal(range.startDate, '2026-11-23');
    assert.equal(range.endDate, '2026-11-29');
    assert.equal(formatLocalYMD(wedNight), '2026-11-25');
  });
});

// ── 4. LiveMap Coordinates, Shift Cutoff & Clustering ───────────────────────
describe('LiveMap Operations Clustering', () => {
  it('rejects (0, 0) and parses valid coordinate formats', () => {
    assert.equal(isValidCoordinate(0, 0), false);
    assert.equal(isValidCoordinate(20.9854, -89.6152), true);
    assert.deepEqual(parseCoordinates('20.9854, -89.6152'), { lat: 20.9854, lng: -89.6152 });
    assert.deepEqual(parseCoordinates('{"lat":19.4326,"lng":-99.1332}'), { lat: 19.4326, lng: -99.1332 });
    assert.equal(parseCoordinates('0, 0'), null);
    assert.deepEqual(parseCoordinates('Mérida, Yucatán'), { lat: 20.9854, lng: -89.6152 });
    assert.equal(parseCoordinates('Unknown Place'), null);
  });

  it('enforces 14-hour active shift cutoff and formats elapsed time', () => {
    const now = Date.parse('2026-12-01T18:00:00Z');
    assert.equal(isShiftActiveWithinCutoff('2026-12-01T14:00:00Z', now, 14), true);
    assert.equal(isShiftActiveWithinCutoff('2026-11-30T20:00:00Z', now, 14), false);
    assert.equal(formatElapsedDuration('2026-12-01T15:30:00Z', now), '2h 30m en turno');
  });

  it('clusters workers to projects, proximity sites, and dynamic off-site pins without ever emitting (0, 0)', () => {
    const sites = [
      { id: 'proj-merida', projectId: 'proj-merida', name: 'Oficina Mérida', lat: 20.9854, lng: -89.6152, radiusMeters: 500, assignedCount: 2 },
      { id: 'proj-cdmx', projectId: 'proj-cdmx', name: 'Oficina CDMX', lat: 19.4326, lng: -99.1332, radiusMeters: 500, assignedCount: 1 },
    ];
    const workers = [
      {
        personnelId: 'w1', name: 'Ana', role: 'Ing', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
        workType: 'ON_SITE', projectId: 'proj-merida', lat: 20.9855, lng: -89.6151,
      },
      {
        personnelId: 'w2', name: 'Luis', role: 'Tech', clockInIso: '2026-12-01T14:15:00Z', clockInLabel: '08:15',
        workType: 'HOME_OFFICE', projectId: null, lat: 21.0200, lng: -89.5800,
      },
      {
        // Worker with missing GPS (0,0 stripped to null) and no project should NOT create a (0,0) pin
        personnelId: 'w3', name: 'Ghost', role: 'Tech', clockInIso: '2026-12-01T14:20:00Z', clockInLabel: '08:20',
        workType: 'ON_SITE', projectId: null, lat: null, lng: null,
      },
    ];

    const clusters = buildLiveSiteClusters(sites, workers);
    assert.equal(clusters.every((c) => isValidCoordinate(c.lat, c.lng)), true);

    const merida = clusters.find((c) => c.id === 'proj-merida');
    assert.equal(merida?.workers.length, 1);
    assert.equal(merida?.status, 'partial');

    const cdmx = clusters.find((c) => c.id === 'proj-cdmx');
    assert.equal(cdmx?.workers.length, 0);
    assert.equal(cdmx?.status, 'empty');

    const ho = clusters.find((c) => c.status === 'offsite');
    assert.equal(ho?.name, 'Home Office / Remoto');
    assert.equal(ho?.workers.length, 1);

    assert.ok(haversineMeters(20.9854, -89.6152, 20.9855, -89.6151) < 25);
  });
});

// ── 5. Semver Gate ──────────────────────────────────────────────────────────
describe('Semver Release Gate', () => {
  it('identifies 5.1.4 < 6.0.0 and 6.0.0 === 6.0.0', () => {
    assert.ok(compareSemver('5.1.4', '6.0.0') < 0);
    assert.equal(compareSemver('6.0.0', '6.0.0'), 0);
    assert.ok(compareSemver('6.0.1', '6.0.0') > 0);
  });
});
