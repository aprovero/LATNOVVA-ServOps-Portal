// Supabase Edge Function: complete-password-rotation
// Authoritative Password Rotation & app_metadata.password_policy_version updater

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

// Final authoritative CORS allowlist (no wildcard *, no unverified hosts)
const ALLOWED_ORIGINS = new Set([
  "https://latnovvamx.onrender.com",
  "https://servops.latnovva.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const BASE_CORS_HEADERS = {
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-latnovva-client-version, x-latnovva-build-id, x-latnovva-release-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function evaluateCors(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("origin");
  // Missing / null Origin (e.g., direct server/CLI call): no ACAO emitted, proceed to JWT auth
  if (!origin) {
    return { allowed: true, headers: { ...BASE_CORS_HEADERS } };
  }
  if (ALLOWED_ORIGINS.has(origin)) {
    return {
      allowed: true,
      headers: {
        ...BASE_CORS_HEADERS,
        "Access-Control-Allow-Origin": origin,
      },
    };
  }
  return { allowed: false, headers: { ...BASE_CORS_HEADERS } };
}

serve(async (req: Request) => {
  const cors = evaluateCors(req);

  // 1. CORS Preflight & Origin Enforcement
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...cors.headers, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors.headers });
  }

  const corsHeaders = cors.headers;

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

    // 6. Admin Supabase Client (uses SUPABASE_SERVICE_ROLE_KEY as apikey natively — PASS 15F P2-5)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 7. Read configured required_password_policy_version from platform_settings
    const { data: platformSettings } = await adminClient
      .from("platform_settings")
      .select("required_password_policy_version")
      .maybeSingle();

    const requiredVersion = platformSettings?.required_password_policy_version ?? 1;

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
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(caller_uid, {
      password: newPassword,
      app_metadata: updatedAppMetadata,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message || "Failed to update user password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Sync public.profiles.password_policy_version
    await adminClient
      .from("profiles")
      .update({ password_policy_version: requiredVersion })
      .eq("id", caller_uid);

    return new Response(
      JSON.stringify({
        success: true,
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
