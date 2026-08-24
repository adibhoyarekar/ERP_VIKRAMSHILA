import React, { useState, useEffect, useCallback, useRef } from "react";
import { LogOut, FileText, LayoutDashboard, Package, GraduationCap, Activity, AlertCircle, Calendar, TrendingUp, Clock, CheckCircle2, Bell, Building2, RefreshCw, MessageSquare, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { User, Student } from '../data/mockData';
import StationaryDashboard from './stationary/StationaryDashboard';
import { StationaryRecord } from '../types/stationary';
import { ScholarshipRecord } from '../types/scholarship';
import { LedgerEntry } from '../types/ledger';
import ScholarshipDashboard from './scholarship/ScholarshipDashboard';
import LedgerDashboard from './ledger/LedgerDashboard';
import MessagesTab from './MessagesTab';
import { supabase } from '../lib/supabase';
import EmployeeAttendanceTab from './attendance/EmployeeAttendanceTab';
import PortalHeader from './PortalHeader';
import PortalDrawer, { DrawerNavGroup } from './PortalDrawer';
import { usePortalNavigation } from '../hooks/usePortalNavigation';

type Tab = 'dashboard' | 'stationary' | 'scholarships' | 'ledger' | 'messages' | 'attendance';

interface Props {
  user: User;
  onLogout: () => void;
  usersList: User[];
  students: Student[];
  setStudents?: React.Dispatch<React.SetStateAction<Student[]>>;
  stationaryRecords: StationaryRecord[];
  setStationaryRecords: (val: StationaryRecord[]) => void;
  scholarshipRecords: ScholarshipRecord[];
  setScholarshipRecords?: React.Dispatch<React.SetStateAction<ScholarshipRecord[]>>;
  ledgerEntries: LedgerEntry[];
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  onSync?: () => Promise<void>;
}

export default function AccountantDashboard({ user, onLogout, usersList, students, setStudents, stationaryRecords, setStationaryRecords, scholarshipRecords, setScholarshipRecords, ledgerEntries, setLedgerEntries, onSync }: Props) {
  const {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isAppMode,
    canGoBack,
    handleGoBack,
  } = usePortalNavigation<Tab>({
    portalKey: 'accountant',
    defaultTab: 'dashboard',
    storageKey: 'vcfd_accountant_tab',
  });

  const handleTabChange = setActiveTab;

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

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
      .channel(`accountant-unread-badge-${user.id}`)
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

  const accountantNavGroups: DrawerNavGroup<Tab>[] = [
    {
      category: 'Financial Core',
      items: [
        {
          tab: 'dashboard',
          icon: <LayoutDashboard size={18} />,
          label: 'Financial Overview',
          description: 'Cash flow, collections & financial stats',
        },
        {
          tab: 'ledger',
          icon: <FileText size={18} />,
          label: 'Ledger Entries',
          description: 'Debit/Credit records, categories & receipts',
        },
      ],
    },
    {
      category: 'Expenses & Grants',
      items: [
        {
          tab: 'stationary',
          icon: <Package size={18} />,
          label: 'Stationary & Expenses',
          description: 'Supplies accounting & vendor balances',
        },
        {
          tab: 'scholarships',
          icon: <GraduationCap size={18} />,
          label: 'Scholarships (Auditing)',
          description: 'View scholarship disbursals & records',
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
      {/* Clean Permanent Desktop Sidebar / Slide-over Mobile Drawer */}
      <PortalDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        portalTitle="Accountant Portal"
        roleBadgeText="Accountant"
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        groups={accountantNavGroups}
        onSync={onSync ? handleSync : undefined}
        isSyncing={isSyncing}
        onLogout={onLogout}
      />

      {/* Right Column: Top Header + Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with Employee Name, Full Email, Refresh and Signout on the right */}
        <PortalHeader
          portalTitle="Accountant Portal"
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
        <main ref={mainRef} className="flex-1 p-2 sm:p-4 md:p-8 overflow-y-auto bg-slate-50 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
        <div className="w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Financial Overview</h2>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">Real-time insights into institutional expenses and scholarships.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg shadow-xs text-xs md:text-sm font-medium text-slate-600">
                    <Calendar size={16} className="text-slate-400" />
                    <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                {(() => {
                  // KPI Calculations
                  const totalExpenses = stationaryRecords.reduce((sum, r) => sum + r.amountPaid, 0);
                  const pendingExpenses = stationaryRecords.reduce((sum, r) => sum + r.balance, 0);
                  const totalScholarship = scholarshipRecords.reduce((sum, r) => sum + r.amountReceived, 0);
                  
                  // This Month vs Last Month (simplified mock logic for trend)
                  const currentMonth = new Date().getMonth();
                  const currentMonthExpenses = stationaryRecords.filter(r => new Date(r.date).getMonth() === currentMonth).reduce((sum, r) => sum + r.amountPaid, 0);
                  
                  // Clerk Financial Updates Mock Notifications
                  const clerkUpdates = students
                    .filter(s => s.bankDetailsUpdated)
                    .map(s => ({
                       id: `update-${s.id}`,
                       type: 'student_financial',
                       title: `Bank Details Updated: ${s.name}`,
                       desc: `Clerk updated ${s.bankName || 'bank'} account details for scholarship processing.`,
                       date: s.bankDetailsUpdated ? s.bankDetailsUpdated.split('T')[0] : new Date().toISOString().split('T')[0],
                       role: 'clerk',
                       icon: <Building2 size={16} className="text-indigo-500" />,
                       bg: 'bg-indigo-100'
                    }))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  // Activity Feed Generation
                  const recentActivities = [
                    ...clerkUpdates,
                    ...stationaryRecords.slice(0, 3).map(r => ({
                      id: r.id,
                      type: 'expense',
                      title: `New expense added: ${r.vendorName}`,
                      desc: `${r.objectName} - ₹${r.price}`,
                      date: r.date,
                      role: r.createdByRole,
                      icon: <Package size={16} className="text-sky-500" />,
                      bg: 'bg-sky-100'
                    })),
                    ...scholarshipRecords.slice(0, 2).map(r => ({
                      id: r.id,
                      type: 'scholarship',
                      title: `Scholarship Updated: ${r.studentName}`,
                      desc: `Status: ${r.status} - ₹${r.amountReceived}`,
                      date: r.applicationDate || new Date().toISOString().split('T')[0],
                      role: 'accountant',
                      icon: <GraduationCap size={16} className="text-emerald-500" />,
                      bg: 'bg-emerald-100'
                    }))
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

                  // Bar Chart Data
                  const monthlyData = stationaryRecords.reduce((acc, curr) => {
                    const date = new Date(curr.date);
                    const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                    const existing = acc.find(item => item.name === monthYear);
                    if (existing) {
                      existing.expenses += curr.amountPaid;
                    } else {
                      acc.push({ name: monthYear, expenses: curr.amountPaid, timestamp: date.getTime() });
                    }
                    return acc;
                  }, [] as any[]).sort((a, b) => a.timestamp - b.timestamp);

                  // Pie Chart Data (Category/Vendor)
                  const vendorMap: Record<string, number> = {};
                  stationaryRecords.forEach(r => {
                    vendorMap[r.vendorName] = (vendorMap[r.vendorName] || 0) + r.amountPaid;
                  });
                  const pieData = Object.keys(vendorMap).map(k => ({ name: k, value: vendorMap[k] })).sort((a,b) => b.value - a.value).slice(0, 4);
                  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

                  return (
                    <div className="space-y-6">
                      {/* Priority Notifications */}
                      {clerkUpdates.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                          <div className="flex gap-3 items-start sm:items-center">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <Bell size={20} className="text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-indigo-900">New Clerk Updates</h4>
                              <p className="text-xs text-indigo-700 mt-0.5">
                                Clerk has updated bank details for {clerkUpdates.length} student(s). These might require verification for scholarship disbursement.
                              </p>
                            </div>
                          </div>
                          <button onClick={() => setActiveTab('scholarships')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm">
                            Review Details
                          </button>
                        </div>
                      )}

                      {/* KPI Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Expenses</p>
                              <p className="text-2xl font-black text-slate-900">₹{totalExpenses.toLocaleString()}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                              <FileText size={20} className="text-slate-700" />
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <TrendingUp size={14} /> <span>+12% this month</span>
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 relative overflow-hidden group">
                           <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50"></div>
                           <div className="relative z-10 flex justify-between items-start">
                             <div>
                               <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Pending Payables</p>
                               <p className="text-2xl font-black text-slate-900">₹{pendingExpenses.toLocaleString()}</p>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                               <Clock size={20} className="text-amber-600" />
                             </div>
                           </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 relative overflow-hidden">
                           <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50"></div>
                           <div className="relative z-10 flex justify-between items-start">
                             <div>
                               <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Scholarships Disbursed</p>
                               <p className="text-2xl font-black text-slate-900">₹{totalScholarship.toLocaleString()}</p>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                               <CheckCircle2 size={20} className="text-emerald-600" />
                             </div>
                           </div>
                        </div>
                        
                         <div className="bg-indigo-600 p-5 rounded-2xl shadow-sm flex flex-col justify-between text-white relative overflow-hidden">
                           <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500 rounded-full opacity-30"></div>
                           <div className="relative z-10 flex justify-between items-start">
                             <div>
                               <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">Ledger Total</p>
                               <p className="text-2xl font-black">₹{ledgerEntries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</p>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                               <FileText size={20} className="text-white" />
                             </div>
                           </div>
                           <div className="relative z-10 mt-4 flex items-center gap-1.5 text-xs font-medium text-indigo-200">
                             <span className="font-bold text-white">{ledgerEntries.length}</span> entries recorded
                           </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-bold text-slate-900">Expense Analytics (Past Year)</h3>
                          </div>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `₹${value}`} />
                                <Tooltip 
                                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                                />
                                <Area type="monotone" dataKey="expenses" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Recent Activity Feed */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <Activity size={18} className="text-slate-400" /> Recent Activities
                            </h3>
                          </div>
                          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
                            {recentActivities.map((activity, idx) => (
                              <div key={idx} className="flex gap-4 relative">
                                {idx !== recentActivities.length - 1 && (
                                  <div className="absolute left-[19px] top-10 bottom-[-20px] w-0.5 bg-slate-100"></div>
                                )}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${activity.bg}`}>
                                  {activity.icon}
                                </div>
                                <div className="pt-1">
                                  <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{activity.desc}</p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-[10px] font-medium text-slate-400">{new Date(activity.date).toLocaleDateString()}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">By {activity.role}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button className="w-full mt-4 py-2 text-sm font-semibold text-sky-600 hover:bg-sky-50 rounded-lg transition-colors">
                            View All Activity
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                           <h3 className="text-base font-bold text-slate-900 mb-6">Top Vendors by Expenditure</h3>
                           <div className="h-64 flex items-center justify-center">
                             {pieData.length > 0 ? (
                               <ResponsiveContainer width="100%" height="100%">
                                 <PieChart>
                                   <Pie
                                     data={pieData}
                                     cx="50%"
                                     cy="50%"
                                     innerRadius={60}
                                     outerRadius={80}
                                     paddingAngle={5}
                                     dataKey="value"
                                   >
                                     {pieData.map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                     ))}
                                   </Pie>
                                   <Tooltip formatter={(value) => `₹${value}`} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold'}} />
                                   <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 500}} />
                                 </PieChart>
                               </ResponsiveContainer>
                             ) : (
                               <p className="text-slate-400 text-sm">No vendor data available.</p>
                             )}
                           </div>
                         </div>
                         
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col">
                             <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                               <FileText size={16} className="text-indigo-500" /> Recent Ledger Entries
                             </h3>
                             <p className="text-xs text-slate-500 mb-4">₹{ledgerEntries.reduce((s, e) => s + e.amount, 0).toLocaleString()} total across {ledgerEntries.length} entries</p>
                             <div className="overflow-y-auto max-h-[220px]">
                               <table className="w-full text-left border-collapse">
                                 <tbody className="divide-y divide-slate-100">
                                   {[...ledgerEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6).map(e => (
                                     <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors">
                                       <td className="py-2.5">
                                         <div className="font-semibold text-sm text-slate-900 truncate max-w-[180px]">{e.description}</div>
                                         <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                           <span className="font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{e.paymentMode}</span>
                                           {new Date(e.date).toLocaleDateString()}
                                         </div>
                                       </td>
                                       <td className="py-2.5 text-right">
                                         <span className="font-bold text-sm text-indigo-700">₹{e.amount.toLocaleString()}</span>
                                       </td>
                                     </tr>
                                   ))}
                                   {ledgerEntries.length === 0 && (
                                     <tr><td colSpan={2} className="py-8 text-center text-sm text-slate-400">No ledger entries yet.</td></tr>
                                   )}
                                 </tbody>
                               </table>
                             </div>
                             <button onClick={() => setActiveTab('ledger')} className="mt-4 w-full py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100">
                               View All Ledger Entries →
                             </button>
                          </div>
                      </div>

                    </div>
                  );
                })()}
              </motion.div>
            )}
            {activeTab === 'stationary' && (
              <motion.div key="stationary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <StationaryDashboard records={stationaryRecords} setRecords={setStationaryRecords} readOnly={false} currentUserRole={user.role} />
              </motion.div>
            )}
            {activeTab === 'scholarships' && (
              <motion.div key="scholarships" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <ScholarshipDashboard records={scholarshipRecords} setRecords={setScholarshipRecords} students={students} setStudents={setStudents} readOnly={false} currentUserRole="accountant" />
              </motion.div>
            )}
            {activeTab === 'ledger' && (
              <motion.div key="ledger" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <LedgerDashboard records={ledgerEntries} setRecords={setLedgerEntries} readOnly={false} currentUserId={user.id} />
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

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg pb-safe">
        <button
          type="button"
          onClick={() => handleTabChange('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] ${
            activeTab === 'dashboard' ? 'text-sky-600 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] mt-0.5">Overview</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('ledger')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] ${
            activeTab === 'ledger' ? 'text-sky-600 font-bold' : 'text-slate-500'
          }`}
        >
          <FileText size={20} />
          <span className="text-[10px] mt-0.5">Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('stationary')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] ${
            activeTab === 'stationary' ? 'text-sky-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Package size={20} />
          <span className="text-[10px] mt-0.5">Expenses</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('attendance')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] ${
            activeTab === 'attendance' ? 'text-sky-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Clock size={20} />
          <span className="text-[10px] mt-0.5">Attendance</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('messages')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] relative ${
            activeTab === 'messages' ? 'text-sky-600 font-bold' : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <MessageSquare size={20} />
            {unreadMsgCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">Chat</span>
        </button>
      </div>
    </div>
  );
}

interface NavItemProps {
  key?: React.Key;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}

function NavItem({ active, icon, label, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-[#1e293b] text-white' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
      {badge != null && badge > 0 ? (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}
