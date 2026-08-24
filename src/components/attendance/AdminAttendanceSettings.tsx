import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AppSettings, CollegeHoliday } from '../../types/attendance';
import { Settings, Save, AlertCircle, CheckCircle, MapPin, RefreshCw, Plus, Trash2, PartyPopper } from 'lucide-react';
import { getDeviceLocation } from '../../utils/geo';
import { timeStringToSeconds, formatTimeAmPm } from '../../utils/attendanceTime';

const DEFAULT_SETTINGS: AppSettings = {
  id: '',
  college_latitude: 19.876165,
  college_longitude: 75.343314,
  college_radius_meters: 100,
  work_start_time: '09:00:00',
  late_threshold_time: '09:15:00',
  check_in_window_start: '08:00:00',
  check_in_window_end: '10:00:00'
};

export default function AdminAttendanceSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [holidays, setHolidays] = useState<CollegeHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Holiday Form State
  const [holidayForm, setHolidayForm] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    description: ''
  });
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [holidaySuccess, setHolidaySuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchHolidays();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
        
      if (fetchErr) {
        console.warn('Could not fetch app_settings:', fetchErr);
      }
      
      if (data) {
        setSettings(data as AppSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('college_holidays')
        .select('*')
        .order('date', { ascending: false });

      if (fetchErr && fetchErr.code !== '42P01') {
        console.warn('Could not fetch holidays:', fetchErr);
      }
      setHolidays((data || []) as CollegeHoliday[]);
    } catch (err: any) {
      console.error('Error fetching holidays:', err);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    setError(null);
    try {
      const { latitude, longitude } = await getDeviceLocation();
      setSettings(s => ({
        ...s,
        college_latitude: Number(latitude.toFixed(6)),
        college_longitude: Number(longitude.toFixed(6))
      }));
    } catch (err: any) {
      setError(err.message || "Failed to retrieve current device location.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Alias for backward compatibility
  const handleUseCurrentLocation = handleGetCurrentLocation;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    // Validate Check-in Window Start < Check-in Window End
    const startSec = timeStringToSeconds(settings.check_in_window_start || '08:00:00');
    const endSec = timeStringToSeconds(settings.check_in_window_end || '10:00:00');

    if (startSec >= endSec) {
      setError("Check-In Window Start time must be earlier than Check-In Window End time.");
      setIsSaving(false);
      return;
    }

    try {
      if (settings.id) {
        const { error: updateErr } = await supabase
          .from('app_settings')
          .update({
            college_latitude: settings.college_latitude,
            college_longitude: settings.college_longitude,
            college_radius_meters: settings.college_radius_meters,
            work_start_time: settings.work_start_time,
            late_threshold_time: settings.late_threshold_time,
            check_in_window_start: settings.check_in_window_start,
            check_in_window_end: settings.check_in_window_end
          })
          .eq('id', settings.id);
        if (updateErr) throw updateErr;
      } else {
        const { data: existingRow } = await supabase
          .from('app_settings')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existingRow?.id) {
          const { error: updateErr } = await supabase
            .from('app_settings')
            .update({
              college_latitude: settings.college_latitude,
              college_longitude: settings.college_longitude,
              college_radius_meters: settings.college_radius_meters,
              work_start_time: settings.work_start_time,
              late_threshold_time: settings.late_threshold_time,
              check_in_window_start: settings.check_in_window_start,
              check_in_window_end: settings.check_in_window_end
            })
            .eq('id', existingRow.id);
          if (updateErr) throw updateErr;
          setSettings(s => ({ ...s, id: existingRow.id }));
        } else {
          const { error: insertErr, data } = await supabase
            .from('app_settings')
            .insert([{
              college_latitude: settings.college_latitude,
              college_longitude: settings.college_longitude,
              college_radius_meters: settings.college_radius_meters,
              work_start_time: settings.work_start_time,
              late_threshold_time: settings.late_threshold_time,
              check_in_window_start: settings.check_in_window_start,
              check_in_window_end: settings.check_in_window_end
            }])
            .select()
            .single();
          if (insertErr) throw insertErr;
          if (data) setSettings(data as AppSettings);
        }
      }
      setSuccess("Attendance settings saved successfully. New check-in window is now live.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.date || !holidayForm.title.trim()) {
      setHolidayError("Please provide both a holiday date and title.");
      return;
    }

    setIsAddingHoliday(true);
    setHolidayError(null);
    setHolidaySuccess(null);

    try {
      const { error: insertErr } = await supabase
        .from('college_holidays')
        .insert({
          date: holidayForm.date,
          title: holidayForm.title.trim(),
          description: holidayForm.description.trim() || null
        });

      if (insertErr) {
        if (insertErr.code === '23505') {
          throw new Error(`A holiday on ${holidayForm.date} is already declared.`);
        }
        throw insertErr;
      }

      setHolidaySuccess(`Holiday "${holidayForm.title}" declared successfully on ${holidayForm.date}.`);
      setHolidayForm({
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: ''
      });
      await fetchHolidays();
    } catch (err: any) {
      console.error(err);
      setHolidayError(err.message || "Failed to declare holiday. Ensure the database migration script has been run in Supabase.");
    } finally {
      setIsAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string, title: string, date: string) => {
    if (!window.confirm(`Are you sure you want to remove the declared holiday "${title}" on ${date}?`)) {
      return;
    }

    try {
      const { error: deleteErr } = await supabase
        .from('college_holidays')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      setHolidaySuccess(`Removed holiday "${title}".`);
      await fetchHolidays();
    } catch (err: any) {
      console.error(err);
      setHolidayError("Failed to delete holiday.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-xs text-slate-500 font-medium">Loading attendance settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      {/* 1. College Location & Timing Settings Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Attendance Settings</h2>
            <p className="text-sm text-slate-500">Configure college campus coordinates, radius, and daily check-in windows.</p>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <div>
                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Auto-Detect Campus Location</p>
                <p className="text-xs text-indigo-600">Populate coordinates from your current device GPS.</p>
              </div>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isGettingLocation ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <MapPin size={13} />
                )}
                {isGettingLocation ? 'Detecting...' : 'Use My Current Location'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">College Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={settings?.college_latitude ?? ''}
                  onChange={e => setSettings(s => ({ ...s, college_latitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="e.g. 19.876165"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">College Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={settings?.college_longitude ?? ''}
                  onChange={e => setSettings(s => ({ ...s, college_longitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="e.g. 75.343314"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Allowed Radius (Meters)</label>
              <input
                type="number"
                required
                min="10"
                value={settings?.college_radius_meters ?? 100}
                onChange={e => setSettings(s => ({ ...s, college_radius_meters: parseInt(e.target.value) || 100 }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="100"
              />
              <p className="text-xs text-slate-500">Maximum distance from college coordinates allowed for check-in/out.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Work Start Time</label>
                <input
                  type="time"
                  required
                  step="1"
                  value={settings?.work_start_time || '09:00:00'}
                  onChange={e => setSettings(s => ({ ...s, work_start_time: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Late Threshold Time</label>
                <input
                  type="time"
                  required
                  step="1"
                  value={settings?.late_threshold_time || '09:15:00'}
                  onChange={e => setSettings(s => ({ ...s, late_threshold_time: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Check-In Window Start</label>
                  <span className="text-xs font-semibold text-indigo-600 font-mono">
                    {formatTimeAmPm(settings?.check_in_window_start || '08:00:00')}
                  </span>
                </div>
                <input
                  type="time"
                  required
                  step="1"
                  value={settings?.check_in_window_start || '08:00:00'}
                  onChange={e => setSettings(s => ({ ...s, check_in_window_start: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
                <p className="text-xs text-slate-500">Employees cannot check in before this time.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Check-In Window End</label>
                  <span className="text-xs font-semibold text-indigo-600 font-mono">
                    {formatTimeAmPm(settings?.check_in_window_end || '10:00:00')}
                  </span>
                </div>
                <input
                  type="time"
                  required
                  step="1"
                  value={settings?.check_in_window_end || '10:00:00'}
                  onChange={e => setSettings(s => ({ ...s, check_in_window_end: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
                <p className="text-xs text-slate-500">Check-in closes and unpunched employees are marked absent after this time.</p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="w-4 h-4" />}
                Save Attendance Settings
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 2. Declare & Manage College Holidays Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <PartyPopper className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Declared College Holidays</h2>
              <p className="text-sm text-slate-500">Days declared as holidays will NOT count as Absent for employees.</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-purple-100 text-purple-800 px-3 py-1 rounded-full border border-purple-200">
            {holidays.length} {holidays.length === 1 ? 'Holiday' : 'Holidays'}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {holidayError && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{holidayError}</p>
            </div>
          )}

          {holidaySuccess && (
            <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold">{holidaySuccess}</p>
            </div>
          )}

          {/* Declare Holiday Form */}
          <form onSubmit={handleAddHoliday} className="bg-purple-50/40 p-4 sm:p-5 rounded-2xl border border-purple-100 space-y-4">
            <h3 className="font-bold text-sm text-purple-950 flex items-center gap-2">
              <Plus size={16} className="text-purple-600" /> Declare New Holiday
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">Holiday Date</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">Holiday Title / Occasion</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day, Diwali, Foundation Day"
                  value={holidayForm.title}
                  onChange={e => setHolidayForm({ ...holidayForm, title: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase">Description / Reason (Optional)</label>
              <input
                type="text"
                placeholder="Optional notes or instructions for staff and clerks..."
                value={holidayForm.description}
                onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isAddingHoliday}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isAddingHoliday ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Plus size={15} />
                )}
                Declare Holiday
              </button>
            </div>
          </form>

          {/* List of Declared Holidays */}
          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-3">All Declared Holidays</h4>
            {holidays.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-sm">
                No institutional holidays declared yet. Use the form above to add holidays.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Holiday Title</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holidays.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-purple-950">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs">
                            <PartyPopper size={12} className="text-purple-600" />
                            {h.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {h.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteHoliday(h.id, h.title, h.date)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Holiday"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
