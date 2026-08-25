-- ==============================================================================
-- FIX: "Direct deletion from storage tables is not allowed" ERROR
-- ==============================================================================
-- Supabase now blocks direct SQL DELETE on storage.objects.
-- This script removes the trigger that was causing attendance submission to fail.
-- Photo cleanup is now handled via the Supabase Storage API in the frontend.
-- ==============================================================================

-- 1. Drop the trigger that fires on every attendance INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_auto_purge_attendance_photos ON public.attendance_records;

-- 2. Drop the trigger function (no longer needed)
DROP FUNCTION IF EXISTS public.trigger_purge_old_attendance_photos() CASCADE;

-- 3. Replace the purge function to only clear DB references (no storage.objects deletion)
--    Storage file deletion will be handled by the frontend using the Storage API.
CREATE OR REPLACE FUNCTION public.delete_old_attendance_photos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_records_count INTEGER := 0;
  v_old_photo_urls TEXT[];
BEGIN
  -- Collect old photo URLs so the frontend/edge function can delete them via Storage API
  SELECT ARRAY_AGG(url) INTO v_old_photo_urls
  FROM (
    SELECT check_in_photo_url AS url FROM public.attendance_records
    WHERE created_at < NOW() - INTERVAL '24 hours'
      AND check_in_photo_url IS NOT NULL
    UNION ALL
    SELECT check_out_photo_url AS url FROM public.attendance_records
    WHERE created_at < NOW() - INTERVAL '24 hours'
      AND check_out_photo_url IS NOT NULL
  ) urls;

  -- Clear photo references from attendance_records (retains punch times & status)
  WITH updated_records AS (
    UPDATE public.attendance_records
    SET check_in_photo_url = NULL,
        check_out_photo_url = NULL
    WHERE created_at < NOW() - INTERVAL '24 hours'
      AND (check_in_photo_url IS NOT NULL OR check_out_photo_url IS NOT NULL)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated_records_count FROM updated_records;

  RETURN jsonb_build_object(
    'success', true,
    'cleared_records', v_updated_records_count,
    'photo_urls_to_delete', COALESCE(v_old_photo_urls, ARRAY[]::TEXT[]),
    'timestamp', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_old_attendance_photos() TO authenticated, anon;

SELECT '✅ Storage trigger removed. Attendance submission will now work without errors.' AS status;
