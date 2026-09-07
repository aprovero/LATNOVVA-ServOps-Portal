-- ==============================================================================
-- AUTOCIERRE AUTOMÁTICO DE TURNOS (>14 HORAS) CON 8 HORAS ACREDITADAS
-- Tabla: public.mx_timesheets
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.auto_close_stale_mx_timesheets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_closed_count integer := 0;
BEGIN
    -- Identificar y cerrar turnos abiertos que cumplan alguna de las siguientes condiciones:
    -- 1. La fecha del turno es anterior a la fecha actual (ayer o anterior).
    -- 2. El turno lleva más de 14 horas abierto desde su hora de entrada/creación.
    WITH stale_shifts AS (
        SELECT id, time_in
        FROM public.mx_timesheets
        WHERE time_in IS NOT NULL
          AND time_out IS NULL
          AND (
              date < CURRENT_DATE::text
              OR (
                  created_at IS NOT NULL 
                  AND (NOW() - created_at) > interval '14 hours'
              )
          )
    )
    UPDATE public.mx_timesheets t
    SET 
        -- Calcula la salida exactamente 8 horas después de la entrada
        time_out = CASE 
            WHEN t.time_in ~ '^[0-9]{2}:[0-9]{2}$' THEN
                to_char((t.time_in::time + interval '8 hours'), 'HH24:MI')
            ELSE 
                '17:00'
        END,
        -- REGLA DE NEGOCIO: El sistema debe contemplar 8 horas de trabajo
        hours = 8.0,
        status = 'Pending',
        notes = CASE 
            WHEN t.notes IS NULL OR t.notes = '' THEN 'System: Auto closed (>14h) - 8h acreditadas'
            ELSE t.notes || ' | System: Auto closed (>14h) - 8h acreditadas'
        END,
        updated_at = NOW()::text
    FROM stale_shifts s
    WHERE t.id = s.id;

    GET DIAGNOSTICS v_closed_count = ROW_COUNT;
    
    IF v_closed_count > 0 THEN
        RAISE NOTICE '[auto_close_stale_mx_timesheets] Se cerraron % turnos con 8 horas acreditadas.', v_closed_count;
    END IF;

    RETURN v_closed_count;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.auto_close_stale_mx_timesheets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_close_stale_mx_timesheets() TO service_role;

-- ==============================================================================
-- PROGRAMACIÓN PERIÓDICA CON PG_CRON (Si la extensión pg_cron está habilitada)
-- Se ejecuta cada 30 minutos
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Desprogramar si ya existía para evitar duplicados
        PERFORM cron.unschedule('autoclose-mx-timesheets');
        -- Programar cada 30 minutos
        PERFORM cron.schedule(
            'autoclose-mx-timesheets',
            '*/30 * * * *',
            'SELECT public.auto_close_stale_mx_timesheets();'
        );
        RAISE NOTICE 'Job cron "autoclose-mx-timesheets" programado con éxito.';
    ELSE
        RAISE NOTICE 'Extensión pg_cron no instalada en este proyecto. Ejecutar manualmente o mediante Supabase Scheduled Function.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo configurar pg_cron automáticamente: %', SQLERRM;
END;
$$;
