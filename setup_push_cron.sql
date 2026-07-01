-- Setup pg_cron and pg_net extensions and schedule daily push reminders
-- Run this script in the Supabase SQL Editor (Dashboard).

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Clear any existing schedules to avoid duplicates (safe check)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('daily-clock-in-reminder', 'daily-clock-out-reminder');

-- 3. Schedule the Clock-In reminder
-- Time: 7:30 AM CST (Mexico/Central) = 13:30 UTC. Run Monday-Friday.
-- We use pg_net's HTTP POST to trigger the Edge Function securely.
-- NOTE: Replace 'YOUR_SUPABASE_PROJECT_REF' with your actual Supabase project ID,
-- or use the internal kong address 'http://kong:8000/functions/v1/send-push-reminders' if supported.
SELECT cron.schedule(
    'daily-clock-in-reminder',
    '30 13 * * 1-5',
    $$
    SELECT net.http_post(
        url := 'https://dvkkxwtqonjgrvloisid.supabase.co/functions/v1/send-push-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body := '{"type": "clock-in"}'::jsonb
    );
    $$
);

-- 4. Schedule the Clock-Out check
-- Time: 7:00 PM (19:00) CST (Mexico/Central) = 01:00 UTC (Next Day). Run daily.
SELECT cron.schedule(
    'daily-clock-out-reminder',
    '0 1 * * *',
    $$
    SELECT net.http_post(
        url := 'https://dvkkxwtqonjgrvloisid.supabase.co/functions/v1/send-push-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body := '{"type": "clock-out"}'::jsonb
    );
    $$
);
