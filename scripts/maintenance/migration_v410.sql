CREATE TABLE IF NOT EXISTS public.app_version_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    email TEXT,
    app_version TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_version_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_version_logs' AND policyname = 'Allow authenticated insert'
    ) THEN
        CREATE POLICY "Allow authenticated insert" ON public.app_version_logs
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_version_logs' AND policyname = 'Allow authenticated read'
    ) THEN
        CREATE POLICY "Allow authenticated read" ON public.app_version_logs
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_app_version TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
