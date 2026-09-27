// Supabase Edge Function: complete-password-rotation
// Authoritative Password Rotation & app_metadata.password_policy_version updater

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-latnovva-client-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify Caller Identity via Bearer Token
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthenticated: Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Verify token using Supabase Auth
    const verifyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: authUserData, error: verifyErr } = await verifyClient.auth.getUser(token);
    if (verifyErr || !authUserData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const caller_uid = authUserData.user.id;

    // 3. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const { newPassword } = body;

    // 4. Server-Side Password Policy Validation
    if (newPassword === undefined || newPassword === null || typeof newPassword !== "string") {
      return new Response(JSON.stringify({ error: "Invalid password payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.trim().length < 12) {
      return new Response(JSON.stringify({ error: "Password must be at least 12 characters long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length > 256) {
      return new Response(JSON.stringify({ error: "Password exceeds maximum length limit" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Reject Known Migration/Default Password
    const MIGRATION_DEFAULT_PASSWORD = "Latnovva2026!";
    if (newPassword === MIGRATION_DEFAULT_PASSWORD) {
      return new Response(JSON.stringify({ error: "New password cannot be the migration/default password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compare SHA-256 hash against server secret if set
    const defaultHashSecret = Deno.env.get("MIGRATION_DEFAULT_PASSWORD_SHA256");
    if (defaultHashSecret) {
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hashHex.toLowerCase() === defaultHashSecret.toLowerCase()) {
        return new Response(JSON.stringify({ error: "New password cannot be the migration/default password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Admin Supabase Client
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { apikey: SUPABASE_ANON_KEY } }
    });

    // 7. Read configured required_password_policy_version from platform_settings
    const { data: platformSettings } = await adminClient
      .from("platform_settings")
      .select("required_password_policy_version")
      .maybeSingle();

    const requiredVersion = body.resetToPolicy0 === true 
      ? 0 
      : (platformSettings?.required_password_policy_version ?? 1);

    // 8. Retrieve full user record via Admin API to preserve existing app_metadata
    const { data: adminUserData, error: getAdminUserErr } = await adminClient.auth.admin.getUserById(caller_uid);
    if (getAdminUserErr || !adminUserData?.user) {
      return new Response(JSON.stringify({ error: "Failed to retrieve authenticated user metadata" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingAppMetadata = adminUserData.user.app_metadata || {};
    const updatedAppMetadata = {
      ...existingAppMetadata,
      password_policy_version: requiredVersion,
      password_changed_at: new Date().toISOString(),
    };

    // 9. Update User Password & app_metadata via Admin API
    const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(caller_uid, {
      password: newPassword,
      app_metadata: updatedAppMetadata,
    });

    if (updateAuthErr) {
      return new Response(JSON.stringify({ error: updateAuthErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Session Revocation for caller
    try {
      await adminClient.auth.admin.signOut(caller_uid, "global");
    } catch (e) {
      console.warn("Global sign-out warning:", e);
    }

    // 11. Profile Observability Mirror Update
    let profileStatus = "SUCCESS";
    try {
      const dbClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { error: profileErr } = await dbClient
        .from("profiles")
        .update({
          password_policy_version: requiredVersion,
          password_changed_at: new Date().toISOString(),
        })
        .eq("id", caller_uid);

      if (profileErr) {
        console.warn("Profile mirror sync failed:", profileErr);
        profileStatus = "PASSWORD_ROTATED_PROFILE_SYNC_PENDING";
      }
    } catch (e) {
      console.warn("Profile mirror exception:", e);
      profileStatus = "PASSWORD_ROTATED_PROFILE_SYNC_PENDING";
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: profileStatus,
        message: "Password successfully rotated. Fresh authentication required.",
        password_policy_version: requiredVersion,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
