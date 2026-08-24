import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { logError, toUserMessage } from './utils/errorHandler';

import { supabase } from './lib/supabase';
import TopBar from './components/TopBar';
import Header from './components/Header';
import MainArea from './components/MainArea';
import PWAInstallBanner from './components/PWAInstallBanner';

// Resilient code-split dashboard portals with auto-retry and version refresh
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      const msg = error?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) {
        const reloadKey = 'chunk_reload_lock';
        const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
        if (Date.now() - lastReload > 8000) {
          sessionStorage.setItem(reloadKey, String(Date.now()));
          window.location.reload();
        }
      }
      throw error;
    })
  );
}

const SuperAdminDashboard = lazyWithRetry(() => import('./components/SuperAdminDashboard'));
const ClerkDashboard = lazyWithRetry(() => import('./components/ClerkDashboard'));
const AccountantDashboard = lazyWithRetry(() => import('./components/AccountantDashboard'));
const StaffDashboard = lazyWithRetry(() => import('./components/StaffDashboard'));
import { initialUsers, initialRequests, User, AccessRequest, Student, initialStudents, initialStationaryRecords, initialScholarshipRecords } from './data/mockData';
import { StationaryRecord } from './types/stationary';
import { ScholarshipRecord } from './types/scholarship';
import { LedgerEntry } from './types/ledger';
import Loader from './components/Loader';
import LoginWelcome from './components/LoginWelcome';
import ErrorBoundary from './components/ErrorBoundary';
import { RATE_LIMITS } from './utils/rateLimits';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState<'pending_approval' | 'invalid_credentials' | 'invalid_password' | 'rate_limited' | 'account_suspended' | null>(null);
  const [loginErrorRetryAfter, setLoginErrorRetryAfter] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);

  // Lifted state
  const [students, setStudents] = useState<Student[]>([]);
  const [stationaryRecords, setStationaryRecords] = useState<StationaryRecord[]>([]);
  const [scholarshipRecords, setScholarshipRecords] = useState<ScholarshipRecord[]>([]);
  const [bonafideRecords, setBonafideRecords] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  const fetchDatabaseData = useCallback(async () => {
    try {
      const { data: dbUsers } = await supabase.from('users').select('*');
      if (dbUsers && dbUsers.length > 0) {
        const uniqueUsersMap = new Map<string, User>();
        dbUsers.forEach(u => {
          const key = u.email ? u.email.trim().toLowerCase() : u.id;
          if (!uniqueUsersMap.has(key)) {
            uniqueUsersMap.set(key, {
              id: u.id,
              name: u.name || u.email,
              username: u.username || u.email.split('@')[0],
              email: u.email,
              role: u.role as any,
              status: u.status || 'active'
            });
          }
        });
        setUsers(Array.from(uniqueUsersMap.values()));
      }
    } catch (err) {
      console.warn('Error fetching users from Supabase:', err);
    }

    try {
      const { data: dbRequests } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending');

      if (dbRequests) {
        const mappedRequests: AccessRequest[] = dbRequests.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          password: r.password,
          date: r.date || (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          status: r.status || 'pending'
        }));
        setRequests(mappedRequests);
      }
    } catch (err) {
      console.warn('Error fetching access requests from Supabase:', err);
    }

    try {
      const { data: dbStudents } = await supabase.from('students').select('*');
      if (dbStudents) {
        const mappedStudents: Student[] = dbStudents.map((s: any) => ({
          id: s.id,
          enrollmentId: s.enrollment_id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          course: s.course,
          branch: s.branch,
          category: s.category || 'OPEN',
          subCaste: s.sub_caste,
          fatherName: s.father_name,
          address: s.address,
          pincode: s.pincode,
          alternatePhone: s.alternate_phone,
          prnNo: s.prn_no,
          rollNo: s.roll_no,
          photoUrl: s.photo_url,
          semester: s.semester,
          batchYear: s.batch_year,
          studyYear: s.study_year,
          dob: s.dob,
          status: s.status,
          admissionDate: s.admission_date,
          scholarship: s.scholarship,
          bankName: s.bank_name,
          bankAccountNo: s.bank_account_no,
          bankIfsc: s.bank_ifsc,
          bankBranch: s.bank_branch,
          accountHolderName: s.account_holder_name,
          upiId: s.upi_id,
          upiApp: s.upi_app,
          documentsComplete: s.documents_complete,
          documents: s.documents || [],
          profileCompletion: s.profile_completion || 0
        }));
        setStudents(mappedStudents);
      }
    } catch (err) {
      console.warn('Error fetching students from Supabase:', err);
    }

    try {
      const { data: dbStationary } = await supabase.from('stationary_records').select(`
          *,
          payments:stationary_payments(*),
          documents:stationary_documents(*)
        `);
      if (dbStationary && dbStationary.length > 0) {
        const mappedStationary: StationaryRecord[] = dbStationary.map((sr: any) => ({
          id: sr.id,
          date: sr.date,
          vendorName: sr.vendor_name,
          objectName: sr.object_name,
          unit: Number(sr.unit),
          price: Number(sr.price),
          amountPaid: Number(sr.amount_paid),
          balance: Number(sr.balance),
          paymentStatus: sr.payment_status,
          payments: (sr.payments || []).map((p: any) => ({
            id: p.id,
            date: p.date,
            amount: Number(p.amount || 0),
            mode: p.mode,
            referenceNo: p.reference_no || p.referenceNo,
            receiptNo: p.receipt_no || p.receiptNo,
            billUrl: p.bill_url || p.billUrl,
            remarks: p.remarks
          })),
          remarks: sr.remarks,
          createdByRole: sr.created_by_role
        }));
        setStationaryRecords(mappedStationary);
      }
    } catch (err) {
      console.warn('Error fetching stationary_records from Supabase:', err);
    }

    try {
      const { data: dbScholarship } = await supabase.from('scholarship_records').select(`
          *,
          installments:scholarship_installments(*),
          documents:scholarship_documents(*)
        `);
      if (dbScholarship && dbScholarship.length > 0) {
        const mappedScholarship: ScholarshipRecord[] = dbScholarship.map((sc: any) => ({
          id: sc.id,
          studentId: sc.student_id,
          studentName: sc.student_name,
          enrollmentId: sc.enrollment_id,
          course: sc.course,
          scholarshipName: sc.scholarship_name,
          applicationDate: sc.application_date,
          sanctionedAmount: Number(sc.sanctioned_amount),
          amountReceived: Number(sc.amount_received),
          amountPending: Number(sc.amount_pending),
          status: sc.status,
          totalAmount: sc.total_amount !== null && sc.total_amount !== undefined ? Number(sc.total_amount) : undefined,
          creditDate: sc.credit_date || undefined,
          scholarshipCreditAmount: sc.scholarship_credit_amount !== null && sc.scholarship_credit_amount !== undefined ? Number(sc.scholarship_credit_amount) : undefined,
          actualBalanceBeforeWithdrawal: sc.actual_balance_before_withdrawal !== null && sc.actual_balance_before_withdrawal !== undefined ? Number(sc.actual_balance_before_withdrawal) : undefined,
          collegeAmount: sc.college_amount !== null && sc.college_amount !== undefined ? Number(sc.college_amount) : undefined,
          studentAmount: sc.student_amount !== null && sc.student_amount !== undefined ? Number(sc.student_amount) : undefined,
          disbursementRemarks: sc.disbursement_remarks || undefined,
          installments: (sc.installments || []).map((inst: any) => ({
            id: inst.id,
            installmentNumber: inst.installment_number,
            paymentDate: inst.payment_date,
            amountReceived: Number(inst.amount_received),
            paymentMode: inst.payment_mode,
            transactionRef: inst.transaction_ref,
            remarks: inst.remarks,
            proofUrl: inst.proof_url,
            isFreeship: inst.is_freeship
          })),
          documents: (sc.documents || []).map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            fileName: doc.file_name,
            uploadDate: doc.upload_date
          }))
        }));
        setScholarshipRecords(mappedScholarship);
      }
    } catch (err) {
      console.warn('Error fetching scholarship_records from Supabase:', err);
    }

    try {
      const { data: dbBonafide } = await supabase.from('bonafide_records').select('*');
      if (dbBonafide && dbBonafide.length > 0) {
        const mappedBonafide = dbBonafide.map((bf: any) => ({
          id: bf.id,
          studentId: bf.student_id,
          studentName: bf.student_name,
          purpose: bf.purpose,
          issueDate: bf.issue_date,
          validUntil: bf.valid_until,
          generatedBy: bf.generated_by
        }));
        setBonafideRecords(mappedBonafide);
      }
    } catch (err) {
      console.warn('Error fetching bonafide_records from Supabase:', err);
    }

    try {
      const { data: dbLedger } = await supabase.from('ledger_entries').select('*').order('date', { ascending: false });
      if (dbLedger && dbLedger.length > 0) {
        const mappedLedger: LedgerEntry[] = dbLedger.map((l: any) => ({
          id: l.id,
          date: l.date,
          description: l.description,
          amount: Number(l.amount),
          paymentMode: l.payment_mode,
          chequeNo: l.cheque_no,
          proofUrl: l.proof_url,
          createdBy: l.created_by,
          createdAt: l.created_at
        }));
        setLedgerEntries(mappedLedger);
      }
    } catch (err) {
      console.warn('Error fetching ledger_entries from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    fetchDatabaseData();

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await handleSupabaseSession(session, false);
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setShowWelcome(false);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN') {
        if (session) {
          handleSupabaseSession(session, true);
        }
      } else if (session) {
        // TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED: silently refresh session without animation or tab resets
        handleSupabaseSession(session, false);
      }
    });

    // Realtime channel subscriptions for live data sync across all dashboards
    const dbSyncChannel = supabase
      .channel('public:db_global_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchDatabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scholarship_records' }, () => {
        fetchDatabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scholarship_installments' }, () => {
        fetchDatabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scholarship_documents' }, () => {
        fetchDatabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stationary_records' }, () => {
        fetchDatabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stationary_payments' }, () => {
        fetchDatabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => {
        fetchDatabaseData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(dbSyncChannel);
    };
  }, [fetchDatabaseData]);

  const handleSupabaseSession = async (session: any, isExplicitLogin: boolean = false) => {
    if (session?.user) {
      const email = (session.user.email || '').toLowerCase();
      const username = email.split('@')[0];

      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .ilike('email', session.user.email)
          .maybeSingle();

        if (dbUser) {
          // SECURITY: Block suspended users even if their Supabase Auth session is valid
          if (dbUser.status === 'suspended') {
            await supabase.auth.signOut();
            setCurrentUser(null);
            setLoginError('account_suspended');
            return;
          }

          // Only reset tabs and trigger welcome animation on EXPLICIT login (not token refresh or reload)
          if (isExplicitLogin) {
            localStorage.removeItem('vcfd_admin_tab');
            localStorage.removeItem('vcfd_clerk_tab');
            localStorage.removeItem('vcfd_acc_tab');
            setShowWelcome(true);
          }

          setCurrentUser(prev => {
            if (
              prev &&
              prev.id === (dbUser.id || session.user.id) &&
              prev.role === dbUser.role &&
              prev.name === (dbUser.name || session.user.user_metadata?.full_name || username) &&
              prev.email === (dbUser.email || session.user.email)
            ) {
              return prev;
            }
            return {
              id: dbUser.id || session.user.id,
              name: dbUser.name || session.user.user_metadata?.full_name || username,
              username: dbUser.username || username,
              email: dbUser.email || session.user.email,
              role: dbUser.role as any,
              status: dbUser.status || 'active'
            };
          });

          fetchDatabaseData(); // Fetch secure data now that we are authenticated
          return;
        }
      } catch (err) {
        console.error('Error fetching user from database:', err);
      }

      // SECURITY: User authenticated via Supabase Auth but has NO row in the users table.
      // Immediately revoke their session — do NOT fall back to guessing a role.
      await supabase.auth.signOut();
      setCurrentUser(null);
      setLoginError('invalid_credentials');
    }
  };


  // Helper: Only call rate limit on FAILED attempts
  const recordFailedAttempt = async (accountId: string) => {
    try {
      const { data: rlData } = await supabase.rpc('check_rate_limit', {
        p_action_type: RATE_LIMITS.auth.actionType,
        p_account_id: accountId,
        p_max_attempts: RATE_LIMITS.auth.maxAttempts,
        p_base_backoff_seconds: RATE_LIMITS.auth.baseBackoffSeconds
      });
      if (rlData && !rlData.allowed) {
        return rlData.retry_after as number;
      }
    } catch (err) {
      console.warn('Rate limit check error:', err);
    }
    return null; // null = not blocked
  };

  const handleLogin = async (inputStr: string, password?: string) => {
    setIsAuthLoading(true);
    setLoginError(null);
    setLoginErrorRetryAfter(null);
    const query = inputStr.trim().toLowerCase();

    // Look up user in the users table by email or username using RPC
    // We must use RPC here because the users table is protected by RLS and not readable anonymously.
    try {
      const { data: dbUser } = await supabase.rpc('get_user_info', { p_query: query });

      if (dbUser) {

        // SECURITY: Block suspended users at login time
        if (dbUser.status === 'suspended') {
          setLoginError('account_suspended');
          setIsAuthLoading(false);
          return;
        }

        if (dbUser.has_password) {
          // User has a legacy password (approved via access request)
          // We use the secure_login RPC to verify without exposing the hash to the client
          const { data: isPasswordValid } = await supabase.rpc('secure_login', {
            p_email: dbUser.email,
            p_password: password || ''
          });
          
          if (!isPasswordValid) {
            const retryAfter = await recordFailedAttempt(query);
            if (retryAfter !== null) {
              setLoginError('rate_limited');
              setLoginErrorRetryAfter(retryAfter);
            } else {
              setLoginError('invalid_password');
            }
            setIsAuthLoading(false);
            return;
          }

          // ✅ Correct credentials — login, do NOT touch rate limit counter
          
          // TRANSPARENT MIGRATION TO SUPABASE AUTH:
          // We know the user's legacy password is correct. Create an Auth account for them
          // behind the scenes so they get a secure JWT session for RLS.
          const { error: signUpError } = await supabase.auth.signUp({
            email: dbUser.email,
            password: password || ''
          });

          // It's okay if they are already registered, but other errors might indicate an issue.
          if (signUpError && signUpError.message !== 'User already registered') {
            console.error("Migration sign up failed:", signUpError);
          }

          // Attempt sign in to establish session
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: dbUser.email,
            password: password || ''
          });

          if (signInError) {
             console.error("Migration sign in failed:", signInError);
             setLoginError('invalid_credentials');
             setIsAuthLoading(false);
             return;
          }

          // onAuthStateChange with 'SIGNED_IN' will handle session update and welcome animation
          setIsAuthLoading(false);
          return;
        } else {
          // No password stored — this is a Supabase Auth user (e.g. superadmin)
          const { error: authError } = await supabase.auth.signInWithPassword({
            email: dbUser.email,
            password: password || ''
          });
          if (authError) {
            const retryAfter = await recordFailedAttempt(query);
            if (retryAfter !== null) {
              setLoginError('rate_limited');
              setLoginErrorRetryAfter(retryAfter);
            } else {
              setLoginError('invalid_password');
            }
            setIsAuthLoading(false);
            return;
          }
          // ✅ Correct credentials — onAuthStateChange with 'SIGNED_IN' will fire
          setIsAuthLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Supabase login check error:', err);
    }

    // No user found in users table — check if they have a pending access request
    try {
      const { data: pendingReqs } = await supabase
        .from('access_requests')
        .select('id')
        .ilike('email', query)
        .eq('status', 'pending')
        .limit(1);
      if (pendingReqs && pendingReqs.length > 0) {
        setLoginError('pending_approval');
        setIsAuthLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Pending request check error:', err);
    }

    // Truly unrecognised — count as failed attempt
    const retryAfter = await recordFailedAttempt(query);
    if (retryAfter !== null) {
      setLoginError('rate_limited');
      setLoginErrorRetryAfter(retryAfter);
    } else {
      setLoginError('invalid_credentials');
    }
    setIsAuthLoading(false);
  };



  const handleRegister = async (name: string, email: string, password?: string): Promise<boolean> => {
    setIsAuthLoading(true);
    const emailNormalized = email.trim().toLowerCase();

    const dateStr = new Date().toISOString().split('T')[0];

    // Hash password before storing using backend RPC
    let hashedPassword = undefined;
    if (password) {
      try {
        const { data, error: hashErr } = await supabase.rpc('hash_password', { p_password: password });
        if (hashErr) {
          console.warn('hash_password RPC error:', hashErr);
        } else if (data) {
          hashedPassword = data;
        }
      } catch (err) {
        console.warn('hash_password call failed:', err);
      }
    }

    try {
      const { data: insertedReq, error } = await supabase
        .from('access_requests')
        .insert([
          {
            name,
            email,
            password: hashedPassword,
            date: dateStr,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) {
        logError('register access request', error);
        const retryAfter = await recordFailedAttempt(emailNormalized);
        if (retryAfter !== null) {
          alert(`Too many access requests. Please try again in ${retryAfter} seconds.`);
        } else {
          alert(toUserMessage('submit access request'));
        }
        setIsAuthLoading(false);
        return false;
      }

      const newReq: AccessRequest = {
        id: insertedReq ? insertedReq.id : `r${Date.now()}`,
        name,
        email,
        password: hashedPassword,
        date: dateStr,
        status: 'pending'
      };

      setRequests(prev => [newReq, ...prev]);
      setIsAuthLoading(false);
      return true;
    } catch (err: any) {
      logError('register network request', err);
      alert(toUserMessage('connect to server'));
      setIsAuthLoading(false);
      return false;
    }
  };


  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      // Clear data states to prevent leakage between sessions
      setStudents([]);
      setRequests([]);
      setUsers([]);
      setStationaryRecords([]);
      setScholarshipRecords([]);
      setBonafideRecords([]);
      setLedgerEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string, role: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) {
      console.warn('Request not found in state:', requestId);
      return;
    }

    try {
      // 1. Try atomic database RPC first
      const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_access_request', {
        p_request_id: requestId,
        p_role: role
      });

      if (!rpcError && rpcResult?.success) {
        const approvedUser = rpcResult.user;
        const newUser: User = {
          id: approvedUser.id,
          name: approvedUser.name,
          username: approvedUser.username,
          email: approvedUser.email,
          password: approvedUser.password,
          role: approvedUser.role,
          status: approvedUser.status || 'active'
        };
        setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== newUser.email.toLowerCase()), newUser]);
        setRequests(prev => prev.filter(r => r.id !== requestId));
        return;
      }

      // 2. Direct database operations fallback
      const username = req.email.split('@')[0];
      const newUser: User = {
        id: `u${Date.now()}`,
        name: req.name,
        username,
        email: req.email,
        password: req.password,
        role: role as any,
        status: 'active'
      };

      const { error: updateError } = await supabase
        .from('access_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Check if user exists to prevent unique constraint violation
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .ilike('email', req.email)
        .maybeSingle();

      if (existingUser) {
        const { data: updatedDbUser, error: updateUError } = await supabase
          .from('users')
          .update({
            role: role,
            status: 'active',
            password: req.password || existingUser.password
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateUError) throw updateUError;
        if (updatedDbUser) newUser.id = updatedDbUser.id;
      } else {
        const { data: createdDbUser, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              name: req.name,
              username,
              email: req.email,
              password: req.password,
              role: role,
              status: 'active'
            }
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        if (createdDbUser) newUser.id = createdDbUser.id;
      }

      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== newUser.email.toLowerCase()), newUser]);
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      console.error('Error approving request in Supabase:', err);
      alert('Failed to approve request: ' + (err.message || 'Please check database permissions.'));
      throw err;
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('reject_access_request', {
        p_request_id: requestId
      });

      if (!rpcError && rpcResult?.success) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        return;
      }

      const { error } = await supabase
        .from('access_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      console.warn('Error rejecting request in Supabase:', err);
      alert('Failed to reject request: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Note: Confirmation dialog is handled by SuperAdminDashboard before calling this
    const userToDelete = users.find(u => u.id === userId);
    try {
      await supabase.from('users').delete().eq('id', userId);
      // SECURITY: Also delete from Supabase Auth so the user cannot re-login
      // via email/password even after being removed from the users table.
      if (userToDelete?.email) {
        await supabase.rpc('delete_auth_user', { user_email: userToDelete.email });
      }
    } catch (err) {
      console.warn('Error deleting user from Supabase:', err);
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleWelcomeDone = useCallback(() => {
    setShowWelcome(false);
  }, []);

  // Emergency safety timer: Never allow welcome screen overlay to trap UI
  useEffect(() => {
    if (showWelcome) {
      const emergencyTimer = setTimeout(() => {
        setShowWelcome(false);
      }, 2000);
      return () => clearTimeout(emergencyTimer);
    }
  }, [showWelcome]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-sky-200">
      <PWAInstallBanner />
      <TopBar />
      <Loader show={isLoading} fullScreen />
      {showWelcome && currentUser && (
        <LoginWelcome
          name={currentUser.name}
          role={currentUser.role}
          onComplete={handleWelcomeDone}
        />
      )}
      {!currentUser && !isLoading && (
        <>
          <Header />
          <div className="bg-white border-b border-slate-200 py-3 text-center shadow-sm relative z-10">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-[0.2em] uppercase">
              VCFD ERP System
            </h2>
          </div>
        </>
      )}

      {!isLoading && currentUser && (
        <ErrorBoundary fallbackTitle="Dashboard Encountered an Error">
          <Suspense fallback={<Loader show={true} fullScreen />}>
            {(currentUser.role === 'superadmin' || currentUser.role === 'super_admin' || currentUser.role === 'admin') ? (
              <SuperAdminDashboard
                user={currentUser}
                onLogout={handleLogout}
                usersList={users}
                requestsList={requests}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
                onDeleteUser={handleDeleteUser}
                students={students}
                stationaryRecords={stationaryRecords}
                scholarshipRecords={scholarshipRecords}
                ledgerEntries={ledgerEntries}
                setLedgerEntries={setLedgerEntries}
                onSync={fetchDatabaseData}
              />
            ) : currentUser.role === 'clerk' ? (
              <ClerkDashboard
                user={currentUser}
                onLogout={handleLogout}
                usersList={users}
                students={students}
                setStudents={setStudents}
                stationaryRecords={stationaryRecords}
                setStationaryRecords={setStationaryRecords}
                scholarshipRecords={scholarshipRecords}
                setScholarshipRecords={setScholarshipRecords}
                bonafideRecords={bonafideRecords}
                setBonafideRecords={setBonafideRecords}
                onSync={fetchDatabaseData}
              />
            ) : currentUser.role === 'accountant' ? (
              <AccountantDashboard
                user={currentUser}
                onLogout={handleLogout}
                usersList={users}
                students={students}
                setStudents={setStudents}
                stationaryRecords={stationaryRecords}
                setStationaryRecords={setStationaryRecords}
                scholarshipRecords={scholarshipRecords}
                setScholarshipRecords={setScholarshipRecords}
                ledgerEntries={ledgerEntries}
                setLedgerEntries={setLedgerEntries}
                onSync={fetchDatabaseData}
              />
            ) : currentUser.role === 'staff' ? (
              <StaffDashboard
                user={currentUser}
                onLogout={handleLogout}
                usersList={users}
                onSync={fetchDatabaseData}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center max-w-md">
                  <h2 className="text-2xl font-bold mb-4">Welcome, {currentUser.name}</h2>
                  <p className="text-slate-600 mb-6">Your role is: <span className="font-semibold uppercase text-sky-700">{currentUser.role.replace('_', ' ')}</span></p>
                  <button
                    onClick={handleLogout}
                    className="px-6 py-2 bg-[#1e293b] text-white rounded-lg hover:bg-slate-800"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
      )}

      {!currentUser && !isLoading ? (
        <MainArea onLogin={handleLogin} onRegister={handleRegister} isLoading={isAuthLoading} loginError={loginError} loginErrorRetryAfter={loginErrorRetryAfter} />
      ) : null}

      {!currentUser && !isLoading && (
        <footer className="bg-slate-900 text-slate-400 py-6 text-center text-sm border-t border-slate-800 mt-auto">
          <p>&copy; {new Date().getFullYear()} Vikramshila College Of Fashion. All rights reserved.</p>
          <p className="mt-1 text-xs text-slate-500">A Government Authorized Institution. Developed for secure access.</p>
          <p className="mt-2 text-xs">
            <a href="https://www.vikramshilacollege.com/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 transition-colors hover:underline">
              Visit Vikramshila College of Fashion Design Website
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}
