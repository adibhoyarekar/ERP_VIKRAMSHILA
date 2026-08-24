import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { AttendanceRecord, CollegeHoliday } from '../../types/attendance';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  X,
  MapPin, 
  Shield, 
  Sparkles,
  Info,
  PartyPopper,
  Eye
} from 'lucide-react';
import { logError } from '../../utils/errorHandler';
import DocumentViewerModal, { DocumentPreviewItem } from '../DocumentViewerModal';

interface AttendanceMonthlyCalendarProps {
  userId: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  initialMonth?: string; // Format: "YYYY-MM"
  onSelectRecord?: (record: AttendanceRecord, date: string) => void;
  readOnly?: boolean;
  refreshTrigger?: number;
}

export default function AttendanceMonthlyCalendar({
  userId,
  userName,
  userRole,
  userEmail,
  initialMonth,
  onSelectRecord,
  readOnly = false,
  refreshTrigger = 0
}: AttendanceMonthlyCalendarProps) {
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);
  // State for Selected Month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialMonth) return initialMonth;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<CollegeHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDayRecord, setSelectedDayRecord] = useState<{ date: string; record?: AttendanceRecord; holiday?: CollegeHoliday } | null>(null);
  const [dayPhotoUrls, setDayPhotoUrls] = useState<{ in?: string; out?: string }>({});

  // Parse Year and Month
  const [year, month] = useMemo(() => {
    const parts = selectedMonth.split('-');
    return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
  }, [selectedMonth]);

  // Fetch Attendance Records and Declared Holidays for this month
  const fetchMonthRecords = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // Calculate last day of the selected month
      const parts = selectedMonth.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      // 1. Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (attendanceError) throw attendanceError;
      setRecords((attendanceData || []) as AttendanceRecord[]);

      // 2. Fetch declared college holidays for this month
      const { data: holidayData, error: holidayError } = await supabase
        .from('college_holidays')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (holidayError && holidayError.code !== '42P01') {
        // Table might not exist yet if migration hasn't been run, suppress breaking error
        console.warn('Could not fetch college_holidays:', holidayError);
      }
      setHolidays((holidayData || []) as CollegeHoliday[]);

    } catch (err) {
      console.error('Error fetching calendar records:', err);
      logError(err, 'AttendanceMonthlyCalendar.fetchMonthRecords');
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedMonth]);

  const fetchMonthRecordsRef = React.useRef(fetchMonthRecords);
  useEffect(() => {
    fetchMonthRecordsRef.current = fetchMonthRecords;
  }, [fetchMonthRecords]);

  // Fetch when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchMonthRecordsRef.current();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    fetchMonthRecordsRef.current();

    // Subscribe to realtime changes for attendance and holidays
    const channel = supabase
      .channel(`calendar-attendance-feed-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records'
      }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (row && row.user_id === userId) {
          fetchMonthRecordsRef.current();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'college_holidays'
      }, () => {
        fetchMonthRecordsRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Navigation handlers
  const handlePrevMonth = () => {
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const isFutureMonth = selectedMonth >= currentMonthStr;

  // Calendar Day Computations
  const { daysInMonth, firstDayOfWeek, monthName, daysArray } = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0 = Sunday, 1 = Monday...
    const dateObj = new Date(year, month - 1, 1);
    const name = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const arr: { dayNum: number; dateStr: string; dayOfWeek: number }[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${selectedMonth}-${dayStr}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      arr.push({ dayNum: d, dateStr, dayOfWeek });
    }

    return {
      daysInMonth: totalDays,
      firstDayOfWeek: firstDay,
      monthName: name,
      daysArray: arr
    };
  }, [year, month, selectedMonth]);

  // Today string in local time (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, []);

  // Quick lookup map for records & holidays
  const recordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach(r => {
      map.set(r.date, r);
    });
    return map;
  }, [records]);

  const holidaysMap = useMemo(() => {
    const map = new Map<string, CollegeHoliday>();
    holidays.forEach(h => {
      map.set(h.date, h);
    });
    return map;
  }, [holidays]);

  // Calculate Monthly Statistics
  const stats = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let holidayCount = 0;
    let totalWorkingMinutes = 0;

    daysArray.forEach(({ dateStr, dayOfWeek }) => {
      const record = recordsMap.get(dateStr);
      const isHoliday = holidaysMap.has(dateStr);
      const isPastOrToday = dateStr <= todayStr;
      const isSunday = dayOfWeek === 0;

      if (isHoliday) {
        holidayCount++;
      }

      if (record) {
        if (record.status === 'Present') presentCount++;
        else if (record.status === 'Late') lateCount++;
        else if (record.status === 'Absent' && !isHoliday) absentCount++;

        // Calculate hours if available
        if (record.working_hours) {
          const match = record.working_hours.match(/(\d+)h\s*(\d+)m/);
          if (match) {
            totalWorkingMinutes += parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          }
        }
      } else if (isPastOrToday && !isSunday && !isHoliday) {
        // Unmarked working day in the past (not Sunday and not Holiday) counts as Absent
        absentCount++;
      }
    });

    const totalHours = Math.floor(totalWorkingMinutes / 60);
    const remainingMins = totalWorkingMinutes % 60;
    const workingHoursDisplay = totalWorkingMinutes > 0 ? `${totalHours}h ${remainingMins}m` : '--';

    return {
      presentCount,
      lateCount,
      absentCount,
      holidayCount,
      totalWorkingDays: presentCount + lateCount + absentCount,
      workingHoursDisplay
    };
  }, [daysArray, recordsMap, holidaysMap, todayStr]);

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDayClick = async (dateStr: string, record?: AttendanceRecord, holiday?: CollegeHoliday) => {
    if (onSelectRecord) {
      if (record) {
        onSelectRecord(record, dateStr);
      } else {
        onSelectRecord({
          id: 'new',
          user_id: userId,
          date: dateStr,
          status: holiday ? 'Holiday' : 'Absent'
        } as AttendanceRecord, dateStr);
      }
      return;
    }

    setSelectedDayRecord({ date: dateStr, record, holiday });
    setDayPhotoUrls({});

    if (record) {
      if (record.check_in_photo_url) {
        const { data } = await supabase.storage.from('attendance_photos').createSignedUrl(record.check_in_photo_url, 3600);
        if (data?.signedUrl) setDayPhotoUrls(prev => ({ ...prev, in: data.signedUrl }));
      }
      if (record.check_out_photo_url) {
        const { data } = await supabase.storage.from('attendance_photos').createSignedUrl(record.check_out_photo_url, 3600);
        if (data?.signedUrl) setDayPhotoUrls(prev => ({ ...prev, out: data.signedUrl }));
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Header Banner & User Profile */}
      <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
            <CalendarIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-slate-800">{userName || 'Employee'}</h3>
              {userRole && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {userRole}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{userEmail || 'Monthly day-wise attendance'}</p>
          </div>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200 shadow-xs"
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            />
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200 shadow-xs"
            disabled={isFutureMonth}
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={handleCurrentMonth}
            className="px-2.5 py-1 ml-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors border border-indigo-200"
          >
            Today
          </button>
        </div>
      </div>

      {/* Compact Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200">
        <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Present</p>
            <p className="text-base sm:text-lg font-black text-emerald-700">{stats.presentCount} <span className="text-xs font-normal text-slate-400">days</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={16} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Late</p>
            <p className="text-base sm:text-lg font-black text-amber-700">{stats.lateCount} <span className="text-xs font-normal text-slate-400">days</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-rose-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <XCircle size={16} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Absent</p>
            <p className="text-base sm:text-lg font-black text-rose-700">{stats.absentCount} <span className="text-xs font-normal text-slate-400">days</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-purple-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <PartyPopper size={16} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Holidays</p>
            <p className="text-base sm:text-lg font-black text-purple-700">{stats.holidayCount} <span className="text-xs font-normal text-slate-400">days</span></p>
          </div>
        </div>
      </div>

      {/* Main Calendar View */}
      <div className="p-2.5 sm:p-5 overflow-x-auto w-full">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-xs font-medium text-slate-500">Loading attendance calendar...</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Weekday Column Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`py-1 sm:py-1.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-md sm:rounded-lg ${
                    idx === 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100/80 text-slate-600'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* Empty leading padding days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-11 sm:h-16 bg-slate-50/30 rounded-lg sm:rounded-xl border border-slate-100/60 opacity-20"></div>
              ))}

              {/* Month Days */}
              {daysArray.map(({ dayNum, dateStr, dayOfWeek }) => {
                const record = recordsMap.get(dateStr);
                const holiday = holidaysMap.get(dateStr);
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const isSunday = dayOfWeek === 0;

                // Determine Theme based on attendance & declared holidays
                let cardStyle = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:shadow-sm';
                let badgeContent = null;

                if (record) {
                  if (record.status === 'Present') {
                    cardStyle = 'bg-emerald-50/80 border-emerald-300 text-emerald-950 hover:bg-emerald-100/80 hover:border-emerald-400';
                    badgeContent = (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white shadow-xs truncate max-w-full">
                        <CheckCircle2 size={9} />
                        {record.check_in_time ? formatTime(record.check_in_time) : 'Present'}
                      </span>
                    );
                  } else if (record.status === 'Late') {
                    cardStyle = 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100/80 hover:border-amber-400';
                    badgeContent = (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white shadow-xs truncate max-w-full">
                        <Clock size={9} />
                        {record.check_in_time ? formatTime(record.check_in_time) : 'Late'}
                      </span>
                    );
                  } else if (record.status === 'Absent' && !holiday) {
                    cardStyle = 'bg-rose-50/70 border-rose-200 text-rose-950 hover:bg-rose-100/70 hover:border-rose-300';
                    badgeContent = (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white truncate max-w-full">
                        <XCircle size={9} /> Absent
                      </span>
                    );
                  }
                }

                // If declared holiday overrides default missing/absent style
                if (holiday && (!record || record.status === 'Absent' || record.status === 'Holiday')) {
                  cardStyle = 'bg-purple-50/90 border-purple-300 text-purple-950 hover:bg-purple-100/90 hover:border-purple-400 shadow-xs';
                  badgeContent = (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600 text-white truncate max-w-full" title={holiday.title}>
                      <PartyPopper size={9} /> {holiday.title}
                    </span>
                  );
                } else if (!record) {
                  if (isSunday) {
                    cardStyle = 'bg-slate-100/60 border-slate-200/70 text-slate-400';
                    badgeContent = <span className="text-[9px] font-bold text-slate-400">Off</span>;
                  } else if (isFuture) {
                    cardStyle = 'bg-slate-50/40 border-slate-100 text-slate-300';
                  } else {
                    // Past working day without record = Absent
                    cardStyle = 'bg-rose-50/40 border-rose-200 text-rose-900 hover:bg-rose-50 hover:border-rose-300';
                    badgeContent = <span className="text-[9px] font-bold text-rose-500 bg-rose-100/80 px-1 py-0.2 rounded">Absent</span>;
                  }
                }

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleDayClick(dateStr, record, holiday)}
                    title={
                      holiday
                        ? `🎉 Holiday: ${holiday.title} (Attendance Optional)`
                        : record
                        ? `${record.status} | In: ${formatTime(record.check_in_time)} | Out: ${record.check_out_time ? formatTime(record.check_out_time) : '-'} | Hours: ${record.working_hours || '-'}`
                        : isSunday
                        ? 'Sunday (Weekly Off)'
                        : isFuture
                        ? 'Upcoming'
                        : 'Absent (No check-in recorded)'
                    }
                    className={`h-11 sm:h-16 p-1 sm:p-2 rounded-lg sm:rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative group select-none hover:scale-[1.03] ${cardStyle} ${
                      isToday ? 'ring-2 ring-indigo-600 ring-offset-1 shadow-sm' : ''
                    }`}
                  >
                    {/* Top Row: Day Number & Indicators */}
                    <div className="flex justify-between items-start w-full">
                      <span
                        className={`text-[10px] sm:text-xs font-black rounded w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center ${
                          isToday
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : holiday
                            ? 'bg-purple-200 text-purple-900 font-black'
                            : isSunday
                            ? 'text-rose-500 font-bold'
                            : 'text-slate-800'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {/* Manual correction indicator */}
                      {record?.is_manually_corrected && (
                        <Shield size={9} className="text-indigo-600 shrink-0" title="Manually Corrected by Admin" />
                      )}
                    </div>

                    {/* Bottom Row: Status Badge / Time */}
                    <div className="flex items-center justify-start w-full overflow-hidden text-[8px] sm:text-[9px]">
                      {badgeContent}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-500"></span>
            <span className="font-semibold text-slate-700">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-500"></span>
            <span className="font-semibold text-slate-700">Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-500"></span>
            <span className="font-semibold text-slate-700">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-purple-600"></span>
            <span className="font-semibold text-slate-700">Declared Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-200"></span>
            <span className="font-semibold text-slate-500">Weekend Off</span>
          </div>
        </div>

        <div className="text-slate-400 text-xs">
          Click on any day card to view location, selfie & holiday details.
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayRecord && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-lg text-slate-800">
                  Attendance for {new Date(selectedDayRecord.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </h4>
                <p className="text-xs text-slate-500">{userName || 'Employee'} • {userRole?.toUpperCase() || 'STAFF'}</p>
              </div>
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* If declared holiday */}
              {selectedDayRecord.holiday && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-3">
                  <PartyPopper className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                      College Holiday
                    </span>
                    <h5 className="font-bold text-purple-950 text-base mt-1">
                      {selectedDayRecord.holiday.title}
                    </h5>
                    <p className="text-xs text-purple-700 mt-1">
                      {selectedDayRecord.holiday.description || 'Institutional holiday declared by administration. Employees are exempt from attendance and will not be marked absent.'}
                    </p>
                  </div>
                </div>
              )}

              {selectedDayRecord.record && selectedDayRecord.record.check_in_time ? (
                <>
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          selectedDayRecord.record.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedDayRecord.record.status === 'Late'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {selectedDayRecord.record.status}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Working Hours</p>
                      <p className="text-base font-black text-slate-800">{selectedDayRecord.record.working_hours || (selectedDayRecord.record.check_in_time && !selectedDayRecord.record.check_out_time ? 'Session In Progress' : '--')}</p>
                    </div>
                  </div>

                  {/* Check In & Check Out Times */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        Check In
                      </div>
                      <p className="text-xl font-black font-mono text-emerald-950">
                        {formatTime(selectedDayRecord.record.check_in_time)}
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-1">
                        {new Date(selectedDayRecord.record.check_in_time).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-2">
                        <Clock size={16} className="text-slate-500" />
                        Check Out
                      </div>
                      <p className="text-xl font-black font-mono text-slate-800">
                        {selectedDayRecord.record.check_out_time ? formatTime(selectedDayRecord.record.check_out_time) : '--:--'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {selectedDayRecord.record.check_out_time ? new Date(selectedDayRecord.record.check_out_time).toLocaleDateString() : 'No Checkout'}
                      </p>
                    </div>
                  </div>

                  {/* Locations & Selfies Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* In Location */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <MapPin size={13} className="text-emerald-600" />
                        Check-in Location
                      </p>
                      {selectedDayRecord.record.check_in_latitude ? (
                        <>
                          <p className="text-xs text-slate-600 font-mono">
                            {selectedDayRecord.record.check_in_latitude.toFixed(6)}, {selectedDayRecord.record.check_in_longitude?.toFixed(6)}
                          </p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedDayRecord.record.check_in_latitude},${selectedDayRecord.record.check_in_longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline mt-1.5"
                          >
                            Open on Google Maps &rarr;
                          </a>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">Not recorded</p>
                      )}
                    </div>

                    {/* Out Location */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-500" />
                        Check-out Location
                      </p>
                      {selectedDayRecord.record.check_out_latitude ? (
                        <>
                          <p className="text-xs text-slate-600 font-mono">
                            {selectedDayRecord.record.check_out_latitude.toFixed(6)}, {selectedDayRecord.record.check_out_longitude?.toFixed(6)}
                          </p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedDayRecord.record.check_out_latitude},${selectedDayRecord.record.check_out_longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline mt-1.5"
                          >
                            Open on Google Maps &rarr;
                          </a>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">Not recorded</p>
                      )}
                    </div>
                  </div>

                  {/* Verification Selfies */}
                  {(dayPhotoUrls.in || dayPhotoUrls.out) && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      {dayPhotoUrls.in && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-slate-700">Check-in Photo</p>
                          <img
                            src={dayPhotoUrls.in}
                            alt="Check in verification"
                            className="w-full h-32 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setPreviewDoc({
                              title: `Check In Selfie - ${userName || 'Employee'} (${selectedDayRecord.date})`,
                              url: dayPhotoUrls.in!,
                              bucket: 'attendance_photos'
                            })}
                          />
                        </div>
                      )}
                      {dayPhotoUrls.out && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-slate-700">Check-out Photo</p>
                          <img
                            src={dayPhotoUrls.out}
                            alt="Check out verification"
                            className="w-full h-32 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setPreviewDoc({
                              title: `Check Out Selfie - ${userName || 'Employee'} (${selectedDayRecord.date})`,
                              url: dayPhotoUrls.out!,
                              bucket: 'attendance_photos'
                            })}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedDayRecord.record.is_manually_corrected && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                      <Shield size={16} className="text-amber-600 shrink-0" />
                      <span>This attendance entry was manually reviewed and corrected by an administrator.</span>
                    </div>
                  )}
                </>
              ) : !selectedDayRecord.holiday ? (
                <div className="py-8 text-center text-slate-500">
                  <Info size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No Attendance Recorded</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(selectedDayRecord.date).getDay() === 0
                      ? 'This day is a designated weekly holiday (Sunday).'
                      : selectedDayRecord.date > todayStr
                      ? 'This is an upcoming date.'
                      : 'The employee did not log attendance on this working day and is marked Absent.'}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Close
              </button>
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
