/**
 * Utility functions for handling attendance times and check-in window calculations.
 */

/**
 * Convert an "HH:mm" or "HH:mm:ss" string to total seconds from start of day (0..86399).
 */
export function timeStringToSeconds(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

/**
 * Format an "HH:mm" or "HH:mm:ss" time string into 12-hour AM/PM display string (e.g. "08:00 AM").
 */
export function formatTimeAmPm(timeStr?: string): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH.toString().padStart(2, '0')}:${m} ${ampm}`;
  }
  return timeStr;
}

export type CheckInWindowState = 'not_started' | 'open' | 'closed';

export interface CheckInWindowInfo {
  state: CheckInWindowState;
  isNotStarted: boolean;
  isOpen: boolean;
  isClosed: boolean;
  currentSeconds: number;
  startSeconds: number;
  endSeconds: number;
  startTimeDisplay: string;
  endTimeDisplay: string;
}

/**
 * Calculate the current status of the check-in window given a Date object and configured window bounds.
 */
export function getCheckInWindowState(
  currentTime: Date,
  windowStartStr: string = '08:00:00',
  windowEndStr: string = '10:00:00'
): CheckInWindowInfo {
  const currentSeconds =
    currentTime.getHours() * 3600 +
    currentTime.getMinutes() * 60 +
    currentTime.getSeconds();

  const startSeconds = timeStringToSeconds(windowStartStr);
  const endSeconds = timeStringToSeconds(windowEndStr);

  const startTimeDisplay = formatTimeAmPm(windowStartStr);
  const endTimeDisplay = formatTimeAmPm(windowEndStr);

  if (currentSeconds < startSeconds) {
    return {
      state: 'not_started',
      isNotStarted: true,
      isOpen: false,
      isClosed: false,
      currentSeconds,
      startSeconds,
      endSeconds,
      startTimeDisplay,
      endTimeDisplay,
    };
  }

  if (currentSeconds > endSeconds) {
    return {
      state: 'closed',
      isNotStarted: false,
      isOpen: false,
      isClosed: true,
      currentSeconds,
      startSeconds,
      endSeconds,
      startTimeDisplay,
      endTimeDisplay,
    };
  }

  return {
    state: 'open',
    isNotStarted: false,
    isOpen: true,
    isClosed: false,
    currentSeconds,
    startSeconds,
    endSeconds,
    startTimeDisplay,
    endTimeDisplay,
  };
}
