/**
 * Environment & Backend Isolation Guard (PASS 15J-P3 / V6-PEND-026)
 *
 * Enforces fail-closed isolation for the hosted V6 staging environment:
 * - Staging mode activates when VITE_APP_ENV === 'staging' OR when running on the
 *   staging Render hostname (`latnovva-v6-staging.onrender.com`).
 * - In staging mode, any attempt to connect to the prohibited production project
 *   (`dvkkxwtqonjgrvloisid`) or any unexpected Supabase backend fails closed.
 * - Secret/service-role keys (`sb_secret_...`) are always rejected in browser builds.
 */

export const PROHIBITED_PRODUCTION_PROJECT_REF = 'dvkkxwtqonjgrvloisid';
export const AUTHORIZED_STAGING_PROJECT_REF = 'pxgvqszeqvoldhiozvko';
export const AUTHORIZED_STAGING_SUPABASE_URL = 'https://pxgvqszeqvoldhiozvko.supabase.co';
export const STAGING_RENDER_HOSTNAME = 'latnovva-v6-staging.onrender.com';

export interface EnvironmentInputs {
  appEnv?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  hostname?: string;
}

function readRuntimeEnv(): EnvironmentInputs {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};
  const hostname =
    typeof window !== 'undefined' && window.location ? window.location.hostname : undefined;

  return {
    appEnv: metaEnv.VITE_APP_ENV || procEnv.VITE_APP_ENV,
    supabaseUrl: metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL,
    supabaseAnonKey: metaEnv.VITE_SUPABASE_ANON_KEY || procEnv.VITE_SUPABASE_ANON_KEY,
    hostname,
  };
}

export function isStagingEnvironment(inputs?: EnvironmentInputs): boolean {
  const env = inputs ?? readRuntimeEnv();
  const explicit = String(env.appEnv || '').trim().toLowerCase() === 'staging';
  const host = String(env.hostname || '').trim().toLowerCase();
  const isStagingHost =
    host === STAGING_RENDER_HOSTNAME || host.endsWith('.latnovva-v6-staging.onrender.com');
  return explicit || isStagingHost;
}

export function shouldDisableExternalPortalLinks(inputs?: EnvironmentInputs): boolean {
  return isStagingEnvironment(inputs);
}

export function validateBackendIsolation(inputs?: EnvironmentInputs): {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isStaging: boolean;
} {
  const env = inputs ?? readRuntimeEnv();
  const supabaseUrl = String(env.supabaseUrl || '').trim();
  const supabaseAnonKey = String(env.supabaseAnonKey || '').trim();
  const isStaging = isStagingEnvironment(env);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  if (supabaseAnonKey.startsWith('sb_secret_')) {
    throw new Error(
      'SECURITY VIOLATION: Secret API key (sb_secret_*) must never be used in browser frontend configuration.'
    );
  }

  if (isStaging) {
    const normalizedUrl = supabaseUrl.replace(/\/+$/, '').toLowerCase();

    if (normalizedUrl.includes(PROHIBITED_PRODUCTION_PROJECT_REF)) {
      throw new Error(
        `STAGING ISOLATION BLOCK: Prohibited production backend (${PROHIBITED_PRODUCTION_PROJECT_REF}) cannot be used in staging.`
      );
    }

    const isLocalTestHost =
      normalizedUrl.startsWith('http://127.0.0.1:') ||
      normalizedUrl.startsWith('http://localhost:');

    if (normalizedUrl !== AUTHORIZED_STAGING_SUPABASE_URL && !isLocalTestHost) {
      throw new Error(
        `STAGING ISOLATION BLOCK: Unexpected Supabase URL "${supabaseUrl}". Staging requires ${AUTHORIZED_STAGING_SUPABASE_URL}.`
      );
    }

    // If running on the hosted Render staging hostname, even localhost is rejected
    const host = String(env.hostname || '').trim().toLowerCase();
    if (host === STAGING_RENDER_HOSTNAME && normalizedUrl !== AUTHORIZED_STAGING_SUPABASE_URL) {
      throw new Error(
        `STAGING ISOLATION BLOCK: Hosted staging origin requires exact backend ${AUTHORIZED_STAGING_SUPABASE_URL}.`
      );
    }
  }

  return { supabaseUrl, supabaseAnonKey, isStaging };
}
