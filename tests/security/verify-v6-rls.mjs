/**
 * Layer 3 — Full 7-Persona Supabase Security, RLS & CORS Verification Suite (v6.0.0 / PASS 15D Item 30)
 *
 * SAFETY: Must ONLY target disposable/staging Supabase.
 * Destructive/mutating authenticated probes REQUIRE:
 *   ALLOW_DESTRUCTIVE_SECURITY_TESTS=true
 *
 * Personas supported via env vars:
 *   anon (default), TEST_JWT_MANAGER, TEST_JWT_HR, TEST_JWT_SUPERVISOR,
 *   TEST_JWT_OFFICE, TEST_JWT_TECH, TEST_JWT_CUSTOMER
 *
 * Additional target IDs (disposable DB):
 *   TEST_MANAGER_USER_ID, TEST_OTHER_CLIENT_PROJECT_ID, TEST_SELF_USER_ID_TECH
 *
 * Usage:
 *   TEST_SUPABASE_URL=... TEST_SUPABASE_ANON_KEY=... ALLOW_DESTRUCTIVE_SECURITY_TESTS=true \
 *   node tests/security/verify-v6-rls.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE_SECURITY_TESTS === 'true';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('FAIL: Missing SUPABASE_URL or ANON_KEY.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
let skipped = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name} -> ${err.message}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`SKIP: ${name} (${reason})`);
}

async function rpcCall(fnName, body, jwt = ANON_KEY) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

async function restPatch(table, filterQuery, body, jwt) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filterQuery}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

async function restGet(table, query, jwt) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  const data = res.ok ? await res.json() : null;
  return { status: res.status, data };
}

// ── 1. CORS & Unauthenticated / Anon Checks ─────────────────────────────────
await check('CORS: approved origin https://latnovvamx.onrender.com receives exact ACAO on OPTIONS', async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-password-rotation`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://latnovvamx.onrender.com' },
  });
  const acao = res.headers.get('access-control-allow-origin');
  if (res.status !== 204 || acao !== 'https://latnovvamx.onrender.com') {
    throw new Error(`Expected 204 + exact ACAO, got ${res.status} / ${acao}`);
  }
});

await check('CORS: unknown origin https://evil.example.com is denied with 403 and no wildcard ACAO', async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-password-rotation`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example.com' },
  });
  const acao = res.headers.get('access-control-allow-origin');
  if (res.status !== 403 || acao === '*' || acao === 'https://evil.example.com') {
    throw new Error(`Expected 403 without evil/wildcard ACAO, got ${res.status} / ${acao}`);
  }
});

await check('anon cannot execute admin_create_user', async () => {
  const res = await rpcCall('admin_create_user', {
    user_email: 'security-probe-should-fail@latnovva.com',
    user_password: '',
    user_role: 'Manager',
    user_name: 'Probe',
    user_client_id: null,
    user_subsidiary: 'MX',
  });
  if (res.status < 400) throw new Error(`Expected 4xx rejection, got HTTP ${res.status}: ${res.text}`);
});

await check('anon cannot execute admin_update_user', async () => {
  const res = await rpcCall('admin_update_user', {
    target_user_id: '00000000-0000-0000-0000-000000000000',
    new_role: 'Manager',
  });
  if (res.status < 400) throw new Error(`Expected 4xx rejection, got HTTP ${res.status}: ${res.text}`);
});

await check('anon cannot execute ensure_user_auth_provisioned', async () => {
  const res = await rpcCall('ensure_user_auth_provisioned', {
    p_email: 'security-probe-should-fail@latnovva.com',
    p_name: 'Probe',
    p_role: 'Manager',
  });
  if (res.status < 400) throw new Error(`Expected 4xx rejection, got HTTP ${res.status}: ${res.text}`);
});

await check('complete-password-rotation rejects unauthenticated POST with 401', async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-password-rotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://latnovvamx.onrender.com' },
    body: JSON.stringify({ newPassword: 'ValidTestPassword2026!', resetToPolicy0: true }),
  });
  if (res.status !== 401) throw new Error(`Expected HTTP 401, got HTTP ${res.status}`);
});

// ── 2. Authenticated 6-Role Matrix (Disposable DB Only) ─────────────────────
const jwtManager = process.env.TEST_JWT_MANAGER;
const jwtHR = process.env.TEST_JWT_HR;
const jwtSupervisor = process.env.TEST_JWT_SUPERVISOR;
const jwtOffice = process.env.TEST_JWT_OFFICE;
const jwtTech = process.env.TEST_JWT_TECH;
const jwtCustomer = process.env.TEST_JWT_CUSTOMER;
const managerTargetId = process.env.TEST_MANAGER_USER_ID || '00000000-0000-0000-0000-000000000001';
const techSelfId = process.env.TEST_SELF_USER_ID_TECH || '00000000-0000-0000-0000-000000000002';

if (!ALLOW_DESTRUCTIVE) {
  skip('Authenticated mutating security probes (Manager/HR/Supervisor/Office/Tech/Customer)', 'Set ALLOW_DESTRUCTIVE_SECURITY_TESTS=true on disposable DB');
} else {
  // HR Persona
  if (jwtHR) {
    await check('HR cannot create Manager via admin_create_user', async () => {
      const res = await rpcCall('admin_create_user', {
        user_email: 'hr-escalation-test@latnovva.com',
        user_password: '',
        user_role: 'Manager',
        user_name: 'Escalation',
        user_client_id: null,
        user_subsidiary: 'MX',
      }, jwtHR);
      if (res.status < 400) throw new Error(`HR created Manager! HTTP ${res.status}`);
    });

    await check('HR cannot create whitespace-padded " Manager "', async () => {
      const res = await rpcCall('admin_create_user', {
        user_email: 'hr-whitespace-test@latnovva.com',
        user_password: '',
        user_role: ' Manager ',
        user_name: 'Whitespace',
        user_client_id: null,
        user_subsidiary: 'MX',
      }, jwtHR);
      if (res.status < 400) throw new Error(`HR created padded Manager! HTTP ${res.status}`);
    });

    await check('HR cannot mutate existing Manager email/password via admin_update_user with new_role=NULL', async () => {
      const res = await rpcCall('admin_update_user', {
        target_user_id: managerTargetId,
        new_email: 'hijacked@latnovva.com',
        new_role: null,
      }, jwtHR);
      if (res.status < 400) throw new Error(`HR mutated Manager! HTTP ${res.status}`);
    });

    await check('HR cannot directly PATCH public.profiles to promote to Manager', async () => {
      const res = await restPatch('profiles', `id=eq.${techSelfId}`, { role: 'Manager' }, jwtHR);
      if (res.status < 400 && res.text.includes('"Manager"')) {
        throw new Error(`HR promoted user via direct profiles PATCH! ${res.text}`);
      }
    });
  } else {
    skip('HR persona security checks', 'Set TEST_JWT_HR');
  }

  // Tech Persona
  if (jwtTech) {
    await check('Tech cannot execute admin_create_user', async () => {
      const res = await rpcCall('admin_create_user', {
        user_email: 'tech-probe@latnovva.com',
        user_password: '',
        user_role: 'Tech',
        user_name: 'Probe',
        user_client_id: null,
        user_subsidiary: 'MX',
      }, jwtTech);
      if (res.status < 400) throw new Error(`Tech executed admin_create_user! HTTP ${res.status}`);
    });

    await check('Tech cannot self-escalate role via direct PATCH on public.profiles', async () => {
      const res = await restPatch('profiles', `id=eq.${techSelfId}`, { role: 'Manager' }, jwtTech);
      if (res.status < 400 && res.text.includes('"Manager"')) {
        throw new Error(`Tech self-escalated via profiles PATCH! ${res.text}`);
      }
    });
  } else {
    skip('Tech persona security checks', 'Set TEST_JWT_TECH');
  }

  // Supervisor & Office Personas
  for (const [label, jwt] of [['Supervisor', jwtSupervisor], ['Office', jwtOffice]]) {
    if (jwt) {
      await check(`${label} cannot execute admin_create_user`, async () => {
        const res = await rpcCall('admin_create_user', {
          user_email: `${label.toLowerCase()}-probe@latnovva.com`,
          user_password: '',
          user_role: 'Tech',
          user_name: 'Probe',
          user_client_id: null,
          user_subsidiary: 'MX',
        }, jwt);
        if (res.status < 400) throw new Error(`${label} executed admin_create_user! HTTP ${res.status}`);
      });
    } else {
      skip(`${label} persona security checks`, `Set TEST_JWT_${label.toUpperCase()}`);
    }
  }

  // Manager Persona (positive verification)
  if (jwtManager) {
    await check('Manager can read v6 hardened tables and is NOT blocked by staff policies', async () => {
      const res = await restGet('mx_personnel', 'select=id&limit=1', jwtManager);
      if (res.status >= 400) throw new Error(`Manager blocked from mx_personnel: HTTP ${res.status}`);
    });
  } else {
    skip('Manager persona positive checks', 'Set TEST_JWT_MANAGER');
  }
}

// ── 3. Customer Tenant Isolation (Read-Only Safe Probes) ────────────────────
if (jwtCustomer) {
  await check('Customer cannot read mx_personnel via REST', async () => {
    const res = await restGet('mx_personnel', 'select=id&limit=5', jwtCustomer);
    if (Array.isArray(res.data) && res.data.length > 0) {
      throw new Error(`Customer read ${res.data.length} mx_personnel rows!`);
    }
  });

  await check('Customer cannot read tools via REST', async () => {
    const res = await restGet('tools', 'select=id&limit=5', jwtCustomer);
    if (Array.isArray(res.data) && res.data.length > 0) {
      throw new Error(`Customer read ${res.data.length} tools rows!`);
    }
  });

  await check('Customer cannot read Draft or Pending Manager Review reports via REST', async () => {
    const res = await restGet('reports', 'select=id,state&state=in.(Draft,Pending%20Manager%20Review)&limit=5', jwtCustomer);
    if (Array.isArray(res.data) && res.data.length > 0) {
      throw new Error(`Customer read ${res.data.length} internal Draft/Pending Manager Review reports!`);
    }
  });

  await check('Customer cannot read v6_migration_sentinels via REST', async () => {
    const res = await restGet('v6_migration_sentinels', 'select=migration_key&limit=5', jwtCustomer);
    if (Array.isArray(res.data) && res.data.length > 0) {
      throw new Error('Customer read v6_migration_sentinels!');
    }
  });
} else {
  skip('Customer tenant isolation REST checks', 'Set TEST_JWT_CUSTOMER on disposable DB');
}

console.log(`\nSecurity suite summary: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
if (failed > 0) process.exit(1);
