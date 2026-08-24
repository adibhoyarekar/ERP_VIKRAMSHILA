import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Send,
  Check,
  CheckCheck,
  Users,
  Megaphone,
  Info,
  Loader2,
  ArrowLeft,
  MessageSquare,
  Sparkles,
  CheckSquare,
  X
} from 'lucide-react';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface MessagesTabProps {
  currentUser: User;
  usersList: User[];
}

export default function MessagesTab({ currentUser, usersList }: MessagesTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedReceivers, setSelectedReceivers] = useState<string[]>([]);
  const [liveUsers, setLiveUsers] = useState<User[]>(usersList || []);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (usersList && usersList.length > 0) {
      setLiveUsers(usersList);
    }
  }, [usersList]);

  const fetchLiveUsers = useCallback(async () => {
    try {
      const { data: dbUsers, error } = await supabase.from('users').select('*');
      if (!error && dbUsers && dbUsers.length > 0) {
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
        setLiveUsers(Array.from(uniqueUsersMap.values()));
      }
    } catch (err) {
      console.warn('Error fetching live users in MessagesTab:', err);
    }
  }, []);

  // Filter out current user from the list (by ID or email)
  const otherUsers = liveUsers.filter(
    u => u.id !== currentUser.id && u.email?.toLowerCase() !== currentUser.email?.toLowerCase() && u.status !== 'suspended'
  );

  // Filter based on role and search query
  const filteredUsers = otherUsers.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedRoleFilter === 'all') return true;
    const r = u.role.toLowerCase();
    if (selectedRoleFilter === 'admin') return r === 'admin' || r.includes('super');
    if (selectedRoleFilter === 'accountant') return r === 'accountant';
    if (selectedRoleFilter === 'clerk') return r === 'clerk';
    if (selectedRoleFilter === 'staff') return r === 'staff' || (!r.includes('super') && r !== 'admin' && r !== 'accountant' && r !== 'clerk');

    return true;
  });

  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!currentUser?.id) return;
    if (isInitial) setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching messages from Supabase:', error);
      } else if (data) {
        setMessages(prev => {
          const msgMap = new Map(prev.map(m => [m.id, m]));
          (data as Message[]).forEach(m => msgMap.set(m.id, m));
          return (Array.from(msgMap.values()) as Message[]).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }
    } catch (error) {
      console.warn('Network error fetching messages:', error);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchLiveUsers();
    fetchMessages(true);

    // Dedicated Realtime channel for this user session and users table
    const usersChannel = supabase
      .channel('public:users_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchLiveUsers();
        }
      )
      .subscribe();

    // Dedicated Realtime channel for this user session
    const channelName = `messages_sync_${currentUser.id}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === currentUser.id || newMsg.receiver_id === currentUser.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setTimeout(() => scrollToBottom(true), 50);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          if (updatedMsg.sender_id === currentUser.id || updatedMsg.receiver_id === currentUser.id) {
            setMessages(prev => prev.map(m => (m.id === updatedMsg.id ? updatedMsg : m)));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const oldRecord = payload.old as { id: string };
          setMessages(prev => prev.filter(m => m.id !== oldRecord.id));
        }
      )
      .subscribe();

    // Polling fallback every 3 seconds guarantees delivery across all portals
    const pollInterval = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(usersChannel);
    };
  }, [currentUser.id, fetchMessages, fetchLiveUsers]);

  useEffect(() => {
    // Mark messages as read when a single chat is opened
    if (!isBroadcast && selectedReceivers.length === 1) {
      const receiverId = selectedReceivers[0];
      const unreadMessages = messages.filter(
        m => m.sender_id === receiverId && m.receiver_id === currentUser.id && !m.is_read
      );

      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages.map(m => m.id));
      }
    }
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedReceivers, isBroadcast]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, isMobileChatOpen]);

  const markAsRead = async (messageIds: string[]) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', messageIds);

      // Optimistic update
      setMessages(prev => prev.map(m => (messageIds.includes(m.id) ? { ...m, is_read: true } : m)));
    } catch (error) {
      console.warn('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || (selectedReceivers.length === 0 && !isBroadcast)) return;

    setIsSending(true);
    const content = messageInput.trim();
    setMessageInput('');

    let receiversToMessage = selectedReceivers;
    if (isBroadcast) {
      receiversToMessage = otherUsers.map(u => u.id);
    }

    try {
      const newMessages = receiversToMessage.map(receiverId => ({
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: content,
        is_read: false
      }));

      const { data, error } = await supabase
        .from('messages')
        .insert(newMessages)
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(error.message || 'Unable to deliver message to database');
      }

      if (data) {
        setMessages(prev => {
          const newM = data as Message[];
          const existingIds = new Set(prev.map(m => m.id));
          return [...prev, ...newM.filter(m => !existingIds.has(m.id))];
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error?.message || 'Please check your connection and try again.'}`);
    } finally {
      setIsSending(false);
      setTimeout(() => scrollToBottom(true), 50);
    }
  };

  const toggleReceiver = (userId: string) => {
    if (isBroadcast) setIsBroadcast(false);
    setSelectedReceivers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectSingleUser = (userId: string) => {
    setIsBroadcast(false);
    setSelectedReceivers([userId]);
    setIsMobileChatOpen(true);
  };

  const handleSelectAllFiltered = () => {
    setIsBroadcast(false);
    const filteredIds = filteredUsers.map(u => u.id);
    const allSelected = filteredIds.every(id => selectedReceivers.includes(id));
    if (allSelected) {
      // Unselect filtered
      setSelectedReceivers(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      setSelectedReceivers(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedReceivers([]);
    setIsBroadcast(false);
    setIsMobileChatOpen(false);
  };

  // Get active chat messages (only if single selection)
  const activeChatMessages =
    !isBroadcast && selectedReceivers.length === 1
      ? messages.filter(
          m =>
            (m.sender_id === currentUser.id && m.receiver_id === selectedReceivers[0]) ||
            (m.receiver_id === currentUser.id && m.sender_id === selectedReceivers[0])
        )
      : [];

  const getUnreadCount = (userId: string) => {
    return messages.filter(m => m.sender_id === userId && m.receiver_id === currentUser.id && !m.is_read).length;
  };

  const getRoleBadge = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('super')) return { bg: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Super Admin' };
    if (r === 'admin') return { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Admin' };
    if (r === 'accountant') return { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Accountant' };
    if (r === 'clerk') return { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Clerk' };
    return { bg: 'bg-sky-100 text-sky-700 border-sky-200', label: 'Staff' };
  };

  const activeUser = otherUsers.find(u => u.id === selectedReceivers[0]);
  const selectedUserObjects = otherUsers.filter(u => selectedReceivers.includes(u.id));

  const roleFilterTabs = [
    { id: 'all', label: 'All' },
    { id: 'admin', label: 'Admin' },
    { id: 'accountant', label: 'Accountant' },
    { id: 'clerk', label: 'Clerk' },
    { id: 'staff', label: 'Staff' }
  ];

  return (
    <div className="flex-1 flex h-full min-h-0 w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
      {/* LEFT SIDEBAR - User & Broadcast List */}
      <div
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white transition-all overflow-hidden ${
          isMobileChatOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Clean Header & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={19} className="text-sky-600" /> Messages
            </h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {otherUsers.length} Contacts
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by name, role or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-sky-400 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-sky-500/10 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Role Filter Segmented Tabs (Proportional width: Accountant gets extra space, zero overlap) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 w-full">
            {roleFilterTabs.map(tab => {
              const isAccountant = tab.id === 'accountant';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedRoleFilter(tab.id)}
                  style={{
                    fontSize: isAccountant ? '10px' : '11px',
                    letterSpacing: isAccountant ? '-0.03em' : 'normal'
                  }}
                  className={`py-1.5 px-1 rounded-lg font-bold transition-all text-center flex items-center justify-center whitespace-nowrap cursor-pointer ${
                    isAccountant ? 'flex-[1.4]' : 'flex-1'
                  } ${
                    selectedRoleFilter === tab.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                  title={tab.label}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Broadcast to Everyone Card */}
          <button
            type="button"
            onClick={() => {
              setIsBroadcast(true);
              setSelectedReceivers([]);
              setIsMobileChatOpen(true);
            }}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
              isBroadcast
                ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-500/20 text-sky-950'
                : 'bg-slate-50 hover:bg-sky-50/50 border-slate-200 text-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isBroadcast ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-600'}`}>
              <Megaphone size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">Broadcast to Everyone</p>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                  All ({otherUsers.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">Send announcement to all staff members</p>
            </div>
          </button>

          {/* Quick Selection Toolbar */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-sky-50 cursor-pointer transition-colors"
            >
              <CheckSquare size={13} />
              {filteredUsers.length > 0 && filteredUsers.every(u => selectedReceivers.includes(u.id))
                ? 'Deselect All'
                : `Select All (${filteredUsers.length})`}
            </button>

            {selectedReceivers.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 py-0.5 px-1 rounded hover:bg-rose-50 cursor-pointer transition-colors"
              >
                <X size={12} /> Clear ({selectedReceivers.length})
              </button>
            )}
          </div>
        </div>

        {/* Selected Users Chips Bar */}
        {selectedReceivers.length > 0 && !isBroadcast && (
          <div className="px-3 py-1.5 bg-sky-50 border-b border-sky-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-bold text-sky-900 shrink-0">Selected ({selectedReceivers.length}):</span>
            {selectedUserObjects.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 bg-white text-sky-900 px-2 py-0.5 rounded-md text-xs font-semibold border border-sky-200 shadow-2xs shrink-0"
              >
                <span className="max-w-[80px] truncate">{u.name}</span>
                <button
                  type="button"
                  onClick={() => toggleReceiver(u.id)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* User List with Checkboxes */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 pb-20 md:pb-2">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-600">No users found</p>
              <p className="text-xs text-slate-400 mt-1">Try another search or role filter</p>
            </div>
          ) : (
            filteredUsers.map(u => {
              const isSelected = selectedReceivers.includes(u.id) && !isBroadcast;
              const unreadCount = getUnreadCount(u.id);
              const badge = getRoleBadge(u.role);

              return (
                <div
                  key={u.id}
                  onClick={() => {
                    if (selectedReceivers.length > 0) {
                      toggleReceiver(u.id);
                    } else {
                      handleSelectSingleUser(u.id);
                    }
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-50/90 border border-sky-200 text-sky-950 shadow-2xs'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {/* Dedicated Checkbox Box */}
                  <div
                    onClick={e => {
                      e.stopPropagation();
                      toggleReceiver(u.id);
                    }}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                        : 'border-slate-300 hover:border-sky-500 bg-white'
                    }`}
                    title={isSelected ? 'Deselect user' : 'Select user'}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-[18px] h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-bold px-0.5">
                        {unreadCount}
                      </div>
                    )}
                  </div>

                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{u.name}</h4>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{u.email}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile Compose Action Button when users selected */}
        {selectedReceivers.length > 0 && !isBroadcast && (
          <div className="md:hidden p-3 bg-white border-t border-slate-200 shadow-lg shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileChatOpen(true)}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <Send size={16} /> Compose Message ({selectedReceivers.length} Selected)
            </button>
          </div>
        )}
      </div>

      {/* RIGHT CHAT PANE */}
      <div
        className={`flex-1 flex flex-col h-full min-h-0 bg-slate-50 relative overflow-hidden ${
          !isMobileChatOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedReceivers.length === 0 && !isBroadcast ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mb-3 text-sky-600 shadow-sm border border-sky-100">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800">Select a Conversation</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
              Click on any staff member or check specific small boxes to send custom messages, or use{' '}
              <span className="font-bold text-sky-600">Broadcast to Everyone</span>.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">
            {/* FIXED/STICKY TOP HEADER: USERNAME IS ALWAYS VISIBLE */}
            <div className="h-16 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shadow-2xs z-30 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileChatOpen(false)}
                  className="md:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Back to Contact List"
                >
                  <ArrowLeft size={20} />
                </button>

                {isBroadcast ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white shadow-sm shrink-0">
                      <Megaphone size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">Broadcast Announcement</h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        Sending directly to all {otherUsers.length} staff & admins
                      </p>
                    </div>
                  </div>
                ) : selectedReceivers.length > 1 ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                      <Users size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                        {selectedReceivers.length} Custom Recipients Selected
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        {selectedUserObjects.map(u => u.name).join(', ')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                      {activeUser?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">{activeUser?.name}</h3>
                        {activeUser && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadge(activeUser.role).bg}`}>
                            {getRoleBadge(activeUser.role).label}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{activeUser?.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Warning Sub-banner */}
            <div className="bg-amber-50/90 border-b border-amber-200/60 px-4 py-1.5 flex items-center justify-center gap-2 shrink-0">
              <Info size={13} className="text-amber-700 shrink-0" />
              <p className="text-[11px] font-medium text-amber-800 text-center">
                Messages and conversations are retained for 7 days.
              </p>
            </div>

            {/* SCROLLABLE CHAT MESSAGES: CHRONOLOGICAL STACK (1st at top, 2nd below, 3rd below...) */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-3 overscroll-contain"
            >
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="animate-spin text-sky-600" size={28} />
                </div>
              ) : isBroadcast || selectedReceivers.length > 1 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 max-w-sm mx-auto text-center">
                  <div className="w-14 h-14 bg-sky-50 border border-sky-100 rounded-2xl flex items-center justify-center text-sky-600 shadow-sm">
                    <Send size={24} className="ml-1" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {isBroadcast ? 'Broadcast to Everyone' : `Ready to message ${selectedReceivers.length} people`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Your message will be sent individually to{' '}
                      <span className="font-bold text-slate-700">
                        {isBroadcast ? `all ${otherUsers.length} users` : `${selectedReceivers.length} selected users`}
                      </span>.
                    </p>
                  </div>
                </div>
              ) : activeChatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 max-w-sm mx-auto text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 mb-2 border border-slate-200">
                    <Sparkles size={20} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No messages yet</p>
                  <p className="text-xs text-slate-500 mt-0.5">Type below to start chatting with {activeUser?.name}.</p>
                </div>
              ) : (
                activeChatMessages.map((msg, index) => {
                  const isSender = msg.sender_id === currentUser.id;
                  const messageDate = new Date(msg.created_at);

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id || index}
                      className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 sm:px-4.5 sm:py-2.5 leading-relaxed shadow-2xs ${
                          isSender
                            ? 'bg-sky-600 text-white rounded-tr-xs'
                            : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                        }`}
                      >
                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>

                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] font-medium text-slate-400">
                          {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isSender && (
                          <span className={msg.is_read ? 'text-emerald-600' : 'text-slate-400'}>
                            {msg.is_read ? <CheckCheck size={13} /> : <Check size={13} />}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* FIXED/STICKY INPUT AT BOTTOM (ALWAYS AT BOTTOM OF SCREEN) */}
            <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder={
                    isBroadcast
                      ? 'Type broadcast message...'
                      : selectedReceivers.length > 1
                      ? `Message ${selectedReceivers.length} selected recipients...`
                      : `Message ${activeUser?.name || 'user'}...`
                  }
                  className="flex-1 bg-slate-100 hover:bg-slate-150 focus:bg-white border border-slate-200 focus:border-sky-400 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-sky-500/10 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || isSending}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-center transition-all shadow-xs font-bold shrink-0 cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Send size={18} className="ml-0.5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
