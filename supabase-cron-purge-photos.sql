-- ==============================================================================
-- CRON JOB: Auto-Purge Attendance Photos Every 24 Hours
-- ==============================================================================
-- This sets up a pg_cron job that calls the 'purge-attendance-photos' Edge Function
-- every day at 2:00 AM IST (20:30 UTC previous day).
-- 
-- PREREQUISITE: 
--   1. Enable the pg_cron and pg_net extensions in Supabase Dashboard > Database > Extensions
--   2. Deploy the 'purge-attendance-photos' Edge Function first
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Grant usage to postgres (required for Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Remove old job if it exists (idempotent)
SELECT cron.unschedule('purge-attendance-photos-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-attendance-photos-daily'
);

-- 4. Store your project URL and service role key in vault
--    ⚠️ REPLACE the values below with your actual Supabase project URL and service role key!
SELECT vault.create_secret('YOUR_PROJECT_URL', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'project_service_role_key');

-- 5. Schedule the Edge Function call every day at 20:30 UTC (2:00 AM IST)
SELECT cron.schedule(
  'purge-attendance-photos-daily',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/purge-attendance-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_service_role_key')
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

SELECT '✅ Daily attendance photo purge cron job scheduled at 2:00 AM IST!' AS status;
