/**
 * PASS 15J-P3 — Staging Environment Identification & Fail-Closed Backend Isolation Tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHORIZED_STAGING_SUPABASE_URL,
  PROHIBITED_PRODUCTION_PROJECT_REF,
  STAGING_RENDER_HOSTNAME,
  isStagingEnvironment,
  shouldDisableExternalPortalLinks,
  validateBackendIsolation,
} from '../../src/config/environment.ts';

describe('PASS 15J-P3 — Staging Identification & Fail-Closed Backend Isolation', () => {
  it('accepts exact authorized staging backend with sb_publishable_ key', () => {
    const res = validateBackendIsolation({
      appEnv: 'staging',
      supabaseUrl: AUTHORIZED_STAGING_SUPABASE_URL,
      supabaseAnonKey: 'sb_publishable_test_key_12345',
      hostname: STAGING_RENDER_HOSTNAME,
    });
    assert.equal(res.isStaging, true);
    assert.equal(res.supabaseUrl, AUTHORIZED_STAGING_SUPABASE_URL);
  });

  it('rejects prohibited production backend dvkkxwtqonjgrvloisid in staging mode', () => {
    assert.throws(
      () =>
        validateBackendIsolation({
          appEnv: 'staging',
          supabaseUrl: `https://${PROHIBITED_PRODUCTION_PROJECT_REF}.supabase.co`,
          supabaseAnonKey: 'sb_publishable_test_key',
        }),
      /STAGING ISOLATION BLOCK.*dvkkxwtqonjgrvloisid/
    );
  });

  it('enforces staging isolation on Render staging hostname even if VITE_APP_ENV is omitted', () => {
    assert.equal(isStagingEnvironment({ hostname: STAGING_RENDER_HOSTNAME }), true);
    assert.equal(shouldDisableExternalPortalLinks({ hostname: STAGING_RENDER_HOSTNAME }), true);
    assert.throws(
      () =>
        validateBackendIsolation({
          hostname: STAGING_RENDER_HOSTNAME,
          supabaseUrl: `https://${PROHIBITED_PRODUCTION_PROJECT_REF}.supabase.co`,
          supabaseAnonKey: 'sb_publishable_test_key',
        }),
      /STAGING ISOLATION BLOCK/
    );
  });

  it('rejects unexpected Supabase project URL in staging mode', () => {
    assert.throws(
      () =>
        validateBackendIsolation({
          appEnv: 'staging',
          supabaseUrl: 'https://someotherproject.supabase.co',
          supabaseAnonKey: 'sb_publishable_test_key',
        }),
      /Unexpected Supabase URL/
    );
  });

  it('rejects missing backend configuration (fail closed)', () => {
    assert.throws(
      () =>
        validateBackendIsolation({
          appEnv: 'staging',
          supabaseUrl: '',
          supabaseAnonKey: '',
        }),
      /Missing Supabase environment variables/
    );
  });

  it('rejects secret API key (sb_secret_*) in browser frontend configuration', () => {
    assert.throws(
      () =>
        validateBackendIsolation({
          appEnv: 'staging',
          supabaseUrl: AUTHORIZED_STAGING_SUPABASE_URL,
          supabaseAnonKey: 'sb_secret_should_never_be_in_browser',
        }),
      /SECURITY VIOLATION/
    );
  });

  it('preserves normal production behavior when not running in staging', () => {
    assert.equal(isStagingEnvironment({ appEnv: 'production', hostname: 'latnovvamx.onrender.com' }), false);
    assert.equal(shouldDisableExternalPortalLinks({ appEnv: 'production', hostname: 'latnovvamx.onrender.com' }), false);
  });
});
