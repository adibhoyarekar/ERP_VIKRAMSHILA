import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../data/mockData';
import { MessageSquare, Clock } from 'lucide-react';
import MessagesTab from './MessagesTab';
import EmployeeAttendanceTab from './attendance/EmployeeAttendanceTab';
import PortalHeader from './PortalHeader';
import PortalDrawer, { DrawerNavGroup } from './PortalDrawer';
import { usePortalNavigation } from '../hooks/usePortalNavigation';
import { supabase } from '../lib/supabase';

interface StaffDashboardProps {
  user: User;
  onLogout: () => void;
  usersList: User[];
  onSync?: () => Promise<void>;
}

type StaffTab = 'attendance' | 'messages';

export default function StaffDashboard({ user, onLogout, usersList, onSync }: StaffDashboardProps) {
  const {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isAppMode,
    canGoBack,
    handleGoBack,
  } = usePortalNavigation<StaffTab>({
    portalKey: 'staff',
    defaultTab: 'attendance',
    storageKey: 'vcfd_staff_tab',
  });

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  const [isSyncing, setIsSyncing] = useState(false);
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
      .channel(`staff-unread-badge-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();
  }, [activeTab, fetchUnreadCount]);

  const handleSync = useCallback(async () => {
    if (!onSync || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onSync, isSyncing]);

  const staffNavGroups: DrawerNavGroup<StaffTab>[] = [
    {
      category: 'Attendance & Duties',
      items: [
        {
          tab: 'attendance',
          icon: <Clock size={18} />,
          label: 'Attendance Portal',
          description: 'Punch in/out, view timesheets & leaves',
        },
      ],
    },
    {
      category: 'Communications',
      items: [
        {
          tab: 'messages',
          icon: <MessageSquare size={18} />,
          label: 'Staff Messages',
          description: 'Real-time chat with administration & peers',
          badge: unreadMsgCount,
        },
      ],
    },
  ];

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50 relative w-full">
      {/* Clean Permanent Desktop Sidebar / Slide-over Mobile Drawer */}
      <PortalDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        portalTitle="Staff Portal"
        roleBadgeText="Staff"
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        groups={staffNavGroups}
        onSync={onSync ? handleSync : undefined}
        isSyncing={isSyncing}
        onLogout={onLogout}
      />

      {/* Right Column: Top Header + Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with Employee Name, Full Email, Refresh and Signout on the right */}
        <PortalHeader
          portalTitle="Staff Portal"
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
        <div
          ref={contentRef}
          className="flex-1 flex flex-col min-h-0 overflow-hidden w-full max-w-full"
        >
          {activeTab === 'attendance' && (
            <div className="flex-1 overflow-y-auto pb-6">
              <EmployeeAttendanceTab user={user} />
            </div>
          )}
          {activeTab === 'messages' && (
            <div className="flex-1 min-h-0 w-full p-2 sm:p-4 md:p-6 pb-6 flex flex-col">
              <MessagesTab currentUser={user} usersList={usersList} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
