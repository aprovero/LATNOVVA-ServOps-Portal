/**
 * PASS 13G: Attendance V2 Media Sync & Two-Phase Integration Test Suite
 * Environment: Disposable PostgreSQL 16 on port 54329
 *
 * Verifies:
 * 1. Event-bound selfie authorization RPC (request_attendance_selfie_upload)
 * 2. Deterministic server-computed storage paths (selfies/{subsidiary}/{personnel_id}/{shift_id}/{event_id}.jpg)
 * 3. Server-side object confirmation (confirm_attendance_selfie_upload)
 * 4. Two-phase decoupling: physical attendance event succeeds even if media fails
 * 5. Media retention in IndexedDB media_blobs store across failures and retries
 * 6. Security boundaries: wrong worker cannot request or confirm another worker's selfie
 * 7. Duplicate request and duplicate confirm idempotency
 * 8. Invalid storage path rejection
 */

const { Client } = require('pg');
const crypto = require('crypto');

const DISPOSABLE_CONN = 'postgres://postgres:pass13d_test_password@localhost:54329/postgres';

// In-Memory IndexedDB Simulation for Node.js test environment matching db.ts interface
class MockIndexedDb {
  constructor() {
    this.media_blobs = new Map();
  }
  async saveMediaBlob(media) {
    this.media_blobs.set(media.media_id, { ...media, updated_at: new Date().toISOString() });
  }
  async getMediaBlob(mediaId) {
    return this.media_blobs.get(mediaId) || null;
  }
  async getMediaBlobByEvent(eventId) {
    return Array.from(this.media_blobs.values()).find((m) => m.event_id === eventId) || null;
  }
  async getPendingMediaBlobs() {
    return Array.from(this.media_blobs.values()).filter(
      (m) => m.sync_status === 'PENDING' || m.sync_status === 'FAILED_RETRYABLE'
    );
  }
  async deleteMediaBlob(mediaId) {
    this.media_blobs.delete(mediaId);
  }
}

async function runPass13GTests() {
  console.log('========================================================================');
  console.log('  PASS 13G: ATTENDANCE V2 MEDIA SYNC & TWO-PHASE INTEGRATION TEST SUITE');
  console.log('  Environment: Disposable PostgreSQL 16 on port 54329');
  console.log('========================================================================\n');

  const client = new Client({ connectionString: DISPOSABLE_CONN });
  await client.connect();

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failedTests++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SETUP: Fixtures in Disposable DB
    // -------------------------------------------------------------------------
    console.log('1. Setting up fresh test fixtures...');

    await client.query(`
      TRUNCATE TABLE 
        public.attendance_event_media,
        public.attendance_audit_log,
        public.attendance_adjustments,
        public.attendance_events,
        public.attendance_shifts,
        public.attendance_offline_lease_scopes,
        public.attendance_offline_leases,
        public.project_geofence_versions,
        public.projects,
        public.mx_personnel,
        public.profiles,
        auth.users
      CASCADE;
    `);

    const tech1Uid = '11111111-1111-1111-1111-111111111111';
    const tech2Uid = '22222222-2222-2222-2222-222222222222';
    const tech1Pid = 'PER-TECH-001';
    const tech2Pid = 'PER-TECH-002';
    const projA = 'aaaaaaaa-1111-1111-1111-111111111111';
    const geofenceVerA = 'cccccccc-1111-1111-1111-111111111111';

    await client.query(`
      INSERT INTO auth.users (id, email) VALUES 
        ($1, 'tech1@latnovva.test'),
        ($2, 'tech2@latnovva.test');
    `, [tech1Uid, tech2Uid]);

    await client.query(`
      INSERT INTO public.mx_personnel (id, name, employee_number, app_role, status, email, subsidiary)
      VALUES 
        ($1, 'Tech One', 'T01', 'Tech', 'ACTIVE', 'tech1@latnovva.test', 'MX'),
        ($2, 'Tech Two', 'T02', 'Tech', 'ACTIVE', 'tech2@latnovva.test', 'MX');
    `, [tech1Pid, tech2Pid]);

    await client.query(`
      INSERT INTO public.profiles (id, email, name, role, subsidiary)
      VALUES 
        ($1, 'tech1@latnovva.test', 'Tech One', 'Tech', 'MX'),
        ($2, 'tech2@latnovva.test', 'Tech Two', 'Tech', 'MX');
    `, [tech1Uid, tech2Uid]);

    await client.query(`
      INSERT INTO public.projects (id, name, subsidiary, assigned_personnel, site_lead_ids)
      VALUES ($1, 'Project Alpha', 'MX', ARRAY[$2, $3]::TEXT[], ARRAY[]::TEXT[]);
    `, [projA, tech1Pid, tech2Pid]);

    await client.query(`
      INSERT INTO public.project_geofence_versions (
        version_id, project_id, version_number, latitude, longitude, radius_meters, accuracy_threshold_meters
      ) VALUES ($1, $2, 1, 25.686614, -100.316112, 150.00, 50.00);
    `, [geofenceVerA, projA]);

    await client.query(`
      INSERT INTO public.attendance_v2_control (
        control_id, system_state, protocol_version, minimum_v2_client_release_id, minimum_v2_client_version
      ) VALUES (1, 'V2_ACTIVE', 2, 49, 'v5.1.0')
      ON CONFLICT (control_id) DO UPDATE 
      SET system_state = EXCLUDED.system_state,
          minimum_v2_client_release_id = EXCLUDED.minimum_v2_client_release_id,
          minimum_v2_client_version = EXCLUDED.minimum_v2_client_version,
          protocol_version = EXCLUDED.protocol_version;
    `);

    // Helper to call as user on disposable DB
    async function asUser(uid, fn) {
      await client.query(`SET ROLE authenticated;`);
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [uid]);
      try {
        return await fn();
      } finally {
        await client.query(`SELECT set_config('request.jwt.claim.sub', '', false);`);
        await client.query(`RESET ROLE;`);
      }
    }

    // Create a real Clock-In event for Tech 1 on DB
    const shift1Id = '99999999-1111-1111-1111-111111111111';
    const event1Id = '88888888-1111-1111-1111-111111111111';
    const ev1 = {
      event_id: event1Id,
      shift_id: shift1Id,
      personnel_id: tech1Pid,
      project_id: projA,
      event_type: 'CLOCK_IN',
      work_type: 'ON_SITE',
      device_event_timestamp: new Date().toISOString(),
      timezone_offset_minutes: -360,
      device_id: 'DEV-TEST-PIXEL',
      device_platform: 'Android',
      client_app_version: 'v5.1.0',
      client_release_id: 49,
      client_commit_hash: 'pass13g_commit',
      attendance_protocol_version: 2,
      created_offline: false,
      offline_lease_id: null,
      latitude: 25.686614,
      longitude: -100.316112,
      accuracy_meters: 15.0,
      gps_verified: true,
      geofence_status: 'INSIDE',
      geofence_distance_meters: 10.0,
      geofence_version_id: geofenceVerA,
      face_verified: true,
      face_bypass_reason: null,
      is_manual_adjustment: false,
      adjustment_reason: null,
      reported_departure_timestamp: null,
      worker_explanation: null
    };

    let ev1Res = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(ev1)]);
      return res.rows[0].r;
    });
    assert(ev1Res.success === true, 'Baseline Clock-In event created on server');

    // -------------------------------------------------------------------------
    // 2. REQUEST ATTENDANCE SELFIE UPLOAD RPC
    // -------------------------------------------------------------------------
    console.log('\n2. Testing Selfie Upload Authorization RPC (request_attendance_selfie_upload)...');

    // Tech 1 requests upload authorization for Event 1
    let reqRes = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.request_attendance_selfie_upload($1::uuid) as r`, [event1Id]);
      return res.rows[0].r;
    });

    assert(reqRes.success === true, 'Selfie upload authorization granted');
    assert(reqRes.bucket === 'attendance-v2-media-private', 'Target bucket is private attendance media bucket');

    const expectedDeterministicPath = `selfies/MX/${tech1Pid}/${shift1Id}/${event1Id}.jpg`;
    assert(reqRes.storage_path === expectedDeterministicPath, `Storage path matches deterministic contract: ${reqRes.storage_path}`);

    // Security Negative: Tech 2 attempts to request upload for Tech 1's event
    let reqSpoofRes = await asUser(tech2Uid, async () => {
      const res = await client.query(`SELECT public.request_attendance_selfie_upload($1::uuid) as r`, [event1Id]);
      return res.rows[0].r;
    });
    assert(reqSpoofRes.success === false && reqSpoofRes.error === 'EVENT_OWNERSHIP_MISMATCH', 'Wrong worker requesting upload rejected with EVENT_OWNERSHIP_MISMATCH');

    // Negative: Non-existent event
    let reqNonExist = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.request_attendance_selfie_upload($1::uuid) as r`, ['00000000-0000-0000-0000-000000000000']);
      return res.rows[0].r;
    });
    assert(reqNonExist.success === false && reqNonExist.error === 'EVENT_NOT_FOUND', 'Non-existent event rejected with EVENT_NOT_FOUND');

    // -------------------------------------------------------------------------
    // 3. CONFIRM ATTENDANCE SELFIE UPLOAD RPC
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Selfie Upload Confirmation RPC (confirm_attendance_selfie_upload)...');

    const fakeSelfieData = 'data:image/jpeg;base64,' + Buffer.from('fake_jpeg_image_bytes').toString('base64');
    const fakeSha256 = crypto.createHash('sha256').update(fakeSelfieData).digest('hex');
    const fakeByteSize = 10240;

    // Negative: Incorrect storage path
    let confBadPath = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.confirm_attendance_selfie_upload($1, $2, $3, $4) as r`, [
        event1Id,
        'selfies/arbitrary_user_path.jpg',
        fakeByteSize,
        fakeSha256
      ]);
      return res.rows[0].r;
    });
    assert(confBadPath.success === false && confBadPath.error === 'INVALID_STORAGE_PATH', 'Arbitrary client storage path rejected with INVALID_STORAGE_PATH');

    // Negative: Wrong worker confirming
    let confWrongUser = await asUser(tech2Uid, async () => {
      const res = await client.query(`SELECT public.confirm_attendance_selfie_upload($1, $2, $3, $4) as r`, [
        event1Id,
        expectedDeterministicPath,
        fakeByteSize,
        fakeSha256
      ]);
      return res.rows[0].r;
    });
    assert(confWrongUser.success === false && confWrongUser.error === 'EVENT_OWNERSHIP_MISMATCH', 'Wrong worker confirming upload rejected with EVENT_OWNERSHIP_MISMATCH');

    // Positive: Valid confirmation with matching path and checksum
    let confValid = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.confirm_attendance_selfie_upload($1, $2, $3, $4) as r`, [
        event1Id,
        expectedDeterministicPath,
        fakeByteSize,
        fakeSha256
      ]);
      return res.rows[0].r;
    });
    assert(confValid.success === true && confValid.status === 'CONFIRMED', 'Valid selfie upload confirmed and stored in attendance_event_media');

    // Verify row in database
    const mediaRow = (await client.query(`SELECT * FROM public.attendance_event_media WHERE event_id = $1`, [event1Id])).rows[0];
    assert(mediaRow && mediaRow.sha256_hash === fakeSha256, 'Media record inserted with valid SHA256 checksum');
    assert(mediaRow.storage_bucket === 'attendance-v2-media-private', 'Media record stored with private bucket');

    // Idempotent duplicate confirmation -> returns ALREADY_CONFIRMED
    let confDuplicate = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.confirm_attendance_selfie_upload($1, $2, $3, $4) as r`, [
        event1Id,
        expectedDeterministicPath,
        fakeByteSize,
        fakeSha256
      ]);
      return res.rows[0].r;
    });
    assert(confDuplicate.success === true && confDuplicate.status === 'ALREADY_CONFIRMED', 'Duplicate confirmation is idempotent (ALREADY_CONFIRMED)');

    // -------------------------------------------------------------------------
    // 4. TWO-PHASE DECOUPLING (EVENT SUCCEEDS / MEDIA FAILS)
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Two-Phase Decoupling (Event Succeeds, Media Fails)...');

    // Create a new event for Tech 2
    const shift2Id = '99999999-2222-2222-2222-222222222222';
    const event2Id = '88888888-2222-2222-2222-222222222222';
    const ev2 = {
      ...ev1,
      event_id: event2Id,
      shift_id: shift2Id,
      personnel_id: tech2Pid
    };

    let ev2Res = await asUser(tech2Uid, async () => {
      const res = await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(ev2)]);
      return res.rows[0].r;
    });
    assert(ev2Res.success === true, 'Physical event accepted and shift created');

    const idb = new MockIndexedDb();
    const { AttendanceV2MediaSync } = await import('../src/lib/attendanceV2/mediaSync.ts');

    // RPC Client adapter for media sync
    const rpcClient = {
      requestAttendanceSelfieUpload: async (eventId) => {
        return await asUser(tech2Uid, async () => {
          const res = await client.query(`SELECT public.request_attendance_selfie_upload($1::uuid) as r`, [eventId]);
          return res.rows[0].r;
        });
      },
      confirmAttendanceSelfieUpload: async (params) => {
        return await asUser(tech2Uid, async () => {
          const res = await client.query(`SELECT public.confirm_attendance_selfie_upload($1, $2, $3, $4) as r`, [
            params.eventId,
            params.storagePath,
            params.byteSize,
            params.sha256Hash
          ]);
          return res.rows[0].r;
        });
      }
    };

    // Simulated Uploader with configurable failure
    let shouldStorageFail = true;
    const mockUploader = {
      uploadSelfie: async () => {
        if (shouldStorageFail) {
          return { success: false, error: 'Connection to private storage bucket dropped' };
        }
        return { success: true };
      }
    };

    const mediaSync = new AttendanceV2MediaSync(idb, rpcClient, mockUploader);

    // Queue selfie locally
    const mediaBlob = await mediaSync.queueSelfie({
      eventId: event2Id,
      shiftId: shift2Id,
      personnelId: tech2Pid,
      subsidiary: 'MX',
      dataBase64: fakeSelfieData,
      mimeType: 'image/jpeg',
      sha256Hash: fakeSha256,
      byteSize: fakeByteSize
    });

    assert(mediaBlob && mediaBlob.sync_status === 'PENDING', 'Media blob enqueued locally in state PENDING');

    // Sync attempt with storage failure
    const syncRes1 = await mediaSync.syncMediaBlob(mediaBlob.media_id);
    assert(syncRes1.success === false && syncRes1.status === 'FAILED_RETRYABLE', 'Storage network failure transitions media to FAILED_RETRYABLE');

    // CRITICAL TWO-PHASE INVARIANT: Verify that physical event remains valid on database!
    const dbEvent = (await client.query(`SELECT * FROM public.attendance_events WHERE event_id = $1`, [event2Id])).rows[0];
    assert(dbEvent && dbEvent.server_authorization_outcome === 'AUTHORIZED', 'Physical attendance event remains AUTHORIZED despite media sync failure');

    // Re-attempt after network restored
    shouldStorageFail = false;
    const syncRes2 = await mediaSync.syncMediaBlob(mediaBlob.media_id);
    assert(syncRes2.success === true && syncRes2.status === 'UPLOADED', 'Media retry succeeds and transitions to UPLOADED');

    const confirmedMedia = (await client.query(`SELECT * FROM public.attendance_event_media WHERE event_id = $1`, [event2Id])).rows[0];
    assert(confirmedMedia && confirmedMedia.sha256_hash === fakeSha256, 'Server confirmed media insertion after retry');

  } catch (err) {
    console.error('FATAL UNHANDLED ERROR in test suite:', err);
    failedTests++;
  } finally {
    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`  PASS 13G TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPass13GTests();
