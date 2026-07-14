CREATE TABLE public.user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT NOT NULL,
    
    -- Ratings
    overall_rating INT CHECK (overall_rating >= 1 AND overall_rating <= 5),
    speed_rating INT CHECK (speed_rating >= 1 AND speed_rating <= 5),
    ease_of_use_rating INT CHECK (ease_of_use_rating >= 1 AND ease_of_use_rating <= 5),
    offline_rating INT CHECK (offline_rating >= 1 AND offline_rating <= 5 OR offline_rating IS NULL),
    
    -- Actions & Permissions
    gps_issue BOOLEAN, -- TRUE = Yes, FALSE = No
    gps_comments TEXT,
    notifications_status TEXT, -- 'Yes', 'No', 'Blocked'
    notifications_comments TEXT,
    
    -- Open Feedback
    friction_points TEXT,
    feature_requests TEXT,
    general_comments TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert feedback
CREATE POLICY "Allow authenticated users to insert feedback" ON public.user_feedback
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow managers, supervisors and HR to read feedback
CREATE POLICY "Allow managers to read feedback" ON public.user_feedback
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.personnel
            WHERE personnel.email = auth.jwt() ->> 'email'
              AND personnel.app_role IN ('Manager', 'Supervisor', 'HR')
        )
    );
