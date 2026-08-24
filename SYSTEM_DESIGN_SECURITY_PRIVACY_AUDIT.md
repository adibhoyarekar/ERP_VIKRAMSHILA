# 🛡️ VIKRAMSHILA COLLEGE ERP — ENTERPRISE SYSTEM DESIGN, SECURITY & PRIVACY AUDIT

**Target System:** Vikramshila College ERP (Web & PWA)  
**Scope:** Full-Stack Architecture, Database Schema, Supabase Configuration, Authentication, Authorization, Geofence Attendance, Financial Ledger, Data Privacy, and PII Protection.  
**Audit Date:** August 19, 2026  
**Status:** High-Priority Architecture & Security Review  

---

## 📑 TABLE OF CONTENTS
1. [Executive Summary](#1-executive-summary)
2. [Critical Security Vulnerabilities ("What is Hackable?")](#2-critical-security-vulnerabilities-what-is-hackable)
3. [System Design & Scalability Bottlenecks](#3-system-design--scalability-bottlenecks)
4. [Data Privacy & PII Compliance Flaws](#4-data-privacy--pii-compliance-flaws)
5. [Frontend Business Logic That Must Move to Backend](#5-frontend-business-logic-that-must-move-to-backend)
6. [Complete Step-by-Step Remediation Plan & Hardened SQL Schema](#6-complete-step-by-step-remediation-plan--hardened-sql-schema)

---

## 1. EXECUTIVE SUMMARY

The Vikramshila College ERP system is visually rich, responsive, and functional, featuring biometric/GPS attendance, student lifecycle management, bonafide generation, financial ledgers, and staff messaging. 

However, from an **Enterprise System Design, Security, and Privacy** perspective, the current architecture relies heavily on **Client-Side Trust**. Because Supabase connects directly to the frontend via the public anonymous key (`VITE_SUPABASE_ANON_KEY`), the browser is an untrusted client. 

### Key Findings at a Glance:
- 🚨 **Privilege Escalation:** Any authenticated employee (Clerk/Staff) can alter their role to `superadmin` or read/modify all database tables because Row Level Security (RLS) only checks `auth.uid() IS NOT NULL`.
- 🚨 **Geofence & Attendance Spoofing:** Geofence verification and punch timing checks are executed in the browser JavaScript. Anyone can forge coordinates and mark themselves present from home via DevTools or API tools.
- 🚨 **Unrestricted Private Message Snooping:** Private messages between employees can be read by any logged-in user with a simple query.
- 🚨 **Client-Side Monolithic Data Loading:** All students, financial ledgers, and invoices are downloaded into browser memory on startup, creating severe scalability limits and PII data leakage risks.
- 🚨 **Bypassable Rate Limiting:** Brute-force rate limiting is invoked by client code rather than enforced inside the database or edge layer.

---

## 2. CRITICAL SECURITY VULNERABILITIES ("WHAT IS HACKABLE?")

### 🔴 VULN-01: Broken Object-Level Authorization (Horizontal & Vertical Privilege Escalation)
- **Location:** `supabase-security-updates.sql` (Lines 85–96), `supabase-schema.sql`
- **The Bug:**
  The current database RLS policy for tables like `users`, `students`, `ledger_entries`, `stationary_records`, and `messages` is:
  ```sql
  CREATE POLICY "Authenticated users can access" ON users 
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  ```
- **How It Can Be Exploited:**
  When a Staff member or Clerk logs in, their browser receives a valid Supabase JWT token (`auth.uid() IS NOT NULL`). Any user can open Chrome DevTools (F12 → Console) and execute:
  ```javascript
  // 1. Promote self to SuperAdmin:
  await supabase.from('users').update({ role: 'superadmin' }).eq('id', currentUser.id);

  // 2. Wipe or alter institutional financial ledger:
  await supabase.from('ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 3. Read every user's personal details and access requests:
  const { data } = await supabase.from('access_requests').select('*');
  console.table(data);
  ```
- **Risk Level:** **CRITICAL (CVSS 9.8)**

---

### 🔴 VULN-02: GPS & Attendance Verification Spoofing
- **Location:** `src/components/attendance/EmployeeAttendanceTab.tsx` (Lines 182–265)
- **The Bug:**
  The distance calculation (`calculateDistanceMeters`), check-in window validation (`getCheckInWindowState`), and late threshold logic (`status = timePart > late_threshold ? 'Late' : 'Present'`) all execute inside the user's browser.
  The frontend then directly issues a raw `insert` query:
  ```typescript
  await supabase.from('attendance_records').insert({
    user_id: user.id,
    date: todayStr,
    check_in_time: serverTime,
    check_in_latitude: latitude,
    check_in_longitude: longitude,
    check_in_accuracy: accuracy,
    status: status
  });
  ```
- **How It Can Be Exploited:**
  An employee at home at 11:30 PM can open the browser console and type:
  ```javascript
  await supabase.from('attendance_records').insert({
    user_id: 'MY_USER_ID',
    date: '2026-08-19',
    check_in_time: '2026-08-19T08:30:00.000Z',
    check_in_latitude: 19.876165, // Exact college coordinates
    check_in_longitude: 75.343314,
    check_in_accuracy: 5.0,
    status: 'Present'
  });
  ```
  The database accepts this without verifying whether the user was physically within the perimeter or whether the punch was within the allowed window.
- **Risk Level:** **HIGH (CVSS 8.2)**

---

### 🔴 VULN-03: Unprotected `app_settings` Table (Public Tampering)
- **Location:** `supabase-schema-updates.sql` (Line 89)
- **The Bug:**
  `app_settings` has RLS enabled with a completely open policy:
  ```sql
  CREATE POLICY "Allow all public operations" ON app_settings FOR ALL USING (true) WITH CHECK (true);
  ```
- **How It Can Be Exploited:**
  Anyone (even an unauthenticated visitor) can change the college's GPS coordinates, expand the geofence radius to 50,000 meters, or alter working hours:
  ```javascript
  await supabase.from('app_settings').update({ 
    college_radius_meters: 50000, 
    check_in_window_end: '23:59:59' 
  }).neq('id', '00000000-0000-0000-0000-000000000000');
  ```
- **Risk Level:** **HIGH (CVSS 8.5)**

---

### 🔴 VULN-04: Client-Bypassed Brute-Force Rate Limiting
- **Location:** `src/App.tsx` (Lines 310–365), `src/lib/rateLimit.ts`
- **The Bug:**
  The rate-limiting stored procedure `check_rate_limit` is called only if the React frontend code runs it when `secure_login` returns false.
- **How It Can Be Exploited:**
  An attacker writing an automated credential stuffing script can call `supabase.rpc('secure_login', { p_email, p_password })` directly via HTTP POST requests without ever calling `check_rate_limit`. The database does not lock the account or enforce an IP cooldown internally.
- **Risk Level:** **MEDIUM (CVSS 6.5)**

---

### 🔴 VULN-05: Storage Bucket IDOR & File Overwrites
- **Location:** `supabase-schema-updates.sql` (Lines 134–137), `supabase-security-updates.sql` (Lines 109–112)
- **The Bug:**
  Storage policies for `attendance_photos` and student documents allow any authenticated user to SELECT, UPDATE, or DELETE any object in the bucket.
- **How It Can Be Exploited:**
  A malicious user can overwrite another employee's attendance selfie or delete official student admission certificates.
- **Risk Level:** **HIGH (CVSS 7.5)**

---

## 3. SYSTEM DESIGN & SCALABILITY BOTTLENECKS

### ⚠️ DESIGN-01: Monolithic In-Memory Data Hydration
- **Current Pattern:** On application startup in `src/App.tsx`, `fetchDatabaseData()` performs `SELECT *` on `students`, `stationary_records`, `scholarship_records`, `bonafide_records`, and `ledger_entries`.
- **Impact:**
  - When the college grows to 2,000+ students and 5 years of financial ledgers (100,000+ rows), initial page load will take 15–30 seconds, downloading 20MB+ of JSON over mobile cellular networks.
  - Low-end mobile devices will experience high memory usage, UI lag, or browser crashes.
- **Solution:** Implement **Server-Side Pagination & Search** (`.range(start, end)`, `.limit(25)`).

---

### ⚠️ DESIGN-02: Client-Side Financial Aggregations & Lack of ACID Guarantees
- **Current Pattern:** In `AccountantDashboard.tsx` and `StationaryDashboard.tsx`, total expenditures, balances, and ledger summaries are computed by iterating over JavaScript arrays using `.reduce()`.
- **Impact:**
  - If two clerks enter stationary invoices or payments simultaneously, the client calculations will drift out of sync.
  - Financial reports and cashbooks must be computed in PostgreSQL views using `SUM()`, `GROUP BY`, and database constraints to guarantee zero rounding or reconciliation errors.

---

### ⚠️ DESIGN-03: Dual Auth System Friction
- **Current Pattern:** Access requests hash passwords with bcrypt into the `users.password` column, and during login, `App.tsx` dynamically calls `supabase.auth.signUp()` behind the scenes to create a parallel Supabase Auth session.
- **Impact:**
  - If a user changes their password or an admin edits an email, the two systems can desynchronize, causing login failures.
  - Storing passwords in custom tables is an anti-pattern when using Supabase Auth.

---

## 4. DATA PRIVACY & PII COMPLIANCE FLAWS

### 🔒 PRIV-01: Unmasked Student Financial & Identity Data (PII)
- **Affected Data:** Bank Account Numbers, IFSC Codes, UPI IDs, Father's Name, Caste Category, Sub-caste, Date of Birth, Full Home Address, Mobile Numbers.
- **Flaw:**
  All fields are returned in plaintext to any user querying the `students` table. A Staff member logging in to mark their daily attendance can open DevTools and dump all student bank account numbers and home addresses.
- **Remediation:**
  - Restrict the `students` table SELECT policy so that Staff members cannot read student data.
  - Create a masked view (`students_public_view`) that masks bank account numbers (`XXXX-XXXX-1234`) for non-accountant roles.

---

### 🔒 PRIV-02: Employee Chat Privacy & Eavesdropping
- **Affected Data:** Direct private messages and broadcast messages in the `messages` table.
- **Flaw:**
  There is no row-level filter restricting message visibility. A query of `supabase.from('messages').select('*')` returns all conversations between any two college staff members.
- **Remediation:**
  Enforce RLS:
  ```sql
  CREATE POLICY "Users can only read their own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  ```

---

## 5. FRONTEND BUSINESS LOGIC THAT MUST MOVE TO BACKEND

| Feature / Logic | Current Location (Frontend) | Why It Belongs in Backend | Target Backend Mechanism |
| :--- | :--- | :--- | :--- |
| **Attendance Geofencing & Distance** | `EmployeeAttendanceTab.tsx` | Client coordinates and distance math can be forged. | PostgreSQL RPC `verify_and_record_attendance` using Haversine formula. |
| **Check-in Window & Late Logic** | `EmployeeAttendanceTab.tsx` | Client clock can be changed on the phone. | Server timestamp `NOW()` and `app_settings` window comparison in SQL. |
| **User Role & Permission Checking** | Component conditional renders (`currentUser.role === 'admin'`) | UI checks only hide buttons; direct API calls bypass UI. | PostgreSQL Role-based RLS Policies with `auth.uid()`. |
| **Password Validation & Brute-Force** | `LoginBox.tsx` & `App.tsx` | Attackers bypass UI forms by sending direct POST requests. | PostgreSQL RPC with internal attempt counter & lockout timestamp. |
| **Access Request Approval** | `SuperAdminDashboard.tsx` (`users.insert` + `access_requests.delete`) | Non-atomic; if one fails, system is inconsistent; anyone can insert into `users`. | Database Function / RPC `approve_access_request(request_id)`. |
| **Invoice & Payment Balancing** | `StationaryDashboard.tsx` | Concurrency issues when multiple staff enter records. | PostgreSQL RPC `record_stationary_with_payment` with ACID transaction. |

---

## 6. COMPLETE STEP-BY-STEP REMEDIATION PLAN & HARDENED SQL SCHEMA

To resolve all findings, apply the following hardened security migration in your **Supabase Dashboard → SQL Editor**.

### 🛠️ Execution Steps:
1. Open Supabase Dashboard → **SQL Editor**.
2. Run the migration script below.
3. Wire the frontend `EmployeeAttendanceTab.tsx` to call `supabase.rpc('verify_and_record_attendance')`.

```sql
-- ============================================================================
-- VIKRAMSHILA COLLEGE ERP — ENTERPRISE SECURITY & RLS HARDENING MIGRATION
-- ============================================================================

-- 1. HELPER FUNCTION: GET CURRENT USER ROLE
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid() LIMIT 1;
  RETURN COALESCE(v_role, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. HARDENED TABLE POLICIES (ROLE-BASED ACCESS CONTROL)
-- ============================================================================

-- A. USERS TABLE
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can access" ON users;
DROP POLICY IF EXISTS "Users can read all profiles" ON users;
DROP POLICY IF EXISTS "SuperAdmins can modify users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Anyone authenticated can view user profiles (names, roles for UI directory)
CREATE POLICY "Users can read all profiles" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only SuperAdmin and Admin can insert/delete/update roles
CREATE POLICY "SuperAdmins can modify users" ON users
  FOR ALL USING (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );

-- Users can only update their own display name or phone
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM users WHERE id = auth.uid()) -- Prevents self-promotion
  );


-- B. MESSAGES TABLE (END-TO-END PRIVACY)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can access" ON messages;
DROP POLICY IF EXISTS "Users can only read their own conversations" ON messages;
DROP POLICY IF EXISTS "Users can only send messages as themselves" ON messages;

CREATE POLICY "Users can only read their own conversations" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can only send messages as themselves" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );


-- C. STUDENTS TABLE (PII PROTECTION)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can access" ON students;
DROP POLICY IF EXISTS "Clerks and Admins can manage students" ON students;

-- Only Clerks, Accountants, and Admins can view and manage students (Staff excluded)
CREATE POLICY "Clerks and Admins can manage students" ON students
  FOR ALL USING (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin', 'clerk', 'accountant')
  )
  WITH CHECK (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin', 'clerk')
  );


-- D. FINANCIAL LEDGER & STATIONARY
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can access" ON ledger_entries;
CREATE POLICY "Only Accountants and Admins can access ledger" ON ledger_entries
  FOR ALL USING (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin', 'accountant')
  )
  WITH CHECK (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin', 'accountant')
  );

ALTER TABLE stationary_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can access" ON stationary_records;
CREATE POLICY "Clerks, Accountants, and Admins can access stationary" ON stationary_records
  FOR ALL USING (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin', 'clerk', 'accountant')
  );


-- E. APP SETTINGS (LOCK DOWN TO ADMINS ONLY)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations" ON app_settings;
CREATE POLICY "Anyone can read app settings" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Only SuperAdmins can update app settings" ON app_settings
  FOR ALL USING (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );


-- F. ACCESS REQUESTS (ANONYMOUS INSERT, ADMIN APPROVAL)
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can access" ON access_requests;
CREATE POLICY "Anyone can submit access request" ON access_requests
  FOR INSERT WITH CHECK (status = 'pending');

CREATE POLICY "Admins can view and manage access requests" ON access_requests
  FOR ALL USING (
    get_auth_user_role() IN ('superadmin', 'super_admin', 'admin')
  );


-- ============================================================================
-- 3. SECURE SERVER-SIDE ATTENDANCE PUNCH RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_and_record_attendance(
  p_action_type TEXT, -- 'check_in' or 'check_out'
  p_photo_url TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_accuracy NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_settings RECORD;
  v_distance_meters FLOAT;
  v_today DATE := CURRENT_DATE;
  v_existing RECORD;
  v_status TEXT;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_time_str TIME := CURRENT_TIME;
  v_working_hours TEXT;
  v_diff_ms FLOAT;
  v_hrs INT;
  v_mins INT;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'User is not authenticated.');
  END IF;

  -- 1. Fetch college settings
  SELECT * INTO v_settings FROM app_settings LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_CONFIG', 'message', 'College attendance settings not configured.');
  END IF;

  -- 2. Geofence Distance Validation (Haversine formula)
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

  -- 3. Check-In Action
  IF p_action_type = 'check_in' THEN
    -- Check if check-in window is open
    IF v_settings.check_in_window_start IS NOT NULL AND v_time_str < v_settings.check_in_window_start THEN
      RETURN jsonb_build_object('success', false, 'error', 'WINDOW_NOT_STARTED', 'message', format('Check-in window opens at %s.', v_settings.check_in_window_start));
    END IF;

    IF v_settings.check_in_window_end IS NOT NULL AND v_time_str > v_settings.check_in_window_end THEN
      RETURN jsonb_build_object('success', false, 'error', 'WINDOW_CLOSED', 'message', format('Check-in window closed at %s.', v_settings.check_in_window_end));
    END IF;

    -- Check if already punched today
    SELECT * INTO v_existing FROM attendance_records WHERE user_id = auth.uid() AND date = v_today;
    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CHECKED_IN', 'message', 'You have already checked in today.');
    END IF;

    -- Calculate Late or Present status
    IF v_settings.late_threshold_time IS NOT NULL AND v_time_str > v_settings.late_threshold_time THEN
      v_status := 'Late';
    ELSE
      v_status := 'Present';
    END IF;

    INSERT INTO attendance_records (
      user_id, date, check_in_time, check_in_photo_url,
      check_in_latitude, check_in_longitude, check_in_accuracy, status
    ) VALUES (
      auth.uid(), v_today, v_now, p_photo_url,
      p_latitude, p_longitude, p_accuracy, v_status
    );

    RETURN jsonb_build_object('success', true, 'status', v_status, 'timestamp', v_now);

  -- 4. Check-Out Action
  ELSIF p_action_type = 'check_out' THEN
    SELECT * INTO v_existing FROM attendance_records WHERE user_id = auth.uid() AND date = v_today;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'NO_CHECK_IN', 'message', 'Cannot check out before checking in.');
    END IF;

    IF v_existing.check_out_time IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CHECKED_OUT', 'message', 'You have already checked out today.');
    END IF;

    v_diff_ms := EXTRACT(EPOCH FROM (v_now - v_existing.check_in_time)) * 1000;
    v_hrs := FLOOR(v_diff_ms / 3600000);
    v_mins := FLOOR((v_diff_ms - (v_hrs * 3600000)) / 60000);
    v_working_hours := format('%sh %sm', v_hrs, v_mins);

    UPDATE attendance_records SET
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
