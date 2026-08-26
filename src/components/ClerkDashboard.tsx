import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { logError, toUserMessage } from '../utils/errorHandler';
import { validateFile, ALLOWED_FILE_TYPES } from '../utils/fileValidator';
import { User, Student } from '../data/mockData';
import { supabase } from '../lib/supabase';
import {
  Users, UserPlus, FileText, LayoutDashboard, Search, Filter,
  Download, Eye, Edit, Trash2, CheckCircle, Package, AlertCircle,
  GraduationCap, Briefcase, FileSignature, LogOut, ChevronRight, X, Upload, Plus, FileDown, Wallet, ClipboardCheck, RefreshCw, MessageSquare, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import StationaryDashboard from "./stationary/StationaryDashboard";
import { StationaryRecord } from "../types/stationary";
import { ScholarshipRecord } from "../types/scholarship";
import ScholarshipDashboard from "./scholarship/ScholarshipDashboard";
import SuccessToast from "./SuccessToast";
import RegistrationTab from './RegistrationTab';
import BonafideTab from './bonafide/BonafideTab';
import Loader from './Loader';
import { BonafideRecord } from '../types/bonafide';
import SuccessAnimation from './SuccessAnimation';
import MessagesTab from './MessagesTab';
import EmployeeAttendanceTab from './attendance/EmployeeAttendanceTab';
import { Clock } from 'lucide-react';

type Tab = 'dashboard' | 'students' | 'registration' | 'documents' | 'stationary' | 'scholarships' | 'bonafide' | 'messages' | 'attendance';

interface Props {
  user: User;
  onLogout: () => void;
  usersList: User[];
  students: Student[];
  setStudents: (val: Student[]) => void;
  stationaryRecords: StationaryRecord[];
  setStationaryRecords: (val: StationaryRecord[]) => void;
  scholarshipRecords: ScholarshipRecord[];
  setScholarshipRecords: (val: ScholarshipRecord[]) => void;
  bonafideRecords?: BonafideRecord[];
  setBonafideRecords?: (val: BonafideRecord[]) => void;
  onSync?: () => Promise<void>;
}

import { openFileUrl, forceDownloadFile, parseSupabaseStorageUrl } from '../utils/fileViewer';
import DocumentViewerModal, { DocumentPreviewItem } from './DocumentViewerModal';
import PortalHeader from './PortalHeader';
import PortalDrawer, { DrawerNavGroup } from './PortalDrawer';
import { usePortalNavigation } from '../hooks/usePortalNavigation';

export const handleRealDownload = async (e: React.MouseEvent, url: string) => {
  e.stopPropagation();
  if (!url) return;
  await forceDownloadFile(url);
};

export const handleView = (e: React.MouseEvent, url: string) => {
  e.stopPropagation();
  if (!url) return;
  openFileUrl(url);
};

export default function ClerkDashboard({ user, onLogout, usersList, students, setStudents, stationaryRecords, setStationaryRecords, scholarshipRecords, setScholarshipRecords, bonafideRecords = [], setBonafideRecords = () => { }, onSync }: Props) {
  const {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isAppMode,
    canGoBack,
    handleGoBack,
  } = usePortalNavigation<Tab>({
    portalKey: 'clerk',
    defaultTab: 'dashboard',
    storageKey: 'vcfd_clerk_tab',
  });

  const handleTabChange = setActiveTab;

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState(1);
  const [hasGap, setHasGap] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);

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
      .channel(`clerk-unread-badge-${user.id}`)
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

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.enrollmentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clerkNavGroups: DrawerNavGroup<Tab>[] = [
    {
      category: 'Overview',
      items: [
        {
          tab: 'dashboard',
          icon: <LayoutDashboard size={18} />,
          label: 'Dashboard Overview',
          description: 'Key metrics, summaries & activity',
        },
      ],
    },
    {
      category: 'Student Administration',
      items: [
        {
          tab: 'students',
          icon: <Users size={18} />,
          label: 'Student Directory',
          description: 'Manage profiles, search & academic status',
        },
        {
          tab: 'registration',
          icon: <UserPlus size={18} />,
          label: 'New Admission',
          description: 'Step-by-step student enrollment form',
        },
        {
          tab: 'documents',
          icon: <FileText size={18} />,
          label: 'Document Manager',
          description: 'Certificates, IDs & verification files',
        },
        {
          tab: 'bonafide',
          icon: <FileSignature size={18} />,
          label: 'Bonafide Certificates',
          description: 'Generate & issue official college certificates',
        },
      ],
    },
    {
      category: 'Finance & Supplies',
      items: [
        {
          tab: 'stationary',
          icon: <Package size={18} />,
          label: 'Stationary & Expenses',
          description: 'Purchase logs, inventory & vendor payments',
        },
        {
          tab: 'scholarships',
          icon: <GraduationCap size={18} />,
          label: 'Scholarship Dispatches',
          description: 'Govt & institutional grant installments',
        },
      ],
    },
    {
      category: 'Staff & Communications',
      items: [
        {
          tab: 'attendance',
          icon: <Clock size={18} />,
          label: 'My Attendance',
          description: 'Daily check-in, check-out & logs',
        },
        {
          tab: 'messages',
          icon: <MessageSquare size={18} />,
          label: 'Messages & Chat',
          description: 'Direct communication with staff & admin',
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
        portalTitle="Clerk Portal"
        roleBadgeText="Clerk"
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        groups={clerkNavGroups}
        onSync={onSync ? handleSync : undefined}
        isSyncing={isSyncing}
        onLogout={onLogout}
      />

      {/* Right Column: Top Header + Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with Employee Name, Full Email, Refresh and Signout on the right */}
        <PortalHeader
          portalTitle="Clerk Portal"
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

        {/* Main Content Area (Full screen width) */}
        <main ref={mainRef} className="flex-1 p-2 sm:p-4 md:p-8 overflow-y-auto pb-8 w-full max-w-full overflow-x-hidden">
        <div className="w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardTab key="dashboard" students={students} stationaryRecords={stationaryRecords} scholarshipRecords={scholarshipRecords} setActiveTab={handleTabChange} />}
            {activeTab === 'students' && (
              <StudentsTab
                key="students"
                students={students}
                setStudents={setStudents}
                scholarshipRecords={scholarshipRecords}
                setScholarshipRecords={setScholarshipRecords}
                bonafideRecords={bonafideRecords}
                setBonafideRecords={setBonafideRecords}
                onSync={onSync ? handleSync : undefined}
                onPreviewDoc={setPreviewDoc}
              />
            )}
            {activeTab === 'registration' && <RegistrationTab students={students} setStudents={setStudents} setActiveTab={handleTabChange} />}

            {activeTab === 'documents' && <DocumentsTab key="documents" students={students} setStudents={setStudents} onPreviewDoc={setPreviewDoc} />}
            {activeTab === 'stationary' && (
              <motion.div key="stationary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <StationaryDashboard records={stationaryRecords} setRecords={setStationaryRecords} currentUserRole={user.role} />
              </motion.div>
            )}
            {activeTab === 'bonafide' && (
              <motion.div key="bonafide" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <BonafideTab students={students} setStudents={setStudents} records={bonafideRecords} setRecords={setBonafideRecords} currentUser={user} />
              </motion.div>
            )}
            {activeTab === 'scholarships' && (
              <motion.div key="scholarships" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <ScholarshipDashboard records={scholarshipRecords} setRecords={setScholarshipRecords} students={students} setStudents={setStudents} currentUserRole="clerk" />
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
            {activeTab === 'attendance' && (
              <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
                <EmployeeAttendanceTab user={user} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      </div>



      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}

interface NavItemProps {
  key?: React.Key;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function NavItem({ active, onClick, icon, label, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active
          ? 'bg-[#1e293b] text-white shadow-md'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      {icon}
      {label}
      {badge != null && badge > 0 ? (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : active ? (
        <ChevronRight size={16} className="ml-auto opacity-50" />
      ) : null}
    </button>
  );
}

// --- Tabs Components ---


function DashboardTab({
  students,
  stationaryRecords,
  scholarshipRecords,
  setActiveTab
}: {
  students: Student[],
  stationaryRecords: StationaryRecord[],
  scholarshipRecords: ScholarshipRecord[],
  setActiveTab: (tab: Tab) => void,
  key?: string
}) {
  const pendingDocsCount = students.filter(s => !s.documentsComplete).length;
  const pendingStationaryPayments = stationaryRecords.filter(r => r.paymentStatus !== 'Paid').length;
  // Show total scholarship records (all statuses), not just 'Pending'
  const totalScholarshipApps = scholarshipRecords.length;
  const pendingScholarshipApps = scholarshipRecords.filter(r => r.status === 'Pending' || r.status === 'Partial').length;
  const recentStudents = [...students].sort((a, b) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()).slice(0, 4);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clerk Overview</h2>
          <p className="text-sm text-slate-500 mt-1">Snapshot of admissions, documents, payments, and scholarships.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
        <KPICard
          title="Total Students"
          value={students.length.toString()}
          icon={<Users size={22} />}
          trend="Active enrolled"
          color="bg-sky-50 text-sky-600"
          borderColor="border-sky-100"
        />
        <KPICard
          title="Pending Payments"
          value={pendingStationaryPayments.toString()}
          icon={<Wallet size={22} />}
          trend="Stationary / Other"
          color="bg-rose-50 text-rose-600"
          borderColor="border-rose-100"
        />
        <KPICard
          title="Scholarships"
          value={totalScholarshipApps.toString()}
          icon={<GraduationCap size={22} />}
          trend={pendingScholarshipApps > 0 ? `${pendingScholarshipApps} pending/partial` : 'All up to date'}
          color="bg-emerald-50 text-emerald-600"
          borderColor="border-emerald-100"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <button onClick={() => setActiveTab('students')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-xl transition-all text-slate-700 hover:text-indigo-700 group">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
            <span className="text-sm font-semibold text-center">Student Management</span>
          </button>
          <button onClick={() => setActiveTab('registration')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-sky-50 border border-slate-100 hover:border-sky-200 rounded-xl transition-all text-slate-700 hover:text-sky-700 group">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <UserPlus size={18} />
            </div>
            <span className="text-sm font-semibold text-center">New Admission</span>
          </button>
          <button onClick={() => setActiveTab('documents')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 rounded-xl transition-all text-slate-700 hover:text-amber-700 group">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <ClipboardCheck size={18} />
            </div>
            <span className="text-sm font-semibold text-center">Verify Docs</span>
          </button>
          <button onClick={() => setActiveTab('stationary')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 rounded-xl transition-all text-slate-700 hover:text-rose-700 group">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <Wallet size={18} />
            </div>
            <span className="text-sm font-semibold text-center">Record Expense</span>
          </button>
          <button onClick={() => setActiveTab('scholarships')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all text-slate-700 hover:text-emerald-700 group">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <GraduationCap size={18} />
            </div>
            <span className="text-sm font-semibold text-center">Scholarships</span>
          </button>
          <button onClick={() => setActiveTab('bonafide')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-xl transition-all text-slate-700 hover:text-purple-700 group">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <FileSignature size={18} />
            </div>
            <span className="text-sm font-semibold text-center">Bonafide Certificates</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts & Tasks */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" /> Pending Tasks & Alerts
          </h3>
          <div className="space-y-4 flex-1">

            {pendingStationaryPayments > 0 && (
              <div className="flex items-start gap-3 p-3 bg-rose-50/50 rounded-lg border border-rose-100">
                <Wallet size={16} className="text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-rose-900">{pendingStationaryPayments} Unpaid expenses</p>
                  <p className="text-xs text-rose-700 mt-1">Stationary or other purchases pending full payment.</p>
                </div>
                <button onClick={() => setActiveTab('stationary')} className="ml-auto text-xs font-bold bg-white text-rose-600 px-3 py-1.5 rounded-md border border-rose-200 hover:bg-rose-50 shrink-0">View</button>
              </div>
            )}

            {pendingScholarshipApps > 0 && (
              <div className="flex items-start gap-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                <GraduationCap size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">{pendingScholarshipApps} Pending/Partial scholarships</p>
                  <p className="text-xs text-emerald-700 mt-1">New scholarship applications awaiting verification.</p>
                </div>
                <button onClick={() => setActiveTab('scholarships')} className="ml-auto text-xs font-bold bg-white text-emerald-600 px-3 py-1.5 rounded-md border border-emerald-200 hover:bg-emerald-50 shrink-0">View</button>
              </div>
            )}

            {pendingStationaryPayments === 0 && pendingScholarshipApps === 0 && (
              <div className="text-center py-8">
                <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-500">No pending alerts right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Admissions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-sky-500" /> Recent Admissions
            </h3>
            <button onClick={() => setActiveTab('students')} className="text-xs font-semibold text-sky-600 hover:text-sky-700">View All</button>
          </div>
          <div className="space-y-3 flex-1">
            {recentStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shadow-sm">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.course} &bull; {s.enrollmentId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-700">{s.admissionDate}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.documentsComplete ? 'Docs Verified' : 'Not Applicable'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </motion.div>
  );
}

function KPICard({ title, value, icon, trend, color, borderColor }: { title: string, value: string, icon: React.ReactNode, trend: string, color: string, borderColor: string }) {
  return (
    <div className={`bg-white p-5 rounded-xl shadow-sm border ${borderColor} flex flex-col relative overflow-hidden group hover:shadow-md transition-all`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color} shrink-0`}>
          {icon}
        </div>
        <div>
          <h4 className="text-2xl font-black text-slate-900 leading-none mb-1">{value}</h4>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-500 font-medium">{trend}</p>
      </div>
    </div>
  );
}

interface StudentsTabProps {
  students: Student[];
  setStudents: (val: Student[]) => void;
  scholarshipRecords: ScholarshipRecord[];
  setScholarshipRecords: (val: ScholarshipRecord[]) => void;
  bonafideRecords?: BonafideRecord[];
  setBonafideRecords?: (val: BonafideRecord[]) => void;
  onSync?: () => Promise<void>;
  onPreviewDoc?: (doc: DocumentPreviewItem) => void;
  key?: string;
}

function StudentsTab({
  students,
  setStudents,
  scholarshipRecords,
  setScholarshipRecords,
  bonafideRecords = [],
  setBonafideRecords,
  onSync,
  onPreviewDoc,
}: StudentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [studyYearFilter, setStudyYearFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Deletion States
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentsToDelete, setStudentsToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [deletedCount, setDeletedCount] = useState(1);

  const handleDeleteStudents = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setIsDeleting(true);
    setDeletedCount(ids.length);

    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

    // 1. Gather all student entities and their IDs
    const studentsToDel = students.filter(s => ids.includes(s.id));
    const targetIds = Array.from(new Set([...ids, ...studentsToDel.map(s => s.id)]));
    const validUuids = targetIds.filter(id => isUuid(id));
    const enrollmentIds = Array.from(new Set(studentsToDel.map(s => s.enrollmentId).filter(Boolean)));
    const studentNames = Array.from(new Set(studentsToDel.map(s => s.name).filter(Boolean)));

    // 2. Optimistic UI update: close confirmation modal, update lists, and show beautiful SuccessAnimation modal
    setIsDeleteModalOpen(false);
    setShowDeleteSuccessModal(true);

    const remainingStudents = students.filter(
      s => !targetIds.includes(s.id) && !(s.enrollmentId && enrollmentIds.includes(s.enrollmentId))
    );
    setStudents(remainingStudents);

    if (setScholarshipRecords) {
      const remainingScholarships = (scholarshipRecords || []).filter(
        r => !targetIds.includes(r.studentId) && !(r.enrollmentId && enrollmentIds.includes(r.enrollmentId))
      );
      setScholarshipRecords(remainingScholarships);
    }

    if (setBonafideRecords) {
      const remainingBonafide = (bonafideRecords || []).filter(
        b => !targetIds.includes(b.studentId) && !(b.studentName && studentNames.includes(b.studentName))
      );
      setBonafideRecords(remainingBonafide);
    }

    setSelectedStudentIds(prev => prev.filter(id => !targetIds.includes(id)));
    if (viewingStudent && (targetIds.includes(viewingStudent.id) || (viewingStudent.enrollmentId && enrollmentIds.includes(viewingStudent.enrollmentId)))) {
      setViewingStudent(null);
    }

    setTimeout(() => {
      setShowDeleteSuccessModal(false);
      setStudentsToDelete([]);
      setIsDeleting(false);
    }, 2200);

    try {
      // 3. Collect storage files for deletion
      const studentDocPaths: string[] = [];
      const avatarPaths: string[] = [];
      const scholarshipDocPaths: string[] = [];

      for (const student of studentsToDel) {
        // Collect student documents
        if (student.documents && Array.isArray(student.documents)) {
          for (const docStr of student.documents) {
            try {
              let docUrl = docStr;
              if (typeof docStr === 'string' && docStr.trim().startsWith('{')) {
                const parsed = JSON.parse(docStr);
                docUrl = parsed.url || docStr;
              }
              const parsedStorage = parseSupabaseStorageUrl(docUrl, 'student_documents');
              if (parsedStorage && parsedStorage.path) {
                studentDocPaths.push(parsedStorage.path);
              } else if (typeof docUrl === 'string' && docUrl.trim()) {
                const clean = docUrl.split('?')[0];
                const fileName = clean.split('/').pop();
                if (fileName && fileName.length > 2) {
                  studentDocPaths.push(decodeURIComponent(fileName));
                }
              }
            } catch (e) {}
          }
        }

        // Collect student avatar / profile photo
        if (student.photoUrl && typeof student.photoUrl === 'string') {
          try {
            const parsedPhoto = parseSupabaseStorageUrl(student.photoUrl, 'avatars');
            if (parsedPhoto && parsedPhoto.path) {
              avatarPaths.push(parsedPhoto.path);
            } else {
              const clean = student.photoUrl.split('?')[0];
              const fileName = clean.split('/').pop();
              if (fileName && fileName.length > 2) {
                avatarPaths.push(decodeURIComponent(fileName));
              }
            }
          } catch (e) {}
        }
      }

      // Collect scholarship documents & installment proofs
      const relScholarshipRecords = (scholarshipRecords || []).filter(
        r => targetIds.includes(r.studentId) || (r.enrollmentId && enrollmentIds.includes(r.enrollmentId))
      );
      for (const sch of relScholarshipRecords) {
        if (sch.documents && Array.isArray(sch.documents)) {
          for (const d of sch.documents) {
            if (d.fileName) scholarshipDocPaths.push(d.fileName);
          }
        }
        if (sch.installments && Array.isArray(sch.installments)) {
          for (const inst of sch.installments) {
            if (inst.proofUrl) {
              const parsedProof = parseSupabaseStorageUrl(inst.proofUrl, 'scholarship_documents');
              if (parsedProof && parsedProof.path) {
                scholarshipDocPaths.push(parsedProof.path);
              } else {
                const clean = inst.proofUrl.split('?')[0];
                const fn = clean.split('/').pop();
                if (fn && fn.length > 2) scholarshipDocPaths.push(decodeURIComponent(fn));
              }
            }
          }
        }
      }

      // Delete storage files (non-blocking)
      const uniqueStudentDocs = Array.from(new Set(studentDocPaths));
      const uniqueAvatars = Array.from(new Set(avatarPaths));
      const uniqueScholarshipDocs = Array.from(new Set(scholarshipDocPaths));

      if (uniqueStudentDocs.length > 0) {
        try {
          await supabase.storage.from('student_documents').remove(uniqueStudentDocs);
        } catch (e) {
          console.warn('Error deleting student_documents storage files:', e);
        }
      }
      if (uniqueAvatars.length > 0) {
        try {
          await supabase.storage.from('avatars').remove(uniqueAvatars);
        } catch (e) {
          console.warn('Error deleting avatars storage files:', e);
        }
      }
      if (uniqueScholarshipDocs.length > 0) {
        try {
          await supabase.storage.from('scholarship_documents').remove(uniqueScholarshipDocs);
        } catch (e) {
          console.warn('Error deleting scholarship_documents storage files:', e);
        }
      }

      // 4. Try atomic stored procedure if present on database
      for (const sId of targetIds) {
        const studentObj = studentsToDel.find(s => s.id === sId);
        const enrId = studentObj?.enrollmentId || null;
        if (isUuid(sId)) {
          try {
            await supabase.rpc('delete_student_cascade', {
              p_student_id: sId,
              p_enrollment_id: enrId
            });
          } catch (e) {
            // If RPC doesn't exist yet in Supabase, direct queries below will execute
          }
        }
      }

      // 5. Cascade delete dependent scholarship records in Supabase
      let scholarshipRecordIds: string[] = [];
      if (validUuids.length > 0) {
        const { data: sch1 } = await supabase
          .from('scholarship_records')
          .select('id')
          .in('student_id', validUuids);
        if (sch1 && sch1.length > 0) {
          scholarshipRecordIds.push(...sch1.map((r: any) => r.id));
        }
      }
      if (enrollmentIds.length > 0) {
        const { data: sch2 } = await supabase
          .from('scholarship_records')
          .select('id')
          .in('enrollment_id', enrollmentIds);
        if (sch2 && sch2.length > 0) {
          scholarshipRecordIds.push(...sch2.map((r: any) => r.id));
        }
      }
      scholarshipRecordIds = Array.from(new Set(scholarshipRecordIds));

      if (scholarshipRecordIds.length > 0) {
        await supabase.from('scholarship_documents').delete().in('record_id', scholarshipRecordIds);
        await supabase.from('scholarship_installments').delete().in('record_id', scholarshipRecordIds);
        await supabase.from('scholarship_records').delete().in('id', scholarshipRecordIds);
      }
      if (enrollmentIds.length > 0) {
        await supabase.from('scholarship_records').delete().in('enrollment_id', enrollmentIds);
      }
      if (validUuids.length > 0) {
        await supabase.from('scholarship_records').delete().in('student_id', validUuids);
      }

      // 6. Cascade delete bonafide records
      if (validUuids.length > 0) {
        await supabase.from('bonafide_records').delete().in('student_id', validUuids);
      }
      if (studentNames.length > 0) {
        await supabase.from('bonafide_records').delete().in('student_name', studentNames);
      }

      // 7. Delete from students table in Supabase
      if (validUuids.length > 0) {
        const { error: delErr } = await supabase.from('students').delete().in('id', validUuids);
        if (delErr) {
          console.warn('Error deleting students by UUID, attempting fallback by enrollment_id:', delErr);
          if (enrollmentIds.length > 0) {
            await supabase.from('students').delete().in('enrollment_id', enrollmentIds);
          }
        }
      } else if (enrollmentIds.length > 0) {
        await supabase.from('students').delete().in('enrollment_id', enrollmentIds);
      }

      // 8. Realtime sync refresh
      if (onSync) {
        await onSync();
      }

    } catch (err: any) {
      logError('delete students', err);
    }
  };

  const filteredStudents = students.filter(s => {
    if (branchFilter && s.branch !== branchFilter && s.course !== branchFilter) return false;
    if (categoryFilter) {
      const normCat = (s.category || 'OPEN').trim().toUpperCase();
      const normFilter = categoryFilter.trim().toUpperCase();
      if (normFilter === 'OPEN' || normFilter === 'GENERAL') {
        if (normCat !== 'OPEN' && normCat !== 'GENERAL') return false;
      } else if (normCat !== normFilter) {
        return false;
      }
    }
    if (semesterFilter && s.semester.toString() !== semesterFilter) return false;
    if (studyYearFilter && s.studyYear !== studyYearFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) &&
        !s.enrollmentId.toLowerCase().includes(q) &&
        !(s.rollNo && s.rollNo.toLowerCase().includes(q)) &&
        !(s.prnNo && s.prnNo.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  const branches = Array.from(new Set(['BA Fashion Design', 'BSc Clinical Laboratory CLS', ...students.map(s => s.branch || s.course).filter(Boolean)]));
  const categories = Array.from(new Set(['OPEN', 'OBC', 'SC', 'ST', 'VJNT', 'EWS', ...students.map(s => s.category).filter(Boolean)]));

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      setIsLoading(true);

      const updateData = {
        name: editingStudent.name,
        email: editingStudent.email,
        phone: editingStudent.phone,
        address: editingStudent.address,
        father_name: editingStudent.fatherName,
        course: editingStudent.course,
        branch: editingStudent.branch,
        semester: editingStudent.semester,
        batch_year: editingStudent.batchYear,
        study_year: editingStudent.studyYear,
        category: editingStudent.category,
        sub_caste: editingStudent.subCaste,
        prn_no: editingStudent.prnNo,
        roll_no: editingStudent.rollNo,
        dob: editingStudent.dob,
        pincode: editingStudent.pincode,
        alternate_phone: editingStudent.alternatePhone,
      };

      try {
        const { error } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', editingStudent.id);

        if (error) throw error;

        setStudents(students.map(s => s.id === editingStudent.id ? editingStudent : s));
        setViewingStudent(editingStudent);
        setEditingStudent(null);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      } catch (err: any) {
        logError('update student', err);
        alert(toUserMessage('update student'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (editingStudent) {
      setEditingStudent({
        ...editingStudent,
        [e.target.name]: e.target.value
      });
    }
  };

  const handleRealDownload = (e: React.MouseEvent, docUrl: string) => {
    e.stopPropagation();
    if (!docUrl || docUrl.startsWith('Downloading')) return;
    const a = document.createElement('a');
    a.href = docUrl;
    a.download = docUrl.split('/').pop() || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderDocRow = (label: string, isMandatory: boolean = false) => {
    let docUrl = null;
    if (viewingStudent?.documents) {
      for (const docStr of viewingStudent.documents) {
        try {
          const parsed = JSON.parse(docStr);
          if (parsed.name === label && parsed.url) {
            docUrl = parsed.url;
            break;
          }
        } catch (e) { }
      }
    }
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
        <div className="flex items-center gap-2">
          <FileText size={16} className={docUrl ? "text-emerald-500" : "text-slate-300"} />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <div>
          {docUrl ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPreviewDoc ? onPreviewDoc({ title: label, url: docUrl, bucket: 'student_documents' }) : openFileUrl(docUrl, 'student_documents'); }}
              className="flex items-center gap-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-2xs"
            >
              <Eye size={12} /> View
            </button>
          ) : (
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">Not Applicable</span>
          )}
        </div>
      </div>
    );
  };

  const renderEditDocRow = (label: string) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
      <label className="block text-sm font-semibold text-slate-900 mb-2">{label} <span className="text-xs font-normal text-slate-500">(Max 5MB)</span></label>
      <div className="flex items-center gap-2">
        <input type="file" accept={ALLOWED_FILE_TYPES.join(',')} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e293b] file:text-white hover:file:bg-slate-800" />
      </div>
    </div>
  );

  if (editingStudent) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative">
        <Loader show={isLoading} fullScreen={false} />
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
          <div>
            <button type="button" onClick={() => { setEditingStudent(null); setViewingStudent(editingStudent); }} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center text-sm font-medium mb-1">
              <ChevronRight size={16} className="rotate-180" /> Cancel Editing
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Edit Student: {editingStudent.name}</h2>
          </div>
        </div>

        <form onSubmit={handleSaveEdit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-8">
          <div>
            <h4 className="font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Basic Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Name <span className="text-rose-500">*</span></label><input type="text" name="name" value={editingStudent.name} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Date of Birth <span className="text-rose-500">*</span></label><input type="date" name="dob" value={editingStudent.dob || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Father's Name</label><input type="text" name="fatherName" value={editingStudent.fatherName || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">Course</label>
                <select name="course" value={editingStudent.course} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg bg-white">
                  <option value="BA Fashion Design">BA Fashion Design</option>
                  <option value="BSc Clinical Laboratory CLS">BSc Clinical Laboratory CLS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">Branch</label>
                <select name="branch" value={editingStudent.branch} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg bg-white">
                  <option value="BA Fashion Design">BA Fashion Design</option>
                  <option value="BSc Clinical Laboratory CLS">BSc Clinical Laboratory CLS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">Category <span className="text-rose-500">*</span></label>
                <select name="category" value={editingStudent.category} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg">
                  <option value="OPEN">OPEN</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="VJNT">VJNT</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Semester <span className="text-rose-500">*</span></label><input type="number" name="semester" value={editingStudent.semester} onChange={handleEditChange} min="1" max="10" className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">Study Year <span className="text-rose-500">*</span></label>
                <select name="studyYear" value={editingStudent.studyYear || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" required>
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Batch Year <span className="text-rose-500">*</span></label><input type="text" name="batchYear" value={editingStudent.batchYear || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Phone</label><input type="tel" name="phone" value={editingStudent.phone} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Email <span className="text-rose-500">*</span></label><input type="email" name="email" value={editingStudent.email} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">PRN No. <span className="text-rose-500">*</span></label><input type="text" name="prnNo" value={editingStudent.prnNo || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Roll No. <span className="text-xs font-normal text-slate-400">(Optional)</span></label><input type="text" name="rollNo" value={editingStudent.rollNo || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1 text-slate-700">Address</label>
                <textarea name="address" value={editingStudent.address || ''} onChange={handleEditChange} rows={2} className="w-full px-4 py-2 border rounded-lg"></textarea>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Bank Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Bank Name</label><input type="text" name="bankName" value={editingStudent.bankName || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Account No.</label><input type="text" name="bankAccountNo" value={editingStudent.bankAccountNo || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">IFSC Code</label><input type="text" name="bankIfsc" value={editingStudent.bankIfsc || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-700">Bank Branch</label><input type="text" name="bankBranch" value={editingStudent.bankBranch || ''} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" /></div>
            </div>
          </div>



          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">Save Changes</button>
          </div>
        </form>
      </motion.div>
    );
  }

  const renderDeleteModal = () => {
    if (!isDeleteModalOpen) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isDeleting) {
            setIsDeleteModalOpen(false);
            setStudentsToDelete([]);
          }
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-[100000] border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
                <p className="text-sm text-slate-500">This action is permanent and non-reversible.</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5">
              <p className="text-sm text-rose-800 font-semibold">
                ⚠️ You are about to permanently delete <span className="font-extrabold">{studentsToDelete.length || 1}</span> student{studentsToDelete.length > 1 ? 's' : ''}.
              </p>
              <p className="text-xs text-rose-700 mt-1.5 leading-relaxed">
                All student data, documents, marksheets, certificates, and photos will be permanently erased from the database and storage.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setStudentsToDelete([]);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStudents(studentsToDelete)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-md shadow-rose-600/20"
              >
                <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Student'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderDeleteSuccessModal = () => {
    if (!showDeleteSuccessModal) return null;
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative z-[100000] border border-slate-100 animate-in zoom-in-95 duration-200">
          <SuccessAnimation
            title="Deletion Successful!"
            message={`Successfully deleted ${deletedCount} student${deletedCount > 1 ? 's' : ''}.`}
            subMessage="Student record and storage files were permanently removed."
            color="rose"
          />
        </div>
      </div>,
      document.body
    );
  };

  if (viewingStudent) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        {renderDeleteModal()}
        {renderDeleteSuccessModal()}
        <SuccessToast show={showSuccessToast} message="Student deleted successfully!" />
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
          <div>
            <button onClick={() => setViewingStudent(null)} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center text-sm font-medium mb-1">
              <ChevronRight size={16} className="rotate-180" /> Back to Students
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Student Profile</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStudentsToDelete([viewingStudent.id]);
                setIsDeleteModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              <Trash2 size={16} /> Delete Student
            </button>
            <button onClick={() => { setEditingStudent(viewingStudent); setViewingStudent(null); }} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer">
              <Edit size={16} /> Edit Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                <UserPlus size={18} className="text-[#1e293b]" /> Basic Details
              </h4>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-32 h-32 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {viewingStudent.photoUrl ? (
                    <img src={viewingStudent.photoUrl} alt={viewingStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserPlus size={40} className="text-slate-300" />
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                  <div className="min-w-0"><p className="text-xs text-slate-500">Student Name</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.name}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Date of Birth</p><p className="text-sm font-medium text-slate-900">{viewingStudent.dob ? new Date(viewingStudent.dob).toLocaleDateString() : 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Father's Name</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.fatherName || 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Enrollment ID</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.enrollmentId}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">PRN No.</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.prnNo || 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Roll No.</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.rollNo || 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Branch</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.branch}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Course</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.course}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Semester</p><p className="text-sm font-medium text-slate-900">Semester {viewingStudent.semester}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Study Year</p><p className="text-sm font-medium text-slate-900">{viewingStudent.studyYear ? viewingStudent.studyYear + (viewingStudent.studyYear === '1' ? 'st' : viewingStudent.studyYear === '2' ? 'nd' : viewingStudent.studyYear === '3' ? 'rd' : 'th') + ' Year' : 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Batch Year</p><p className="text-sm font-medium text-slate-900">{viewingStudent.batchYear || 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Category</p><p className="text-sm font-medium text-slate-900">{viewingStudent.category}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Phone</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.phone || 'N/A'}</p></div>
                  <div className="min-w-0"><p className="text-xs text-slate-500">Email</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.email || 'N/A'}</p></div>
                  <div className="col-span-2 min-w-0"><p className="text-xs text-slate-500">Address</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.address || 'N/A'} {viewingStudent.pincode ? ` - ${viewingStudent.pincode}` : ''}</p></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Briefcase size={18} className="text-[#1e293b]" /> Bank Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="min-w-0"><p className="text-xs text-slate-500">Bank Name</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.bankName || 'N/A'}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">Account No.</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.bankAccountNo || 'N/A'}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">IFSC Code</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.bankIfsc || 'N/A'}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">Bank Branch</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.bankBranch || 'N/A'}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">Account Holder Name</p><p className="text-sm font-medium text-slate-900 break-words">{viewingStudent.accountHolderName || 'N/A'}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">UPI ID</p><p className="text-sm font-medium text-slate-900 break-all">{viewingStudent.upiId || 'N/A'}</p></div>
              </div>
            </div>
          </div>

          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <FileText size={18} className="text-[#1e293b]" /> Documents
              </h4>
              <div>
                {renderDocRow("10th Marksheet", true)}
                {renderDocRow("12th Marksheet", true)}
                {renderDocRow("Aadhar Card", true)}
                {renderDocRow("Transfer Certificate (TC)", true)}
                {renderDocRow("Caste Certificate", viewingStudent.category !== 'OPEN' && viewingStudent.category !== 'Other')}
                {renderDocRow("Domicile / Rahivasi", false)}
                {renderDocRow("Gap Certificate", false)}
                {renderDocRow("Ration Card", viewingStudent.category === 'OBC')}
                {renderDocRow("Declaration Certificate", ['ST', 'OPEN', 'VJNT', 'OBC'].includes(viewingStudent.category))}
                {renderDocRow("Income Certificate", false)}
                {renderDocRow("PAN Card", false)}
                {renderDocRow("Other Course Document", false)}
              </div>
            </div>
          </div>
        </div>

      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative">
      <Loader show={isLoading} fullScreen={false} />
      {renderDeleteModal()}
      {renderDeleteSuccessModal()}
      <SuccessToast show={showSuccessToast} message="Student deleted successfully!" />

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Student Management</h2>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, PRN, roll no, enrollment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter size={16} /> Filters
          </button>
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Category (Caste)</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Semester</label>
              <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                <option value="">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>Semester {s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Study Year</label>
              <select value={studyYearFilter} onChange={(e) => setStudyYearFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1e293b]">
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setBranchFilter(''); setCategoryFilter(''); setSemesterFilter(''); setStudyYearFilter(''); setSearchQuery(''); }}
                className="w-full px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Bulk Delete Bar ── */}
      <AnimatePresence>
        {selectedStudentIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-3.5"
          >
            <span className="text-sm font-semibold">{selectedStudentIds.length} student{selectedStudentIds.length > 1 ? 's' : ''} selected</span>
            <button
              onClick={() => { setStudentsToDelete(selectedStudentIds); setIsDeleteModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <Trash2 size={15} /> Delete Selected
            </button>
            <button
              onClick={() => setSelectedStudentIds([])}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                    checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStudentIds(filteredStudents.map(s => s.id));
                      else setSelectedStudentIds([]);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">IDs</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Branch/Sem</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? filteredStudents.map(student => (
                <tr key={student.id} className={`hover:bg-slate-50 transition-colors ${selectedStudentIds.includes(student.id) ? 'bg-rose-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudentIds(prev => [...prev, student.id]);
                        else setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 overflow-hidden">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserPlus size={18} className="text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{student.name}</div>
                        <div className="text-xs text-slate-500">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-700"><span className="font-semibold">PRN:</span> {student.prnNo || 'N/A'}</div>
                    <div className="text-xs text-slate-700"><span className="font-semibold">Roll:</span> {student.rollNo || 'N/A'}</div>
                    <div className="text-xs text-slate-700"><span className="font-semibold">ID:</span> {student.enrollmentId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{student.branch}</div>
                    <div className="text-xs text-slate-500">Semester {student.semester}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                      {student.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setViewingStudent(student)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Eye size={14} /> View
                    </button>
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors ml-2"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    <button
                      onClick={() => { setStudentsToDelete([student.id]); setIsDeleteModalOpen(true); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-colors ml-2"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No students found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
function DocumentsTab({ students, setStudents, onPreviewDoc }: { students: Student[], setStudents?: (val: Student[]) => void, onPreviewDoc?: (doc: DocumentPreviewItem) => void, key?: string }) {
  const [branchFilter, setBranchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedFilter, setSubmittedFilter] = useState(''); // '' | 'yes' | 'no'
  const [docTitleFilter, setDocTitleFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [isAddingDocument, setIsAddingDocument] = useState(false);
  const [showDocSuccessToast, setShowDocSuccessToast] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState('');
  const getStudentDocs = (student: Student) => student.documents || [];
  const [mockDocs, setMockDocs] = useState<string[]>([]);
  
  React.useEffect(() => {
    if (selectedStudent) {
      setMockDocs(getStudentDocs(selectedStudent));
    }
  }, [selectedStudent]);

  // Helper to check if a student has a specific doc uploaded
  const studentHasDoc = (s: Student, docName: string) => {
    if (!s.documents) return false;
    return s.documents.some(d => {
      try { return JSON.parse(d).name === docName; } catch { return d === docName; }
    });
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    if (branchFilter && s.branch !== branchFilter) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (semesterFilter && s.semester.toString() !== semesterFilter) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.enrollmentId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Submitted filter logic
    if (submittedFilter === 'yes') {
      // Show only students who have at least one doc uploaded
      // If a specific doc title is also selected, show only students who uploaded that doc
      if (docTitleFilter) {
        if (!studentHasDoc(s, docTitleFilter)) return false;
      } else {
        if (!s.documents || s.documents.length === 0) return false;
      }
    } else if (submittedFilter === 'no') {
      // Show only students who have NOT uploaded the selected document
      if (docTitleFilter) {
        if (studentHasDoc(s, docTitleFilter)) return false;
      } else {
        // No doc selected + No submitted: show students with incomplete docs
        if (s.documentsComplete) return false;
      }
    }
    return true;
  });

  const branches = Array.from(new Set(students.map(s => s.branch)));
  const categories = Array.from(new Set(students.map(s => s.category)));
  const semesters = Array.from(new Set(students.map(s => s.semester)));

  const STANDARD_DOCS = [
    '10th Marksheet',
    '12th Marksheet',
    'Aadhar Card',
    'PAN Card',
    'Transfer Certificate (TC)',
    'Caste Certificate',
    'Domicile / Rahivasi',
    'Gap Certificate',
    'Income Certificate',
    'Ration Card',
    'Declaration Certificate',
    'Other Course Document'
  ];

  const getDocUrl = (docName: string) => {
    for (const doc of mockDocs) {
      try {
        const parsed = JSON.parse(doc);
        if (parsed.name === docName) return parsed.url;
      } catch (e) {
        // Fallback for simple strings (mock data)
        if (doc === docName) return 'mock_url'; 
      }
    }
    return null;
  };
  
  const getDocFromList = (docList: string[], docName: string) => {
    for (const doc of docList) {
      try {
        const parsed = JSON.parse(doc);
        if (parsed.name === docName) return parsed.url;
      } catch (e) {
        if (doc === docName) return 'mock_url';
      }
    }
    return null;
  }

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, docName: string) => {
    if (e.target.files && e.target.files.length > 0 && selectedStudent) {
      const file = e.target.files[0];
      const errorMsg = await validateFile(file, ALLOWED_FILE_TYPES);
      if (errorMsg) {
        alert(errorMsg);
        e.target.value = '';
        return;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedStudent.enrollmentId}-${docName.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}.${fileExt}`;

      try {
        const { error } = await supabase.storage.from('student_documents').upload(fileName, file);
        if (error) throw error;

        const { data: signData } = await supabase.storage.from('student_documents').createSignedUrl(fileName, 86400 * 365);
        const newDocEntry = JSON.stringify({ name: docName, url: signData?.signedUrl || fileName });
        const updatedDocs = [...mockDocs, newDocEntry];

        await supabase.from('students').update({
          documents: updatedDocs,
          // Simple logic for documents_complete can be re-evaluated later
          documents_complete: updatedDocs.length > 0 
        }).eq('id', selectedStudent.id);

        setMockDocs(updatedDocs);
        if (setStudents) {
          setStudents(students.map(s =>
            s.id === selectedStudent.id ? { ...s, documents: updatedDocs, documentsComplete: updatedDocs.length > 0 } : s
          ));
          setSelectedStudent({ ...selectedStudent, documentsComplete: updatedDocs.length > 0, documents: updatedDocs });
        }
      } catch (err: any) {
        logError('upload document', err);
        alert(toUserMessage('upload file'));
      }
    }
  };

  const renderDocCard = (docName: string, isCustom = false, isMandatory = false) => {
    const docUrl = getDocUrl(docName);

    return (
      <div key={docName} className="flex flex-col justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group hover:border-slate-300 transition-all">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl ${docUrl ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate" title={docName}>{docName}</p>
              <p className={`text-xs font-semibold ${docUrl ? 'text-emerald-600' : 'text-slate-400'}`}>
                {docUrl ? '✓ Uploaded & Verified' : 'Not Uploaded'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          {docUrl ? (
            <>
              <button 
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const previewPayload = { title: docName, url: docUrl !== 'mock_url' ? docUrl : '', bucket: 'student_documents' };
                  if (onPreviewDoc) {
                    onPreviewDoc(previewPayload);
                  } else {
                    openFileUrl(docUrl !== 'mock_url' ? docUrl : '', 'student_documents');
                  }
                }} 
                className="flex-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/90 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs" 
                title="View Document"
              >
                <Eye size={14} className="text-sky-600" /> View
              </button>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRealDownload(e, docUrl !== 'mock_url' ? docUrl : docName); }} 
                className="flex-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs" 
                title="Download Document"
              >
                <FileDown size={14} className="text-emerald-600" /> Download
              </button>
              <button 
                type="button"
                onClick={async () => {
                  const newDocs = mockDocs.filter(d => {
                    try {
                      return JSON.parse(d).name !== docName;
                    } catch {
                      return d !== docName;
                    }
                  });
                  setMockDocs(newDocs);
                  if (selectedStudent) {
                    await supabase.from('students').update({ documents: newDocs }).eq('id', selectedStudent.id);
                    if (setStudents) setStudents(students.map(s => s.id === selectedStudent.id ? { ...s, documents: newDocs } : s));
                  }
                }} 
                className="px-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/90 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Remove Document"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <label className="cursor-pointer w-full text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 hover:border-sky-300 border border-sky-200/90 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-2xs">
              <Upload size={14} className="text-sky-600 shrink-0" />
              <span className="text-sky-800 font-bold">Upload File (Max 5MB)</span>
              <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => handleUploadDoc(e, docName)} />
            </label>
          )}
        </div>
      </div>
    );
  };

  if (selectedStudent) {
    const customDocs = mockDocs.filter(doc => {
      try {
        const parsed = JSON.parse(doc);
        return !STANDARD_DOCS.includes(parsed.name);
      } catch (e) {
        return !STANDARD_DOCS.includes(doc);
      }
    }).map(doc => {
        try {
            return JSON.parse(doc).name;
        } catch {
            return doc;
        }
    });

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => { setSelectedStudent(null); setShowDocSuccessToast(true); setTimeout(() => setShowDocSuccessToast(false), 3000); }} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center text-sm font-medium">
                <ChevronRight size={16} className="rotate-180" /> Back to Documents
              </button>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Manage Documents</h2>
            <p className="text-sm text-slate-500">Managing files for <span className="font-semibold text-slate-700">{selectedStudent.name}</span> ({selectedStudent.enrollmentId})</p>
          </div>
          <button
            onClick={async () => {
              if (setStudents && selectedStudent) {
                setStudents(students.map(s => s.id === selectedStudent.id ? { ...s, documents: mockDocs } : s));
              }
              setSelectedStudent(null);
            }}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <CheckCircle size={16} /> Close Document Manager
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-[#1e293b]" /> Standard Documents</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {STANDARD_DOCS.map(docName => {
                let isMandatory = false;
                if (docName === '10th Marksheet' || docName === '12th Marksheet' || docName === 'Aadhar Card') isMandatory = true;
                if (docName === 'Caste Certificate' && selectedStudent?.category !== 'OPEN' && selectedStudent?.category !== 'Other') isMandatory = true;
                if (docName === 'Ration Card' && selectedStudent?.category === 'OBC') isMandatory = true;
                if (docName === 'Declaration Certificate' && selectedStudent?.category && ['ST', 'OPEN', 'VJNT', 'OBC'].includes(selectedStudent.category)) isMandatory = true;
                return renderDocCard(docName, false, isMandatory);
              })}
            </div>
          </div>
          
          <div className="p-4 border-y border-slate-100 bg-slate-50 flex justify-between items-center mt-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-[#1e293b]" /> Additional Documents</h3>
            <button onClick={() => setIsAddingDocument(true)} className="text-xs font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 flex items-center gap-1">
              <Plus size={14} /> Add New Document
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customDocs.map(docName => renderDocCard(docName, true))}
              
              {customDocs.length === 0 && !isAddingDocument && (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm font-semibold text-slate-600 mb-1">No additional documents</p>
                </div>
              )}

              {/* Add new doc card */}
              {isAddingDocument && (
                <div className="flex flex-col justify-between bg-white p-4 rounded-xl border border-dashed border-sky-300 shadow-sm bg-sky-50/30">
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Document Name</label>
                    <input
                      type="text"
                      value={newDocumentName}
                      onChange={(e) => setNewDocumentName(e.target.value)}
                      placeholder="e.g. Health Certificate"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setIsAddingDocument(false); setNewDocumentName(''); }} className="flex-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <label className={`flex-1 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${newDocumentName ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                      <Upload size={14} className="shrink-0" />
                      <span className="font-bold">Upload File (Max 5MB)</span>
                      <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} disabled={!newDocumentName} onChange={(e) => {
                          handleUploadDoc(e, newDocumentName);
                          setIsAddingDocument(false);
                          setNewDocumentName('');
                      }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <SuccessToast show={showDocSuccessToast} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Document Manager</h2>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col gap-4">
        {/* Row 1: Search + Branch + Category + Semester */}
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search Student</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b]"
              />
            </div>
          </div>

          <div className="w-full md:w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
            <div className="relative">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] appearance-none"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div className="w-full md:w-32">
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] appearance-none"
              >
                <option value="">All</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div className="w-full md:w-32">
            <label className="block text-xs font-medium text-slate-500 mb-1">Semester</label>
            <div className="relative">
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] appearance-none"
              >
                <option value="">All</option>
                {semesters.map(s => <option key={s} value={s.toString()}>Sem {s}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        {/* Row 2: Submitted filter + Document Title filter */}
        <div className="flex flex-col md:flex-row gap-4 items-end pt-3 border-t border-slate-100">
          <div className="w-full md:w-48">
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <ClipboardCheck size={13} className="text-slate-500" /> Document Submitted?
            </label>
            <div className="relative">
              <select
                value={submittedFilter}
                onChange={(e) => { setSubmittedFilter(e.target.value); if (!e.target.value) setDocTitleFilter(''); }}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] appearance-none bg-slate-50"
              >
                <option value="">Any Status</option>
                <option value="yes">✅ Yes — Submitted</option>
                <option value="no">❌ No — Not Submitted</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <FileText size={13} className="text-slate-500" /> Document Title
              {submittedFilter === 'no' && <span className="text-rose-500 text-[10px] ml-1">← select to find students missing this doc</span>}
              {submittedFilter === 'yes' && <span className="text-emerald-600 text-[10px] ml-1">← select to find students who uploaded this doc</span>}
            </label>
            <div className="relative">
              <select
                value={docTitleFilter}
                onChange={(e) => setDocTitleFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]/20 focus:border-[#1e293b] appearance-none bg-slate-50"
                disabled={!submittedFilter}
              >
                <option value="">{submittedFilter ? 'All Documents' : '— Select Submitted? first —'}</option>
                {STANDARD_DOCS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          {(submittedFilter || docTitleFilter || branchFilter || categoryFilter || semesterFilter || searchQuery) && (
            <button
              onClick={() => { setBranchFilter(''); setCategoryFilter(''); setSemesterFilter(''); setSearchQuery(''); setSubmittedFilter(''); setDocTitleFilter(''); }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <X size={13} /> Clear All
            </button>
          )}
        </div>

        {/* Active filter summary pill */}
        {submittedFilter && docTitleFilter && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${submittedFilter === 'yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {submittedFilter === 'yes' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
            Showing students where <strong className="mx-1">&quot;{docTitleFilter}&quot;</strong> is {submittedFilter === 'yes' ? 'submitted ✅' : 'NOT submitted ❌'} — {filteredStudents.length} result{filteredStudents.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.length > 0 ? filteredStudents.map(s => {
          const studentDocs = s.documents || [];

          // Collect all uploaded documents for this student
          const uploadedDocs: { name: string; url: string }[] = [];
          for (const d of studentDocs) {
            try {
              const parsed = JSON.parse(d);
              if (parsed.name && parsed.url) uploadedDocs.push(parsed);
            } catch { }
          }

          return (
            <div key={s.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">{s.enrollmentId}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{s.branch}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{s.category}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">Sem {s.semester}</span>
                  </div>
                </div>
                {s.documentsComplete ? (
                  <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle size={16} /></span>
                ) : (
                  <span className="p-1.5 bg-slate-100 text-slate-400 rounded-lg"><AlertCircle size={16} /></span>
                )}
              </div>

              <div className="space-y-1.5 mb-5 flex-1">
                {uploadedDocs.length > 0 ? (
                  uploadedDocs.map(doc => (
                    <div key={doc.name} className="flex items-center justify-between text-xs p-2 rounded-lg border bg-emerald-50/60 border-emerald-100">
                      <span className="flex items-center gap-1.5 text-slate-700 font-medium truncate max-w-[65%]" title={doc.name}>
                        <FileText size={13} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </span>
                      <span className="text-emerald-600 font-semibold shrink-0">Verified</span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <AlertCircle size={18} className="text-slate-300 mb-1" />
                    <p className="text-xs text-slate-400 font-medium">No documents uploaded yet</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => setSelectedStudent(s)}
                  className="flex-1 bg-[#1e293b] text-white text-xs font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors flex justify-center items-center gap-1.5"
                >
                  <FileSignature size={14} /> Manage Docs
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
            <Search size={40} className="text-slate-300 mb-3" />
            <p className="font-medium text-slate-700">No students found</p>
            <p className="text-sm">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
