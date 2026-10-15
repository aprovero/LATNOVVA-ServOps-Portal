/**
 * PASS 13I-V: Generate Proposed Initial Geofence Seed Set SQL
 * Reads production projects, filters active MX projects,
 * generates public.project_geofence_versions INSERT statements for review.
 * DOES NOT EXECUTE THE SQL.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

function parseCoords(loc) {
  if (!loc) return null;
  const parts = loc.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function stableUuid(projectId) {
  const hash = crypto.createHash('sha256').update(projectId + ':v1:geofence').digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    'a' + hash.slice(17, 20),
    hash.slice(20, 32)
  ].join('-');
}

async function main() {
  const client = createClient(supabaseUrl, anonKey);
  await client.auth.signInWithPassword({
    email: 'tech@latnovva.com',
    password: 'CanaryPassword123!'
  });

  const { data: projects, error } = await client.from('projects').select('*');
  if (error) {
    console.error('Error fetching projects:', error);
    process.exit(1);
  }

  const activeMx = projects.filter(p => {
    const isStatus = ['Active', 'In Progress', 'En proceso', 'En procceso'].includes(p.status);
    const isSub = p.subsidiary === 'MX' || p.subsidiary === 'Mexico' || !p.subsidiary;
    return isStatus && isSub;
  });

  const ready = activeMx.filter(p => {
    const coords = parseCoords(p.location);
    return coords !== null && p.location_validated === true;
  });

  const blocked = activeMx.filter(p => {
    const coords = parseCoords(p.location);
    return coords === null || p.location_validated !== true;
  });

  console.log(`Active MX projects: ${activeMx.length}`);
  console.log(`Ready to seed: ${ready.length}`);
  console.log(`Blocked: ${blocked.length}`);

  let sql = '-- ==============================================================================\n';
  sql += '-- PASS 13I-V: PROPOSED INITIAL GEOFENCE SEED SET (READ ONLY - DO NOT EXECUTE)\n';
  sql += '-- Generated At: ' + new Date().toISOString() + '\n';
  sql += '-- Ready to seed: ' + ready.length + ' projects\n';
  sql += '-- Blocked: ' + blocked.length + ' projects\n';
  sql += '-- Effective From Timestamp: 2026-10-15 00:00:00+00\n';
  sql += '-- ==============================================================================\n\n';
  sql += 'BEGIN;\n\n';

  ready.forEach((p, idx) => {
    const coords = parseCoords(p.location);
    const vId = stableUuid(p.id);
    const radius = p.subsidiary_metadata?.geofenceRadius || (p.name === 'Mérida' ? 500 : 1000);
    const acc = 150.00;
    const isWhBypass = p.name.toLowerCase().includes('merida') || p.name.toLowerCase().includes('m\u00e9rida');
    const notes = ('PASS 13I-V Initial Seed: ' + p.name).replace(/'/g, "''");

    sql += `-- [${idx + 1}/${ready.length}] ${p.name} (Project ID: ${p.id})\n`;
    sql += `INSERT INTO public.project_geofence_versions (\n`;
    sql += `    version_id,\n`;
    sql += `    project_id,\n`;
    sql += `    version_number,\n`;
    sql += `    latitude,\n`;
    sql += `    longitude,\n`;
    sql += `    radius_meters,\n`;
    sql += `    accuracy_threshold_meters,\n`;
    sql += `    warehouse_bypass_allowed,\n`;
    sql += `    home_office_allowed,\n`;
    sql += `    effective_from,\n`;
    sql += `    notes\n`;
    sql += `) VALUES (\n`;
    sql += `    '${vId}'::uuid,\n`;
    sql += `    '${p.id}'::uuid,\n`;
    sql += `    1,\n`;
    sql += `    ${coords.lat},\n`;
    sql += `    ${coords.lng},\n`;
    sql += `    ${radius}.00,\n`;
    sql += `    ${acc},\n`;
    sql += `    ${isWhBypass ? 'TRUE' : 'FALSE'},\n`;
    sql += `    TRUE,\n`;
    sql += `    '2026-10-15 00:00:00+00'::timestamptz,\n`;
    sql += `    '${notes}'\n`;
    sql += `) ON CONFLICT (project_id, version_number) DO NOTHING;\n\n`;
  });

  sql += 'COMMIT;\n';
  sql += '-- ==============================================================================\n';
  sql += '-- END OF PROPOSED GEOFENCE SEED SCRIPT\n';
  sql += '-- ==============================================================================\n';

  const outPath = path.join(__dirname, 'sql', 'pass13i_v_proposed_geofence_seed.sql');
  fs.writeFileSync(outPath, sql);
  console.log(`✅ Saved proposed geofence seed SQL to: ${outPath} (${sql.length} bytes)`);

  return {
    readyCount: ready.length,
    blockedCount: blocked.length,
    blockedList: blocked.map(b => ({ name: b.name, id: b.id, reason: 'location_validated is false' }))
  };
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { main };
