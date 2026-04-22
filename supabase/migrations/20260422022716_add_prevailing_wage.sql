-- Add prevailing_wage column to personnel table
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS prevailing_wage BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN personnel.prevailing_wage IS 'Flag to indicate if the personnel is a prevailing wage worker';
