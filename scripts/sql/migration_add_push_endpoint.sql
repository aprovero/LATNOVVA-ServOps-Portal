-- SQL Migration: Add endpoint column to push_subscriptions table
-- Run this script in your Supabase SQL Editor (Dashboard) to update the schema.

-- 1. Add the column (nullable initially)
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;

-- 2. Populate endpoint values from the JSONB subscription data
UPDATE public.push_subscriptions SET endpoint = subscription->>'endpoint' WHERE endpoint IS NULL;

-- 3. Enforce NOT NULL and add UNIQUE constraint
ALTER TABLE public.push_subscriptions ALTER COLUMN endpoint SET NOT NULL;

-- 4. Drop the old expression index if it exists, since we now use the plain column unique constraint
DROP INDEX IF EXISTS public.push_subscriptions_endpoint_idx;

-- 5. Add unique constraint on the new column
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
