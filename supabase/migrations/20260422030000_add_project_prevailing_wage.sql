-- Add prevailing_wage column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS prevailing_wage BOOLEAN DEFAULT false;
