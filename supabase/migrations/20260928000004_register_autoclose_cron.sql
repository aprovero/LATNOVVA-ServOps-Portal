-- ==============================================================================
-- PASS 12J: Register Auto-Close Cron Job in pg_cron
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- Schedules public.auto_close_stale_mx_timesheets() every 30 minutes
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule if pre-existing to avoid duplicates
        PERFORM cron.unschedule('autoclose-mx-timesheets');
        
        -- Schedule every 30 minutes
        PERFORM cron.schedule(
            'autoclose-mx-timesheets',
            '*/30 * * * *',
            'SELECT public.auto_close_stale_mx_timesheets();'
        );
        RAISE NOTICE 'Job cron "autoclose-mx-timesheets" successfully registered (*/30 * * * *).';
    ELSE
        RAISE NOTICE 'Extension pg_cron is not enabled on this database instance.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule pg_cron job automatically: %', SQLERRM;
END;
$$;

COMMIT;
