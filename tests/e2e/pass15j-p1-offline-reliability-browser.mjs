/**
 * PASS 15J-P1 — Real Browser IndexedDB, Offline & Multi-Tab Reliability Suite
 *
 * Runs inside verified Playwright Docker container (mcr.microsoft.com/playwright:v1.63.0-resolute-amd64)
 * against a local Vite server serving the ACTUAL R60 Attendance V2 client modules
 * (`src/lib/attendanceV2/db.ts`, `clientEngine.ts`, `transport.ts`) with:
 *   - Real Chromium IndexedDB (`latnovva_attendance_v2_db`)
 *   - Real Web Locks API (`navigator.locks`) across multiple browser tabs
 *   - Real Playwright offline mode (`context.setOffline`) & page reloads (`page.reload`)
 *   - Controlled local transport route fixture (ZERO production contact)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = 4179;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const FAKE_SUPABASE_URL = 'http://127.0.0.1:59999';
const FORBIDDEN_PROD_HOST = 'dvkkxwtqonjgrvloisid';

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite server at ${url} did not start within ${timeoutMs}ms`);
}

function startViteServer() {
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      env: {
        ...process.env,
        VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: 'local-disposable-test-anon-key',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  child.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  return child;
}

async function resetBrowserDb(page) {
  await page.evaluate(async () => {
    const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
    await attendanceV2Db.clearAll();
  });
}

async function seedLeaseAndQueueShift(page, personnelId, projectId = 'proj-browser-1') {
  return page.evaluate(
    async ({ personnelId, projectId }) => {
      const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
      const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
      const { engine } = getAttendanceV2Engine();
      const deviceId = localStorage.getItem('attendance_device_id') || 'DEV-BROWSER';

      await attendanceV2Db.saveOfflineLease({
        lease_id: `lease-${personnelId}`,
        auth_user_id: personnelId,
        personnel_id: personnelId,
        subsidiary: 'MX',
        valid_from: new Date(Date.now() - 3600_000).toISOString(),
        valid_until: new Date(Date.now() + 24 * 3600_000).toISOString(),
        attendance_protocol_version: 2,
        client_release_id: 60,
        client_app_version: '6.0.0',
        device_id: deviceId,
        is_revoked: false,
        cached_at: new Date().toISOString(),
        scopes: [{ project_id: projectId, geofence_version_id: 'geo-browser-1' }],
      });

      const ci = await engine.clockIn({
        personnel_id: personnelId,
        project_id: projectId,
        work_type: 'ON_SITE',
        latitude: 20.9854,
        longitude: -89.6152,
        accuracy_meters: 10,
        gps_verified: true,
        geofence_status: 'INSIDE',
        geofence_distance_meters: 8,
        face_verified: true,
        force_offline: true,
      });
      const co = await engine.clockOut({
        personnel_id: personnelId,
        shift_id: ci.shift_id,
        project_id: projectId,
        work_type: 'ON_SITE',
        latitude: 20.9855,
        longitude: -89.6151,
        accuracy_meters: 10,
        gps_verified: true,
        geofence_status: 'INSIDE',
        geofence_distance_meters: 9,
        face_verified: true,
        force_offline: true,
      });
      return { ci, co, isMemoryFallback: attendanceV2Db.isMemoryFallbackMode() };
    },
    { personnelId, projectId }
  );
}

async function runSuite() {
  const vite = startViteServer();
  let browser;
  let prodContacts = 0;
  let passed = 0;
  let failed = 0;

  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    context.on('request', (req) => {
      if (req.url().includes(FORBIDDEN_PROD_HOST)) {
        prodContacts++;
      }
    });

    // Block all external/non-local network traffic (fonts, CDNs, etc.) for deterministic speed & isolation
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.startsWith(BASE_URL) || url.startsWith(FAKE_SUPABASE_URL) || url.startsWith('data:') || url.startsWith('blob:')) {
        await route.fallback();
      } else {
        await route.abort('blockedbyclient');
      }
    });

    // Controlled transport state
    let mode = 'NORMAL';
    let inFlight = 0;
    let maxConcurrent = 0;
    let rpcLog = [];
    let delayMs = 0;
    let failFirstClockIn = false;
    let goOfflineBeforeClockOut = false;

    await context.route(`${FAKE_SUPABASE_URL}/rest/v1/rpc/record_attendance_event`, async (route) => {
      const body = route.request().postDataJSON();
      const ev = body?.p_event;
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      rpcLog.push({ event_id: ev?.event_id, shift_id: ev?.shift_id, event_type: ev?.event_type });

      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      if (goOfflineBeforeClockOut && ev?.event_type === 'CLOCK_OUT') {
        goOfflineBeforeClockOut = false;
        inFlight--;
        await context.setOffline(true);
        await route.abort('internetdisconnected');
        return;
      }

      if (failFirstClockIn && ev?.event_type === 'CLOCK_IN') {
        failFirstClockIn = false;
        inFlight--;
        await route.abort('failed');
        return;
      }

      if (mode === 'MALFORMED_ACK') {
        inFlight--;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }

      if (mode === 'PERMANENT_REJECT') {
        inFlight--;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, status: 'REJECTED_TERMINATED', error: 'PERSONNEL_INACTIVE' }),
        });
        return;
      }

      inFlight--;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'APPLIED',
          event_id: ev?.event_id,
          shift_id: ev?.shift_id,
        }),
      });
    });

    const HARNESS_URL = `${BASE_URL}/__pass15j_p1_harness.html`;

    // Serve lightweight same-origin HTML harness so Vite only transforms the actual attendanceV2 modules
    await context.route(HARNESS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><head><meta charset="utf-8"><title>PASS 15J-P1 Harness</title></head><body><div id="harness">PASS 15J-P1</div></body></html>',
      });
    });

    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err));
    await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
    // Warm up actual R60 attendanceV2 modules while online so offline tests can execute them cleanly
    await page.evaluate(async () => {
      await import('/src/lib/attendanceV2/db.ts');
      await import('/src/lib/attendanceV2/transport.ts');
    });

    async function test(name, fn) {
      mode = 'NORMAL';
      inFlight = 0;
      maxConcurrent = 0;
      rpcLog = [];
      delayMs = 0;
      failFirstClockIn = false;
      goOfflineBeforeClockOut = false;
      await context.setOffline(false);
      await resetBrowserDb(page);
      try {
        await fn();
        passed++;
        console.log(`PASS: ${name}`);
      } catch (err) {
        failed++;
        console.error(`FAIL: ${name}\n`, err);
      }
    }

    // 1. Scenario A: Real IndexedDB normal offline replay
    await test('Browser-1 (A): Real IndexedDB offline CLOCK_IN -> CLOCK_OUT replay', async () => {
      await context.setOffline(true);
      const { ci, co, isMemoryFallback } = await seedLeaseAndQueueShift(page, 'p-b1');
      assert.equal(isMemoryFallback, false, 'Must use real browser IndexedDB, not memory fallback');
      await context.setOffline(false);

      const res = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(res.sync.acked_count, 2);
      assert.deepEqual(rpcLog.map((r) => r.event_type), ['CLOCK_IN', 'CLOCK_OUT']);
      assert.equal(rpcLog[0].event_id, ci.event_id);
      assert.equal(rpcLog[1].event_id, co.event_id);
      assert.deepEqual(res.events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    });

    // 2. Scenario B: Temporary prerequisite failure -> recovery
    await test('Browser-2 (B): Temporary CLOCK_IN failure retains CLOCK_OUT (DEPENDENCY_WAITING) and auto-recovers', async () => {
      const { ci, co } = await seedLeaseAndQueueShift(page, 'p-b2');
      failFirstClockIn = true;

      const afterRun1 = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(afterRun1.sync.acked_count, 0);
      assert.deepEqual(rpcLog.map((r) => r.event_type), ['CLOCK_IN']);
      assert.deepEqual(afterRun1.events.map((e) => e.sync_status), ['RETRYABLE', 'DEPENDENCY_WAITING']);

      const afterRun2 = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(afterRun2.sync.acked_count, 2);
      assert.deepEqual(rpcLog.map((r) => r.event_type), ['CLOCK_IN', 'CLOCK_IN', 'CLOCK_OUT']);
      assert.equal(rpcLog[2].event_id, co.event_id);
      assert.equal(rpcLog[2].shift_id, ci.shift_id);
      assert.deepEqual(afterRun2.events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    });

    // 3. Scenario C: Malformed / missing ACK
    await test('Browser-3 (C): Malformed empty {} ACK never marks ACKED and deletes zero events', async () => {
      await seedLeaseAndQueueShift(page, 'p-b3');
      mode = 'MALFORMED_ACK';

      const out = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(out.sync.acked_count, 0);
      assert.equal(out.events.length, 2);
      assert.deepEqual(out.events.map((e) => e.sync_status), ['RETRYABLE', 'DEPENDENCY_WAITING']);
    });

    // 4. Scenario D: Permanent prerequisite rejection
    await test('Browser-4 (D): Permanent CLOCK_IN rejection preserves DEPENDENCY_FAILED with zero retry loop', async () => {
      await seedLeaseAndQueueShift(page, 'p-b4');
      mode = 'PERMANENT_REJECT';

      const out = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const r1 = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const r2 = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { r1, r2, events };
      });
      assert.equal(out.r1.acked_count, 0);
      assert.equal(out.r2.processed_count, 0);
      assert.equal(rpcLog.length, 1);
      assert.deepEqual(out.events.map((e) => e.sync_status), ['FAILED_PERMANENT', 'DEPENDENCY_FAILED']);
    });

    // 5. Scenario E: Concurrent in-tab triggers
    await test('Browser-5 (E): Concurrent in-tab sync triggers coalesce into single-flight sequence', async () => {
      await seedLeaseAndQueueShift(page, 'p-b5');
      delayMs = 100;

      const out = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { engine } = getAttendanceV2Engine();
        const [r1, r2, r3] = await Promise.all([
          engine.syncOfflineQueue(),
          engine.syncOfflineQueue(),
          engine.syncOfflineQueue(),
        ]);
        return { r1, r2, r3 };
      });
      assert.equal(maxConcurrent, 1);
      assert.equal(rpcLog.length, 2);
      assert.deepEqual(rpcLog.map((r) => r.event_type), ['CLOCK_IN', 'CLOCK_OUT']);
      assert.equal(out.r1.acked_count, 2);
      assert.equal(out.r2.acked_count, 2);
      assert.equal(out.r3.acked_count, 2);
    });

    // 6. Scenario I: Stranded historical R52 DEPENDENCY_FAILED in real IndexedDB
    await test('Browser-6 (I): Existing stranded R52 DEPENDENCY_FAILED record in real IndexedDB recovers automatically', async () => {
      const { ci, co } = await seedLeaseAndQueueShift(page, 'p-b6');
      await page.evaluate(
        async ({ ciId, coId }) => {
          const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
          const ciEv = await attendanceV2Db.getQueuedEvent(ciId);
          const coEv = await attendanceV2Db.getQueuedEvent(coId);
          await attendanceV2Db.saveQueuedEvent({ ...ciEv, sync_status: 'ACKED', server_receipt_at: new Date().toISOString() });
          await attendanceV2Db.saveQueuedEvent({ ...coEv, sync_status: 'DEPENDENCY_FAILED', error_message: 'Prior event in shift failed to synchronize' });
        },
        { ciId: ci.event_id, coId: co.event_id }
      );

      const out = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(out.sync.acked_count, 1);
      assert.deepEqual(rpcLog.map((r) => r.event_type), ['CLOCK_OUT']);
      assert.equal(rpcLog[0].event_id, co.event_id);
      assert.deepEqual(out.events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    });

    // 7. Scenario J: Real page reload during stale SYNCING
    await test('Browser-7 (J): Real browser reload recovers stale SYNCING record with identical event identity', async () => {
      const { ci, co } = await seedLeaseAndQueueShift(page, 'p-b7');
      await page.evaluate(
        async ({ ciId }) => {
          const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
          const ciEv = await attendanceV2Db.getQueuedEvent(ciId);
          await attendanceV2Db.saveQueuedEvent({
            ...ciEv,
            sync_status: 'SYNCING',
            last_attempted_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          });
        },
        { ciId: ci.event_id }
      );

      await page.reload({ waitUntil: 'domcontentloaded' });

      const out = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(out.sync.acked_count, 2);
      assert.deepEqual(rpcLog.map((r) => r.event_id), [ci.event_id, co.event_id]);
      assert.deepEqual(out.events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    });

    // 8. Scenario K: Multiple browser tabs sharing real IndexedDB & navigator.locks
    await test('Browser-8 (K): Two real browser tabs coordinate via navigator.locks with zero duplicate requests', async () => {
      const pageB = await context.newPage();
      await pageB.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });

      await seedLeaseAndQueueShift(page, 'p-b8');
      delayMs = 150;

      const [resA, resB] = await Promise.all([
        page.evaluate(async () => {
          const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
          return getAttendanceV2Engine().engine.syncOfflineQueue();
        }),
        pageB.evaluate(async () => {
          const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
          return getAttendanceV2Engine().engine.syncOfflineQueue();
        }),
      ]);

      await pageB.close();

      assert.equal(maxConcurrent, 1, 'Cross-tab Web Locks must serialize transport calls');
      assert.equal(rpcLog.length, 2, 'Zero duplicate RPCs across tabs');
      assert.deepEqual(rpcLog.map((r) => r.event_type), ['CLOCK_IN', 'CLOCK_OUT']);
      assert.equal(resA.acked_count + resB.acked_count, 2);
    });

    // 9. Scenario L: Real connectivity loss mid-replay -> resume after reconnect
    await test('Browser-9 (L): Connectivity drop mid-replay preserves CLOCK_OUT and resumes on reconnect', async () => {
      await seedLeaseAndQueueShift(page, 'p-b9');
      goOfflineBeforeClockOut = true;

      const mid = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(mid.sync.acked_count, 1);
      assert.equal(mid.sync.failed_count, 1);
      assert.deepEqual(mid.events.map((e) => e.sync_status), ['ACKED', 'RETRYABLE']);

      await context.setOffline(false);
      const resumed = await page.evaluate(async () => {
        const { getAttendanceV2Engine } = await import('/src/lib/attendanceV2/transport.ts');
        const { attendanceV2Db } = await import('/src/lib/attendanceV2/db.ts');
        const sync = await getAttendanceV2Engine().engine.syncOfflineQueue();
        const events = await attendanceV2Db.getAllQueuedEvents();
        return { sync, events };
      });
      assert.equal(resumed.sync.acked_count, 1);
      assert.deepEqual(resumed.events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    });

    assert.equal(prodContacts, 0, `Expected 0 production contacts, got ${prodContacts}`);
    console.log(`\nSUMMARY: passed=${passed} failed=${failed} total=${passed + failed} prodContacts=${prodContacts}`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    try { vite.kill('SIGKILL'); } catch { /* ignore */ }
  }
}

runSuite().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
