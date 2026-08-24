# 🏫 Vikramshila College Of Fashion Design — ERP System

An end-to-end Enterprise Resource Planning (ERP) platform designed for **Vikramshila College Of Fashion Design** to streamline academic administration, student lifecycle management, document verification, financial ledger tracking, scholarship disbursement, vendor expenses (stationary), and official certificate issuance.

---

## 📄 Full In-Depth Documentation

For the comprehensive, detailed breakdown of all user roles, dashboards, workflows, features, database schema, and storage buckets, please refer to:

👉 **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**

---

## 👥 Supported Roles & Dashboards at a Glance

1. **Super Admin / Admin (`super_admin`, `admin`)**:
   - System user management & access request approvals.
   - High-level analytics (Students, Stationary, Scholarships, Ledger balance).
   - Full read/write audit permissions across all records.

2. **Clerk / Administrative Staff (`clerk`)**:
   - Student onboarding, multi-step registration, profile editing.
   - Document upload & verification manager.
   - Official **Bonafide Certificate** generation with printable PDF templates.
   - Vendor expense logs and scholarship application tracking.

3. **Accountant (`accountant`)**:
   - Institutional financial ledger (Credit / Debit entries).
   - Stationary & vendor bill payment settlements.
   - Transaction proof uploads and cheque clearance tracking.
   - Scholarship financial audits.

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Vanilla CSS + Framer Motion
- **Icons**: Lucide React
- **Backend & DB**: Supabase (PostgreSQL + RLS Policies + Storage Buckets)
- **Security**: Bcryptjs password hashing + Supabase Session Auth

---

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run Locally**:
   ```bash
   npm run dev
   ```

4. **Database Setup**:
   Execute `supabase-schema.sql` in your Supabase SQL Editor.

---

*© Vikramshila College Of Fashion Design ERP*
