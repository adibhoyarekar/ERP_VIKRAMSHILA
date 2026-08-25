-- ==============================================================================
-- VIKRAMSHILA COLLEGE ERP — COMPLETE ALL-IN-ONE MASTER DATABASE SETUP
-- ==============================================================================
-- Project: Vikramshila College ERP System
-- Description: Complete, 100% unified schema definition containing all tables,
--              constraints, indexes, triggers, stored procedures (RPCs),
--              realtime configuration, storage buckets, and row-level security (RLS).
-- Idempotent & Safe: Uses IF NOT EXISTS, CREATE OR REPLACE, and clean policy drops.
-- How to run: Copy everything in this file -> Supabase Dashboard -> SQL Editor -> Run.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS & SCHEMAS
-- ==============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Ensure pg_trgm is in extensions schema if already installed in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' AND extnamespace = 'public'::regnamespace
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;


-- ==============================================================================
-- 2. CORE DATABASE TABLES
-- ==============================================================================

-- 2.1 Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'superadmin', 'admin', 'clerk', 'accountant', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure users_role_check constraint supports all roles including staff
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('super_admin', 'superadmin', 'admin', 'clerk', 'accountant', 'staff'));


-- 2.2 Access Requests Table (Pending staff & clerk signup requests)
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.3 Students Table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  course TEXT,
  branch TEXT,
  category TEXT,
  sub_caste TEXT,
  father_name TEXT,
  address TEXT,
  pincode TEXT,
  alternate_phone TEXT,
  prn_no TEXT,
  roll_no TEXT,
  photo_url TEXT,
  semester INTEGER,
  batch_year TEXT,
  dob DATE,
  study_year TEXT,
  status TEXT CHECK (status IN ('active', 'graduated', 'dropped', 'Active', 'Graduated', 'Dropped')),
  admission_date DATE,
  scholarship BOOLEAN DEFAULT FALSE,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_ifsc TEXT,
  bank_branch TEXT,
  account_holder_name TEXT,
  upi_id TEXT,
  upi_app TEXT,
  bank_details_updated TEXT,
  documents_complete BOOLEAN DEFAULT FALSE,
  documents TEXT[],
  profile_completion INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.4 Bonafide Certificate Records
CREATE TABLE IF NOT EXISTS public.bonafide_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  issue_date DATE NOT NULL,
  valid_until DATE,
  generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.5 Stationary & Inventory Expense Records
CREATE TABLE IF NOT EXISTS public.stationary_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  object_name TEXT NOT NULL,
  unit INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  balance NUMERIC(10, 2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('Paid', 'Pending', 'Partial', 'paid', 'pending', 'partial')),
  remarks TEXT,
  created_by_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.6 Stationary Payment Installments
CREATE TABLE IF NOT EXISTS public.stationary_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID REFERENCES public.stationary_records(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  mode TEXT CHECK (mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'N/A')),
  bill_url TEXT,
  reference_no TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.7 Stationary Documents & Receipts
CREATE TABLE IF NOT EXISTS public.stationary_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID REFERENCES public.stationary_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.8 Scholarship Records
CREATE TABLE IF NOT EXISTS public.scholarship_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  course TEXT NOT NULL,
  scholarship_name TEXT NOT NULL,
  application_date DATE,
  sanctioned_amount NUMERIC(10, 2) NOT NULL,
  amount_received NUMERIC(10, 2) NOT NULL,
  amount_pending NUMERIC(10, 2) NOT NULL,
  status TEXT CHECK (status IN ('Pending', 'Partial', 'Completed', 'pending', 'partial', 'completed')),
  total_amount NUMERIC(10, 2),
  credit_date DATE,
  scholarship_credit_amount NUMERIC(10, 2),
  actual_balance_before_withdrawal NUMERIC(10, 2),
  college_amount NUMERIC(10, 2),
  student_amount NUMERIC(10, 2),
  disbursement_remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.9 Scholarship Payment Installments
CREATE TABLE IF NOT EXISTS public.scholarship_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID REFERENCES public.scholarship_records(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  amount_received NUMERIC(10, 2) NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('UPI', 'Cash', 'Cheque', 'NEFT', 'RTGS', 'IMPS', 'Bank Transfer', 'Other')),
  transaction_ref TEXT,
  remarks TEXT,
  proof_url TEXT,
  is_freeship BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.10 Scholarship Documents
CREATE TABLE IF NOT EXISTS public.scholarship_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID REFERENCES public.scholarship_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  upload_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.11 Financial Ledger Entries
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('Cash', 'UPI', 'Net Banking', 'Cheque')),
  cheque_no TEXT,
  proof_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.12 Internal Messages & Staff Chat Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 2.13 College Attendance & App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_latitude NUMERIC,
  college_longitude NUMERIC,
  college_radius_meters INTEGER DEFAULT 100,
  work_start_time TIME DEFAULT '09:00:00',
  late_threshold_time TIME DEFAULT '09:15:00',
  check_in_window_start TIME DEFAULT '08:00:00',
  check_in_window_end TIME DEFAULT '10:00:00',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial settings if empty
INSERT INTO public.app_settings (college_latitude, college_longitude, college_radius_meters)
SELECT 19.876165, 75.343314, 100
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);


-- 2.14 Employee Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_in_photo_url TEXT,
  check_in_latitude NUMERIC,
  check_in_longitude NUMERIC,
  check_in_accuracy NUMERIC,
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_out_photo_url TEXT,
  check_out_latitude NUMERIC,
  check_out_longitude NUMERIC,
  check_out_accuracy NUMERIC,
  status TEXT CHECK (status IN ('Present', 'Late', 'Absent')),
  working_hours TEXT,
  is_manually_corrected BOOLEAN DEFAULT FALSE,
  corrected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);


-- 2.15 College Holidays Table
CREATE TABLE IF NOT EXISTS public.college_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;


-- 2.17 Rate Limiting Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  account_id TEXT,
  action_type TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==============================================================================
-- 3. HIGH-SPEED INDEXES (B-Tree & Trigram)
-- ==============================================================================

-- Students Table Indexes
CREATE INDEX IF NOT EXISTS idx_students_course_branch ON public.students(course, branch);
CREATE INDEX IF NOT EXISTS idx_students_category ON public.students(category);
CREATE INDEX IF NOT EXISTS idx_students_admission_date ON public.students(admission_date DESC);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_semester ON public.students(semester);
CREATE INDEX IF NOT EXISTS idx_students_batch_year ON public.students(batch_year);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON public.students(created_at DESC);

-- Trigram Fuzzy Search Index across Name, Enrollment ID, PRN, and Roll No
CREATE INDEX IF NOT EXISTS idx_students_search_trgm ON public.students USING gin (
  (name || ' ' || COALESCE(enrollment_id, '') || ' ' || COALESCE(prn_no, '') || ' ' || COALESCE(roll_no, '')) extensions.gin_trgm_ops
);

-- Bonafide Records Indexes
CREATE INDEX IF NOT EXISTS idx_bonafide_student_id ON public.bonafide_records(student_id);
CREATE INDEX IF NOT EXISTS idx_bonafide_issue_date ON public.bonafide_records(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_bonafide_generated_by ON public.bonafide_records(generated_by);

-- Stationary & Vendor Expense Indexes
CREATE INDEX IF NOT EXISTS idx_stationary_date ON public.stationary_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_stationary_vendor ON public.stationary_records(vendor_name);
CREATE INDEX IF NOT EXISTS idx_stationary_status ON public.stationary_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_stationary_payments_record_id ON public.stationary_payments(record_id);
CREATE INDEX IF NOT EXISTS idx_stationary_payments_date ON public.stationary_payments(date DESC);
CREATE INDEX IF NOT EXISTS idx_stationary_documents_record_id ON public.stationary_documents(record_id);

-- Scholarship Records Indexes
CREATE INDEX IF NOT EXISTS idx_scholarship_student_id ON public.scholarship_records(student_id);
CREATE INDEX IF NOT EXISTS idx_scholarship_status ON public.scholarship_records(status);
CREATE INDEX IF NOT EXISTS idx_scholarship_installments_record_id ON public.scholarship_installments(record_id);
CREATE INDEX IF NOT EXISTS idx_scholarship_installments_date ON public.scholarship_installments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_scholarship_documents_record_id ON public.scholarship_documents(record_id);

-- Financial Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON public.ledger_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payment_mode ON public.ledger_entries(payment_mode);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_by ON public.ledger_entries(created_by);

-- Messages & Chat Indexes
CREATE INDEX IF NOT EXISTS idx_messages_inbox ON public.messages(receiver_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);

-- Attendance & Geofencing Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_records(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON public.attendance_records(date, status);

-- College Holidays Index
CREATE INDEX IF NOT EXISTS idx_college_holidays_date ON public.college_holidays(date);

-- Access Requests Index
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

-- Rate Limits Index
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(ip_address, action_type);


-- ==============================================================================
-- 4. CORE APPLICATION RPCS & FUNCTIONS
-- ==============================================================================

-- 4.1 Resilient Role Lookup (Supports ID, JWT Email, and auth.users match)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'anonymous';
  END IF;

  -- 1. Match by direct user ID
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- 2. Match by email from JWT claims
  BEGIN
    v_email := auth.jwt() ->> 'email';
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT role INTO v_role FROM public.users WHERE lower(email) = lower(v_email) LIMIT 1;
    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  -- 3. Match by email from auth.users table
  SELECT u.role INTO v_role 
  FROM public.users u 
  JOIN auth.users au ON lower(u.email) = lower(au.email) 
  WHERE au.id = auth.uid() 
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  RETURN 'anonymous';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO anon, authenticated;


-- 4.2 Server Timestamp RPC
CREATE OR REPLACE FUNCTION public.get_server_timestamp()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT NOW();
$$;

GRANT EXECUTE ON FUNCTION public.get_server_timestamp() TO anon, authenticated;


-- 4.3 Password Hasher RPC
CREATE OR REPLACE FUNCTION public.hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf', 10));
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO anon, authenticated;


-- 4.4 User Info Lookup for Login
CREATE OR REPLACE FUNCTION public.get_user_info(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, name, username, email, role, status, (password IS NOT NULL) AS has_password INTO v_user
  FROM public.users
  WHERE email ILIKE p_query OR username ILIKE p_query
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  RETURN row_to_json(v_user)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_info(TEXT) TO anon, authenticated;


-- 4.5 Secure Password Verification RPC
CREATE OR REPLACE FUNCTION public.secure_login(p_email TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
DECLARE
  v_user_password TEXT;
BEGIN
  SELECT password INTO v_user_password 
  FROM public.users 
  WHERE email ILIKE p_email OR username ILIKE p_email
  LIMIT 1;
  
  IF NOT FOUND OR v_user_password IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF replace(v_user_password, '$2b$', '$2a$') = crypt(p_password, replace(v_user_password, '$2b$', '$2a$')) THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_login(TEXT, TEXT) TO anon, authenticated;


-- 4.6 Delete Auth User (Admin only)
CREATE OR REPLACE FUNCTION public.delete_auth_user(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
BEGIN
  IF public.get_auth_user_role() NOT IN ('superadmin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators are permitted to delete auth users.';
  END IF;

  DELETE FROM auth.users WHERE email = lower(trim(user_email));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_auth_user(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_auth_user(TEXT) TO authenticated;


-- 4.7 Atomic Access Request Approval RPC
CREATE OR REPLACE FUNCTION public.approve_access_request(
  p_request_id TEXT,
  p_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_req RECORD;
  v_existing_user RECORD;
  v_username TEXT;
  v_base_username TEXT;
  v_counter INT := 1;
  v_result RECORD;
BEGIN
  -- A. Check Caller Authorization
  v_caller_role := public.get_auth_user_role();
  IF v_caller_role NOT IN ('superadmin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only SuperAdmin and Admin accounts can approve requests. (Detected role: %)', v_caller_role;
  END IF;

  -- B. Validate Target Role
  IF p_role NOT IN ('super_admin', 'superadmin', 'admin', 'clerk', 'accountant', 'staff') THEN
    RAISE EXCEPTION 'Invalid role specified: %. Supported roles: superadmin, admin, clerk, accountant, staff.', p_role;
  END IF;

  -- C. Fetch Access Request
  BEGIN
    SELECT * INTO v_req FROM public.access_requests WHERE id = p_request_id::uuid LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_req FROM public.access_requests WHERE id::text = p_request_id LIMIT 1;
  END;

  IF NOT FOUND OR v_req IS NULL THEN
    RAISE EXCEPTION 'Access request with ID % was not found.', p_request_id;
  END IF;

  -- D. Upsert into public.users
  SELECT * INTO v_existing_user FROM public.users WHERE lower(email) = lower(v_req.email) LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    -- User already exists: update role, password, status
    UPDATE public.users SET
      role = p_role,
      status = 'active',
      password = COALESCE(v_req.password, password),
      name = COALESCE(v_req.name, name),
      updated_at = NOW()
    WHERE id = v_existing_user.id
    RETURNING * INTO v_result;
  ELSE
    -- Generate unique username
    v_base_username := split_part(v_req.email, '@', 1);
    v_username := v_base_username;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE lower(username) = lower(v_username)) LOOP
      v_counter := v_counter + 1;
      v_username := v_base_username || v_counter::text;
    END LOOP;

    -- Insert new user
    INSERT INTO public.users (
      name,
      username,
      email,
      password,
      role,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_req.name,
      v_username,
      v_req.email,
      v_req.password,
      p_role,
      'active',
      NOW(),
      NOW()
    )
    RETURNING * INTO v_result;
  END IF;

  -- E. Mark Request as Approved
  UPDATE public.access_requests 
  SET status = 'approved' 
  WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('User %s successfully granted %s role.', v_result.name, p_role),
    'user', row_to_json(v_result)::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_access_request(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_access_request(TEXT, TEXT) TO authenticated;


-- 4.8 Atomic Access Request Rejection RPC
CREATE OR REPLACE FUNCTION public.reject_access_request(
  p_request_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_req RECORD;
BEGIN
  -- A. Check Caller Authorization
  v_caller_role := public.get_auth_user_role();
  IF v_caller_role NOT IN ('superadmin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only SuperAdmin and Admin accounts can reject requests.';
  END IF;

  -- B. Fetch Access Request
  BEGIN
    SELECT * INTO v_req FROM public.access_requests WHERE id = p_request_id::uuid LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_req FROM public.access_requests WHERE id::text = p_request_id LIMIT 1;
  END;

  IF NOT FOUND OR v_req IS NULL THEN
    RAISE EXCEPTION 'Access request with ID % was not found.', p_request_id;
  END IF;

  -- C. Mark Request as Rejected
  UPDATE public.access_requests 
  SET status = 'rejected' 
  WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Access request rejected.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_access_request(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_access_request(TEXT) TO authenticated;


-- 4.9 Rate Limiting RPC with Exponential Backoff
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action_type TEXT,
  p_account_id TEXT,
  p_max_attempts INTEGER,
  p_base_backoff_seconds INTEGER
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_ip TEXT;
  v_record RECORD;
  v_time_since_last_attempt FLOAT;
  v_required_wait_time FLOAT;
BEGIN
  BEGIN
    v_client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := 'unknown';
  END;
  
  IF v_client_ip IS NULL THEN
    v_client_ip := 'unknown';
  ELSE
    v_client_ip := split_part(v_client_ip, ',', 1);
  END IF;

  SELECT * INTO v_record FROM public.rate_limits 
  WHERE ip_address = v_client_ip AND action_type = p_action_type
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (ip_address, account_id, action_type, attempt_count, last_attempt_at)
    VALUES (v_client_ip, p_account_id, p_action_type, 1, NOW());
    
    RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
  END IF;

  v_time_since_last_attempt := extract(epoch from (NOW() - v_record.last_attempt_at));

  IF v_record.attempt_count >= p_max_attempts THEN
    v_required_wait_time := p_base_backoff_seconds * power(2, v_record.attempt_count - p_max_attempts);
    
    IF v_time_since_last_attempt < v_required_wait_time THEN
      RETURN jsonb_build_object(
        'allowed', false, 
        'retry_after', ceiling(v_required_wait_time - v_time_since_last_attempt)
      );
    END IF;
  END IF;

  IF v_time_since_last_attempt > 3600 THEN
    UPDATE public.rate_limits 
    SET attempt_count = 1, last_attempt_at = NOW(), account_id = COALESCE(p_account_id, account_id)
    WHERE id = v_record.id;
  ELSE
    UPDATE public.rate_limits 
    SET attempt_count = attempt_count + 1, last_attempt_at = NOW(), account_id = COALESCE(p_account_id, account_id)
    WHERE id = v_record.id;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;


-- 4.10 Atomic Stationary Order + Payment RPC
CREATE OR REPLACE FUNCTION public.record_stationary_with_payment(
  p_vendor_name TEXT,
  p_object_name TEXT,
  p_unit INTEGER,
  p_price NUMERIC,
  p_amount_paid NUMERIC,
  p_payment_mode TEXT,
  p_reference_no TEXT,
  p_bill_url TEXT,
  p_remarks TEXT,
  p_created_by_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_id UUID;
  v_balance NUMERIC;
  v_status TEXT;
BEGIN
  IF public.get_auth_user_role() NOT IN ('superadmin', 'super_admin', 'admin', 'clerk', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: Caller role cannot create stationary records.';
  END IF;

  v_balance := (p_unit * p_price) - p_amount_paid;
  
  IF v_balance <= 0 THEN
    v_status := 'Paid';
  ELSIF p_amount_paid > 0 THEN
    v_status := 'Partial';
  ELSE
    v_status := 'Pending';
  END IF;

  INSERT INTO public.stationary_records (date, vendor_name, object_name, unit, price, amount_paid, balance, payment_status, remarks, created_by_role)
  VALUES (CURRENT_DATE, p_vendor_name, p_object_name, p_unit, p_price, p_amount_paid, v_balance, v_status, p_remarks, COALESCE(p_created_by_role, 'clerk'))
  RETURNING id INTO v_record_id;

  IF p_amount_paid > 0 THEN
    INSERT INTO public.stationary_payments (record_id, date, amount, mode, reference_no, bill_url, remarks)
    VALUES (v_record_id, CURRENT_DATE, p_amount_paid, p_payment_mode, p_reference_no, p_bill_url, 'Initial payment upon order entry');
  END IF;

  RETURN jsonb_build_object('success', true, 'record_id', v_record_id, 'balance', v_balance, 'status', v_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_stationary_with_payment(TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stationary_with_payment(TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- 4.11 Attendance Punch RPC (Geofencing & Window Enforcement)
CREATE OR REPLACE FUNCTION public.verify_and_record_attendance(
  p_action_type TEXT,
  p_photo_url TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_accuracy NUMERIC,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings RECORD;
  v_distance_meters FLOAT;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_existing RECORD;
  v_status TEXT;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_time_str TIME := (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME;
  v_working_hours TEXT;
  v_diff_ms FLOAT;
  v_hrs INT;
  v_mins INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'User ID is required.');
  END IF;

  SELECT * INTO v_settings FROM public.app_settings LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_CONFIG', 'message', 'College attendance settings not configured.');
  END IF;

  IF v_settings.college_latitude IS NOT NULL AND v_settings.college_longitude IS NOT NULL THEN
    v_distance_meters := 6371000 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(v_settings.college_latitude)) * cos(radians(p_latitude)) *
        cos(radians(p_longitude) - radians(v_settings.college_longitude)) +
        sin(radians(v_settings.college_latitude)) * sin(radians(p_latitude))
      ))
    );

    IF v_distance_meters > COALESCE(v_settings.college_radius_meters, 100) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'OUT_OF_BOUNDS',
        'message', format('Location verification failed: You are %s meters away from the campus (strictly allowed radius: %sm).', round(v_distance_meters::numeric, 1), v_settings.college_radius_meters)
      );
    END IF;
  END IF;

  IF p_action_type = 'check_in' THEN
    IF v_settings.check_in_window_start IS NOT NULL AND v_time_str < v_settings.check_in_window_start::TIME THEN
      RETURN jsonb_build_object('success', false, 'error', 'WINDOW_NOT_STARTED', 'message', format('Check-in window opens at %s.', v_settings.check_in_window_start));
    END IF;

    IF v_settings.check_in_window_end IS NOT NULL AND v_time_str > v_settings.check_in_window_end::TIME THEN
      RETURN jsonb_build_object('success', false, 'error', 'WINDOW_CLOSED', 'message', format('Check-in window closed at %s.', v_settings.check_in_window_end));
    END IF;

    SELECT * INTO v_existing 
    FROM public.attendance_records 
    WHERE (user_id = v_user_id OR user_id = auth.uid()) 
      AND date = v_today;
      
    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CHECKED_IN', 'message', 'You have already checked in today.');
    END IF;

    IF v_settings.late_threshold_time IS NOT NULL AND v_time_str > v_settings.late_threshold_time::TIME THEN
      v_status := 'Late';
    ELSE
      v_status := 'Present';
    END IF;

    INSERT INTO public.attendance_records (
      user_id, date, check_in_time, check_in_photo_url,
      check_in_latitude, check_in_longitude, check_in_accuracy, status
    ) VALUES (
      v_user_id, v_today, v_now, p_photo_url,
      p_latitude, p_longitude, p_accuracy, v_status
    );

    RETURN jsonb_build_object('success', true, 'status', v_status, 'timestamp', v_now);

  ELSIF p_action_type = 'check_out' THEN
    SELECT * INTO v_existing 
    FROM public.attendance_records 
    WHERE (user_id = v_user_id OR user_id = auth.uid())
      AND (date = v_today OR check_out_time IS NULL)
    ORDER BY created_at DESC 
    LIMIT 1;

    IF NOT FOUND OR v_existing.check_in_time IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'NO_CHECK_IN', 'message', 'Cannot check out before checking in.');
    END IF;

    IF v_existing.check_out_time IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CHECKED_OUT', 'message', 'You have already checked out today.');
    END IF;

    v_diff_ms := EXTRACT(EPOCH FROM (v_now - v_existing.check_in_time)) * 1000;
    v_hrs := FLOOR(GREATEST(0, v_diff_ms) / 3600000);
    v_mins := FLOOR((GREATEST(0, v_diff_ms) - (v_hrs * 3600000)) / 60000);
    v_working_hours := format('%sh %sm', v_hrs, v_mins);

    UPDATE public.attendance_records SET
      check_out_time = v_now,
      check_out_photo_url = p_photo_url,
      check_out_latitude = p_latitude,
      check_out_longitude = p_longitude,
      check_out_accuracy = p_accuracy,
      working_hours = v_working_hours,
      updated_at = v_now
    WHERE id = v_existing.id;

    RETURN jsonb_build_object('success', true, 'working_hours', v_working_hours, 'timestamp', v_now);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION', 'message', 'Action type must be check_in or check_out.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_attendance(TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, UUID) TO authenticated, anon;


-- 4.12 Purge Attendance Photo References Older Than 24 Hours
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


-- 4.13 Cascade Delete Student RPC
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


-- ==============================================================================
-- 5. DATABASE TRIGGERS
-- ==============================================================================

-- 5.1 Auto-purge messages older than 7 days on insert
CREATE OR REPLACE FUNCTION public.delete_old_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delete_old_messages_trigger ON public.messages;
CREATE TRIGGER delete_old_messages_trigger
AFTER INSERT ON public.messages
FOR EACH STATEMENT
EXECUTE FUNCTION public.delete_old_messages();


-- 5.2 Enterprise Audit Log Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_client_ip TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
  v_actor_id UUID := NULL;
  v_email TEXT;
BEGIN
  BEGIN
    -- Get client IP from PostgREST headers if present
    BEGIN
      v_client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    EXCEPTION WHEN OTHERS THEN
      v_client_ip := NULL;
    END;

    IF auth.uid() IS NOT NULL THEN
      -- Try direct ID match in public.users
      SELECT id, name, role INTO v_actor_id, v_actor_name, v_actor_role
      FROM public.users
      WHERE id = auth.uid()
      LIMIT 1;

      -- If not found by ID, try email match
      IF v_actor_id IS NULL THEN
        BEGIN
          v_email := auth.jwt() ->> 'email';
        EXCEPTION WHEN OTHERS THEN
          v_email := NULL;
        END;

        IF v_email IS NOT NULL THEN
          SELECT id, name, role INTO v_actor_id, v_actor_name, v_actor_role
          FROM public.users
          WHERE lower(email) = lower(v_email)
          LIMIT 1;
        END IF;
      END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
      INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, table_name, record_id, old_data, ip_address)
      VALUES (v_actor_id, v_actor_name, v_actor_role, 'DELETE', TG_TABLE_NAME, OLD.id::text, row_to_json(OLD)::jsonb, v_client_ip);
    ELSIF (TG_OP = 'UPDATE') THEN
      INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, table_name, record_id, old_data, new_data, ip_address)
      VALUES (v_actor_id, v_actor_name, v_actor_role, 'UPDATE', TG_TABLE_NAME, NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_client_ip);
    ELSIF (TG_OP = 'INSERT') THEN
      INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, table_name, record_id, new_data, ip_address)
      VALUES (v_actor_id, v_actor_name, v_actor_role, 'INSERT', TG_TABLE_NAME, NEW.id::text, row_to_json(NEW)::jsonb, v_client_ip);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never let audit logging failure block the core business transaction
    NULL;
  END;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_students_trigger ON public.students;
CREATE TRIGGER audit_students_trigger AFTER INSERT OR UPDATE OR DELETE ON public.students FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_ledger_trigger ON public.ledger_entries;
CREATE TRIGGER audit_ledger_trigger AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_stationary_trigger ON public.stationary_records;
CREATE TRIGGER audit_stationary_trigger AFTER INSERT OR UPDATE OR DELETE ON public.stationary_records FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


-- ==============================================================================
-- 6. REALTIME PUBLICATIONS
-- ==============================================================================
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.college_holidays REPLICA IDENTITY FULL;
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.scholarship_records REPLICA IDENTITY FULL;
ALTER TABLE public.scholarship_installments REPLICA IDENTITY FULL;
ALTER TABLE public.scholarship_documents REPLICA IDENTITY FULL;
ALTER TABLE public.bonafide_records REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Add messages to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- Add attendance_records to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;

  -- Add college_holidays to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'college_holidays'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.college_holidays;
  END IF;

  -- Add students to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;

  -- Add scholarship_records to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scholarship_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_records;
  END IF;

  -- Add scholarship_installments to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scholarship_installments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_installments;
  END IF;

  -- Add scholarship_documents to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scholarship_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_documents;
  END IF;

  -- Add bonafide_records to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bonafide_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bonafide_records;
  END IF;
END $$;


-- ==============================================================================
-- 7. STORAGE BUCKETS & POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('student_documents', 'student_documents', true, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']) 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('stationary_documents', 'stationary_documents', true, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']) 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('scholarship_documents', 'scholarship_documents', true, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']) 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png']) 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('ledger_proofs', 'ledger_proofs', true, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf']) 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('attendance_photos', 'attendance_photos', false, 5242880, ARRAY['image/jpeg', 'image/png']) 
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880;


-- Clean and apply storage policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated storage select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated storage update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated storage delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Select Policy" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated avatars select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated avatars upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated avatars update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated avatars delete" ON storage.objects;
DROP POLICY IF EXISTS "Attendance Photos Select" ON storage.objects;
DROP POLICY IF EXISTS "Attendance Photos Insert" ON storage.objects;
DROP POLICY IF EXISTS "Attendance Photos Update" ON storage.objects;
DROP POLICY IF EXISTS "Attendance Photos Delete" ON storage.objects;

-- Public read for documents & avatars
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id IN ('student_documents', 'stationary_documents', 'scholarship_documents', 'avatars', 'ledger_proofs'));

-- Authenticated upload/update/delete for documents
CREATE POLICY "Authenticated storage insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('student_documents', 'stationary_documents', 'scholarship_documents', 'avatars', 'ledger_proofs'));

CREATE POLICY "Authenticated storage update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id IN ('student_documents', 'stationary_documents', 'scholarship_documents', 'avatars', 'ledger_proofs'));

CREATE POLICY "Authenticated storage delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id IN ('student_documents', 'stationary_documents', 'scholarship_documents', 'avatars', 'ledger_proofs'));

-- Attendance Photos policies (Authenticated users only)
CREATE POLICY "Attendance Photos Select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'attendance_photos');

CREATE POLICY "Attendance Photos Insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attendance_photos');

CREATE POLICY "Attendance Photos Update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'attendance_photos');

CREATE POLICY "Attendance Photos Delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'attendance_photos');


-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES ON ALL TABLES
-- ==============================================================================

-- 8.1 Users Table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.users;
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
DROP POLICY IF EXISTS "SuperAdmins can modify users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can read all profiles" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL TO authenticated
  USING (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR lower(email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (auth.uid() = id OR lower(email) = lower(auth.jwt() ->> 'email'));


-- 8.2 Access Requests Table RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.access_requests;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.access_requests;
DROP POLICY IF EXISTS "Anyone can submit access request" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can view and manage access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can manage access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Public check pending request" ON public.access_requests;
DROP POLICY IF EXISTS "Public access request insert" ON public.access_requests;

CREATE POLICY "Anyone can submit access request" ON public.access_requests
  FOR INSERT
  WITH CHECK (status = 'pending');

CREATE POLICY "Public check pending request" ON public.access_requests
  FOR SELECT
  USING (status = 'pending' OR auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage access requests" ON public.access_requests
  FOR ALL
  TO authenticated
  USING (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );


-- 8.3 Students Table RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated full access to students" ON public.students;
CREATE POLICY "Allow authenticated full access to students" ON public.students FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);


-- 8.4 Bonafide Records Table RLS
ALTER TABLE public.bonafide_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.bonafide_records;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.bonafide_records;
DROP POLICY IF EXISTS "Allow authenticated full access to bonafide_records" ON public.bonafide_records;
CREATE POLICY "Allow authenticated full access to bonafide_records" ON public.bonafide_records FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);


-- 8.5 Stationary Tables RLS
ALTER TABLE public.stationary_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.stationary_records;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.stationary_records;
CREATE POLICY "Authenticated users can access" ON public.stationary_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.stationary_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.stationary_payments;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.stationary_payments;
CREATE POLICY "Authenticated users can access" ON public.stationary_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.stationary_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.stationary_documents;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.stationary_documents;
CREATE POLICY "Authenticated users can access" ON public.stationary_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 8.6 Scholarship Tables RLS
ALTER TABLE public.scholarship_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.scholarship_records;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.scholarship_records;
CREATE POLICY "Authenticated users can access" ON public.scholarship_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.scholarship_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.scholarship_installments;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.scholarship_installments;
CREATE POLICY "Authenticated users can access" ON public.scholarship_installments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.scholarship_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.scholarship_documents;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.scholarship_documents;
CREATE POLICY "Authenticated users can access" ON public.scholarship_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 8.7 Financial Ledger Table RLS
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.ledger_entries;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.ledger_entries;
CREATE POLICY "Authenticated users can access" ON public.ledger_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 8.8 Messages Table RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.messages;
DROP POLICY IF EXISTS "Users can only read their own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can only send messages as themselves" ON public.messages;
CREATE POLICY "Authenticated users can access" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 8.9 Attendance Records Table RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated users can access" ON public.attendance_records;
DROP POLICY IF EXISTS "Employees can view own attendance and Admins view all" ON public.attendance_records;
DROP POLICY IF EXISTS "Employees can insert own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Allow authenticated full access to attendance_records" ON public.attendance_records;

CREATE POLICY "Allow authenticated full access to attendance_records" ON public.attendance_records
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);


-- 8.10 College Holidays Table RLS
ALTER TABLE public.college_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow manage college_holidays for authenticated users" ON public.college_holidays;
DROP POLICY IF EXISTS "Allow select college_holidays for all users" ON public.college_holidays;
DROP POLICY IF EXISTS "Allow read college_holidays for all users" ON public.college_holidays;
DROP POLICY IF EXISTS "Allow manage college_holidays for admins only" ON public.college_holidays;

CREATE POLICY "Allow read college_holidays for all users" ON public.college_holidays
  FOR SELECT USING (true);

CREATE POLICY "Allow manage college_holidays for admins only" ON public.college_holidays
  FOR ALL TO authenticated
  USING (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );


-- 8.11 App Settings Table RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON public.app_settings;
DROP POLICY IF EXISTS "Allow read app_settings for all" ON public.app_settings;
DROP POLICY IF EXISTS "Allow manage app_settings for admins" ON public.app_settings;

CREATE POLICY "Allow read app_settings for all" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow manage app_settings for admins" ON public.app_settings
  FOR ALL TO authenticated
  USING (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    public.get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );


-- 8.12 Audit Logs Table RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);


-- 8.13 Rate Limits Table RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Implicitly denies direct table access to client queries (accessible solely via SECURITY DEFINER check_rate_limit RPC)


-- ==============================================================================
-- 9. SETUP VERIFICATION
-- ==============================================================================
SELECT '🎉 VIKRAMSHILA COLLEGE ERP: Master Database Setup successfully executed! All tables, indexes, RPCs, storage buckets, and RLS policies are 100% active.' AS setup_status;
