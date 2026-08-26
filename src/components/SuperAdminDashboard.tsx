import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, AccessRequest, Student } from '../data/mockData';
import { Check, X, Shield, Users, AlertCircle, Search, Trash2, Package, GraduationCap, FileText, UserCircle, Eye, Wallet, Activity, TrendingUp, LayoutDashboard, FileDown, CheckCircle, RefreshCw, LogOut, Menu } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import StationaryDashboard from './stationary/StationaryDashboard';
import ScholarshipDashboard from './scholarship/ScholarshipDashboard';
import { StationaryRecord } from '../types/stationary';
import { ScholarshipRecord } from '../types/scholarship';
import { LedgerEntry } from '../types/ledger';
import Loader from './Loader';
import LedgerDashboard from './ledger/LedgerDashboard';
import { openFileUrl, forceDownloadFile } from '../utils/fileViewer';
import DocumentViewerModal, { DocumentPreviewItem } from './DocumentViewerModal';
import MessagesTab from './MessagesTab';
import { MessageSquare, Clock, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AdminAttendanceDashboard from './attendance/AdminAttendanceDashboard';
import AdminAttendanceSettings from './attendance/AdminAttendanceSettings';
import ErrorBoundary from './ErrorBoundary';
import PortalHeader from './PortalHeader';
import PortalDrawer, { DrawerNavGroup } from './PortalDrawer';
import { usePortalNavigation } from '../hooks/usePortalNavigation';

type AdminTab = 'overview' | 'requests' | 'users' | 'students' | 'stationary' | 'scholarships' | 'ledger' | 'messages' | 'attendance_dashboard' | 'attendance_settings';

interface Props {
  user: User;
  onLogout: () => void;
  usersList: User[];
  requestsList: AccessRequest[];
  onApproveRequest: (requestId: string, role: string) => Promise<void> | void;
  onRejectRequest: (requestId: string) => Promise<void> | void;
  onDeleteUser: (userId: string) => Promise<void> | void;
  students: Student[];
  stationaryRecords: StationaryRecord[];
  scholarshipRecords: ScholarshipRecord[];
  ledgerEntries: LedgerEntry[];
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  onSync?: () => Promise<void>;
}

export default function SuperAdminDashboard({
  user,
  onLogout,
  usersList,
  requestsList,
  onApproveRequest,
  onRejectRequest,
  onDeleteUser,
  students,
  stationaryRecords,
  scholarshipRecords,
  ledgerEntries,
  setLedgerEntries,
  onSync
}: Props) {
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'superadmin';

  const {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isAppMode,
    canGoBack,
    handleGoBack,
  } = usePortalNavigation<AdminTab>({
    portalKey: 'superadmin',
    defaultTab: 'overview',
    storageKey: 'vcfd_admin_tab',
  });

  const handleTabChange = setActiveTab;

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [approvedRequestId, setApprovedRequestId] = useState<string | null>(null);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [approvedPersonName, setApprovedPersonName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Unread message count for sidebar badge ---
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    setUnreadMsgCount(count ?? 0);
  }, [user.id]);

  useEffect(() => {
    fetchUnreadCount();

    const channel = supabase
      .channel(`admin-unread-badge-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, fetchUnreadCount]);

  // Re-fetch when user switches tabs (clears badge after reading messages)
  useEffect(() => {
    fetchUnreadCount();
  }, [activeTab, fetchUnreadCount]);
  // -----------------------------------------------

  const handleSync = useCallback(async () => {
    if (!onSync || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onSync, isSyncing]);

  const handleRoleChange = (requestId: string, role: string) => {
    setSelectedRole(prev => ({ ...prev, [requestId]: role }));
  };

  const handleApprove = async (reqId: string, personName: string) => {
    const role = selectedRole[reqId];
    if (!role) {
      alert("Please select a role first.");
      return;
    }
    setIsLoading(true);
    setApprovedRequestId(reqId);
    setApprovedPersonName(personName);

    try {
      await onApproveRequest(reqId, role);
      setShowApprovalSuccess(true);
      setTimeout(() => {
        setShowApprovalSuccess(false);
        setApprovedRequestId(null);
        setApprovedPersonName('');
      }, 2800);
    } catch (err: any) {
      console.error('Approval failed:', err);
      setApprovedRequestId(null);
      setApprovedPersonName('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (reqId: string) => {
    setIsLoading(true);
    try {
      await onRejectRequest(reqId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm("Are you sure you want to revoke access for this user?")) {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 600));
      onDeleteUser(userId);
      setIsLoading(false);
    }
  };

  const superAdminNavGroups: DrawerNavGroup<AdminTab>[] = [
    {
      category: 'Executive Dashboard',
      items: [
        {
          tab: 'overview',
          icon: <LayoutDashboard size={18} />,
          label: 'Overview Dashboard',
          description: 'Institutional metrics, counts & summaries',
        },
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            category: 'Administration & Access',
            items: [
              {
                tab: 'requests' as AdminTab,
                icon: <AlertCircle size={18} />,
                label: 'Access Requests',
                description: 'Pending staff & clerk signup requests',
                badge: requestsList.length,
                badgeColor: 'bg-rose-500 text-white animate-pulse',
              },
              {
                tab: 'users' as AdminTab,
                icon: <Users size={18} />,
                label: 'User Roles & Accounts',
                description: 'Manage staff accounts, privileges & status',
              },
            ],
          },
        ]
      : []),
    {
      category: 'Institution Operations',
      items: [
        {
          tab: 'students',
          icon: <UserCircle size={18} />,
          label: 'Students Database',
          description: 'Comprehensive student directory & records',
        },
        {
          tab: 'stationary',
          icon: <Package size={18} />,
          label: 'Stationary & Expenses',
          description: 'Supplies, inventory & expenditure auditing',
        },
        {
          tab: 'scholarships',
          icon: <GraduationCap size={18} />,
          label: 'Scholarship Grants',
          description: 'Sanctions, verification & payouts tracking',
        },
        {
          tab: 'ledger',
          icon: <FileText size={18} />,
          label: 'Financial Ledger',
          description: 'Complete institutional accounts & audits',
        },
      ],
    },
    {
      category: 'Staff & Attendance',
      items: [
        {
          tab: 'attendance_dashboard',
          icon: <Clock size={18} />,
          label: 'Attendance Monitor',
          description: 'Live punch logs, staff presence & summaries',
        },
        {
          tab: 'attendance_settings',
          icon: <Settings size={18} />,
          label: 'Attendance Settings',
          description: 'Geofencing, IP rules & office schedules',
        },
      ],
    },
    {
      category: 'Communications',
      items: [
        {
          tab: 'messages',
          icon: <MessageSquare size={18} />,
          label: 'System Messages',
          description: 'Direct messaging with all employees',
          badge: unreadMsgCount,
        },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full">
      <Loader show={isLoading} fullScreen={false} />

      {/* Clean Permanent Desktop Sidebar / Slide-over Mobile Drawer */}
      <PortalDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        portalTitle={isSuperAdmin ? 'Super Admin Portal' : 'Admin Portal'}
        roleBadgeText={isSuperAdmin ? 'Super Admin' : 'Admin'}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        groups={superAdminNavGroups}
        onSync={onSync ? handleSync : undefined}
        isSyncing={isSyncing}
        onLogout={onLogout}
      />

      {/* Right Column: Top Header + Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with Employee Name, Full Email, Refresh and Signout on the right */}
        <PortalHeader
          portalTitle={isSuperAdmin ? 'Super Admin Portal' : 'Admin Portal'}
          activeTabLabel={activeTab}
          user={user}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isAppMode={isAppMode}
          canGoBack={canGoBack}
          onGoBack={handleGoBack}
          onSync={onSync ? handleSync : undefined}
          isSyncing={isSyncing}
          onLogout={onLogout}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative pb-0 w-full max-w-full">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200/50 via-transparent to-transparent pointer-events-none"></div>
          <div ref={contentRef} className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 lg:p-8 relative z-10 w-full max-w-full overflow-x-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">System Overview</h3>
                    <p className="text-sm text-slate-500 mt-1">Real-time aggregate data across all departments.</p>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mb-8">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Students</p>
                        <p className="text-2xl font-black text-slate-900">{(students || []).length}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <Users size={20} className="text-blue-600" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className="text-emerald-600 font-bold">{(students || []).filter(s => s?.status === 'active').length} Active</span> enrolled
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Expenses</p>
                        <p className="text-2xl font-black text-slate-900">
                          ₹{(stationaryRecords || []).reduce((acc, curr) => acc + (Number(curr?.amountPaid) || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                        <Activity size={20} className="text-rose-600" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      From <span className="font-bold">{(stationaryRecords || []).length}</span> stationary records
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50"></div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Pending Payables</p>
                        <p className="text-2xl font-black text-slate-900">
                          ₹{(stationaryRecords || []).reduce((acc, curr) => acc + (Number(curr?.balance) || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Wallet size={20} className="text-amber-600" />
                      </div>
                    </div>
                    <div className="relative z-10 mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      Needs accountant clearance
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50"></div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Scholarships Disbursed</p>
                        <p className="text-2xl font-black text-slate-900">
                          ₹{(scholarshipRecords || []).reduce((acc, curr) => acc + (Number(curr?.amountReceived) || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <GraduationCap size={20} className="text-emerald-600" />
                      </div>
                    </div>
                    <div className="relative z-10 mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      Across {(scholarshipRecords || []).length} student files
                    </div>
                  </div>

                  {/* Ledger Entries KPI */}
                  <div className="bg-indigo-600 p-5 rounded-2xl shadow-sm flex flex-col justify-between text-white relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500 rounded-full opacity-30"></div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">Ledger Total</p>
                        <p className="text-2xl font-black">
                          ₹{(ledgerEntries || []).reduce((acc, e) => acc + (Number(e?.amount) || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                        <FileText size={20} className="text-white" />
                      </div>
                    </div>
                    <div className="relative z-10 mt-4 flex items-center gap-1.5 text-xs font-medium text-indigo-200">
                      <span className="font-bold text-white">{(ledgerEntries || []).length}</span> entries recorded
                    </div>
                  </div>
                </div>

                {/* Recent Activity Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <UserCircle size={16} className="text-sky-500" /> Recent Student Admissions
                      </h4>
                      <button onClick={() => setActiveTab('students')} className="text-xs font-semibold text-sky-600 hover:text-sky-800">View All</button>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-slate-100">
                          {[...(students || [])].sort((a, b) => new Date(b?.admissionDate || 0).getTime() - new Date(a?.admissionDate || 0).getTime()).slice(0, 5).map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-sm text-slate-900">{s.name}</div>
                                <div className="text-xs text-slate-500">{s.course} - {s.branch}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-xs font-bold text-slate-400">
                                  {s.admissionDate ? new Date(s.admissionDate).toLocaleDateString() : 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!students || students.length === 0) && (
                            <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-500">No students found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Package size={16} className="text-rose-500" /> Recent Expenses
                      </h4>
                      <button onClick={() => setActiveTab('stationary')} className="text-xs font-semibold text-sky-600 hover:text-sky-800">View All</button>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-slate-100">
                          {[...(stationaryRecords || [])].sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()).slice(0, 5).map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-sm text-slate-900">{r.vendorName}</div>
                                <div className="text-xs text-slate-500">{r.objectName} • {r.date ? new Date(r.date).toLocaleDateString() : 'N/A'}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="font-bold text-sm text-slate-900">₹{(Number(r.price) || 0).toLocaleString()}</div>
                                <div className={`text-[10px] font-bold uppercase tracking-wider ${r.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {r.paymentStatus}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {(!stationaryRecords || stationaryRecords.length === 0) && (
                            <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-500">No records found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Ledger Entries */}
                  <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-indigo-50 bg-indigo-50/60 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" /> Recent Ledger Entries
                      </h4>
                      <button onClick={() => setActiveTab('ledger')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View All</button>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-slate-100">
                          {[...(ledgerEntries || [])].sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()).slice(0, 5).map(e => (
                            <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-sm text-slate-900 truncate max-w-[140px]">{e.description}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{e.paymentMode}</span>
                                  {e.date ? new Date(e.date).toLocaleDateString() : 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="font-bold text-sm text-indigo-700">₹{(Number(e.amount) || 0).toLocaleString()}</div>
                              </td>
                            </tr>
                          ))}
                          {(!ledgerEntries || ledgerEntries.length === 0) && (
                            <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-400">No ledger entries yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {isSuperAdmin && activeTab === 'requests' && (
              <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <AlertCircle size={20} className="text-amber-500" /> Pending Access Requests
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requestsList.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                      No pending access requests.
                    </div>
                  ) : (
                    requestsList.map(req => (
                      <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900">{req.name}</h4>
                            <p className="text-sm text-slate-500">{req.email}</p>
                          </div>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">Pending</span>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <select
                            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                            value={selectedRole[req.id] || ''}
                            onChange={(e) => handleRoleChange(req.id, e.target.value)}
                          >
                            <option value="" disabled>Assign Role...</option>
                            <option value="admin">Admin</option>
                            <option value="clerk">Clerk</option>
                            <option value="accountant">Accountant</option>
                            <option value="staff">Staff</option>
                          </select>
                          <button
                            onClick={() => {
                              if (!selectedRole[req.id]) return alert("Please select a role first.");
                              handleApprove(req.id, req.name);
                            }}
                            className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                            title="Approve"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="p-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                            title="Reject"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {isSuperAdmin && activeTab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Users size={20} className="text-indigo-500" /> Active System Users
                </h3>

                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${u.role === 'super_admin' || u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                                u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                  u.role === 'accountant' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-sky-100 text-sky-700'
                              }`}>
                              {u.role.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!u.role.includes('super') && (
                              <button
                                onClick={() => handleDelete(u.id)}
                                className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded transition-colors"
                                title="Revoke Access"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-bold text-slate-800 mb-6">Student Database (Read Only)</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Enrollment ID</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Course</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.enrollmentId}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 overflow-hidden">
                                {s.photoUrl ? (
                                  <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                                ) : (
                                  <UserCircle size={18} className="text-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 text-sm">{s.name}</div>
                                <div className="text-xs text-slate-500">{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{s.course}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedStudent(s)}
                              className="text-sky-600 hover:text-sky-800 p-1.5 hover:bg-sky-50 rounded transition-colors"
                              title="View Full Profile"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'stationary' && (
              <motion.div key="stationary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <StationaryDashboard records={stationaryRecords} readOnly={true} currentUserRole={user.role} />
              </motion.div>
            )}

            {activeTab === 'scholarships' && (
              <motion.div key="scholarships" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ScholarshipDashboard records={scholarshipRecords} students={students} readOnly={true} currentUserRole={user.role} />
              </motion.div>
            )}

            {activeTab === 'ledger' && (
              <motion.div key="ledger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <LedgerDashboard records={ledgerEntries} setRecords={setLedgerEntries} readOnly={true} />
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-[calc(100dvh-120px)] w-full flex flex-col min-h-0"
              >
                <MessagesTab currentUser={user} usersList={usersList} />
              </motion.div>
            )}

            {activeTab === 'attendance_dashboard' && (
              <motion.div key="attendance_dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Attendance Dashboard</h2>
                  <p className="text-slate-500 mb-6">Monitor employee attendance records.</p>
                  <ErrorBoundary fallbackTitle="Unable to load Attendance Dashboard">
                    <AdminAttendanceDashboard usersList={usersList} currentUser={user} />
                  </ErrorBoundary>
                </div>
              </motion.div>
            )}

            {activeTab === 'attendance_settings' && (
              <motion.div key="attendance_settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Attendance Settings</h2>
                  <p className="text-slate-500 mb-6">Configure college geolocation and rules.</p>
                  <ErrorBoundary fallbackTitle="Unable to load Attendance Settings">
                    <AdminAttendanceSettings />
                  </ErrorBoundary>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      </div>

      {/* Student Details Modal */}
      {selectedStudent && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
                  {selectedStudent.photoUrl ? (
                    <img src={selectedStudent.photoUrl} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle size={28} className="text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                  <p className="text-slate-400 text-sm">PRN: {selectedStudent.prnNo || 'N/A'} • {selectedStudent.enrollmentId}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Personal Info */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Personal Information</h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                        {selectedStudent.photoUrl ? (
                          <img src={selectedStudent.photoUrl} alt={selectedStudent.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={32} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-slate-900 truncate">{selectedStudent.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedStudent.enrollmentId}</p>
                        <p className="text-xs text-slate-500 break-all mt-1">{selectedStudent.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 font-medium">Phone Number</p>
                        <p className="text-sm font-semibold text-slate-900 break-all">{selectedStudent.phone || 'N/A'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 font-medium">Date of Birth</p>
                        <p className="text-sm font-semibold text-slate-900 break-words">{selectedStudent.dob ? new Date(selectedStudent.dob).toLocaleDateString() : 'N/A'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 font-medium">Category</p>
                        <p className="text-sm font-semibold text-slate-900 break-words">{selectedStudent.category} {selectedStudent.subCaste ? `(${selectedStudent.subCaste})` : ''}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 font-medium">Father's Name</p>
                        <p className="text-sm font-semibold text-slate-900 break-words">{selectedStudent.fatherName || 'N/A'}</p>
                      </div>
                      {selectedStudent.address && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 font-medium">Address</p>
                          <p className="text-sm font-semibold text-slate-900 break-words leading-relaxed">{selectedStudent.address}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Academic Info */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Academic Profile</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Course & Branch</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedStudent.course} - {selectedStudent.branch}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Study Year</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedStudent.studyYear ? selectedStudent.studyYear + (selectedStudent.studyYear === '1' ? 'st' : selectedStudent.studyYear === '2' ? 'nd' : selectedStudent.studyYear === '3' ? 'rd' : 'th') + ' Year' : 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Semester</p>
                      <p className="text-sm font-semibold text-slate-900">Semester {selectedStudent.semester}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Batch Year</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedStudent.batchYear || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Admission Date</p>
                      <p className="text-sm font-semibold text-slate-900">{new Date(selectedStudent.admissionDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Status</p>
                      <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full mt-1 ${selectedStudent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {selectedStudent.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial / Bank Info */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm md:col-span-2">
                  <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-indigo-500" /> Bank &amp; Scholarship Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Scholarship Applicant</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedStudent.scholarship ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Bank Name</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{selectedStudent.bankName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">IFSC Code</p>
                      <p className="text-sm font-semibold text-slate-900 break-all">{selectedStudent.bankIfsc || 'N/A'}</p>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                      <p className="text-xs text-slate-500 font-medium">Account Number</p>
                      <p className="text-sm font-semibold text-slate-900 break-all">{selectedStudent.bankAccountNo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Bank Branch</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{selectedStudent.bankBranch || 'N/A'}</p>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-xs text-slate-500 font-medium">Account Holder Name</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedStudent.accountHolderName || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm md:col-span-2">
                  <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-500" /> Uploaded Documents / Images
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedStudent.documents && selectedStudent.documents.length > 0 ? (
                      selectedStudent.documents.map((doc, i) => {
                        let docName = doc;
                        let docUrl = null;
                        try {
                          const parsed = JSON.parse(doc);
                          if (parsed && typeof parsed === 'object') {
                            docName = parsed.name;
                            docUrl = parsed.url;
                          }
                        } catch (e) { }

                        return (
                          <div key={i} className="flex flex-col justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <FileText size={16} className="text-slate-400" />
                              <p className="text-sm font-medium text-slate-900 truncate">{docName}</p>
                            </div>
                            {docUrl ? (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setPreviewDoc({ title: docName, url: docUrl, bucket: 'student_documents' })} 
                                  className="flex-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 py-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eye size={12} /> View
                                </button>
                                <button onClick={async () => await forceDownloadFile(docUrl, docName, 'student_documents')} className="flex-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer">
                                  <FileDown size={12} /> Download
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">No file attached</p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500 italic col-span-full">No documents uploaded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Full-screen Approval Success Overlay */}
      <AnimatePresence>
        {showApprovalSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative flex items-center justify-center"
            >
              {/* Ripple rings */}
              {[1, 2, 3].map(i => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 3 }}
                  transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute w-24 h-24 rounded-full bg-white/30"
                />
              ))}
              <div className="relative z-10 bg-white rounded-full p-6 shadow-2xl">
                <CheckCircle size={64} className="text-emerald-500" />
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-4xl font-black text-white tracking-tight"
            >
              Access Granted!
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-2 text-white/80 text-lg font-medium"
            >
              {approvedPersonName} has been approved successfully.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>



      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

    </div>
  );
}
