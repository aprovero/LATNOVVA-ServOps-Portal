-- ============================================================================
-- PASS 11G: Canary Allowlist & Telemetry Infrastructure
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- ============================================================================

BEGIN;

-- 1. Create Canary Allowlist Table
CREATE TABLE IF NOT EXISTS public.mx_normalized_punch_canary (
    personnel_id TEXT PRIMARY KEY,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

ALTER TABLE public.mx_normalized_punch_canary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mx_normalized_punch_canary FROM PUBLIC, anon, authenticated;

-- Insert Dedicated Non-Payroll Canary Identity (Test Technician)
INSERT INTO public.mx_normalized_punch_canary (personnel_id, notes)
VALUES ('b6a26042-f99e-49df-92f7-b136f20b0eef', 'Dedicated Pass 11G Production Canary Identity')
ON CONFLICT (personnel_id) DO NOTHING;

-- 2. Create Central Telemetry Table
CREATE TABLE IF NOT EXISTS public.mx_normalized_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    personnel_id TEXT,
    punch_id UUID,
    timesheet_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mx_normalized_telemetry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mx_normalized_telemetry FROM PUBLIC, anon, authenticated;

-- Populate Pilot Allowlist
INSERT INTO public.mx_normalized_punch_canary (personnel_id, notes) VALUES
    ('b6a26042-f99e-49df-92f7-b136f20b0eef', 'Pilot Identity 1: Test Technician'),
    ('16398cbc-0206-454c-acff-bde60b8826f4', 'Pilot Identity 2: Test Supervisor'),
    ('63679509-adb2-4d7d-a7b4-d06798e2a370', 'Pilot Identity 3: Test Office'),
    ('f44a82c3-3b54-4a2d-bf05-49d2674dbd4e', 'Pilot Identity 4: ACOSTA SALAISES JOSE MIGUEL'),
    ('d5439649-c2f9-4bdb-a133-0010754780ba', 'Pilot Identity 5: AGUSTIN NUFIO OSCAR RAUL')
ON CONFLICT (personnel_id) DO UPDATE SET notes = EXCLUDED.notes;

COMMIT;
