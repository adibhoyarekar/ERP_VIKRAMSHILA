# Vikramshila College ERP System — Comprehensive Project Documentation

Welcome to the official documentation for the **Vikramshila College Of Fashion Design ERP System**. This document provides an exhaustive, in-depth breakdown of the project architecture, supported user roles, dashboard functionality, features, data models, and database schema.

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Technology Stack & Architecture](#-technology-stack--architecture)
3. [User Roles & Permission Hierarchy](#-user-roles--permission-hierarchy)
4. [Authentication & Access Request Workflow](#-authentication--access-request-workflow)
5. [In-Depth Dashboard Breakdown](#-in-depth-dashboard-breakdown)
   - [5.1 Super Admin & Admin Dashboard](#51-super-admin--admin-dashboard)
   - [5.2 Clerk / Administrative Staff Dashboard](#52-clerk--administrative-staff-dashboard)
   - [5.3 Accountant Dashboard](#53-accountant-dashboard)
6. [Core Functional Modules](#-core-functional-modules)
   - [Student Lifecycle & Registration](#student-lifecycle--registration)
   - [Document Management](#document-management)
   - [Stationary & Vendor Expense Management](#stationary--vendor-expense-management)
   - [Scholarship Tracking & Disbursement](#scholarship-tracking--disbursement)
   - [Bonafide Certificate Generation](#bonafide-certificate-generation)
   - [Financial Ledger Management](#financial-ledger-management)
7. [Database Schema & Data Architecture](#-database-schema--data-architecture)
8. [Data Sync & Fallback System](#-data-sync--fallback-system)
9. [Getting Started & Local Development](#-getting-started--local-development)

---

## 🏛️ Project Overview

The **Vikramshila College ERP System** is a full-featured Enterprise Resource Planning web application designed specifically for **Vikramshila College Of Fashion Design** (a Government Authorized Institution).

It streamlines academic administration, student lifecycle management, document verification, financial ledger tracking, scholarship disbursement, vendor expenses (stationary), and official certificate issuance (Bonafide certificates).

---

## 🛠️ Technology Stack & Architecture

- **Frontend Framework**: React 18 with TypeScript
- **Build Tooling**: Vite
- **Styling**: Vanilla CSS + Tailwind CSS for responsive grid layouts and utility classes
- **Icons**: Lucide React
- **Animations**: Framer Motion (`motion/react`) & Tailwind Animations (custom keyframes, pulse, ping effects)
- **Backend & Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth + custom Bcrypt hashing for fallback password validation
- **Storage**: Supabase Storage Buckets for document uploads, bill proofs, and receipts

---

## 👥 User Roles & Permission Hierarchy

The system defines 4 primary administrative roles, each bound to specific security permissions and operational boundaries:

| Role Code | Role Name | Primary Responsibility | Access Scope |
| :--- | :--- | :--- | :--- |
| `super_admin` / `superadmin` | **Super Administrator** | System oversight, security, access request approvals, full data management | Complete system read/write across all modules, user administration, access request processing |
| `admin` | **Principal / Administrator** | Academic management, student database monitoring, financial auditing | Complete dashboard access, student data review, financial overview (read-only for user creation) |
| `clerk` | **Administrative Clerk** | Student admissions, profile management, document collection, bonafide certificates | Full CRUD on Students, Registration, Bonafide generation, Stationary entry, Scholarship tracking |
| `accountant` | **Financial Accountant** | Institutional ledger, financial records, vendor payments, expense tracking | Full management of Ledger entries, Stationary payment settlements, Scholarship financial auditing |

---

## 🔐 Authentication & Access Request Workflow

### 1. User Sign-In (`LoginBox.tsx`)
- Users log in using their registered email and password.
- Password validation uses **bcryptjs** hashing to verify credentials securely.
- Role-based redirection opens the appropriate dashboard immediately upon authentication.

### 2. Access Request Flow (`LoginBox.tsx` & `App.tsx`)
- New staff members or clerks without an active account can click **"Request Access"**.
- Features real-time password strength verification checklist:
  - Minimum 8 characters
  - At least 1 uppercase letter (`A-Z`)
  - At least 1 lowercase letter (`a-z`)
  - At least 1 digit (`0-9`)
  - At least 1 special character (`!@#$%^&*`)
- **Interactive Submission Animation**: When a user submits an access request, a visual pulse/ping animation (`animate-ping`) with a green success badge appears for 2.5 seconds before smoothly transitioning back to the login screen.
- **Admin Approval**: Access requests enter a `pending` state in the `access_requests` table. A Super Admin must review and **Approve** the request in the Super Admin Dashboard before the user can sign in.

---

## 📊 In-Depth Dashboard Breakdown

### 5.1 Super Admin & Admin Dashboard (`SuperAdminDashboard.tsx`)

Designed for executive leadership and IT administrators.

#### Key Features & Tabs:
1. **Overview Tab**:
   - High-level metric cards: Total System Users, Pending Access Requests, Total Enrolled Students, Total Stationary Expenses, Active Scholarships, Net Financial Balance.
   - Quick tables for recent student admissions and recent stationary expenses.
2. **Access Requests Tab**:
   - List of pending account registration requests.
   - One-click **Approve** (automatically provisions a user account in the `users` table) or **Reject**.
3. **User Management Tab**:
   - View all registered system users, their roles, email addresses, and account status.
   - Ability to create new system users directly or delete/revoke user access.
4. **Students Database (Read-Only View)**:
   - Full search and filter controls across enrolled fashion design students.
5. **Stationary & Expense Audit**:
   - Comprehensive log of vendor orders, units purchased, total cost, amount paid, and pending balances.
6. **Scholarship Monitoring**:
   - Financial audit of scholarship funds sanctioned vs. received by students.
7. **Financial Ledger View**:
   - Read/write access to credit and debit entries in the college ledger.

---

### 5.2 Clerk / Administrative Staff Dashboard (`ClerkDashboard.tsx`)

Designed for frontline office staff handling daily operations, student onboarding, and official documentation.

#### Key Features & Tabs:
1. **Dashboard Overview**:
   - Quick action grid to jump into Student Registration, Document Verification, Bonafide Generation, or Expense Tracking.
   - Summary of total students, incomplete document alerts, and pending scholarships.
2. **Student Management Tab (`StudentsTab`)**:
   - Search by Name, Enrollment ID, PRN Number, or Course.
   - Category filtering (General, OBC, SC, ST, VJNT, SBC, etc.).
   - Full student profile drawer with tabbed navigation: Personal Info, Academic Details, Bank & UPI Details (for direct scholarship disbursements), and Uploaded Documents.
   - Real-time profile completion percentage calculation.
3. **New Student Registration Tab (`RegistrationTab.tsx`)**:
   - Multi-step comprehensive admission form:
     - **Personal Info**: Full Name, DOB, Category, Sub-caste, Father's Name, Contact Number, Alternate Phone, Email.
     - **Academic Info**: Course (e.g., Diploma in Fashion Design, B.Des, Advanced Apparel Design), Branch, Admission Date, Semester, Batch Year, PRN Number, Roll Number.
     - **Bank Details**: Bank Name, Account Number, IFSC Code, Branch, Account Holder Name, UPI ID, UPI App (PhonePe, GPay, Paytm).
     - **Mandatory Document Checklist**: Marksheet, Leaving Certificate, Caste Certificate, Aadhaar Card, Income Certificate, Domicile.
4. **Document Manager (`DocumentsTab`)**:
   - Filters students with missing or incomplete documentation.
   - Direct file upload support to Supabase `student_documents` storage bucket.
5. **Bonafide Certificates (`BonafideTab.tsx`)**:
   - Search student database and generate official college Bonafide Certificates.
   - Custom purpose selector: Bus Pass, Bank Account Opening, Scholarship Application, Passport Verification, Hostel Admission, Custom Purpose.
   - Live PDF-styled printable certificate preview complete with college logo, official seal watermark, reference numbers, issue date, and validity date.
6. **Stationary & Other Expenses (`StationaryDashboard.tsx`)**:
   - Log vendor purchases (e.g., fabric, sewing supplies, paper, office supplies).
   - Track partial payments and remaining balances.
7. **Scholarships Tab (`ScholarshipDashboard.tsx`)**:
   - Register students for government or private scholarship schemes.
   - Track multi-installment disbursements, payment modes, transaction reference numbers, and upload payment receipts.

---

### 5.3 Accountant Dashboard (`AccountantDashboard.tsx`)

Tailored for financial officers and bursars managing institutional income, expenses, and cash flow.

#### Key Features & Tabs:
1. **Financial Overview**:
   - Executive dashboard displaying Total Income, Total Expenses, Net Cash Balance, and Outstanding Vendor Liabilities.
   - Breakdown of payment distribution (Cash vs. UPI vs. Bank Transfer vs. Cheque).
2. **Ledger Management Tab (`LedgerDashboard.tsx`)**:
   - Record formal accounting transactions.
   - Attach digital payment proofs (receipts, transaction screenshots, bank deposit slips).
   - Cheque tracking (cheque number, bank clearance status).
3. **Stationary & Vendor Expense Settlement**:
   - Settle pending balances with vendors.
   - Add installment payments to existing stationary records.
4. **Scholarship Financial Audit**:
   - Read-only financial tracking of funds allocated and disbursed to students.

---

## ⚡ Core Functional Modules

### 1. Student Lifecycle & Registration
- Full CRUD operations on student records.
- Unique Enrollment ID and PRN generation.
- Course, Branch, Semester, and Academic Year assignment.
- Category-wise analytics (OBC, SC, ST, General).

### 2. Bonafide Certificate Generator
- Built-in official document generator adhering to institution standards.
- Instant print/save as PDF support.
- Audit trail logging every generated certificate into `bonafide_records`.

### 3. Stationary & Expense Management
- Track material requirements, vendor names, unit counts, price per unit, amount paid, and balance due.
- Payment status auto-updating (`Paid`, `Partial`, `Pending`).

### 4. Scholarship Disbursement Tracking
- Tracks total sanctioned scholarship vs. actual received amount.
- Freeship flag support for eligible categories.
- Multi-installment payment recording with reference IDs.

### 5. Institutional Financial Ledger
- Detailed debit and credit logs.
- Proof upload support with storage bucket integration.

---

## 🗄️ Database Schema & Data Architecture

The application operates on a PostgreSQL schema managed via Supabase (`supabase-schema.sql`).

### Core Tables Summary:

| Table Name | Description | Key Fields |
| :--- | :--- | :--- |
| `users` | System user accounts | `id`, `name`, `username`, `email`, `password`, `role`, `status` |
| `access_requests` | Pending account requests | `id`, `name`, `email`, `password`, `date`, `status` |
| `students` | Master student directory | `id`, `enrollment_id`, `name`, `course`, `branch`, `category`, `bank_account_no`, `prn_no`, `profile_completion` |
| `bonafide_records` | Issued bonafide log | `id`, `student_id`, `purpose`, `issue_date`, `valid_until`, `generated_by` |
| `stationary_records`| Expense & vendor bills | `id`, `date`, `vendor_name`, `object_name`, `unit`, `price`, `amount_paid`, `balance`, `payment_status` |
| `stationary_payments`| Installment payments | `id`, `record_id`, `date`, `amount`, `mode`, `reference_no` |
| `scholarship_records`| Student scholarships | `id`, `student_id`, `scholarship_name`, `sanctioned_amount`, `amount_received`, `amount_pending`, `status` |
| `scholarship_installments`| Scholarship payments | `id`, `record_id`, `installment_number`, `amount_received`, `payment_mode`, `transaction_ref`, `is_freeship` |
| `ledger_entries` | Financial ledger entries | `id`, `date`, `description`, `amount`, `payment_mode`, `cheque_no`, `proof_url` |

### Storage Buckets:
- `student_documents`: Student marksheets, certificates, Aadhaar scans.
- `stationary_documents`: Vendor invoices and receipts.
- `scholarship_documents`: Scholarship approval letters & sanction proofs.
- `ledger_proofs`: Financial payment proofs and bank slips.
- `avatars`: User and student profile photos.

---

## 🔄 Data Sync & Fallback System

- The application automatically attempts to connect to **Supabase** upon loading.
- If Supabase environment variables or connection fail, the app gracefully falls back to local in-memory state and mock data structures (`src/data/mockData.ts`), ensuring uninterrupted operation and UI demonstration.

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd erp-vikramshila-college
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Execute Database Setup**:
   Copy the SQL contents from `supabase-schema.sql` into your Supabase SQL Editor and execute to set up tables, RLS policies, and storage buckets.

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

*Documentation maintained for Vikramshila College Of Fashion Design ERP System.*
