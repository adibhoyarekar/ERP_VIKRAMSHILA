import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from '../../data/mockData';
import { supabase } from '../../lib/supabase';
import { calculateDistanceMeters, getDeviceLocation } from '../../utils/geo';
import { AppSettings, AttendanceRecord, CollegeHoliday } from '../../types/attendance';
import CameraCapture from './CameraCapture';
import AttendanceMonthlyCalendar from './AttendanceMonthlyCalendar';
import { 
  MapPin, Clock, CheckCircle, AlertCircle, Camera, Calendar, 
  ListFilter, Sparkles, RefreshCw, Shield, Sun, Moon, Lock, 
  CheckCircle2, ShieldCheck, PartyPopper, PhoneCall 
} from 'lucide-react';
import { logError } from '../../utils/errorHandler';
import { compressImage } from '../../utils/imageCompressor';
import { getCheckInWindowState, formatTimeAmPm } from '../../utils/attendanceTime';

interface EmployeeAttendanceTabProps {
  user: User;
}

export default function EmployeeAttendanceTab({ user }: EmployeeAttendanceTabProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<CollegeHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [showCamera, setShowCamera] = useState(false);
  const [actionType, setActionType] = useState<'check_in' | 'check_out'>('check_in');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCountdown, setErrorCountdown] = useState<number>(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [liveTime, setLiveTime] = useState<Date>(new Date());

  // Auto-scroll helper so notifications are instantly visible to the user
  const scrollToTopNotification = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const scrollParents = document.querySelectorAll('main, .overflow-y-auto, #attendance-tab-container');
      scrollParents.forEach(el => {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, []);

  // 10-Second Auto-dismiss timer for notifications with instant continue option
  useEffect(() => {
    if (!error) {
      setErrorCountdown(0);
      return;
    }

    setErrorCountdown(10);
    scrollToTopNotification();

    const interval = setInterval(() => {
      setErrorCountdown(prev => {
        if (prev <= 1) {
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [error, scrollToTopNotification]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
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

  // Check if today is a declared college holiday
  const todayHoliday = useMemo(() => {
    return holidays.find(h => h.date === todayStr);
  }, [holidays, todayStr]);

  // Real-time check-in window state
  const windowInfo = useMemo(() => {
    return getCheckInWindowState(
      liveTime,
      settings?.check_in_window_start || '08:00:00',
      settings?.check_in_window_end || '10:00:00'
    );
  }, [liveTime, settings]);

  const isCheckInWindowEnded = windowInfo.isClosed;

  const fetchAttendanceData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Get app settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single();
        
      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      if (settingsData) setSettings(settingsData as AppSettings);

      // 2. Get today's record (matching today's date or latest active check-in record)
      let todayRec: AttendanceRecord | null = null;
      const { data: todayData, error: todayError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();
        
      if (todayError) throw todayError;
      todayRec = todayData as AttendanceRecord | null;

      if (!todayRec) {
        // Fallback: Check if there is an active check-in record from today
        const { data: recentData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', user.id)
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentData && recentData.check_in_time) {
          const recDate = new Date(recentData.check_in_time).toDateString();
          const currDate = new Date().toDateString();
          if (recDate === currDate) {
            todayRec = recentData as AttendanceRecord;
          }
        }
      }

      setTodayRecord(todayRec);

      // 3. Get all history records
      const { data: historyData, error: historyError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(60);
        
      if (historyError) throw historyError;
      setHistory((historyData as AttendanceRecord[]) || []);

      // 4. Get declared college holidays
      const { data: holidayData, error: holidayError } = await supabase
        .from('college_holidays')
        .select('*')
        .order('date', { ascending: false });

      if (holidayError && holidayError.code !== '42P01') {
        console.warn('Could not fetch college_holidays:', holidayError);
      }
      setHolidays((holidayData || []) as CollegeHoliday[]);

    } catch (err) {
      console.error('Error fetching attendance:', err);
      logError(err, 'fetchAttendanceData');
    } finally {
      setIsLoading(false);
    }
  }, [user.id, todayStr]);

  const fetchAttendanceRef = useRef(fetchAttendanceData);
  useEffect(() => {
    fetchAttendanceRef.current = fetchAttendanceData;
  }, [fetchAttendanceData]);

  useEffect(() => {
    fetchAttendanceRef.current();

    // Subscribe to realtime changes for this employee's attendance & holidays
    const channel = supabase
      .channel(`employee-attendance-live-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records'
      }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (row && row.user_id === user.id) {
          fetchAttendanceRef.current();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'college_holidays'
      }, () => {
        fetchAttendanceRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const handleStartAttendance = (type: 'check_in' | 'check_out') => {
    setError(null);
    setSuccess(null);

    // Validate check-in window boundaries before opening camera
    if (type === 'check_in') {
      const currentWindow = getCheckInWindowState(
        new Date(),
        settings?.check_in_window_start || '08:00:00',
        settings?.check_in_window_end || '10:00:00'
      );

      if (currentWindow.isNotStarted) {
        setError(`Check-in window has not started yet. Today's check-in is allowed between ${currentWindow.startTimeDisplay} and ${currentWindow.endTimeDisplay}.`);
        return;
      }

      if (currentWindow.isClosed) {
        setError(`Check-in window closed at ${currentWindow.endTimeDisplay} (Marked Absent). Please contact an Admin or SuperAdmin to mark or regularize your attendance.`);
        return;
      }
    }

    if (type === 'check_out') {
      if (!todayRecord?.check_in_time) {
        setError("You must complete check-in before checking out.");
        return;
      }
      if (todayRecord?.check_out_time) {
        setError("You have already checked out for today.");
        return;
      }
    }

    setActionType(type);
    setShowCamera(true);
  };

  const processAttendance = async (photoFile: File) => {
    setShowCamera(false);
    setIsProcessing(true);
    setError(null);

    try {
      if (!settings) throw new Error("College location settings not configured. Please contact Admin.");

      // 1. Get Location
      const { latitude, longitude, accuracy } = await getDeviceLocation();

      // 2. Geofence Validation (Strictly enforce campus radius, zero tolerance)
      const distance = calculateDistanceMeters(
        latitude,
        longitude,
        settings.college_latitude,
        settings.college_longitude
      );

      const maxAllowedRadius = Number(settings.college_radius_meters || 100);
      
      if (distance > maxAllowedRadius) {
        throw new Error(
          `Location verification failed: You are ${distance.toFixed(1)}m away from the campus (strictly allowed radius: ${maxAllowedRadius}m). Attendance cannot be marked outside the designated college perimeter.`
        );
      }

      if (accuracy > 400) {
        throw new Error("Location accuracy is too low (> 400m). Please move closer to an open area or enable WiFi for better accuracy and try again.");
      }

      // 3. Compress & Upload Photo to Storage
      const compressedPhoto = await compressImage(photoFile, {
        maxDimension: 800,
        quality: 0.7,
        mimeType: 'image/jpeg',
        fileName: `${Date.now()}.jpg`
      });

      const filePath = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('attendance_photos')
        .upload(filePath, compressedPhoto, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.warn("Photo upload warning:", uploadError);
      }

      // 4. Record to Database via Secure Server RPC (with fallback)
      let rpcHandled = false;
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('verify_and_record_attendance', {
          p_action_type: actionType,
          p_photo_url: filePath,
          p_latitude: latitude,
          p_longitude: longitude,
          p_accuracy: accuracy,
          p_user_id: user.id
        });

        if (!rpcError && rpcResult) {
          if (!rpcResult.success) {
            throw new Error(rpcResult.message || "Attendance verification failed.");
          }
          rpcHandled = true;
          if (actionType === 'check_in') {
            setSuccess(`Check-in confirmed successfully (${rpcResult.status || 'Present'})! Your punch is now live.`);
          } else {
            setSuccess(`Check-out confirmed successfully! Total hours worked: ${rpcResult.working_hours || 'recorded'}.`);
          }
        }
      } catch (rpcErr: any) {
        if (rpcErr.message && (
          rpcErr.message.includes('Location verification failed') ||
          rpcErr.message.includes('Check-in window') ||
          rpcErr.message.includes('already checked in') ||
          rpcErr.message.includes('already checked out')
        )) {
          throw rpcErr;
        }
      }

      if (!rpcHandled) {
        let serverTime = new Date().toISOString();
        try {
          const { data: serverTimeData } = await supabase.rpc('get_server_timestamp');
          if (serverTimeData) serverTime = serverTimeData;
        } catch {
          // fallback
        }

        if (actionType === 'check_in') {
          // Convert server UTC timestamp to IST (UTC+5:30) for correct comparison
          // against admin-configured IST time settings
          const serverDateObj = new Date(serverTime);
          const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
          const istDate = new Date(serverDateObj.getTime() + istOffsetMs + serverDateObj.getTimezoneOffset() * 60000);

          const windowStart = settings.check_in_window_start || '08:00:00';
          const windowEnd = settings.check_in_window_end || '10:00:00';

          // Server-verified check-in window validation using IST time
          const serverWindow = getCheckInWindowState(istDate, windowStart, windowEnd);

          if (serverWindow.isNotStarted) {
            throw new Error(`Check-in window has not started yet. Today's check-in is permitted between ${serverWindow.startTimeDisplay} and ${serverWindow.endTimeDisplay}.`);
          }

          if (serverWindow.isClosed) {
            throw new Error(`Check-in window closed at ${serverWindow.endTimeDisplay} (Marked Absent). Please contact an Admin or SuperAdmin to mark or regularize your attendance.`);
          }

          // Determine Present vs Late using IST time
          const timePart = `${istDate.getHours().toString().padStart(2, '0')}:${istDate.getMinutes().toString().padStart(2, '0')}:${istDate.getSeconds().toString().padStart(2, '0')}`;
          const status = timePart > settings.late_threshold_time ? 'Late' : 'Present';

          // Use IST date for the record
          const istDateStr = `${istDate.getFullYear()}-${(istDate.getMonth() + 1).toString().padStart(2, '0')}-${istDate.getDate().toString().padStart(2, '0')}`;

          const { data: insertedRec, error: dbError } = await supabase
            .from('attendance_records')
            .insert({
              user_id: user.id,
              date: istDateStr,
              check_in_time: serverTime,
              check_in_photo_url: filePath,
              check_in_latitude: latitude,
              check_in_longitude: longitude,
              check_in_accuracy: accuracy,
              status: status
            })
            .select()
            .maybeSingle();
            
          if (dbError) {
            if (dbError.code === '23505') throw new Error("You have already checked in today.");
            throw dbError;
          }
          if (insertedRec) {
            setTodayRecord(insertedRec as AttendanceRecord);
          }
          setSuccess(`Check-in confirmed successfully (${status})! Your punch is now live.`);
          
        } else {
          // Check-out branch
          let existingRecord = todayRecord;
          if (!existingRecord?.id || !existingRecord?.check_in_time) {
            const { data: dbRec } = await supabase
              .from('attendance_records')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (dbRec && dbRec.check_in_time) {
              existingRecord = dbRec as AttendanceRecord;
            }
          }

          if (!existingRecord || !existingRecord.check_in_time) {
            throw new Error("Cannot check out: No active morning check-in found for today.");
          }

          if (existingRecord.check_out_time) {
            throw new Error("You have already checked out for today.");
          }
          
          const checkInDate = new Date(existingRecord.check_in_time);
          const checkOutDate = new Date(serverTime);
          const diffMs = Math.max(0, checkOutDate.getTime() - checkInDate.getTime());
          const hrs = Math.floor(diffMs / 3600000);
          const mins = Math.floor((diffMs % 3600000) / 60000);
          const workingHoursStr = `${hrs}h ${mins}m`;

          const { data: updatedRec, error: dbError } = await supabase
            .from('attendance_records')
            .update({
              check_out_time: serverTime,
              check_out_photo_url: filePath,
              check_out_latitude: latitude,
              check_out_longitude: longitude,
              check_out_accuracy: accuracy,
              working_hours: workingHoursStr
            })
            .eq('id', existingRecord.id)
            .select()
            .maybeSingle();
            
          if (dbError) throw dbError;
          if (updatedRec) {
            setTodayRecord(updatedRec as AttendanceRecord);
          } else {
            setTodayRecord(prev => prev ? { ...prev, check_out_time: serverTime, working_hours: workingHoursStr } : null);
          }
          setSuccess(`Check-out confirmed successfully! Total hours worked: ${workingHoursStr}.`);
        }
      }

      await fetchAttendanceData();
      setRefreshTrigger(prev => prev + 1);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      logError(err, 'processAttendance');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Month Statistics (excluding declared holidays from absent count)
  const monthStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthRecords = history.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const present = monthRecords.filter(r => r.status === 'Present').length;
    const late = monthRecords.filter(r => r.status === 'Late').length;
    // Exclude records that are holidays
    const absent = monthRecords.filter(r => r.status === 'Absent' && !holidays.some(h => h.date === r.date)).length;
    const totalWorkingDays = present + late + absent;

    return {
      present,
      late,
      absent,
      total: totalWorkingDays
    };
  }, [history, holidays]);

  const hasCheckedIn = !!todayRecord?.check_in_time;
  const hasCheckedOut = !!todayRecord?.check_out_time;

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-sm font-medium text-slate-500">Loading attendance dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-3.5 sm:space-y-5 overflow-y-auto h-full custom-scrollbar w-full">
      {/* Toast Notifications with Auto-Countdown and Instant Continue */}
      {error && (
        <div className="p-3.5 sm:p-4 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300 shadow-sm">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-rose-950">Verification Alert</p>
              <p className="text-xs sm:text-sm font-medium text-rose-800 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-[11px] font-mono font-bold text-rose-600 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-200">
              {errorCountdown > 0 ? `${errorCountdown}s` : 'Closing'}
            </span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-bold text-emerald-950">{success}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* 1. Live Real-Time Date & Clock Header */}
      <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 w-full">
        <div className="w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Live Real-Time Status
            </span>
            {todayHoliday && (
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 inline-flex items-center gap-1">
                <PartyPopper size={11} /> Holiday: {todayHoliday.title}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mt-1.5">
            <h3 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
              {liveTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </h3>
            <span className="text-sm sm:text-lg font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
              {liveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            <Clock size={15} className="text-slate-400" />
            <span>Check-in:</span>
            <span className="font-bold text-slate-800 font-mono">
              {windowInfo.startTimeDisplay} - {windowInfo.endTimeDisplay}
            </span>
          </div>
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

      {/* Holiday Announcement Banner if today is a Holiday */}
      {todayHoliday && (
        <div className="p-3.5 sm:p-4 bg-purple-50 border border-purple-200 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
              <PartyPopper size={18} />
            </div>
            <div>
              <h4 className="font-bold text-purple-950 text-xs sm:text-sm">
                Today is a Declared College Holiday: {todayHoliday.title}
              </h4>
              <p className="text-[11px] sm:text-xs text-purple-700">
                {todayHoliday.description || 'Attendance punch is optional today. No absence will be recorded if you do not check in.'}
              </p>
            </div>
          </div>
          <span className="text-[11px] sm:text-xs font-bold bg-purple-200 text-purple-900 px-3 py-1 rounded-full border border-purple-300 self-start sm:self-auto">
            Exempt From Punch
          </span>
        </div>
      )}

      {/* Window Closed Admin Contact Notification Banner */}
      {!hasCheckedIn && windowInfo.isClosed && !todayHoliday && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h4 className="font-bold text-rose-950 text-xs sm:text-sm">
                Check-in Window Closed for Today (Ended at {windowInfo.endTimeDisplay})
              </h4>
              <p className="text-[11px] sm:text-xs text-rose-700 mt-0.5">
                Attendance is marked as Absent. If you arrived on time or have authorization, please contact your Admin or SuperAdmin to regularize or mark your attendance.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-900 text-xs font-bold rounded-xl border border-rose-200 whitespace-nowrap self-start sm:self-auto">
            <PhoneCall size={13} />
            <span>Contact Admin</span>
          </div>
        </div>
      )}

      {/* Window Not Started Banner */}
      {!hasCheckedIn && windowInfo.isNotStarted && !todayHoliday && (
        <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                Check-in Window Opens at {windowInfo.startTimeDisplay}
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-800 mt-0.5">
                Morning punch will unlock automatically once the check-in window starts ({windowInfo.startTimeDisplay} - {windowInfo.endTimeDisplay}).
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-amber-200/80 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-300 self-start sm:self-auto">
            Window Starts at {windowInfo.startTimeDisplay}
          </span>
        </div>
      )}

      {/* 2. Top 4 Statistics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-black uppercase tracking-wider mb-1 text-slate-500">Working Days</p>
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{monthStats.total}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-black uppercase tracking-wider mb-1 text-emerald-600">Present</p>
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-600">{monthStats.present}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-black uppercase tracking-wider mb-1 text-amber-600">Late</p>
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-amber-600">{monthStats.late}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-black uppercase tracking-wider mb-1 text-rose-600">Absent</p>
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-rose-600">{monthStats.absent}</p>
        </div>
      </div>

      {/* 3. Sleek Today's Punch Session Card */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden w-full">
        {/* Card Header */}
        <div className="p-3.5 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                Today's Punch Session
                <span className="text-[9px] sm:text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wider">
                  Selfie + GPS
                </span>
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-500">Live facial photo verification & campus geofence tracking</p>
            </div>
          </div>

          <div>
            {todayRecord ? (
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border shadow-xs ${
                todayRecord.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                todayRecord.status === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                todayRecord.status === 'Holiday' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${todayRecord.status === 'Present' ? 'bg-emerald-500' : todayRecord.status === 'Late' ? 'bg-amber-500' : todayRecord.status === 'Holiday' ? 'bg-purple-500' : 'bg-rose-500'}`}></span>
                {todayRecord.status} Today
              </span>
            ) : todayHoliday ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-purple-800 bg-purple-100 border border-purple-200">
                <PartyPopper size={13} className="text-purple-600" />
                Holiday: {todayHoliday.title} (Optional Punch)
              </span>
            ) : windowInfo.isNotStarted ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200">
                <Clock size={13} className="text-amber-600" />
                Check-In Opens at {windowInfo.startTimeDisplay}
              </span>
            ) : windowInfo.isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Window Closed (Marked Absent)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Awaiting Morning Check-In
              </span>
            )}
          </div>
        </div>

        {/* Dual Punch Cards Grid */}
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Check In / Morning Punch */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
            hasCheckedIn
              ? 'bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 border-emerald-200 shadow-xs'
              : 'bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 border-indigo-200/80 hover:border-indigo-400 hover:shadow-md'
          }`}>
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    hasCheckedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Sun size={16} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-800">Check In (Morning)</h5>
                    <p className="text-[11px] text-slate-400">Campus Arrival</p>
                  </div>
                </div>

                {hasCheckedIn ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Completed
                  </span>
                ) : windowInfo.isNotStarted ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                    <Clock size={12} /> Not Started
                  </span>
                ) : windowInfo.isClosed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                    <Lock size={12} /> Closed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Pending
                  </span>
                )}
              </div>

              {/* Time Display & Metadata */}
              <div className="my-3 p-3 bg-white/80 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punch In Time</p>
                  <p className="text-2xl sm:text-3xl font-black font-mono text-slate-800 tracking-tight">
                    {hasCheckedIn ? formatTime(todayRecord?.check_in_time) : '--:--'}
                  </p>
                </div>

                {hasCheckedIn && todayRecord?.check_in_accuracy && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 inline-flex items-center gap-1">
                      <MapPin size={10} /> GPS Verified ({Math.round(todayRecord.check_in_accuracy)}m)
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">Photo Uploaded ✓</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {hasCheckedIn ? (
              <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-2 mt-2">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Morning check-in successfully logged & verified.</span>
              </div>
            ) : windowInfo.isNotStarted ? (
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                >
                  <Lock size={15} />
                  <span>Window Opens at {windowInfo.startTimeDisplay}</span>
                </button>
                <p className="text-[11px] text-center text-amber-700 bg-amber-50/80 py-1 px-2 rounded-lg border border-amber-100 font-medium">
                  Check-in window: {windowInfo.startTimeDisplay} - {windowInfo.endTimeDisplay}
                </p>
              </div>
            ) : windowInfo.isClosed ? (
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 bg-rose-50 text-rose-500 rounded-xl font-bold text-sm border border-rose-200 flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                >
                  <Lock size={15} />
                  <span>Window Closed (Marked Absent)</span>
                </button>
                <p className="text-[11px] text-center text-rose-700 bg-rose-50/90 py-1 px-2 rounded-lg border border-rose-100 font-medium">
                  Window closed at {windowInfo.endTimeDisplay}. Please contact Admin to mark attendance.
                </p>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => handleStartAttendance('check_in')}
                  disabled={isProcessing}
                  className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-indigo-500/25 flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing && actionType === 'check_in' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <Camera size={16} className="group-hover:scale-110 transition-transform" />
                      <span>Check In with Selfie</span>
                    </>
                  )}
                </button>

                {/* In-Place Verification Notice for Check In */}
                {error && actionType === 'check_in' && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-xs text-rose-950">Verification Notice</p>
                          <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            {errorCountdown > 0 ? `${errorCountdown}s` : 'Closing'}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">{error}</p>
                        <button
                          type="button"
                          onClick={() => setError(null)}
                          className="mt-2 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          Continue / Retry
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Check Out / Evening Punch */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
            hasCheckedOut
              ? 'bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/20 border-indigo-200 shadow-xs'
              : hasCheckedIn
              ? 'bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 border-indigo-200/90 hover:border-indigo-400 hover:shadow-md'
              : 'bg-slate-50/60 border-slate-200/60 opacity-80'
          }`}>
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    hasCheckedOut ? 'bg-indigo-100 text-indigo-700' : hasCheckedIn ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Moon size={16} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-800">Check Out (Evening)</h5>
                    <p className="text-[11px] text-slate-400">Campus Departure</p>
                  </div>
                </div>

                {hasCheckedOut ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    <CheckCircle2 size={13} className="text-indigo-600" /> Completed
                  </span>
                ) : hasCheckedIn ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                    Session In Progress
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500">
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>

              {/* Time Display & Metadata */}
              <div className="my-3 p-3 bg-white/80 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punch Out Time</p>
                  <p className="text-2xl sm:text-3xl font-black font-mono text-slate-800 tracking-tight">
                    {hasCheckedOut ? formatTime(todayRecord?.check_out_time) : '--:--'}
                  </p>
                </div>

                {hasCheckedOut && todayRecord?.working_hours ? (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Total: {todayRecord.working_hours}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">Photo Uploaded ✓</p>
                  </div>
                ) : hasCheckedIn ? (
                  <div className="text-right">
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      Ready for check-out
                    </span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400">
                      Unlocks after check-in
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {hasCheckedIn && !hasCheckedOut ? (
              <div>
                <button
                  onClick={() => handleStartAttendance('check_out')}
                  disabled={isProcessing}
                  className="w-full mt-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-slate-800/25 flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing && actionType === 'check_out' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <Camera size={16} className="group-hover:scale-110 transition-transform" />
                      <span>Check Out with Selfie</span>
                    </>
                  )}
                </button>

                {/* In-Place Verification Notice for Check Out */}
                {error && actionType === 'check_out' && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-xs text-rose-950">Verification Notice</p>
                          <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            {errorCountdown > 0 ? `${errorCountdown}s` : 'Closing'}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">{error}</p>
                        <button
                          type="button"
                          onClick={() => setError(null)}
                          className="mt-2 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          Continue / Retry
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : hasCheckedOut ? (
              <div className="text-[11px] text-indigo-700 font-semibold bg-indigo-50/80 px-3 py-2 rounded-xl border border-indigo-100 flex items-center gap-2 mt-2">
                <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />
                <span>Day completed. Total hours logged: {todayRecord?.working_hours}.</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium bg-slate-100/70 px-3 py-2 rounded-xl border border-slate-200/50 flex items-center gap-2 mt-2">
                <Lock size={13} className="text-slate-400 shrink-0" />
                <span>Complete morning check-in to enable check-out.</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 4. Tab Navigation & Main Calendar View */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'calendar'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={15} />
            Monthly Calendar
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter size={15} />
            History Table
          </button>
        </div>

        <button
          onClick={fetchAttendanceData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors shadow-xs"
          title="Refresh attendance data"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* 5. Main Calendar Render */}
      {viewMode === 'calendar' ? (
        <AttendanceMonthlyCalendar
          userId={user.id}
          userName={user.name}
          userRole={user.role}
          userEmail={user.email}
          refreshTrigger={refreshTrigger}
        />
      ) : (
        /* Real-Time Attendance History Table */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Attendance History</h3>
              <p className="text-xs text-slate-500">Live updated records for all past and active sessions</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4">Working Hours</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No attendance records found yet.
                    </td>
                  </tr>
                ) : (
                  history.map((record) => {
                    const isToday = record.date === todayStr;
                    const isHolidayRecord = holidays.find(h => h.date === record.date);

                    return (
                      <tr key={record.id} className={`hover:bg-slate-50/70 transition-colors ${isToday ? 'bg-indigo-50/20' : ''}`}>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{formatDate(record.date)}</span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700">
                                Today
                              </span>
                            )}
                            {isHolidayRecord && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1">
                                <PartyPopper size={10} /> {isHolidayRecord.title}
                              </span>
                            )}
                            {record.is_manually_corrected && (
                              <span className="text-[11px] text-amber-600 font-semibold" title="Manually Corrected by Admin">
                                (Corrected)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-mono">
                          {formatTime(record.check_in_time)}
                          {record.check_in_accuracy && (
                            <span className="ml-1 text-emerald-500 text-xs" title="GPS Verified">✓</span>
                          )}
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
                            'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture 
          onCapture={processAttendance} 
          onCancel={() => setShowCamera(false)} 
        />
      )}
    </div>
  );
}
