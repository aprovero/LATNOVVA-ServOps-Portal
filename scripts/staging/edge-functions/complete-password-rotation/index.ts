// STAGING-ONLY Edge Function Variant: complete-password-rotation (PASS 15J-P3 / V6-PEND-026)
// Preserves authoritative production artifact supabase/functions/complete-password-rotation/index.ts untouched.
// Adds exact-match STAGING_ALLOWED_ORIGIN support (no wildcard *, no weakening of production allowlist).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const ALLOWED_ORIGINS = new Set([
  "https://latnovvamx.onrender.com",
  "https://servops.latnovva.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const stagingOrigin = (Deno.env.get("STAGING_ALLOWED_ORIGIN") || "").trim();
if (stagingOrigin && stagingOrigin.startsWith("https://") && !stagingOrigin.includes("*")) {
  ALLOWED_ORIGINS.add(stagingOrigin);
}

const BASE_CORS_HEADERS = {
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-latnovva-client-version, x-latnovva-build-id, x-latnovva-release-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function evaluateCors(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("origin");
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
    const body = await req.json().catch(() => ({}));
    const { newPassword } = body;

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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: platformSettings } = await adminClient
      .from("platform_settings")
      .select("required_password_policy_version")
      .maybeSingle();

    const requiredVersion = platformSettings?.required_password_policy_version ?? 1;

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
