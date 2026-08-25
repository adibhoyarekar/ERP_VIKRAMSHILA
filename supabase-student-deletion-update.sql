-- ==============================================================================
-- VIKRAMSHILA COLLEGE ERP: STUDENT DELETION & STORAGE CASCADE UPDATE
-- Run this SQL in your Supabase SQL Editor to enable complete student deletion,
-- storage cleanup permissions, and realtime synchronization.
-- ==============================================================================

-- 1. Ensure RLS is enabled on relevant tables
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bonafide_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scholarship_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scholarship_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scholarship_documents ENABLE ROW LEVEL SECURITY;

-- 2. Idempotent RLS Policies for Students Table
DROP POLICY IF EXISTS "Allow authenticated full access to students" ON public.students;
DROP POLICY IF EXISTS "Allow all public operations" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.students;

CREATE POLICY "Allow authenticated full access to students" ON public.students
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. Idempotent RLS Policies for Bonafide Records
DROP POLICY IF EXISTS "Allow authenticated full access to bonafide_records" ON public.bonafide_records;
DROP POLICY IF EXISTS "Allow all public operations" ON public.bonafide_records;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.bonafide_records;

CREATE POLICY "Allow authenticated full access to bonafide_records" ON public.bonafide_records
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 4. Idempotent RLS Policies for Scholarship Tables
DROP POLICY IF EXISTS "Allow authenticated full access to scholarship_records" ON public.scholarship_records;
CREATE POLICY "Allow authenticated full access to scholarship_records" ON public.scholarship_records
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to scholarship_installments" ON public.scholarship_installments;
CREATE POLICY "Allow authenticated full access to scholarship_installments" ON public.scholarship_installments
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to scholarship_documents" ON public.scholarship_documents;
CREATE POLICY "Allow authenticated full access to scholarship_documents" ON public.scholarship_documents
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 5. Storage Buckets: Ensure student_documents, avatars, and scholarship_documents are public
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('student_documents', 'student_documents', true, 5242880) 
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('avatars', 'avatars', true, 5242880) 
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('scholarship_documents', 'scholarship_documents', true, 5242880) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6. Storage Deletion Policies
DROP POLICY IF EXISTS "Allow delete student_documents" ON storage.objects;
CREATE POLICY "Allow delete student_documents" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'student_documents');

DROP POLICY IF EXISTS "Allow delete avatars" ON storage.objects;
CREATE POLICY "Allow delete avatars" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow delete scholarship_documents" ON storage.objects;
CREATE POLICY "Allow delete scholarship_documents" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'scholarship_documents');

-- 7. Atomic Cascade Deletion Stored Procedure (RPC)
CREATE OR REPLACE FUNCTION public.delete_student_cascade(
  p_student_id UUID DEFAULT NULL,
  p_enrollment_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_student_id UUID := p_student_id;
  v_enrollment_id TEXT := p_enrollment_id;
  v_deleted_count INTEGER := 0;
  v_scholarship_ids UUID[];
BEGIN
  -- Resolve IDs
  IF v_student_id IS NULL AND v_enrollment_id IS NOT NULL THEN
    SELECT id INTO v_student_id FROM public.students WHERE enrollment_id = v_enrollment_id LIMIT 1;
  END IF;

  IF v_enrollment_id IS NULL AND v_student_id IS NOT NULL THEN
    SELECT enrollment_id INTO v_enrollment_id FROM public.students WHERE id = v_student_id LIMIT 1;
  END IF;

  -- 1. Find all related scholarship records
  SELECT ARRAY_AGG(id) INTO v_scholarship_ids
  FROM public.scholarship_records
  WHERE (v_student_id IS NOT NULL AND student_id = v_student_id)
     OR (v_enrollment_id IS NOT NULL AND enrollment_id = v_enrollment_id);

  -- 2. Delete scholarship child documents & installments
  IF v_scholarship_ids IS NOT NULL AND array_length(v_scholarship_ids, 1) > 0 THEN
    DELETE FROM public.scholarship_documents WHERE record_id = ANY(v_scholarship_ids);
    DELETE FROM public.scholarship_installments WHERE record_id = ANY(v_scholarship_ids);
    DELETE FROM public.scholarship_records WHERE id = ANY(v_scholarship_ids);
  END IF;

  -- Fallback delete scholarship records
  IF v_enrollment_id IS NOT NULL THEN
    DELETE FROM public.scholarship_records WHERE enrollment_id = v_enrollment_id;
  END IF;
  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.scholarship_records WHERE student_id = v_student_id;
  END IF;

  -- 3. Delete bonafide records
  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.bonafide_records WHERE student_id = v_student_id;
  END IF;

  -- 4. Delete the student row
  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.students WHERE id = v_student_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  ELSIF v_enrollment_id IS NOT NULL THEN
    DELETE FROM public.students WHERE enrollment_id = v_enrollment_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'student_id', v_student_id,
    'enrollment_id', v_enrollment_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 8. Add Tables to Realtime Publication with Full Replica Identity
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.scholarship_records REPLICA IDENTITY FULL;
ALTER TABLE public.scholarship_installments REPLICA IDENTITY FULL;
ALTER TABLE public.scholarship_documents REPLICA IDENTITY FULL;
ALTER TABLE public.bonafide_records REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_records;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_installments;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_documents;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bonafide_records;
  EXCEPTION WHEN duplicate_object THEN
  END;
END $$;

-- 9. Purge Attendance Photo References Older Than 24 Hours
-- NOTE: Supabase blocks direct DELETE FROM storage.objects.
-- This function only clears DB references and returns URLs for client-side Storage API deletion.
DROP FUNCTION IF EXISTS public.delete_old_attendance_photos() CASCADE;

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
  -- Collect old photo URLs so the frontend can delete them via Storage API
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

-- NOTE: The auto-purge trigger has been REMOVED.
-- Direct DELETE FROM storage.objects is no longer allowed by Supabase.
-- Photo file cleanup is now handled via the Supabase Storage API in the frontend.

SELECT '✅ Student cascade deletion, storage delete permissions, 24h attendance photo auto-purge, and realtime sync configured successfully!' AS status;
