# 🏫 Vikramshila College Of Fashion Design — ERP System (Standalone Demo Edition)

An end-to-end Enterprise Resource Planning (ERP) platform designed for **Vikramshila College Of Fashion Design** to streamline academic administration, student lifecycle management, document verification, financial ledger tracking, scholarship disbursement, vendor expenses (stationary), staff biometric/GPS attendance, and official certificate issuance.

---

## ⚡ Standalone Demo Mode (Zero Backend Setup Required)

This version is configured as a **100% standalone, serverless demo edition**. All database operations, authentication sessions, storage uploads, and real-time syncing run directly in the browser via an in-memory & `localStorage`-backed mock database engine.

No backend servers, API keys, or Supabase accounts are needed. Anyone can run the project with a single command!

### 🔑 Demo Login Credentials (Also available via 1-Click Login on UI)

| Role | Role Title | Demo Email | Password | Primary Functions |
| :--- | :--- | :--- | :--- | :--- |
| 👑 **Super Admin** | Super Admin | `superadmin@vikramshila.edu` | `Demo@1234` | System user management, approvals, analytics, settings |
| 🛡️ **Admin** | Campus Admin | `admin@vikramshila.edu` | `Demo@1234` | Faculty management, attendance monitoring, academic oversight |
| 📋 **Clerk** | Registrar / Clerk | `clerk@vikramshila.edu` | `Demo@1234` | Student registration, stationary orders, bonafide certificates |
| 💰 **Accountant** | Chief Accountant | `accountant@vikramshila.edu` | `Demo@1234` | Financial ledger, fee collections, vendor payments, scholarships |
| 👨‍🏫 **Staff** | Faculty Member | `staff@vikramshila.edu` | `Demo@1234` | Selfie GPS attendance clock-in/out, calendar, internal chat |

---

## 🚀 How to Run the Project

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Local Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Build for Production / Deployment**:
   ```bash
   npm run build
   ```
   The `dist/` directory can be deployed directly to Vercel, Netlify, GitHub Pages, or any static host.

---

## 👥 Included Features & Mock Datasets

- **12+ Detailed Fashion Design Students**: Complete with multi-semester records, PRN numbers, roll numbers, photos, bank details, and document checklists.
- **Stationary & Inventory Hub**: Vendor expense tracking, partial/full installment settlements, digital bill receipts.
- **Scholarship Disbursement Tracker**: Government Post-Matric, EBC, Swadhar schemes, installment history, and approval documents.
- **Financial Ledger**: Institutional income/expense transactions with debit/credit breakdown.
- **Bonafide Certificate Generator**: Instant printable PDF generation with official college letterhead.
- **Employee GPS Attendance**: Camera selfie check-in/out, college geofencing verification, monthly attendance calendar, and college holidays.
- **Internal Messaging**: Inter-departmental chat system.
- **Reset Demo Data**: Easily reset modifications back to default demo state at any time via the "Reset Demo Data" button on the login screen.

---

*© Vikramshila College Of Fashion Design ERP — Demo Project Edition*
