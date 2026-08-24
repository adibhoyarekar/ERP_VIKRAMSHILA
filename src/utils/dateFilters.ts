export function getDateRangeForPreset(preset: string, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (preset === 'currentWeek') {
    const day = ref.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: format(monday), to: format(sunday) };
  }
  if (preset === 'lastWeek') {
    const day = ref.getDay();
    const diffToLastMonday = (day === 0 ? -6 : 1 - day) - 7;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToLastMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: format(monday), to: format(sunday) };
  }
  if (preset === 'currentMonth') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { from: format(start), to: format(end) };
  }
  if (preset === 'lastMonth') {
    const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
    return { from: format(start), to: format(end) };
  }
  if (preset === 'currentYear') {
    const start = new Date(ref.getFullYear(), 0, 1);
    const end = new Date(ref.getFullYear(), 11, 31);
    return { from: format(start), to: format(end) };
  }
  if (preset === 'lastYear') {
    const start = new Date(ref.getFullYear() - 1, 0, 1);
    const end = new Date(ref.getFullYear() - 1, 11, 31);
    return { from: format(start), to: format(end) };
  }
  if (preset === 'currentFinancialYear') {
    let startYear = ref.getFullYear();
    if (ref.getMonth() < 3) {
      startYear -= 1;
    }
    const start = new Date(startYear, 3, 1);
    const end = new Date(startYear + 1, 2, 31);
    return { from: format(start), to: format(end) };
  }

  return { from: '', to: '' };
}

/**
 * Formats any date string (ISO, YYYY-MM-DD), Date object, or timestamp to strict DD/MM/YYYY (date/month/year).
 */
export function formatDateDDMMYYYY(dateStr?: string | Date | number | null): string {
  if (!dateStr) return '-';
  try {
    if (typeof dateStr === 'string') {
      const trimmed = dateStr.trim();
      if (!trimmed) return '-';
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-');
        return `${d}/${m}/${y}`;
      }
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const datePart = trimmed.split('T')[0];
        const [y, m, d] = datePart.split('-');
        return `${d}/${m}/${y}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return typeof dateStr === 'string' ? dateStr : '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return typeof dateStr === 'string' ? dateStr : '-';
  }
}
