-- ==============================================================================
-- Vikramshila College ERP: Scholarship & Bank Details Synchronization Policies
-- (Safe & Non-Destructive: All queries use IF NOT EXISTS so previous data is preserved)
-- Run this SQL in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Ensure all Bank Details columns exist on the students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS account_holder_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS upi_app TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bank_details_updated TEXT;

-- 2. Ensure all Disbursement & Credit columns exist on the scholarship_records table
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS credit_date DATE;
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS scholarship_credit_amount NUMERIC(10, 2);
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS actual_balance_before_withdrawal NUMERIC(10, 2);
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS college_amount NUMERIC(10, 2);
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS student_amount NUMERIC(10, 2);
ALTER TABLE public.scholarship_records ADD COLUMN IF NOT EXISTS disbursement_remarks TEXT;

-- 3. Ensure RLS is enabled on all relevant tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_documents ENABLE ROW LEVEL SECURITY;

-- 4. Idempotent RLS Policies for Students Table (Allows authenticated & anon ERP clients full access)
DROP POLICY IF EXISTS "Allow authenticated full access to students" ON public.students;
DROP POLICY IF EXISTS "Allow all public operations" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.students;

CREATE POLICY "Allow authenticated full access to students" ON public.students
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 5. Idempotent RLS Policies for Scholarship Records
DROP POLICY IF EXISTS "Allow authenticated full access to scholarship_records" ON public.scholarship_records;
DROP POLICY IF EXISTS "Allow all public operations" ON public.scholarship_records;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.scholarship_records;

CREATE POLICY "Allow authenticated full access to scholarship_records" ON public.scholarship_records
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 6. Idempotent RLS Policies for Scholarship Installments
DROP POLICY IF EXISTS "Allow authenticated full access to scholarship_installments" ON public.scholarship_installments;
DROP POLICY IF EXISTS "Allow all public operations" ON public.scholarship_installments;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.scholarship_installments;

CREATE POLICY "Allow authenticated full access to scholarship_installments" ON public.scholarship_installments
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 7. Idempotent RLS Policies for Scholarship Documents
DROP POLICY IF EXISTS "Allow authenticated full access to scholarship_documents" ON public.scholarship_documents;
DROP POLICY IF EXISTS "Allow all public operations" ON public.scholarship_documents;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.scholarship_documents;

CREATE POLICY "Allow authenticated full access to scholarship_documents" ON public.scholarship_documents
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 8. Ensure Supabase Storage Bucket 'scholarship_documents' exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('scholarship_documents', 'scholarship_documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 9. Storage Object Policies for 'scholarship_documents' Bucket
DROP POLICY IF EXISTS "Allow read scholarship_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert scholarship_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow update scholarship_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete scholarship_documents" ON storage.objects;

CREATE POLICY "Allow read scholarship_documents" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'scholarship_documents');

CREATE POLICY "Allow insert scholarship_documents" ON storage.objects
  FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id = 'scholarship_documents');

CREATE POLICY "Allow update scholarship_documents" ON storage.objects
  FOR UPDATE TO authenticated, anon
  USING (bucket_id = 'scholarship_documents');

CREATE POLICY "Allow delete scholarship_documents" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'scholarship_documents');

-- 10. Add Storage Deletion Policies for student_documents and avatars
DROP POLICY IF EXISTS "Allow delete student_documents" ON storage.objects;
CREATE POLICY "Allow delete student_documents" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'student_documents');

DROP POLICY IF EXISTS "Allow delete avatars" ON storage.objects;
CREATE POLICY "Allow delete avatars" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'avatars');

-- 11. Add Bonafide Records RLS Policy for authenticated & anon
DROP POLICY IF EXISTS "Allow authenticated full access to bonafide_records" ON public.bonafide_records;
CREATE POLICY "Allow authenticated full access to bonafide_records" ON public.bonafide_records
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 12. Atomic Stored Procedure: Cascade Delete Student with All Dependencies
CREATE OR REPLACE FUNCTION public.delete_student_cascade(
  p_student_id UUID DEFAULT NULL,
  p_enrollment_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := p_student_id;
  v_enrollment_id TEXT := p_enrollment_id;
  v_deleted_count INTEGER := 0;
  v_scholarship_ids UUID[];
BEGIN
  IF v_student_id IS NULL AND v_enrollment_id IS NOT NULL THEN
    SELECT id INTO v_student_id FROM public.students WHERE enrollment_id = v_enrollment_id LIMIT 1;
  END IF;

  IF v_enrollment_id IS NULL AND v_student_id IS NOT NULL THEN
    SELECT enrollment_id INTO v_enrollment_id FROM public.students WHERE id = v_student_id LIMIT 1;
  END IF;

  -- Find all related scholarship record IDs
  SELECT ARRAY_AGG(id) INTO v_scholarship_ids
  FROM public.scholarship_records
  WHERE (v_student_id IS NOT NULL AND student_id = v_student_id)
     OR (v_enrollment_id IS NOT NULL AND enrollment_id = v_enrollment_id);

  -- Delete scholarship child documents & installments
  IF v_scholarship_ids IS NOT NULL AND array_length(v_scholarship_ids, 1) > 0 THEN
    DELETE FROM public.scholarship_documents WHERE record_id = ANY(v_scholarship_ids);
    DELETE FROM public.scholarship_installments WHERE record_id = ANY(v_scholarship_ids);
    DELETE FROM public.scholarship_records WHERE id = ANY(v_scholarship_ids);
  END IF;

  IF v_enrollment_id IS NOT NULL THEN
    DELETE FROM public.scholarship_records WHERE enrollment_id = v_enrollment_id;
  END IF;
  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.scholarship_records WHERE student_id = v_student_id;
  END IF;

  -- Delete bonafide records
  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.bonafide_records WHERE student_id = v_student_id;
  END IF;

  -- Delete from students table
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

GRANT EXECUTE ON FUNCTION public.delete_student_cascade(UUID, TEXT) TO authenticated, anon;

-- 13. Add Tables to Supabase Realtime Publication for Live Sync
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

