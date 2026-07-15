// Supabase Edge Function: send-push-reminders
// Triggered daily via pg_cron to send clock-in/out alerts to push subscriptions

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { sendNotification } from "npm:web-push-neo";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type } = await req.json();

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("Missing VAPID key environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current date in Mexico Central Time (UTC-6 / UTC-5)
    // Format: YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(new Date()); // Outputs "YYYY-MM-DD"

    console.log(`[Push] Processing ${type} triggers for date: ${todayStr}`);

    let usersToNotify: any[] = [];
    let notificationTitle = "";
    let notificationBody = "";
    let redirectUrl = "/";

    if (type === "clock-in") {
      notificationTitle = "Portal LATNOVVA";
      notificationBody = "Buenos días, recuerda hacer check in en el Portal de Servicios LATNOVVA antes de empezar tus actividades.";
      redirectUrl = "/clock-in";

      // 1. Find profiles
      const { data: staff, error: staffErr } = await supabase
        .from("profiles")
        .select("id, name, email, role");

      if (staffErr) throw staffErr;

      // Filter staff who require reminders (non-managers + aprovero@latnovva.com)
      const allowedStaff = (staff || []).filter(s => 
        ["Tech", "Supervisor", "Office", "HR"].includes(s.role || '') || 
        s.email?.toLowerCase() === 'aprovero@latnovva.com'
      );

      // 2. Query timesheets for today to see who has NOT clocked in
      const { data: activeShifts, error: shiftErr } = await supabase
        .from("timesheets")
        .select("personnel_id")
        .eq("date", todayStr);

      if (shiftErr) throw shiftErr;

      // Also check Mexico timesheets
      const { data: activeMxShifts, error: mxShiftErr } = await supabase
        .from("mx_timesheets")
        .select("personnel_id")
        .eq("date", todayStr);

      if (mxShiftErr) throw mxShiftErr;

      const clockedInIds = new Set([
        ...activeShifts.map(s => s.personnel_id),
        ...activeMxShifts.map(s => s.personnel_id)
      ]);

      // Filter staff who are NOT clocked in
      usersToNotify = allowedStaff.filter(s => !clockedInIds.has(s.id));

    } else if (type === "clock-out") {
      notificationTitle = "Portal LATNOVVA";
      notificationBody = "Buenas noches, hemos identificado que tu turno sigue activo, recuerda hacer clock out al terminar las actividades.";
      redirectUrl = "/clock-in";

      // Find users with open shifts (timeIn is set, but timeOut is missing/null)
      // We check both global and Mexico timesheet tables
      const { data: openShifts, error: shiftErr } = await supabase
        .from("timesheets")
        .select("personnel_id")
        .eq("date", todayStr)
        .is("time_out", null);

      if (shiftErr) throw shiftErr;

      const { data: openMxShifts, error: mxShiftErr } = await supabase
        .from("mx_timesheets")
        .select("personnel_id")
        .eq("date", todayStr)
        .is("time_out", null);

      if (mxShiftErr) throw mxShiftErr;

      const openShiftUserIds = new Set([
        ...openShifts.map(s => s.personnel_id),
        ...openMxShifts.map(s => s.personnel_id)
      ]);

      // Query profiles for these IDs
      let staff: any[] = [];
      if (openShiftUserIds.size > 0) {
        const { data, error: staffErr } = await supabase
          .from("profiles")
          .select("id, name, email, role")
          .in("id", Array.from(openShiftUserIds));

        if (staffErr) throw staffErr;
        staff = data || [];
      }

      // Explicitly fetch and append the test manager profile (aprovero@latnovva.com) to allow testing clock-out triggers
      const { data: testManager } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .eq("email", "aprovero@latnovva.com")
        .maybeSingle();

      if (testManager && !staff.some(s => s.id === testManager.id)) {
        staff.push(testManager);
      }

      usersToNotify = staff.filter(s =>
        ["Tech", "Supervisor", "Office", "HR"].includes(s.role || '') ||
        s.email?.toLowerCase() === 'aprovero@latnovva.com'
      );
    } else {
      return new Response(JSON.stringify({ error: "Invalid trigger type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (usersToNotify.length === 0) {
      console.log("[Push] No users matched notification criteria.");
      return new Response(JSON.stringify({ message: "No notifications needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = usersToNotify.map(u => u.id);
    console.log(`[Push] Users to notify:`, usersToNotify.map(u => u.name));

    // Get all subscriptions for these users
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription")
      .in("user_id", userIds);

    if (subsErr) throw subsErr;

    if (!subs || subs.length === 0) {
      console.log("[Push] No active push subscriptions found for target users.");
      return new Response(JSON.stringify({ message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Push] Sending notifications to ${subs.length} devices...`);

    let successCount = 0;
    let failCount = 0;

    for (const sub of subs) {
      try {
        const endpoint = sub.subscription.endpoint;
        const auth = sub.subscription.keys?.auth;
        const p256dh = sub.subscription.keys?.p256dh;

        if (!endpoint || !auth || !p256dh) {
          console.warn("[Push] Subscription missing critical key parameters:", sub);
          continue;
        }

        await sendNotification(
          {
            endpoint,
            keys: { auth, p256dh }
          },
          JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            url: redirectUrl
          }),
          {
            vapidDetails: {
              subject: "mailto:noreply@latnovva.com",
              publicKey: VAPID_PUBLIC_KEY,
              privateKey: VAPID_PRIVATE_KEY
            }
          }
        );
        successCount++;
      } catch (err) {
        console.error(`[Push] Failed to deliver push to subscription:`, err);
        failCount++;
        // If endpoint is expired or invalid (404/410 Gone), we should delete it
        if (err.message && (err.message.includes("404") || err.message.includes("410") || err.message.includes("Gone") || err.message.includes("Expired"))) {
          console.log(`[Push] Removing expired subscription:`, sub.subscription.endpoint);
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("subscription->>endpoint", sub.subscription.endpoint);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, dispatched: successCount, failed: failCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Push] Global edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
