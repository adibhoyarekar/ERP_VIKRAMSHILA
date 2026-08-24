export interface AppSettings {
  id: string;
  college_latitude: number;
  college_longitude: number;
  college_radius_meters: number;
  work_start_time: string;
  late_threshold_time: string;
  check_in_window_start?: string;
  check_in_window_end?: string;
}

export interface CollegeHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time?: string;
  check_in_photo_url?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_accuracy?: number;
  check_out_time?: string;
  check_out_photo_url?: string;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_out_accuracy?: number;
  status: 'Present' | 'Late' | 'Absent' | 'Holiday' | 'In Process';
  working_hours?: string;
  is_manually_corrected: boolean;
  corrected_by?: string;
}

export interface AttendanceRecordWithUser extends AttendanceRecord {
  users?: {
    name: string;
    role: string;
    email: string;
  };
}
