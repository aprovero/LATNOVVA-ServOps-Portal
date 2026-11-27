/**
 * PASS 15B — Automated Regression Test Suite for Every P0, P1 & P2 Fix
 * Covers all 15+ required regression cases from PASS 15B Section 22.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeRole,
  isStaffRole,
  canAccessSettings,
  canEditPersonnel,
  canAccessManagerHR,
  canAccessOps,
  canAccessProject,
} from '../../src/lib/roleAuth.ts';

import {
  shouldPreserveStorageKeyOnUpgrade,
  runVersionUpgradeStorageCleanup,
  clearAuthSessionStorage,
} from '../../src/lib/storageMigration.ts';

import { canBootstrapOfflineV2WithLease } from '../../src/lib/attendanceV2/offlineBootstrap.ts';

import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  getFaceMatchThreshold,
  resolveDetectorStrategy,
  createEmpiricalValidationRecord,
} from '../../src/utils/faceIdCore.utils.ts';

import { buildLiveSiteClusters } from '../../src/utils/liveMap.utils.ts';

import {
  CHUNK_RECOVERY_STORAGE_KEY,
  isChunkLoadError,
  attemptOneShotChunkRecovery,
} from '../../src/lib/chunkRecovery.ts';

const repoRoot = process.cwd();

// ── P0-1: Production CORS Policy ────────────────────────────────────────────
describe('P0-1: complete-password-rotation CORS allowlist & policy', () => {
  const fnSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/complete-password-rotation/index.ts'),
    'utf8'
  );

  it('explicitly allows https://latnovvamx.onrender.com and localhost, never wildcard * or dead host', () => {
    assert.ok(fnSource.includes('"https://latnovvamx.onrender.com"'), 'Must allow live Render production origin');
    assert.ok(fnSource.includes('"http://localhost:5173"'), 'Must allow localhost dev origin');
    assert.equal(fnSource.includes('"Access-Control-Allow-Origin": "*"'), false, 'Must NEVER allow wildcard *');
    assert.equal(fnSource.includes('latnovva-servicetool.onrender.com'), false, 'Must not retain dead/unverified hostname');
    assert.ok(fnSource.includes('status: 403'), 'Must deny unknown Origin with 403');
    assert.ok(fnSource.includes('status: 204'), 'Must handle OPTIONS preflight cleanly');
  });
});

// ── P0-2 & P2-1: Hardened Privileged RPCs & SQL Security ────────────────────
describe('P0-2 & P2-1: Privileged RPCs SQL Hardening', () => {
  const sql = fs.readFileSync(
    path.join(repoRoot, 'supabase/migrations/20261201000001_v6_security_hardening.sql'),
    'utf8'
  );

  it('normalizes roles with trim() and validates explicit allowed vocabulary', () => {
    assert.ok(sql.includes("clean_caller_role := trim(COALESCE(raw_caller_role, ''))"));
    assert.ok(sql.includes("clean_requested_role := trim(COALESCE(user_role, ''))"));
    assert.ok(sql.includes("clean_target_role := trim(COALESCE(raw_target_role, ''))"));
    assert.ok(sql.includes("('Manager', 'HR', 'Supervisor', 'Office', 'Tech', 'Customer')"));
  });

  it('blocks HR from creating Manager, promoting to Manager, or mutating ANY field on existing Manager', () => {
    assert.ok(sql.includes("IF clean_caller_role = 'HR' AND clean_requested_role = 'Manager' THEN"));
    assert.ok(sql.includes("IF clean_caller_role = 'HR' AND clean_target_role = 'Manager' THEN"));
    assert.ok(sql.includes("IF clean_caller_role = 'HR' AND clean_new_role = 'Manager' THEN"));
    assert.match(sql, /SELECT role[\s\S]{0,80}INTO raw_target_role/);
  });

  it('revokes PUBLIC & anon, drops all existing overloads dynamically, and reconciles existing auth.users idempotently', () => {
    assert.ok(sql.includes("EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', fn.proname, fn.args);"));
    assert.ok(sql.includes("p.proname IN ('admin_create_user', 'admin_update_user', 'get_user_id_by_email')"));
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text) FROM PUBLIC;'));
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, text, uuid, text, text) FROM PUBLIC;'));
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;'));
    assert.ok(sql.includes('INSERT INTO auth.identities'));
    assert.ok(sql.includes('pg_get_function_identity_arguments'));
  });
});

// ── P0-3 & P1-3: Fail-Closed Role Model & Route Alignment ───────────────────
describe('P0-3 & P1-3: Fail-Closed Role Matrix', () => {
  it('fails closed on null, undefined, empty, whitespace, and unknown roles (never defaults to Tech)', () => {
    for (const bad of [null, undefined, '', '   ', 'Admin', 'SuperAdmin', 'tech', 'MANAGER', 123, {}]) {
      assert.equal(normalizeRole(bad), null, `Expected null for ${String(bad)}`);
      assert.equal(isStaffRole(bad), false);
      assert.equal(canAccessSettings(bad), false);
      assert.equal(canEditPersonnel(bad), false);
      assert.equal(canAccessManagerHR(bad), false);
      assert.equal(canAccessOps(bad), false);
      assert.equal(canAccessProject(bad, 'c1', 'c1'), false);
    }
  });

  it('enforces exact StaffRoute allowlist (Manager, HR, Supervisor, Office, Tech; denies Customer)', () => {
    for (const staff of ['Manager', 'HR', 'Supervisor', 'Office', 'Tech', ' Tech ']) {
      assert.equal(isStaffRole(staff), true);
    }
    assert.equal(isStaffRole('Customer'), false);
  });

  it('aligns Settings & Personnel mutation strictly to Manager & HR (Supervisor read-only)', () => {
    assert.equal(canAccessSettings('Manager'), true);
    assert.equal(canAccessSettings('HR'), true);
    assert.equal(canAccessSettings('Supervisor'), false);
    assert.equal(canEditPersonnel('Manager'), true);
    assert.equal(canEditPersonnel('HR'), true);
    assert.equal(canEditPersonnel('Supervisor'), false);
    assert.equal(canAccessOps('Supervisor'), true);
  });
});

// ── P0-4, Item 5 & P2-3: Offline Attendance & CacheStorage Preservation ─────
describe('P0-4 & P2-3: Offline Attendance Preservation & CacheStorage Safety', () => {
  it('preserves attendance_device_id, active shifts, GPS cache, and cached_user_profile on v5 -> v6 upgrade', () => {
    assert.equal(shouldPreserveStorageKeyOnUpgrade('attendance_device_id'), true);
    assert.equal(shouldPreserveStorageKeyOnUpgrade('latnovva-active-shift-u1'), true);
    assert.equal(shouldPreserveStorageKeyOnUpgrade('latnovva_last_gps_fix'), true);
    assert.equal(shouldPreserveStorageKeyOnUpgrade('cached_user_profile'), true);

    const store = new Map([
      ['latnovva_app_version', '5.1.4'],
      ['attendance_device_id', 'dev-uuid-123'],
      ['latnovva-active-shift-u1', '{"shift_id":"s1"}'],
      ['latnovva_last_gps_fix', '{"lat":20.98,"lng":-89.61}'],
      ['cached_user_profile', '{"name":"Ana"}'],
      ['cached_user_descriptor', '[old-v5]'],
    ]);
    const mockStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
    runVersionUpgradeStorageCleanup(mockStorage, '6.0.0', Array.from(store.keys()));
    assert.equal(store.get('attendance_device_id'), 'dev-uuid-123');
    assert.equal(store.get('latnovva-active-shift-u1'), '{"shift_id":"s1"}');
    assert.equal(store.has('cached_user_descriptor'), false);
  });

  it('targeted logout preserves attendance_device_id and active shifts while clearing auth & Face cache', () => {
    const store = new Map([
      ['attendance_device_id', 'dev-uuid-123'],
      ['latnovva-active-shift-u1', '{"shift_id":"s1"}'],
      ['sb-proj-auth-token', 'secret-jwt'],
      ['cached_user_profile', '{"name":"Ana"}'],
      ['v6_face_descriptor_u1', '[0.1]'],
    ]);
    const mockStorage = { removeItem: (k) => store.delete(k) };
    clearAuthSessionStorage(mockStorage, 'u1', Array.from(store.keys()));
    assert.equal(store.has('attendance_device_id'), true);
    assert.equal(store.has('latnovva-active-shift-u1'), true);
    assert.equal(store.has('sb-proj-auth-token'), false);
    assert.equal(store.has('v6_face_descriptor_u1'), false);
  });

  it('main.tsx does NOT wildcard-delete CacheStorage', () => {
    const mainSrc = fs.readFileSync(path.join(repoRoot, 'src/main.tsx'), 'utf8');
    assert.equal(mainSrc.includes('caches.delete('), false, 'main.tsx must NOT wildcard-delete CacheStorage');
  });
});

// ── Item 6: Offline V2 Lease Bootstrap ──────────────────────────────────────
describe('Item 6: Offline Attendance V2 Lease Bootstrap', () => {
  const now = Date.parse('2026-12-01T15:00:00Z');
  const validLease = {
    lease_id: 'lease-1',
    personnel_id: 'p-1',
    device_id: 'dev-1',
    issued_at: '2026-12-01T08:00:00Z',
    valid_until: '2026-12-02T08:00:00Z',
    is_revoked: false,
    authorized_project_ids: ['proj-1'],
  };

  it('allows V2 offline mode with valid unexpired device-matched lease', () => {
    assert.equal(canBootstrapOfflineV2WithLease(validLease, 'p-1', 'dev-1', now), true);
  });

  it('fails closed when lease is missing, expired, revoked, wrong personnel, or wrong device', () => {
    assert.equal(canBootstrapOfflineV2WithLease(null, 'p-1', 'dev-1', now), false);
    assert.equal(canBootstrapOfflineV2WithLease({ ...validLease, valid_until: '2026-12-01T14:00:00Z' }, 'p-1', 'dev-1', now), false);
    assert.equal(canBootstrapOfflineV2WithLease({ ...validLease, is_revoked: true }, 'p-1', 'dev-1', now), false);
    assert.equal(canBootstrapOfflineV2WithLease(validLease, 'p-other', 'dev-1', now), false);
    assert.equal(canBootstrapOfflineV2WithLease(validLease, 'p-1', 'dev-other', now), false);
    assert.equal(canBootstrapOfflineV2WithLease(validLease, 'p-1', null, now), false);
  });
});

// ── P0-5: Zero Hardcoded Onboarding Credentials ─────────────────────────────
describe('P0-5: Zero hardcoded onboarding credentials in Settings.tsx', () => {
  it('Settings.tsx contains no Latnovva!TemporaryPass123 and uses admin_create_user + resetPasswordForEmail', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/pages/Settings.tsx'), 'utf8');
    assert.equal(src.includes('Latnovva!TemporaryPass123'), false);
    assert.ok(src.includes("'admin_create_user'"));
    assert.ok(src.includes('resetPasswordForEmail'));
  });
});

// ── P1-1 & P1-2: Face Threshold Config & SSD/Tiny Fallback ──────────────────
describe('P1-1 & P1-2: Face Threshold Authoritative Config & SSD/Tiny Fallback', () => {
  it('provides single authoritative threshold & empirical validation harness', () => {
    assert.equal(getFaceMatchThreshold(), DEFAULT_FACE_MATCH_THRESHOLD);
    assert.equal(getFaceMatchThreshold(0.48), 0.48);
    const rec = createEmpiricalValidationRecord({
      candidateThreshold: 0.53,
      genuineDistance: 0.41,
      impostorDistance: 0.68,
      device: 'iPhone 14 Safari',
      lighting: 'outdoor-shade',
      glassesOrPpe: 'safety-glasses',
    });
    assert.equal(rec.acceptedGenuine, true);
    assert.equal(rec.rejectedImpostor, true);
  });

  it('falls back to TinyFaceDetector when SSD fails to load or returns 0 detections', () => {
    assert.equal(resolveDetectorStrategy({ ssdLoaded: true, tinyLoaded: true, ssdDetectionsCount: 1 }), 'ssd');
    assert.equal(resolveDetectorStrategy({ ssdLoaded: false, tinyLoaded: true }), 'tiny_fallback');
    assert.equal(resolveDetectorStrategy({ ssdLoaded: true, tinyLoaded: true, ssdDetectionsCount: 0 }), 'tiny_fallback');
    assert.equal(resolveDetectorStrategy({ ssdLoaded: false, tinyLoaded: false }), 'unavailable');
  });
});

// ── P1-4: Customer Tenant Isolation ─────────────────────────────────────────
describe('P1-4: Customer Tenant Isolation', () => {
  it('allows Customer only on own clientId projects (fails closed on null or mismatched clientId)', () => {
    assert.equal(canAccessProject('Customer', 'client-A', 'client-A'), true);
    assert.equal(canAccessProject('Customer', 'client-A', 'client-B'), false);
    assert.equal(canAccessProject('Customer', null, 'client-A'), false);
  });
});

// ── P1-5: LiveMap HOME_OFFICE & Offsite Project Worker Clustering ───────────
describe('P1-5: LiveMap Offsite & Home Office Clustering Priority', () => {
  const sites = [
    { id: 'proj-merida', projectId: 'proj-merida', name: 'Oficina Mérida', lat: 20.9854, lng: -89.6152, radiusMeters: 500, assignedCount: 2 },
    { id: 'loc-warehouse', name: 'Bodega Mérida', lat: 20.9600, lng: -89.6400, radiusMeters: 300, assignedCount: 1 },
  ];

  it('NEVER snaps HOME_OFFICE with projectId onto the on-site project pin', () => {
    const workers = [{
      personnelId: 'ho-1', name: 'Sofia', role: 'Admin', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
      workType: 'HOME_OFFICE', projectId: 'proj-merida', lat: 21.0300, lng: -89.5700,
    }];
    const clusters = buildLiveSiteClusters(sites, workers);
    const merida = clusters.find((c) => c.id === 'proj-merida');
    const hoCluster = clusters.find((c) => c.id.startsWith('homeoffice-'));
    assert.equal(merida?.workers.length, 0, 'HOME_OFFICE worker must NOT snap to project pin');
    assert.equal(hoCluster?.workers.length, 1);
  });

  it('NEVER snaps an offsite worker (far from project geofence) onto the project pin merely because projectId matches', () => {
    const workers = [{
      personnelId: 'off-1', name: 'Carlos', role: 'Tech', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
      workType: 'ON_SITE', projectId: 'proj-merida', lat: 21.1500, lng: -89.5000, // ~20km away!
    }];
    const clusters = buildLiveSiteClusters(sites, workers);
    const merida = clusters.find((c) => c.id === 'proj-merida');
    const offsiteCluster = clusters.find((c) => c.id.startsWith('offsite-'));
    assert.equal(merida?.workers.length, 0, 'Worker 20km outside geofence must NOT snap to project pin');
    assert.equal(offsiteCluster?.workers.length, 1);
  });

  it('snaps onsite primary, onsite secondary, and GPS-less project worker accurately', () => {
    const workers = [
      {
        personnelId: 'on-1', name: 'Ana', role: 'Tech', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
        workType: 'ON_SITE', projectId: 'proj-merida', lat: 20.9856, lng: -89.6150,
      },
      {
        personnelId: 'sec-1', name: 'Luis', role: 'Tech', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
        workType: 'ON_SITE', projectId: 'proj-merida', attendanceLocationId: 'loc-warehouse', lat: 20.9601, lng: -89.6401,
      },
      {
        personnelId: 'nogps-1', name: 'Maria', role: 'Tech', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
        workType: 'ON_SITE', projectId: 'proj-merida', lat: null, lng: null,
      },
    ];
    const clusters = buildLiveSiteClusters(sites, workers);
    assert.equal(clusters.find((c) => c.id === 'proj-merida')?.workers.length, 2); // Ana + Maria
    assert.equal(clusters.find((c) => c.id === 'loc-warehouse')?.workers.length, 1); // Luis
  });
});

// ── P1-6: Face Re-Enrollment One-Time Sentinel & Rollback Boundary ──────────
describe('P1-6: Face Re-Enrollment Migration Idempotency & Rollback', () => {
  it('migration has BEGIN/COMMIT, sentinel check, RLS lockdown, backup count assertion, and non-migration rollback script', () => {
    const mig = fs.readFileSync(path.join(repoRoot, 'supabase/migrations/20261201000002_v6_face_reenroll.sql'), 'utf8');
    const rb = fs.readFileSync(path.join(repoRoot, 'scripts/sql/v6_face_reenroll_pre_boundary_rollback.sql'), 'utf8');
    assert.equal(
      fs.existsSync(path.join(repoRoot, 'supabase/migrations/20261201000002_v6_face_reenroll_rollback.sql')),
      false,
      'Rollback SQL must NOT reside inside supabase/migrations/'
    );
    assert.ok(mig.includes('BEGIN;') && mig.includes('COMMIT;'));
    assert.ok(mig.includes('v6_migration_sentinels'));
    assert.ok(mig.includes('ENABLE ROW LEVEL SECURITY'));
    assert.ok(mig.includes('IF v_already_done THEN'));
    assert.ok(mig.includes('IF v_mx_backed < v_mx_source THEN'));
    assert.ok(rb.includes('Past irreversible boundary'));
  });
});

// ── PASS 15D: Second Remediation Behavioral & Structural Regression ─────────
describe('PASS 15D: Second Remediation Regression', () => {
  it('Item 1-8 & PASS 15F: SQL migration dynamically drops all policies/overloads, hardens get_user_id_by_email, and asserts postconditions', () => {
    const sql = fs.readFileSync(path.join(repoRoot, 'supabase/migrations/20261201000001_v6_security_hardening.sql'), 'utf8');
    assert.ok(sql.includes('FOR fn IN') && sql.includes('pg_get_function_identity_arguments(p.oid)'), 'Must drop all existing overloads dynamically before CREATE');
    assert.ok(sql.includes('FOR pol IN') && sql.includes('FROM pg_policies'), 'Must dynamically drop all legacy policies across all 6 target tables');
    assert.ok(sql.includes('CREATE FUNCTION public.get_user_id_by_email(email_query text)'), 'Must authoritatively own & harden get_user_id_by_email');
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM anon;'), 'Must revoke anon EXECUTE on get_user_id_by_email');
    assert.ok(sql.includes('Postcondition failed:'), 'Must include transactional postcondition assertions');
    assert.ok(sql.includes('guard_profiles_sensitive_fields'), 'Must guard direct profiles UPDATE against self-escalation & HR->Manager');
    assert.ok(sql.includes('guard_mx_personnel_self_update'), 'Must guard mx_personnel self-updates against role/rate escalation');
    assert.ok(sql.includes('v6_mx_personnel_staff_select') && sql.includes('v6_reports_manager_readonly') && sql.includes('v6_tools_manager_readonly'), 'Must install fail-closed v6 RLS policies');
  });

  it('PASS 15F P0-2, P1-2, P2-1 & Lean v6: FaceCameraModal z-index > FaceLockScreen, Login recovery setter, wildcard v6 face cleanup, zero dead Report/Tool UI', () => {
    const modalSrc = fs.readFileSync(path.join(repoRoot, 'src/components/shared/FaceCameraModal.tsx'), 'utf8');
    const loginSrc = fs.readFileSync(path.join(repoRoot, 'src/pages/Login.tsx'), 'utf8');
    const layoutSrc = fs.readFileSync(path.join(repoRoot, 'src/components/layout/Layout.tsx'), 'utf8');
    const searchSrc = fs.readFileSync(path.join(repoRoot, 'src/components/search/CommandSearch.tsx'), 'utf8');
    assert.ok(modalSrc.includes('z-[10000]') && modalSrc.includes('z-[10001]'), 'FaceCameraModal must stack above FaceLockScreen z-[9990]');
    assert.ok(loginSrc.includes('setUrlHasRecovery(false)'), 'Login must clear urlHasRecovery after password recovery');
    assert.equal(layoutSrc.includes('Create Daily Report'), false, 'Layout must not contain dead Report modal');
    assert.equal(layoutSrc.includes('/tools?q='), false, 'Layout must not contain dead /tools links');
    assert.equal(searchSrc.includes('qa-new-report'), false, 'CommandSearch must not contain dead Report quick action');
    assert.equal(fs.existsSync(path.join(repoRoot, 'public/APROVERO_LOGO.png.bak')), false);
    assert.equal(fs.existsSync(path.join(repoRoot, 'src/scripts/bulkResetPasswords.ts')), false);
  });

  it('Item 10 & 11: clearAuthSessionStorage clears lnv_search_recent & user face cache while preserving attendance_device_id', () => {
    const store = new Map([
      ['attendance_device_id', 'dev-999'],
      ['latnovva-active-shift-u2', '{"shift_id":"s2"}'],
      ['lnv_search_recent', '["secret-query"]'],
      ['v6_face_descriptor_u2', '[0.1,0.2]'],
      ['sb-xyz-auth-token', 'jwt'],
    ]);
    const mockStorage = { removeItem: (k) => store.delete(k) };
    clearAuthSessionStorage(mockStorage, 'u2', Array.from(store.keys()));
    assert.equal(store.has('attendance_device_id'), true);
    assert.equal(store.has('latnovva-active-shift-u2'), true);
    assert.equal(store.has('lnv_search_recent'), false);
    assert.equal(store.has('v6_face_descriptor_u2'), false);
    assert.equal(store.has('sb-xyz-auth-token'), false);
  });

  it('Item 12: VersionUpdateGate does NOT wildcard-delete CacheStorage and waits for installing worker', () => {
    const gateSrc = fs.readFileSync(path.join(repoRoot, 'src/components/VersionUpdateGate.tsx'), 'utf8');
    assert.equal(gateSrc.includes('caches.delete('), false);
    assert.ok(gateSrc.includes('waitForWorkerReady'));
  });

  it('Item 18 & 25: useStore has no CUST_POWER_ELEC default and strips legacy v5 faceDescriptors on rehydrate', () => {
    const storeSrc = fs.readFileSync(path.join(repoRoot, 'src/store/useStore.ts'), 'utf8');
    assert.equal(storeSrc.includes("clientId: 'CUST_POWER_ELEC'"), false);
    assert.ok(storeSrc.includes('faceDescriptorVersion !== 6'));
    assert.ok(storeSrc.includes('faceDescriptorVersion?: number'));
  });

  it('Item 27: LiveMap checks ALL physical sites for a multi-location project without premature break', () => {
    const multiSites = [
      { id: 'proj-alpha', projectId: 'proj-alpha', name: 'Alpha Primary (CDMX)', lat: 19.4326, lng: -99.1332, radiusMeters: 500, assignedCount: 2 },
      { id: 'loc-alpha-merida', projectId: 'proj-alpha', name: 'Alpha Secondary (Mérida)', lat: 20.9854, lng: -89.6152, radiusMeters: 500, assignedCount: 1 },
    ];
    const workers = [{
      personnelId: 'w-sec', name: 'Diego', role: 'Tech', clockInIso: '2026-12-01T14:00:00Z', clockInLabel: '08:00',
      workType: 'ON_SITE', projectId: 'proj-alpha', lat: 20.9855, lng: -89.6151,
    }];
    const clusters = buildLiveSiteClusters(multiSites, workers);
    assert.equal(clusters.find((c) => c.id === 'proj-alpha')?.workers.length, 0);
    assert.equal(clusters.find((c) => c.id === 'loc-alpha-merida')?.workers.length, 1);
  });
});

// ── P1-7: One-Shot ChunkLoadError Recovery ──────────────────────────────────
describe('P1-7: ChunkLoadError One-Shot Recovery', () => {
  it('reloads ONCE on ChunkLoadError and refuses infinite loop on second failure', async () => {
    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
    let reloadCount = 0;
    let swUpdateCount = 0;
    const chunkErr = new TypeError('Failed to fetch dynamically imported module: /assets/LiveMap-abc.js');

    assert.equal(isChunkLoadError(chunkErr), true);
    assert.equal(isChunkLoadError(new Error('Normal business error')), false);

    // Attempt 1: triggers SW update + reload once
    const r1 = await attemptOneShotChunkRecovery(chunkErr, {
      storage: mockStorage,
      reload: () => { reloadCount++; },
      updateServiceWorker: async () => { swUpdateCount++; },
    });
    assert.equal(r1.recovered, true);
    assert.equal(r1.reason, 'reloading');
    assert.equal(reloadCount, 1);
    assert.equal(swUpdateCount, 1);
    assert.equal(store.get(CHUNK_RECOVERY_STORAGE_KEY), 'true');

    // Attempt 2: already attempted -> stops infinite loop so ErrorBoundary renders
    const r2 = await attemptOneShotChunkRecovery(chunkErr, {
      storage: mockStorage,
      reload: () => { reloadCount++; },
      updateServiceWorker: async () => { swUpdateCount++; },
    });
    assert.equal(r2.recovered, false);
    assert.equal(r2.reason, 'already_attempted');
    assert.equal(reloadCount, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PASS 15H — P1-G1, P2-G1, P2-G2, P2-G3 Regression Coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('PASS 15H: P1-G1 admin_create_user subsidiary & Supervisor read-only Personnel UI', () => {
  it('addPersonnel and updatePersonnel pass user_subsidiary to admin_create_user and never PATCH profiles directly', () => {
    const storeSrc = fs.readFileSync(path.join(process.cwd(), 'src/store/useStore.ts'), 'utf8');
    // Every admin_create_user call in useStore.ts must pass user_subsidiary and user_client_id
    const rpcBlocks = storeSrc.match(/rpc\(\s*'admin_create_user'[\s\S]{0,600}?\}\s*as any\)/g) || [];
    assert.ok(rpcBlocks.length >= 2, `Expected >=2 admin_create_user calls in useStore.ts, found ${rpcBlocks.length}`);
    for (const block of rpcBlocks) {
      assert.match(block, /user_subsidiary:/, 'admin_create_user call must pass user_subsidiary');
      assert.match(block, /user_client_id:/, 'admin_create_user call must pass user_client_id');
    }
    // Zero direct profiles.update({ subsidiary ... }) calls anywhere in src/store/useStore.ts
    assert.doesNotMatch(
      storeSrc,
      /from\(\s*'profiles'\s*\)[\s\S]{0,80}\.update\(\s*\{\s*subsidiary\b/,
      'Direct client PATCH of profiles.subsidiary must be removed (P1-G1)'
    );
  });

  it('Personnel.tsx gates profile photo upload and disables detail edit fieldset for non-managers (Supervisor)', () => {
    const personnelSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Personnel.tsx'), 'utf8');
    assert.match(
      personnelSrc,
      /\{canManagePersonnel && \(\s*<label[^>]*>[\s\S]*?<input type="file"/,
      'Profile photo upload input must be gated behind canManagePersonnel'
    );
    assert.match(
      personnelSrc,
      /<fieldset\s+disabled=\{!canManagePersonnel\}\s+className="contents">/,
      'Personnel edit form body must disable all inputs for non-HR/Manager roles via fieldset'
    );
  });
});

describe('PASS 15H: P2-G1 Lean-v6 dead Report & Tool removal from useStore.ts', () => {
  it('useStore.ts contains zero dead Report or Tool state/actions/table queries', () => {
    const storeSrc = fs.readFileSync(path.join(process.cwd(), 'src/store/useStore.ts'), 'utf8');
    const forbiddenSymbols = [
      /\bexport\s+type\s+ReportState\b/,
      /\bexport\s+interface\s+Report\b/,
      /\bexport\s+interface\s+Tool\b/,
      /\bALLOWED_REPORT_TRANSITIONS\b/,
      /\bfetchReportsForRange\b/,
      /\baddReport\s*:/,
      /\bupdateReport\s*:/,
      /\bdeleteReport\s*:/,
      /\baddTool\s*:/,
      /\bupdateTool\s*:/,
      /\bdeleteTool\s*:/,
      /\bsubReportTemplates\b/,
      /\bsubReportInstances\b/,
      /\.from\(\s*'reports'\s*\)/,
      /\.from\(\s*'tools'\s*\)/,
    ];
    for (const pattern of forbiddenSymbols) {
      assert.doesNotMatch(storeSrc, pattern, `Dead Report/Tool residue found in useStore.ts: ${pattern}`);
    }
  });
});

describe('PASS 15H: P2-G2 package.json & package-lock.json reconciliation', () => {
  it('package-lock.json root dependencies and devDependencies match package.json cleanly', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf8'));
    assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
    assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
    assert.equal(lock.packages[''].dependencies['@radix-ui/react-icons'], undefined);
    assert.equal(lock.packages[''].dependencies['uuid'], undefined);
    assert.equal(lock.packages[''].devDependencies['@types/uuid'], undefined);
    assert.equal(lock.packages[''].dependencies['tailwindcss-animate'], undefined);
    assert.ok(lock.packages[''].devDependencies['tailwindcss-animate']);
  });
});

describe('PASS 15H: P2-G3 Migration 01 exact 14-policy postcondition assertion', () => {
  it('20261201000001_v6_security_hardening.sql defines and asserts the exact 14 v6_* policies', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261201000001_v6_security_hardening.sql'),
      'utf8'
    );
    const createdPolicies = [...sql.matchAll(/CREATE POLICY\s+(v6_[a-z0-9_]+)\s+ON\s+public\.([a-z_]+)/g)]
      .map((m) => `${m[2]}:${m[1]}`)
      .sort();

    assert.equal(createdPolicies.length, 14, `Expected exactly 14 CREATE POLICY statements, found ${createdPolicies.length}`);

    const expectedPolicies = [
      'clients:v6_clients_admin_write',
      'clients:v6_clients_staff_or_own_customer_select',
      'mx_personnel:v6_mx_personnel_hr_manage_non_manager',
      'mx_personnel:v6_mx_personnel_manager_all',
      'mx_personnel:v6_mx_personnel_self_update',
      'mx_personnel:v6_mx_personnel_staff_select',
      'profiles:v6_profiles_manager_all',
      'profiles:v6_profiles_select_own_or_admin',
      'profiles:v6_profiles_update_own',
      'projects:v6_projects_admin_write',
      'projects:v6_projects_staff_or_own_customer_select',
      'projects:v6_projects_supervisor_update_assigned',
      'reports:v6_reports_manager_readonly',
      'tools:v6_tools_manager_readonly',
    ];
    assert.deepEqual(createdPolicies, expectedPolicies);
    assert.match(sql, /array_length\(actual_policies,\s*1\),\s*0\)\s*<>\s*14/);
    assert.match(sql, /actual_policies IS DISTINCT FROM expected_policies/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PASS 15I — Production-Grounded Type Boundaries, Identity Trust & Attendance V2 Server Hardening
// ─────────────────────────────────────────────────────────────────────────────

describe('PASS 15I: Migration 01 production type boundaries, email trust & Supervisor column guard', () => {
  it('fixes all 5 production TEXT/UUID boundaries and enforces email + Supervisor project guards', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261201000001_v6_security_hardening.sql'),
      'utf8'
    );
    // 1. mx_personnel.client_id cast from uuid to text
    assert.match(sql, /WHEN new_client_id IS NOT NULL THEN new_client_id::text/);
    // 2. admin_update_user resolves target mx_personnel BEFORE email mutation using ::text + unique email fallback
    assert.match(sql, /WHERE id = target_user_id::text;/);
    assert.match(sql, /Ambiguous personnel linkage: multiple mx_personnel rows share email/);
    assert.match(sql, /WHERE id = resolved_personnel_id;/);
    // 3 & 4. site_lead_ids (uuid[]) compared against ARRAY[auth.uid()] (NOT text[])
    assert.doesNotMatch(sql, /site_lead_ids\s*@>\s*ARRAY\[auth\.uid\(\)::text\]/);
    assert.match(sql, /site_lead_ids\s*@>\s*ARRAY\[auth\.uid\(\)\]/);
    // 5. mx_personnel self-update uses authoritative resolver (not raw text=uuid)
    assert.doesNotMatch(sql, /v6_mx_personnel_self_update[\s\S]{0,160}id\s*=\s*auth\.uid\(\)\s+AND/);
    assert.match(sql, /id\s*=\s*public\.get_authoritative_personnel_id\(\)\s+AND\s+public\.is_internal_staff\(\)/);
    // Email identity trust locks in BOTH profiles & mx_personnel triggers
    assert.match(sql, /guard_profiles_sensitive_fields[\s\S]{0,1200}NEW\.email IS DISTINCT FROM OLD\.email/);
    assert.match(sql, /guard_mx_personnel_self_update[\s\S]{0,1200}NEW\.email IS DISTINCT FROM OLD\.email/);
    // Supervisor project authorization-bearing column guard trigger
    assert.match(sql, /CREATE TRIGGER trg_guard_projects_supervisor_update/);
    assert.match(sql, /guard_projects_supervisor_update[\s\S]{0,1200}NEW\.assigned_personnel IS DISTINCT FROM OLD\.assigned_personnel/);
    assert.match(sql, /guard_projects_supervisor_update[\s\S]{0,1200}NEW\.site_lead_ids IS DISTINCT FROM OLD\.site_lead_ids/);
    // Guard triggers never use current_user inside SECURITY DEFINER
    assert.doesNotMatch(sql, /IF current_user IN \(/);
  });
});

describe('PASS 15I: Migration 03 Attendance V2 server hardening & Migration 02 preservation', () => {
  it('enforces auth-before-idempotency, fail-closed status, Face evidence, device binding, normal ClockOut geofence, deferred zombie, and revokes anon/PUBLIC', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261201000003_v6_attendance_server_hardening.sql'),
      'utf8'
    );
    const idAuthIdx = sql.indexOf('v_caller_personnel_id := public.get_authoritative_personnel_id();');
    const idempIdx = sql.indexOf('SELECT * INTO v_existing_event FROM public.attendance_events WHERE event_id = v_event_id;');
    const statusIdx = sql.indexOf("UPPER(TRIM(COALESCE(v_personnel_status, ''))) <> 'ACTIVE'");
    assert.ok(idAuthIdx > 0 && idempIdx > idAuthIdx, 'Identity verification must precede idempotency lookup');
    assert.ok(statusIdx > idempIdx, 'Personnel status guard must run after authorized idempotency check');

    assert.match(sql, /v_existing_event\.personnel_id IS DISTINCT FROM v_personnel_id/);
    assert.match(sql, /'status',\s*'REJECTED_TERMINATED'/);
    assert.match(sql, /'error',\s*'PERSONNEL_INACTIVE'/);
    assert.match(sql, /'error',\s*'FACE_VERIFICATION_REQUIRED'/);
    assert.match(sql, /'error',\s*'FACE_BYPASS_UNAUTHORIZED'/);
    assert.match(sql, /v_lease\.device_id IS DISTINCT FROM v_device_id/);
    assert.match(sql, /'error',\s*'OFFLINE_LEASE_DEVICE_MISMATCH'/);
    assert.match(sql, /v_zombie_shift_to_close_id UUID := NULL/);
    assert.doesNotMatch(sql, /IF v_work_type = 'ON_SITE' AND NOT v_created_offline THEN/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_attendance_event\(jsonb\) FROM PUBLIC;/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_attendance_event\(jsonb\) FROM anon;/);

    const engineSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/attendanceV2/clientEngine.ts'), 'utf8');
    assert.doesNotMatch(engineSrc, /UNSPECIFIED_BYPASS/, 'clientEngine.ts must not manufacture UNSPECIFIED_BYPASS');
  });

  it('preserves Migration 02 unchanged (SHA256 locked)', async () => {
    const crypto = await import('node:crypto');
    const m2 = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261201000002_v6_face_reenroll.sql'));
    const sha = crypto.createHash('sha256').update(m2).digest('hex');
    assert.equal(sha, '488761f345c06ac75de417d0fa88fa7c979e13b86001fe95551aa760e90b945c');
  });
});
