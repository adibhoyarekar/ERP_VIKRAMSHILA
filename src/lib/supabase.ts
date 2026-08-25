/**
 * Client-side Mock Supabase Engine with LocalStorage Persistence
 * 
 * Provides a 100% standalone, serverless mock implementation of the Supabase Client.
 * All queries, table relations, mutations, RPC stored procedures, auth sessions,
 * mock storage, and real-time pub/sub channels operate client-side in the browser.
 */

import {
  initialUsers,
  initialRequests,
  initialStudents,
  initialStationaryRecords,
  initialScholarshipRecords,
  initialBonafideRecords,
  initialLedgerEntries,
  initialMessages,
  initialAttendanceRecords,
  initialAppSettings,
  initialCollegeHolidays,
  User
} from '../data/mockData';

const DB_STORAGE_KEY = 'vcfd_demo_db_v2';
const AUTH_SESSION_KEY = 'vcfd_demo_session_v2';

interface MockDatabase {
  users: any[];
  access_requests: any[];
  students: any[];
  student_documents: any[];
  stationary_records: any[];
  stationary_payments: any[];
  stationary_documents: any[];
  scholarship_records: any[];
  scholarship_installments: any[];
  scholarship_documents: any[];
  bonafide_records: any[];
  ledger_entries: any[];
  messages: any[];
  attendance_records: any[];
  app_settings: any[];
  college_holidays: any[];
  storage_files: Record<string, Record<string, string>>;
}

function getInitialDatabase(): MockDatabase {
  const stationaryPayments: any[] = [];
  const stationaryDocs: any[] = [];
  initialStationaryRecords.forEach(sr => {
    (sr.payments || []).forEach(p => {
      stationaryPayments.push({ ...p, record_id: sr.id });
    });
  });

  const scholarshipInstallments: any[] = [];
  const scholarshipDocs: any[] = [];
  initialScholarshipRecords.forEach(sc => {
    (sc.installments || []).forEach(inst => {
      scholarshipInstallments.push({ ...inst, record_id: sc.id });
    });
    (sc.documents || []).forEach(doc => {
      scholarshipDocs.push({ ...doc, record_id: sc.id });
    });
  });

  const dbStudents = initialStudents.map(s => ({
    id: s.id,
    enrollment_id: s.enrollmentId,
    name: s.name,
    email: s.email,
    phone: s.phone,
    course: s.course,
    branch: s.branch,
    category: s.category,
    sub_caste: s.subCaste,
    father_name: s.fatherName,
    address: s.address,
    pincode: s.pincode,
    alternate_phone: s.alternatePhone,
    prn_no: s.prnNo,
    roll_no: s.rollNo,
    photo_url: s.photoUrl,
    semester: s.semester,
    study_year: s.studyYear,
    batch_year: s.batchYear,
    dob: s.dob,
    status: s.status,
    admission_date: s.admissionDate,
    scholarship: s.scholarship,
    bank_name: s.bankName,
    bank_account_no: s.bankAccountNo,
    bank_ifsc: s.bankIfsc,
    bank_branch: s.bankBranch,
    account_holder_name: s.accountHolderName,
    upi_id: s.upiId,
    upi_app: s.upiApp,
    bank_details_updated: s.bankDetailsUpdated,
    documents_complete: s.documentsComplete,
    documents: s.documents,
    profile_completion: s.profileCompletion,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const dbStationary = initialStationaryRecords.map(sr => ({
    id: sr.id,
    date: sr.date,
    vendor_name: sr.vendorName,
    object_name: sr.objectName,
    unit: sr.unit,
    price: sr.price,
    amount_paid: sr.amountPaid,
    balance: sr.balance,
    payment_status: sr.paymentStatus,
    remarks: sr.remarks,
    created_by_role: sr.createdByRole,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const dbScholarship = initialScholarshipRecords.map(sc => ({
    id: sc.id,
    student_id: sc.studentId,
    student_name: sc.studentName,
    enrollment_id: sc.enrollmentId,
    course: sc.course,
    scholarship_name: sc.scholarshipName,
    application_date: sc.applicationDate,
    sanctioned_amount: sc.sanctionedAmount,
    amount_received: sc.amountReceived,
    amount_pending: sc.amountPending,
    status: sc.status,
    total_amount: sc.totalAmount,
    credit_date: sc.creditDate,
    scholarship_credit_amount: sc.scholarshipCreditAmount,
    actual_balance_before_withdrawal: sc.actualBalanceBeforeWithdrawal,
    college_amount: sc.collegeAmount,
    student_amount: sc.studentAmount,
    disbursement_remarks: sc.disbursementRemarks,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const dbBonafide = initialBonafideRecords.map(bf => ({
    id: bf.id,
    student_id: bf.studentId,
    student_name: bf.studentName,
    purpose: bf.purpose,
    issue_date: bf.issueDate,
    valid_until: bf.validUntil,
    generated_by: bf.generatedBy,
    created_at: new Date().toISOString()
  }));

  const dbLedger = initialLedgerEntries.map(l => ({
    id: l.id,
    date: l.date,
    description: l.description,
    amount: l.amount,
    payment_mode: l.paymentMode,
    cheque_no: l.chequeNo,
    proof_url: l.proofUrl,
    created_by: l.createdBy,
    created_at: l.createdAt
  }));

  return {
    users: [...initialUsers],
    access_requests: [...initialRequests],
    students: dbStudents,
    student_documents: [],
    stationary_records: dbStationary,
    stationary_payments: stationaryPayments,
    stationary_documents: stationaryDocs,
    scholarship_records: dbScholarship,
    scholarship_installments: scholarshipInstallments,
    scholarship_documents: scholarshipDocs,
    bonafide_records: dbBonafide,
    ledger_entries: dbLedger,
    messages: [...initialMessages],
    attendance_records: [...initialAttendanceRecords],
    app_settings: [initialAppSettings],
    college_holidays: [...initialCollegeHolidays],
    storage_files: {}
  };
}

function loadDatabase(): MockDatabase {
  try {
    const saved = localStorage.getItem(DB_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const initial = getInitialDatabase();
      return { ...initial, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load mock database from localStorage:', err);
  }
  const initial = getInitialDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: MockDatabase) {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Failed to save mock database to localStorage:', err);
  }
}

let mockDB: MockDatabase = loadDatabase();

type ChannelListener = (payload: { event: string; schema: string; table: string; new?: any; old?: any }) => void;
const channelListeners: Map<string, ChannelListener[]> = new Map();

function broadcastEvent(table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', newRow?: any, oldRow?: any) {
  const payload = {
    event,
    schema: 'public',
    table,
    new: newRow,
    old: oldRow
  };
  channelListeners.forEach((listeners) => {
    listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('Error in mock channel listener:', err);
      }
    });
  });
}

type AuthListener = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED', session: any) => void;
const authListeners: Set<AuthListener> = new Set();

function getStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to get session from localStorage:', err);
  }
  return null;
}

function setStoredSession(session: any) {
  try {
    if (session) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch (err) {
    console.warn('Failed to persist session to localStorage:', err);
  }
}

type OperationType = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

/**
 * Unified Chainable Mock Postgrest Query Builder
 */
class MockQueryBuilder {
  private tableName: string;
  private op: OperationType = 'select';
  private insertData: any = null;
  private updateData: any = null;
  private filters: Array<(row: any) => boolean> = [];
  private orderCol?: string;
  private ascending: boolean = true;
  private limitCount?: number;
  private offsetCount?: number;
  private selectCols: string = '*';
  private singleRow: boolean = false;
  private maybeSingleRow: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    this.selectCols = columns;
    if (options?.head) {
      this.limitCount = 0;
    }
    return this;
  }

  insert(values: any | any[]): this {
    this.op = 'insert';
    this.insertData = values;
    return this;
  }

  update(values: any): this {
    this.op = 'update';
    this.updateData = values;
    return this;
  }

  upsert(values: any | any[], _options?: { onConflict?: string }): this {
    this.op = 'upsert';
    this.insertData = values;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push(row => {
      if (value === null || value === undefined) return row[column] === value;
      return String(row[column]) === String(value);
    });
    return this;
  }

  neq(column: string, value: any): this {
    this.filters.push(row => String(row[column]) !== String(value));
    return this;
  }

  ilike(column: string, pattern: string): this {
    const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push(row => {
      const val = String(row[column] || '').toLowerCase();
      return val.includes(cleanPattern);
    });
    return this;
  }

  like(column: string, pattern: string): this {
    const cleanPattern = pattern.replace(/%/g, '');
    this.filters.push(row => {
      const val = String(row[column] || '');
      return val.includes(cleanPattern);
    });
    return this;
  }

  in(column: string, values: any[]): this {
    const set = new Set((values || []).map(v => String(v)));
    this.filters.push(row => set.has(String(row[column])));
    return this;
  }

  or(filterString: string): this {
    // Basic PostgREST "or" clause simulation (e.g., 'sender_id.eq.A,receiver_id.eq.A')
    const conditions = (filterString || '').split(',').map(c => c.trim()).filter(Boolean);
    if (conditions.length > 0) {
      this.filters.push(row => {
        return conditions.some(cond => {
          const parts = cond.split('.');
          if (parts.length >= 3) {
            const col = parts[0];
            const op = parts[1];
            const val = parts.slice(2).join('.');
            if (op === 'eq') return String(row[col]) === val;
            if (op === 'neq') return String(row[col]) !== val;
          }
          return true;
        });
      });
    }
    return this;
  }

  gte(column: string, value: any): this {
    this.filters.push(row => (row[column] !== null && row[column] !== undefined && row[column] >= value));
    return this;
  }

  lte(column: string, value: any): this {
    this.filters.push(row => (row[column] !== null && row[column] !== undefined && row[column] <= value));
    return this;
  }

  is(column: string, value: any): this {
    this.filters.push(row => row[column] === value);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderCol = column;
    this.ascending = options.ascending !== false;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single(): this {
    this.singleRow = true;
    return this;
  }

  maybeSingle(): this {
    this.maybeSingleRow = true;
    return this;
  }

  private getTableData(): any[] {
    const key = this.tableName as keyof MockDatabase;
    if (!mockDB[key] || !Array.isArray(mockDB[key])) {
      (mockDB as any)[key] = [];
    }
    return (mockDB as any)[key] as any[];
  }

  private execute(): { data: any; count: number; error: any } {
    const tableData = this.getTableData();

    if (this.op === 'insert') {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const inserted: any[] = [];

      for (const item of items) {
        const newRow = {
          id: item.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        tableData.push(newRow);
        inserted.push(newRow);
        broadcastEvent(this.tableName, 'INSERT', newRow);
      }

      saveDatabase(mockDB);
      const res = Array.isArray(this.insertData) ? inserted : (this.singleRow || this.maybeSingleRow ? inserted[0] : inserted);
      return { data: res, count: inserted.length, error: null };
    }

    if (this.op === 'update') {
      let updatedCount = 0;
      const updatedRows: any[] = [];

      for (let i = 0; i < tableData.length; i++) {
        let match = true;
        for (const filter of this.filters) {
          if (!filter(tableData[i])) {
            match = false;
            break;
          }
        }
        if (match) {
          const oldRow = { ...tableData[i] };
          tableData[i] = {
            ...tableData[i],
            ...this.updateData,
            updated_at: new Date().toISOString()
          };
          updatedRows.push(tableData[i]);
          updatedCount++;
          broadcastEvent(this.tableName, 'UPDATE', tableData[i], oldRow);
        }
      }

      saveDatabase(mockDB);
      const res = this.singleRow || this.maybeSingleRow ? (updatedRows[0] || null) : updatedRows;
      return { data: res, count: updatedCount, error: null };
    }

    if (this.op === 'upsert') {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const results: any[] = [];

      for (const item of items) {
        const idx = tableData.findIndex(r => (item.id && r.id === item.id) || (item.user_id && item.date && r.user_id === item.user_id && r.date === item.date));
        if (idx >= 0) {
          const oldRow = { ...tableData[idx] };
          tableData[idx] = { ...tableData[idx], ...item, updated_at: new Date().toISOString() };
          results.push(tableData[idx]);
          broadcastEvent(this.tableName, 'UPDATE', tableData[idx], oldRow);
        } else {
          const newRow = {
            id: item.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item
          };
          tableData.push(newRow);
          results.push(newRow);
          broadcastEvent(this.tableName, 'INSERT', newRow);
        }
      }

      saveDatabase(mockDB);
      const res = Array.isArray(this.insertData) ? results : (this.singleRow || this.maybeSingleRow ? results[0] : results);
      return { data: res, count: results.length, error: null };
    }

    if (this.op === 'delete') {
      const remaining: any[] = [];
      const deleted: any[] = [];

      for (const row of tableData) {
        let match = true;
        for (const filter of this.filters) {
          if (!filter(row)) {
            match = false;
            break;
          }
        }
        if (match) {
          deleted.push(row);
          broadcastEvent(this.tableName, 'DELETE', undefined, row);
        } else {
          remaining.push(row);
        }
      }

      (mockDB as any)[this.tableName] = remaining;
      saveDatabase(mockDB);
      return { data: deleted, count: deleted.length, error: null };
    }

    // Default: select
    let rows = [...tableData];
    for (const filter of this.filters) {
      rows = rows.filter(filter);
    }

    const totalCount = rows.length;

    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.ascending;
      rows.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return asc ? -1 : 1;
        if (valB === undefined || valB === null) return asc ? 1 : -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return asc ? valA - valB : valB - valA;
        }
        return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    }

    if (this.offsetCount !== undefined) {
      rows = rows.slice(this.offsetCount);
    }
    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    // Relational embeds simulation
    if (this.tableName === 'stationary_records' && this.selectCols.includes('payments:stationary_payments')) {
      const payments = mockDB.stationary_payments || [];
      const docs = mockDB.stationary_documents || [];
      rows = rows.map(r => ({
        ...r,
        payments: payments.filter(p => p.record_id === r.id),
        documents: docs.filter(d => d.record_id === r.id)
      }));
    } else if (this.tableName === 'scholarship_records' && this.selectCols.includes('installments:scholarship_installments')) {
      const installments = mockDB.scholarship_installments || [];
      const docs = mockDB.scholarship_documents || [];
      rows = rows.map(r => ({
        ...r,
        installments: installments.filter(i => i.record_id === r.id),
        documents: docs.filter(d => d.record_id === r.id)
      }));
    }

    if (this.singleRow) {
      if (rows.length === 0) {
        return { data: null, count: 0, error: { message: 'Row not found' } };
      }
      return { data: rows[0], count: 1, error: null };
    }

    if (this.maybeSingleRow) {
      return { data: rows.length > 0 ? rows[0] : null, count: rows.length, error: null };
    }

    return { data: rows, count: totalCount, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; count: number; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = this.execute();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

/**
 * Mock Supabase Client Object
 */
export const supabase = {
  // Database Queries
  from(tableName: string): MockQueryBuilder {
    return new MockQueryBuilder(tableName);
  },

  // Stored Procedures (RPCs)
  async rpc(fnName: string, params: any = {}): Promise<{ data: any; error: any }> {
    switch (fnName) {
      case 'get_user_info': {
        const query = (params.p_query || '').trim().toLowerCase();
        const user = mockDB.users.find(
          u => (u.email && u.email.toLowerCase() === query) || (u.username && u.username.toLowerCase() === query)
        );
        if (user) {
          return {
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              status: user.status || 'active',
              has_password: true
            },
            error: null
          };
        }
        return { data: null, error: null };
      }

      case 'secure_login': {
        const email = (params.p_email || '').trim().toLowerCase();
        const user = mockDB.users.find(u => u.email && u.email.toLowerCase() === email);
        if (user) {
          const expectedPw = user.password || 'Demo@1234';
          const isValid = !params.p_password || params.p_password === expectedPw || params.p_password === 'Demo@1234' || params.p_password === 'admin123';
          return { data: isValid, error: null };
        }
        return { data: false, error: null };
      }

      case 'hash_password': {
        return { data: params.p_password ? `mock_hash_${params.p_password}` : undefined, error: null };
      }

      case 'check_rate_limit': {
        return { data: { allowed: true, retry_after: 0 }, error: null };
      }

      case 'approve_access_request': {
        const reqId = params.p_request_id;
        const role = params.p_role;
        const reqIndex = mockDB.access_requests.findIndex(r => r.id === reqId);
        if (reqIndex >= 0) {
          const req = mockDB.access_requests[reqIndex];
          mockDB.access_requests[reqIndex] = { ...req, status: 'approved' };
          
          const newUser: User = {
            id: `u-${Date.now()}`,
            name: req.name,
            username: req.email.split('@')[0],
            email: req.email,
            password: req.password || 'Demo@1234',
            role: role as any,
            status: 'active'
          };
          
          mockDB.users = mockDB.users.filter(u => u.email.toLowerCase() !== newUser.email.toLowerCase());
          mockDB.users.push(newUser);
          saveDatabase(mockDB);
          broadcastEvent('users', 'INSERT', newUser);
          broadcastEvent('access_requests', 'UPDATE', mockDB.access_requests[reqIndex]);

          return {
            data: { success: true, user: newUser },
            error: null
          };
        }
        return { data: { success: false }, error: { message: 'Request not found' } };
      }

      case 'reject_access_request': {
        const reqId = params.p_request_id;
        const reqIndex = mockDB.access_requests.findIndex(r => r.id === reqId);
        if (reqIndex >= 0) {
          mockDB.access_requests[reqIndex].status = 'rejected';
          saveDatabase(mockDB);
          broadcastEvent('access_requests', 'UPDATE', mockDB.access_requests[reqIndex]);
          return { data: { success: true }, error: null };
        }
        return { data: { success: false }, error: { message: 'Request not found' } };
      }

      case 'delete_auth_user': {
        const email = (params.user_email || '').toLowerCase();
        mockDB.users = mockDB.users.filter(u => u.email.toLowerCase() !== email);
        saveDatabase(mockDB);
        return { data: { success: true }, error: null };
      }

      case 'delete_student_cascade': {
        const studentId = params.p_student_id;
        mockDB.students = mockDB.students.filter(s => s.id !== studentId);
        mockDB.scholarship_records = mockDB.scholarship_records.filter(sc => sc.student_id !== studentId);
        mockDB.bonafide_records = mockDB.bonafide_records.filter(bf => bf.student_id !== studentId);
        saveDatabase(mockDB);
        broadcastEvent('students', 'DELETE', undefined, { id: studentId });
        return { data: { success: true }, error: null };
      }

      case 'get_server_timestamp': {
        return { data: new Date().toISOString(), error: null };
      }

      case 'delete_old_attendance_photos': {
        return { data: { success: true, deleted_count: 0 }, error: null };
      }

      case 'verify_and_record_attendance': {
        const { p_user_id, p_type, p_photo_url, p_latitude, p_longitude, p_accuracy } = params;
        const today = new Date().toISOString().split('T')[0];
        let record = mockDB.attendance_records.find(r => r.user_id === p_user_id && r.date === today);

        if (!record) {
          record = {
            id: `att-${Date.now()}`,
            user_id: p_user_id,
            date: today,
            check_in_time: `${today}T08:55:00.000Z`,
            check_in_photo_url: p_photo_url,
            check_in_latitude: p_latitude,
            check_in_longitude: p_longitude,
            check_in_accuracy: p_accuracy,
            check_out_time: null,
            check_out_photo_url: null,
            check_out_latitude: null,
            check_out_longitude: null,
            check_out_accuracy: null,
            status: 'Present',
            working_hours: null,
            is_manually_corrected: false,
            corrected_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          mockDB.attendance_records.push(record);
        } else if (p_type === 'check_out') {
          record.check_out_time = new Date().toISOString();
          record.check_out_photo_url = p_photo_url;
          record.check_out_latitude = p_latitude;
          record.check_out_longitude = p_longitude;
          record.check_out_accuracy = p_accuracy;
          record.working_hours = '8 hrs 15 mins';
          record.updated_at = new Date().toISOString();
        }

        saveDatabase(mockDB);
        broadcastEvent('attendance_records', 'UPDATE', record);
        return { data: { success: true, status: record.status, record }, error: null };
      }

      default:
        console.warn(`Mock RPC called with unknown function: ${fnName}`, params);
        return { data: { success: true }, error: null };
    }
  },

  // Authentication Management
  auth: {
    async getSession() {
      const session = getStoredSession();
      return { data: { session }, error: null };
    },

    async getUser() {
      const session = getStoredSession();
      return { data: { user: session?.user || null }, error: null };
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      const cleanEmail = (email || '').trim().toLowerCase();
      const user = mockDB.users.find(u => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail);

      if (!user) {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
      }

      if (user.status === 'suspended') {
        return { data: { user: null, session: null }, error: { message: 'Account suspended' } };
      }

      const expectedPw = user.password || 'Demo@1234';
      if (password && password !== expectedPw && password !== 'Demo@1234' && password !== 'admin123') {
        return { data: { user: null, session: null }, error: { message: 'Invalid password' } };
      }

      const session = {
        access_token: `mock-jwt-${Date.now()}`,
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: {
            full_name: user.name,
            role: user.role
          }
        }
      };

      setStoredSession(session);

      authListeners.forEach(listener => {
        try {
          listener('SIGNED_IN', session);
        } catch (e) {
          console.error(e);
        }
      });

      return { data: { user: session.user, session }, error: null };
    },

    async signUp({ email, password, options }: { email: string; password?: string; options?: any }) {
      const cleanEmail = (email || '').trim().toLowerCase();
      let user = mockDB.users.find(u => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        user = {
          id: `u-${Date.now()}`,
          name: options?.data?.full_name || cleanEmail.split('@')[0],
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          password: password || 'Demo@1234',
          role: 'staff',
          status: 'active'
        };
        mockDB.users.push(user);
        saveDatabase(mockDB);
      }

      const session = {
        access_token: `mock-jwt-${Date.now()}`,
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { full_name: user.name, role: user.role }
        }
      };

      setStoredSession(session);
      return { data: { user: session.user, session }, error: null };
    },

    async signOut() {
      setStoredSession(null);
      authListeners.forEach(listener => {
        try {
          listener('SIGNED_OUT', null);
        } catch (e) {
          console.error(e);
        }
      });
      return { error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            }
          }
        }
      };
    }
  },

  // Mock File Storage
  storage: {
    from(bucketName: string) {
      return {
        async upload(filePath: string, file: any, _options?: any) {
          if (!mockDB.storage_files[bucketName]) {
            mockDB.storage_files[bucketName] = {};
          }
          let url = '';
          if (typeof file === 'string') {
            url = file;
          } else if (file instanceof Blob || file instanceof File) {
            url = URL.createObjectURL(file);
          } else {
            url = `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80`;
          }
          mockDB.storage_files[bucketName][filePath] = url;
          saveDatabase(mockDB);
          return { data: { path: filePath }, error: null };
        },

        async createSignedUrl(filePath: string, _expiresIn?: number) {
          const stored = mockDB.storage_files[bucketName]?.[filePath];
          const url = stored || filePath.startsWith('http') || filePath.startsWith('data:')
            ? filePath
            : `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80`;
          return { data: { signedUrl: url }, error: null };
        },

        getPublicUrl(filePath: string) {
          const stored = mockDB.storage_files[bucketName]?.[filePath];
          const url = stored || filePath.startsWith('http') || filePath.startsWith('data:')
            ? filePath
            : `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80`;
          return { data: { publicUrl: url } };
        },

        async remove(files: string[]) {
          if (mockDB.storage_files[bucketName]) {
            files.forEach(f => delete mockDB.storage_files[bucketName][f]);
            saveDatabase(mockDB);
          }
          return { error: null };
        },

        async list(_path?: string) {
          return { data: [], error: null };
        }
      };
    }
  },

  // Real-time Event Subscription Channels
  channel(channelName: string) {
    const listeners: ChannelListener[] = [];
    const channelObj = {
      on(_type: string, _filter: any, callback: ChannelListener) {
        listeners.push(callback);
        return channelObj;
      },
      subscribe() {
        if (!channelListeners.has(channelName)) {
          channelListeners.set(channelName, []);
        }
        channelListeners.get(channelName)!.push(...listeners);
        return channelObj;
      }
    };
    return channelObj;
  },

  removeChannel(channel: any) {
    if (!channel) return;
    channelListeners.clear();
  }
};

/**
 * Utility helper to reset database to default mock data at any time during a demo.
 */
export function resetDemoDatabase() {
  localStorage.removeItem(DB_STORAGE_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
  mockDB = getInitialDatabase();
  saveDatabase(mockDB);
  window.location.reload();
}
