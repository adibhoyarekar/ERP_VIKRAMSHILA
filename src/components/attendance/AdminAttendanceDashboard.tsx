import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { AttendanceRecordWithUser, CollegeHoliday } from '../../types/attendance';
import { User } from '../../data/mockData';
import AttendanceMonthlyCalendar from './AttendanceMonthlyCalendar';
import { Search, Calendar, MapPin, Clock, Edit, Shield, CheckCircle, X, Sparkles, User as UserIcon, PartyPopper, Eye } from 'lucide-react';
import { logError } from '../../utils/errorHandler';
import { getCheckInWindowState, formatTimeAmPm } from '../../utils/attendanceTime';
import DocumentViewerModal, { DocumentPreviewItem } from '../DocumentViewerModal';

interface AdminAttendanceDashboardProps {
  usersList: User[];
  currentUser: User;
}

export default function AdminAttendanceDashboard({ usersList, currentUser }: AdminAttendanceDashboardProps) {
  const [records, setRecords] = useState<AttendanceRecordWithUser[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecordWithUser[]>([]);
  const [holidays, setHolidays] = useState<CollegeHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);
  
  // Real-time ticking clock for SuperAdmin & Admin dashboard
  const [liveTime, setLiveTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const scrollParents = document.querySelectorAll('main, .overflow-y-auto');
      scrollParents.forEach(el => {
        el.scrollTop = 0;
      });
    }
  }, []);

  // Today's date string in local timezone
  const todayStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, []);

  // Fetch college settings (check-in window)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('*').maybeSingle();
        if (data) setSettings(data);
      } catch (err) {
        console.error('Error loading app settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Fetch declared college holidays
  const fetchHolidays = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('college_holidays')
        .select('*')
        .order('date', { ascending: false });

      if (error && error.code !== '42P01') {
        console.warn('Error fetching holidays:', error);
      }
      setHolidays((data || []) as CollegeHoliday[]);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Real-time check-in window state
  const windowInfo = useMemo(() => {
    return getCheckInWindowState(
      liveTime,
      settings?.check_in_window_start || '08:00:00',
      settings?.check_in_window_end || '10:00:00'
    );
  }, [liveTime, settings]);

  const isCheckInWindowEnded = windowInfo.isClosed;

  // Filters
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecordWithUser[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected Employee for Full Calendar Modal
  const [selectedEmployeeForCalendar, setSelectedEmployeeForCalendar] = useState<User | null>(null);

  // Selected Record for Details / Correction Modal
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecordWithUser | null>(null);
  const [photoUrls, setPhotoUrls] = useState<{ in?: string; out?: string }>({});

  // Correction Mode
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    status: 'Present',
    checkInTime: '',
    checkOutTime: ''
  });

  // Check if the current filterDate is a declared holiday
  const activeHolidayForFilterDate = useMemo(() => {
    return holidays.find(h => h.date === filterDate);
  }, [holidays, filterDate]);

  // Check if today is a declared holiday
  const isTodayHoliday = useMemo(() => {
    return holidays.find(h => h.date === todayStr);
  }, [holidays, todayStr]);

  // 1. Deduplicate usersList by lowercase trimmed email (or ID if email missing)
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, User>();
    usersList.forEach(u => {
      const role = u.role?.toLowerCase();
      if (['staff', 'clerk', 'accountant'].includes(role)) {
        const key = u.email ? u.email.trim().toLowerCase() : u.id;
        if (!map.has(key)) {
          map.set(key, u);
        }
      }
    });
    return Array.from(map.values());
  }, [usersList]);

  // Helper to resolve an employee's user object from an attendance record
  const resolveUserForRecord = useCallback((r: any): { name: string; role: string; email: string } => {
    if (r.users && r.users.name) {
      return r.users;
    }
    const matched = usersList.find(u => u.id === r.user_id);
    if (matched) {
      return { name: matched.name, role: matched.role, email: matched.email };
    }
    return { name: 'Employee', role: 'staff', email: '' };
  }, [usersList]);

  // Always fetch today's records so top stats cards are 100% accurate regardless of viewMode/filters
  const fetchTodayRecords = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', todayStr);

      if (error) throw error;
      const formatted = (data || []).map(r => ({
        ...r,
        users: resolveUserForRecord(r)
      }));
      setTodayRecords(formatted as AttendanceRecordWithUser[]);
    } catch (err) {
      console.error(err);
    }
  }, [todayStr, resolveUserForRecord]);

  const fetchDailyRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', filterDate);

      if (error) throw error;
      const formatted = (data || []).map(r => ({
        ...r,
        users: resolveUserForRecord(r)
      }));
      setRecords(formatted as AttendanceRecordWithUser[]);
      await supabase.rpc('delete_old_attendance_photos');
    } catch (err) {
      console.error(err);
      logError(err, 'fetchAttendanceRecords');
    } finally {
      setIsLoading(false);
    }
  }, [filterDate, resolveUserForRecord]);

  const fetchMonthlyRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const parts = filterMonth.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${filterMonth}-01`;
      const endDate = `${filterMonth}-${lastDay.toString().padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      const formatted = (data || []).map(r => ({
        ...r,
        users: resolveUserForRecord(r)
      }));
      setMonthlyRecords(formatted as AttendanceRecordWithUser[]);
    } catch (err) {
      console.error(err);
      logError(err, 'fetchAttendanceRecords');
    } finally {
      setIsLoading(false);
    }
  }, [filterMonth, resolveUserForRecord]);

  // Initial fetch and fetch on view/date change
  useEffect(() => {
    fetchTodayRecords();
    if (viewMode === 'daily') {
      fetchDailyRecords();
    } else {
      fetchMonthlyRecords();
    }
  }, [viewMode, filterDate, filterMonth, fetchTodayRecords, fetchDailyRecords, fetchMonthlyRecords]);

  // Real-time Postgres changes listener
  useEffect(() => {
    const channel = supabase
      .channel('admin-attendance-live-feed')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance_records' 
      }, () => {
        fetchTodayRecords();
        if (viewMode === 'daily') {
          fetchDailyRecords();
        } else {
          fetchMonthlyRecords();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'college_holidays'
      }, () => {
        fetchHolidays();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, fetchTodayRecords, fetchDailyRecords, fetchMonthlyRecords, fetchHolidays]);

  // Open single record modal (Details / Admin Correction)
  const handleRowClick = async (record: AttendanceRecordWithUser, openInCorrectionMode = false) => {
    setSelectedRecord(record);
    if (openInCorrectionMode) {
      const inTime = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
      const outTime = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
      setCorrectionForm({ status: record.status || 'Present', checkInTime: inTime, checkOutTime: outTime });
      setIsCorrecting(true);
    } else {
      setIsCorrecting(false);
    }
    setPhotoUrls({});

    if (record.check_in_photo_url) {
      const { data } = await supabase.storage.from('attendance_photos').createSignedUrl(record.check_in_photo_url, 3600);
      if (data?.signedUrl) setPhotoUrls(prev => ({ ...prev, in: data.signedUrl }));
    }
    if (record.check_out_photo_url) {
      const { data } = await supabase.storage.from('attendance_photos').createSignedUrl(record.check_out_photo_url, 3600);
      if (data?.signedUrl) setPhotoUrls(prev => ({ ...prev, out: data.signedUrl }));
    }
  };

  // Open employee full monthly calendar modal
  const handleOpenEmployeeCalendar = (employee: User) => {
    setSelectedEmployeeForCalendar(employee);
  };

  const handleSaveCorrection = async () => {
    if (!selectedRecord) return;
    try {
      let inIso: string | undefined = undefined;
      let outIso: string | undefined = undefined;
      let hoursStr: string | undefined = undefined;

      const dateBase = selectedRecord.date;

      if (correctionForm.checkInTime) {
        inIso = new Date(`${dateBase}T${correctionForm.checkInTime}:00`).toISOString();
      }
      if (correctionForm.checkOutTime) {
        outIso = new Date(`${dateBase}T${correctionForm.checkOutTime}:00`).toISOString();
      }

      if (inIso && outIso) {
        const diffMs = new Date(outIso).getTime() - new Date(inIso).getTime();
        if (diffMs > 0) {
          const hrs = Math.floor(diffMs / 3600000);
          const mins = Math.floor((diffMs % 3600000) / 60000);
          hoursStr = `${hrs}h ${mins}m`;
        }
      }

      const updateData = {
        status: correctionForm.status as any,
        check_in_time: inIso || null,
        check_out_time: outIso || null,
        working_hours: hoursStr || null,
        is_manually_corrected: true,
        corrected_by: currentUser.id
      };

      if (selectedRecord.id.startsWith('absent-') || selectedRecord.id.startsWith('holiday-') || selectedRecord.id === 'new') {
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            user_id: selectedRecord.user_id,
            date: selectedRecord.date,
            ...updateData
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance_records')
          .update(updateData)
          .eq('id', selectedRecord.id);
        if (error) throw error;
      }
      
      setIsCorrecting(false);
      setSelectedRecord(prev => prev ? { ...prev, ...updateData } : null);
      setToastMessage('Record corrected successfully.');
      setTimeout(() => setToastMessage(null), 3000);
      fetchTodayRecords();
      if (viewMode === 'daily') {
        fetchDailyRecords();
      } else {
        fetchMonthlyRecords();
      }

    } catch (err) {
      console.error(err);
      alert('Failed to save correction.');
    }
  };

  // Helper to check if an attendance record belongs to an employee
  const isRecordForEmployee = useCallback((record: AttendanceRecordWithUser, emp: User): boolean => {
    if (record.user_id === emp.id) return true;
    const empEmail = emp.email?.trim().toLowerCase();
    const recEmail = record.users?.email?.trim().toLowerCase() || usersList.find(u => u.id === record.user_id)?.email?.trim().toLowerCase();
    return Boolean(empEmail && recEmail && empEmail === recEmail);
  }, [usersList]);

  // Daily View records: 1 row per unique employee
  const filteredRecords = useMemo(() => {
    if (viewMode !== 'daily') return [];

    const baseRecords = uniqueEmployees.map(u => {
      const existing = records.find(r => isRecordForEmployee(r, u));

      if (existing) {
        return {
          ...existing,
          users: existing.users || { name: u.name, role: u.role, email: u.email }
        };
      }

      // If active holiday on filterDate and employee did not check in, classify as Holiday
      if (activeHolidayForFilterDate) {
        return {
          id: `holiday-${u.id}`,
          user_id: u.id,
          date: filterDate,
          status: 'Holiday',
          users: { name: u.name, role: u.role, email: u.email }
        } as unknown as AttendanceRecordWithUser;
      }

      const isPastDate = filterDate < todayStr;
      const isAbsent = isPastDate || isCheckInWindowEnded;
      const statusTitle = isAbsent ? 'Absent' : 'In Process';

      return {
        id: `absent-${u.id}`,
        user_id: u.id,
        date: filterDate,
        status: statusTitle,
        users: { name: u.name, role: u.role, email: u.email }
      } as unknown as AttendanceRecordWithUser;
    });

    return baseRecords.filter(r => {
      const role = r.users?.role?.toLowerCase();
      if (filterRole !== 'all' && role !== filterRole.toLowerCase()) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          r.users?.name?.toLowerCase().includes(query) || 
          r.users?.email?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [uniqueEmployees, records, viewMode, filterDate, filterRole, filterStatus, searchQuery, isRecordForEmployee, todayStr, isCheckInWindowEnded, activeHolidayForFilterDate]);

  // Statistics for Today's Attendance
  const stats = useMemo(() => {
    const total = uniqueEmployees.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let pending = 0;
    let holiday = 0;

    uniqueEmployees.forEach(u => {
      const rec = todayRecords.find(r => isRecordForEmployee(r, u));

      if (rec) {
        if (rec.status === 'Present') present++;
        else if (rec.status === 'Late') late++;
        else if (rec.status === 'Holiday') holiday++;
        else if (isTodayHoliday) holiday++;
        else absent++;
      } else {
        if (isTodayHoliday) {
          holiday++;
        } else if (isCheckInWindowEnded) {
          absent++;
        } else {
          pending++;
        }
      }
    });

    return { total, present, late, absent, pending, holiday };
  }, [uniqueEmployees, todayRecords, isRecordForEmployee, isCheckInWindowEnded, isTodayHoliday]);

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const daysInMonth = useMemo(() => {
    if (!filterMonth) return 0;
    const [y, m] = filterMonth.split('-');
    return new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  }, [filterMonth]);

  // Monthly Grid View employees
  const monthlyEmployees = useMemo(() => {
    return uniqueEmployees.filter(u => {
      const role = u.role?.toLowerCase();
      if (filterRole !== 'all' && role !== filterRole.toLowerCase()) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query);
      }
      return true;
    });
  }, [uniqueEmployees, filterRole, searchQuery]);

  const getRecordForDay = (emp: User, day: number) => {
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `${filterMonth}-${dayStr}`;

    return monthlyRecords.find(r => 
      isRecordForEmployee(r, emp) && 
      r.date === dateStr
    );
  };

  return (
    <div className="space-y-5 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <CheckCircle className="w-6 h-6 text-emerald-400" />
          <span className="font-semibold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Live Date, Time & Check-in Window Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Live Real-Time Status
            </span>
            {isTodayHoliday && (
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 inline-flex items-center gap-1">
                <PartyPopper size={11} /> Holiday: {isTodayHoliday.title}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-3 mt-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {liveTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </h3>
            <span className="text-base sm:text-lg font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
              {liveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
          <Clock size={16} className="text-slate-400" />
          <span>Check-in Window:</span>
          <span className="font-bold text-slate-800 font-mono">
            {windowInfo.startTimeDisplay} - {windowInfo.endTimeDisplay}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
            windowInfo.isNotStarted
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : windowInfo.isClosed
              ? 'bg-rose-100 text-rose-700 border border-rose-200'
              : 'bg-emerald-100 text-emerald-700 border border-emerald-200 animate-pulse'
          }`}>
            {windowInfo.isNotStarted ? 'Upcoming' : windowInfo.isClosed ? 'Closed' : 'Open'}
          </span>
        </div>
      </div>

      {/* Holiday Banner if selected filterDate is a Holiday */}
      {activeHolidayForFilterDate && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <PartyPopper size={20} />
            </div>
            <div>
              <h4 className="font-bold text-purple-950 text-sm">
                Declared College Holiday: {activeHolidayForFilterDate.title} ({filterDate})
              </h4>
              <p className="text-xs text-purple-700">
                {activeHolidayForFilterDate.description || 'Employees are exempt from attendance on this date and will not be marked absent.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-purple-200 text-purple-900 px-3 py-1 rounded-full border border-purple-300">
            Attendance Optional
          </span>
        </div>
      )}

      {/* Header & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5 text-slate-500">Total Employees</p>
          <p className="text-3xl font-black tracking-tight text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5 text-emerald-600">Present Today</p>
          <p className="text-3xl font-black tracking-tight text-emerald-600">{stats.present}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5 text-amber-600">Late Arrivals</p>
          <p className="text-3xl font-black tracking-tight text-amber-600">{stats.late}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5 text-rose-600">
            {isTodayHoliday ? 'Holiday Exemption' : 'Absent Today'}
          </p>
          {isTodayHoliday ? (
            <div>
              <p className="text-2xl font-black tracking-tight text-purple-700">Declared Holiday</p>
              <p className="text-[11px] font-medium text-purple-600 mt-0.5">Absence not recorded</p>
            </div>
          ) : windowInfo.isClosed ? (
            <div>
              <p className="text-3xl font-black tracking-tight text-rose-600">{stats.absent}</p>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">Window closed at {windowInfo.endTimeDisplay}</p>
            </div>
          ) : windowInfo.isNotStarted ? (
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-amber-600">Not Started</p>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">{stats.pending} pending (Opens at {windowInfo.startTimeDisplay})</p>
            </div>
          ) : (
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-blue-600">In Process</p>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">{stats.pending} pending check-in (Window active)</p>
            </div>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Daily vs Monthly Switch */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button 
              onClick={() => setViewMode('daily')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                viewMode === 'daily' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily View
            </button>
            <button 
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                viewMode === 'monthly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Grid
            </button>
          </div>

          <div className="relative">
            {viewMode === 'daily' ? (
              <input 
                type="date" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              />
            ) : (
              <input 
                type="month" 
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              />
            )}
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          
          <select 
            value={filterRole} 
            onChange={e => setFilterRole(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="staff">Staff</option>
            <option value="clerk">Clerk</option>
            <option value="accountant">Accountant</option>
          </select>

          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Holiday">Holiday</option>
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <input 
            type="text" 
            placeholder="Search employee name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Main Table: Daily View or Monthly View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {viewMode === 'daily' ? (
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4">Hours</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No attendance records found for this date.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(record => {
                    const matchedUser = usersList.find(u => u.id === record.user_id) || {
                      id: record.user_id,
                      name: record.users?.name || 'Employee',
                      role: record.users?.role || 'staff',
                      email: record.users?.email || '',
                      username: ''
                    } as User;

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div 
                            onClick={() => handleOpenEmployeeCalendar(matchedUser)}
                            className="cursor-pointer group flex flex-col"
                            title="Click to view full monthly calendar"
                          >
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                              {record.users?.name}
                              <Calendar size={13} className="opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                            </p>
                            <p className="text-xs text-slate-500">{record.users?.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-slate-600 text-xs font-semibold bg-slate-100 px-2.5 py-1 rounded-md">
                            {record.users?.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-mono">
                          {formatTime(record.check_in_time)}
                          {record.check_in_accuracy && <MapPin className="w-3 h-3 inline text-emerald-500 ml-1" title="GPS Verified" />}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-mono">
                          {record.check_out_time ? formatTime(record.check_out_time) : <span className="text-slate-400 font-sans">-</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {record.working_hours || (record.check_in_time && !record.check_out_time ? (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">In progress</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          ))}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            record.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                            record.status === 'Late' ? 'bg-amber-100 text-amber-800' :
                            record.status === 'Holiday' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            record.status === 'In Process' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                          {record.is_manually_corrected && (
                            <Shield className="w-3 h-3 inline text-indigo-500 ml-1" title="Manually Corrected" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEmployeeCalendar(matchedUser)}
                            className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                            title="View Monthly Calendar"
                          >
                            <Calendar size={13} /> Calendar
                          </button>
                          <button
                            onClick={() => handleRowClick(record, true)}
                            className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 border border-slate-200 shadow-xs"
                            title="Edit Attendance"
                          >
                            <Edit size={12} className="text-slate-500" /> Edit Attendance
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Monthly Grid View */
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Employee</th>
                  {Array.from({ length: daysInMonth }).map((_, i) => (
                    <th key={i} className="px-2 py-3 text-center min-w-[34px] font-bold">{i + 1}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Calendar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : monthlyEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-6 py-12 text-center text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  monthlyEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                        <div 
                          onClick={() => handleOpenEmployeeCalendar(emp)}
                          className="cursor-pointer group"
                          title="Click to open calendar"
                        >
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                            {emp.name}
                            <Calendar size={12} className="opacity-0 group-hover:opacity-100 text-indigo-500" />
                          </div>
                          <div className="text-xs text-slate-400 capitalize">{emp.role}</div>
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const record = getRecordForDay(emp, i + 1);
                        const dayStr = (i + 1).toString().padStart(2, '0');
                        const dateStr = `${filterMonth}-${dayStr}`;
                        const isHolidayForThisDay = holidays.find(h => h.date === dateStr);

                        return (
                          <td key={i} className="px-1 py-2 text-center border-r border-slate-50 last:border-0">
                            {record ? (
                              <span 
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black cursor-pointer hover:scale-110 transition-transform ${
                                  record.status === 'Present' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                  record.status === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                  record.status === 'Holiday' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                  'bg-red-100 text-red-800 border border-red-300'
                                }`}
                                title={`${record.status} - In: ${formatTime(record.check_in_time)} | Out: ${record.check_out_time ? formatTime(record.check_out_time) : '-'} | Hours: ${record.working_hours || '-'}`}
                                onClick={() => handleRowClick({ ...record, users: { name: emp.name, role: emp.role, email: emp.email } })}
                              >
                                {record.status.charAt(0)}
                              </span>
                            ) : isHolidayForThisDay ? (
                              <span 
                                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black bg-purple-100 text-purple-800 border border-purple-200 cursor-pointer hover:scale-110 transition-transform"
                                title={`🎉 Holiday: ${isHolidayForThisDay.title}`}
                                onClick={() => handleRowClick({ 
                                  id: `holiday-${emp.id}`,
                                  user_id: emp.id,
                                  date: dateStr,
                                  status: 'Holiday',
                                  users: { name: emp.name, role: emp.role, email: emp.email } 
                                } as any)}
                              >
                                H
                              </span>
                            ) : (
                              <span 
                                className="text-slate-300 font-bold cursor-pointer hover:text-indigo-500 transition-colors"
                                onClick={() => handleRowClick({ 
                                  id: 'new',
                                  user_id: emp.id,
                                  date: dateStr,
                                  status: 'Absent',
                                  users: { name: emp.name, role: emp.role, email: emp.email } 
                                } as any)}
                              >
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenEmployeeCalendar(emp)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Calendar size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Monthly Calendar Modal for a Specific Employee */}
      {selectedEmployeeForCalendar && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl relative my-auto custom-scrollbar animate-in zoom-in-95 duration-200">
            {/* Modal Top Bar */}
            <div className="sticky top-0 z-30 flex items-center justify-between p-4 bg-slate-900 text-white rounded-t-3xl border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="text-indigo-400 w-5 h-5" />
                <h3 className="font-bold text-base md:text-lg text-white">
                  {selectedEmployeeForCalendar.name}'s Attendance Calendar
                </h3>
              </div>
              <button
                onClick={() => setSelectedEmployeeForCalendar(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 md:p-6">
              <AttendanceMonthlyCalendar
                userId={selectedEmployeeForCalendar.id}
                userName={selectedEmployeeForCalendar.name}
                userRole={selectedEmployeeForCalendar.role}
                userEmail={selectedEmployeeForCalendar.email}
                initialMonth={filterMonth}
                onSelectRecord={(record) => {
                  handleRowClick({
                    ...record,
                    users: {
                      name: selectedEmployeeForCalendar.name,
                      role: selectedEmployeeForCalendar.role,
                      email: selectedEmployeeForCalendar.email
                    }
                  });
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Single Record Details / Admin Correction Modal */}
      {selectedRecord && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Edit {selectedRecord.users?.name}'s Attendance</h3>
                <p className="text-sm text-slate-500">{new Date(selectedRecord.date).toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {!isCorrecting ? (
                <>
                  {/* Status Bar */}
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedRecord.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                          selectedRecord.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                          selectedRecord.status === 'Holiday' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {selectedRecord.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">Total Hours</p>
                        <p className="text-sm font-bold text-slate-800">{selectedRecord.working_hours || '--'}</p>
                      </div>
                    </div>
                    {/* Admin Correction Button */}
                    <button 
                      onClick={() => {
                        const inTime = selectedRecord.check_in_time ? new Date(selectedRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                        const outTime = selectedRecord.check_out_time ? new Date(selectedRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                        setCorrectionForm({ status: selectedRecord.status, checkInTime: inTime, checkOutTime: outTime });
                        setIsCorrecting(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                    >
                      <Edit className="w-4 h-4" /> Correct Record
                    </button>
                  </div>

                  {/* Verifications */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Check IN */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <h4 className="font-bold text-slate-800">Check In</h4>
                        <span className="ml-auto font-mono font-medium text-slate-600">{formatTime(selectedRecord.check_in_time)}</span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Selfie Verification</p>
                            {photoUrls.in && (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({
                                  title: `Check In Selfie - ${selectedRecord.user?.name || 'Employee'} (${selectedRecord.attendance_date})`,
                                  url: photoUrls.in!,
                                  bucket: 'attendance_photos'
                                })}
                                className="flex items-center gap-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={12} /> View
                              </button>
                            )}
                          </div>
                          {photoUrls.in ? (
                            <img 
                              src={photoUrls.in} 
                              alt="Check in selfie" 
                              className="w-full h-48 object-cover rounded-lg bg-black cursor-pointer hover:opacity-95 transition-opacity" 
                              onClick={() => setPreviewDoc({
                                title: `Check In Selfie - ${selectedRecord.user?.name || 'Employee'} (${selectedRecord.attendance_date})`,
                                url: photoUrls.in!,
                                bucket: 'attendance_photos'
                              })}
                            />
                          ) : selectedRecord.check_in_photo_url ? (
                            <div className="w-full h-48 bg-slate-200 rounded-lg flex items-center justify-center animate-pulse">Loading...</div>
                          ) : (
                            <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">No Photo</div>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Location Data</p>
                          {selectedRecord.check_in_latitude ? (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono space-y-1">
                              <p>Lat: {selectedRecord.check_in_latitude}</p>
                              <p>Lng: {selectedRecord.check_in_longitude}</p>
                              <p>Accuracy: {Math.round(selectedRecord.check_in_accuracy || 0)}m</p>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.check_in_latitude},${selectedRecord.check_in_longitude}`} 
                                target="_blank" rel="noreferrer"
                                className="text-indigo-600 font-sans hover:underline flex items-center gap-1 mt-2"
                              >
                                <MapPin className="w-3 h-3" /> View on Map
                              </a>
                            </div>
                          ) : <p className="text-sm text-slate-400">Not recorded</p>}
                        </div>
                      </div>
                    </div>

                    {/* Check OUT */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-slate-400" />
                        <h4 className="font-bold text-slate-800">Check Out</h4>
                        <span className="ml-auto font-mono font-medium text-slate-600">{formatTime(selectedRecord.check_out_time)}</span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Selfie Verification</p>
                            {photoUrls.out && (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({
                                  title: `Check Out Selfie - ${selectedRecord.user?.name || 'Employee'} (${selectedRecord.attendance_date})`,
                                  url: photoUrls.out!,
                                  bucket: 'attendance_photos'
                                })}
                                className="flex items-center gap-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={12} /> View
                              </button>
                            )}
                          </div>
                          {photoUrls.out ? (
                            <img 
                              src={photoUrls.out} 
                              alt="Check out selfie" 
                              className="w-full h-48 object-cover rounded-lg bg-black cursor-pointer hover:opacity-95 transition-opacity" 
                              onClick={() => setPreviewDoc({
                                title: `Check Out Selfie - ${selectedRecord.user?.name || 'Employee'} (${selectedRecord.attendance_date})`,
                                url: photoUrls.out!,
                                bucket: 'attendance_photos'
                              })}
                            />
                          ) : selectedRecord.check_out_photo_url ? (
                            <div className="w-full h-48 bg-slate-200 rounded-lg flex items-center justify-center animate-pulse">Loading...</div>
                          ) : (
                            <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">No Photo</div>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Location Data</p>
                          {selectedRecord.check_out_latitude ? (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono space-y-1">
                              <p>Lat: {selectedRecord.check_out_latitude}</p>
                              <p>Lng: {selectedRecord.check_out_longitude}</p>
                              <p>Accuracy: {Math.round(selectedRecord.check_out_accuracy || 0)}m</p>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.check_out_latitude},${selectedRecord.check_out_longitude}`} 
                                target="_blank" rel="noreferrer"
                                className="text-indigo-600 font-sans hover:underline flex items-center gap-1 mt-2"
                              >
                                <MapPin className="w-3 h-3" /> View on Map
                              </a>
                            </div>
                          ) : <p className="text-sm text-slate-400">Not recorded</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Correction Mode */
                <div className="bg-amber-50 p-6 rounded-xl border border-amber-200">
                  <h4 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-600" /> Admin Correction
                  </h4>
                  <p className="text-sm text-amber-700 mb-6">You are overriding the system-generated attendance record. This action will be logged.</p>
                  <div className="space-y-4 max-w-sm">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-amber-900">Attendance Status</label>
                      <select 
                        value={correctionForm.status}
                        onChange={e => setCorrectionForm({...correctionForm, status: e.target.value})}
                        className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Present">Present</option>
                        <option value="Late">Late</option>
                        <option value="Absent">Absent</option>
                        <option value="Holiday">Holiday</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-amber-900">Check In Time</label>
                        <input 
                          type="time" 
                          value={correctionForm.checkInTime}
                          onChange={e => setCorrectionForm({...correctionForm, checkInTime: e.target.value})}
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-amber-900">Check Out Time</label>
                        <input 
                          type="time" 
                          value={correctionForm.checkOutTime}
                          onChange={e => setCorrectionForm({...correctionForm, checkOutTime: e.target.value})}
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center gap-3">
                    <button 
                      onClick={() => setIsCorrecting(false)}
                      className="px-4 py-2 bg-white text-slate-600 font-medium rounded-lg hover:bg-slate-100 border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveCorrection}
                      className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700"
                    >
                      Save Correction
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* In-App Document Viewer Lightbox Modal */}
      <DocumentViewerModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
