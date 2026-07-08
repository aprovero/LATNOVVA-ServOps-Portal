-- Fix: Add missing lunch_start and lunch_end columns to mx_timesheets
-- Run this in the Supabase SQL Editor

ALTER TABLE public.mx_timesheets
    ADD COLUMN IF NOT EXISTS lunch_start text,
    ADD COLUMN IF NOT EXISTS lunch_end   text;
