const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function run() {
  console.log('🚀 Applying PASS 12J SQL Migration to Supabase project dvkkxwtqonjgrvloisid...');
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260928000005_forgotten_clockout_schema_and_rpc.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'Latnovva2026!';
  const hosts = [
    'db.dvkkxwtqonjgrvloisid.supabase.co',
    'aws-0-us-west-1.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-us-east-2.pooler.supabase.com'
  ];

  let connected = false;
  for (const host of hosts) {
    try {
      const connectionString = `postgresql://postgres.dvkkxwtqonjgrvloisid:${encodeURIComponent(dbPassword)}@${host}:5432/postgres`;
      const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
      await client.connect();
      console.log(`✅ Connected via Postgres client to ${host}`);
      await client.query(sql);
      await client.end();
      console.log('🎉 Migration applied successfully via pg client!');
      connected = true;
      break;
    } catch (e) {
      console.log(`Connection to ${host} failed: ${e.message}`);
    }
  }

  if (connected) return;

  if (process.env.SUPABASE_ACCESS_TOKEN) {
    console.log('Attempting Supabase Management API db/query endpoint...');
    const resp = await fetch('https://api.supabase.com/v1/projects/dvkkxwtqonjgrvloisid/db/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    const result = await resp.json();
    if (resp.ok) {
      console.log('🎉 Migration applied successfully via Supabase Management API!');
      return;
    } else {
      console.error('Management API error:', result);
    }
  }
}

run().catch(console.error);
