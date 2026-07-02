const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse the .env file in the project root
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://dvkkxwtqonjgrvloisid.supabase.co';
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing in .env');
  process.exit(1);
}

// Create Supabase Admin client using Service Role Key to bypass RLS and access auth.users
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('\n============================================================');
  console.log('       LATNOVVA SECURE USER LOGINS & REFRESH INSPECTOR      ');
  console.log('============================================================\n');

  try {
    // 1. Fetch all users from Supabase Auth admin API
    console.log('Fetching users from Supabase Auth...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw new Error(`Failed to fetch auth users: ${usersError.message}`);
    }

    // 2. Fetch push subscriptions (if the table exists and has rows)
    let subscriptions = [];
    try {
      const { data, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('user_id, created_at, updated_at');
      
      if (!subsError && data) {
        subscriptions = data;
      }
    } catch (e) {
      console.log('(Note: push_subscriptions table not accessible or empty)');
    }

    // Map user subscriptions for easy lookup
    const subMap = new Map();
    subscriptions.forEach(s => {
      subMap.set(s.user_id, s.updated_at);
    });

    console.log(`Found ${users.length} total registered users.\n`);

    // Sort users by last sign-in timestamp descending
    const sortedUsers = users
      .filter(u => u.last_sign_in_at)
      .map(u => ({
        email: u.email,
        lastSignIn: new Date(u.last_sign_in_at),
        rawSignInStr: u.last_sign_in_at,
        hasPushSub: subMap.has(u.id),
        pushSubUpdatedAt: subMap.get(u.id)
      }))
      .sort((a, b) => b.lastSignIn - a.lastSignIn);

    console.log('--- SIGN-IN LOGS (Sorted by most recent) ---');
    
    // Check if sign-in is recent (within last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    sortedUsers.forEach((u) => {
      const isRecent = u.lastSignIn > oneDayAgo;
      
      // Markers:
      // ★ [ACTIVE RECENTLY] for logins within 24h
      // 📱 [PUSH ENABLED] if they have a push subscription registered
      const recentMarker = isRecent ? '★ [RECENT]' : '          ';
      const pushMarker = u.hasPushSub ? '📱 [PUSH-OK]' : '            ';
      
      console.log(
        `${recentMarker} ${pushMarker} | ${u.email.padEnd(30)} | Last Login: ${u.rawSignInStr}`
      );
    });

    console.log('\n============================================================');
  } catch (err) {
    console.error('Fatal execution error:', err.message);
  }
}

main();
