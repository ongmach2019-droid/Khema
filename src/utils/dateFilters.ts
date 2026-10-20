export interface DateDetails {
  year: number;
  month: number; // 1 - 12
  day: number;   // 1 - 31
  week: number;  // 1 - 4
}

export interface MonthOption {
  value: string;
  label: string;
  short: string;
  en: string;
  num: string;
}

export interface WeekOption {
  value: string;
  label: string;
  short: string;
  tag: string;
  days: string;
}

export const KHMER_MONTHS: MonthOption[] = [
  { value: '1', label: 'មករា (Jan)', short: 'មករា', en: 'January', num: '01' },
  { value: '2', label: 'កុម្ភៈ (Feb)', short: 'កុម្ភៈ', en: 'February', num: '02' },
  { value: '3', label: 'មីនា (Mar)', short: 'មីនា', en: 'March', num: '03' },
  { value: '4', label: 'មេសា (Apr)', short: 'មេសា', en: 'April', num: '04' },
  { value: '5', label: 'ឧសភា (May)', short: 'ឧសភា', en: 'May', num: '05' },
  { value: '6', label: 'មិថុនា (Jun)', short: 'មិថុនា', en: 'June', num: '06' },
  { value: '7', label: 'កក្កដា (Jul)', short: 'កក្កដា', en: 'July', num: '07' },
  { value: '8', label: 'សីហា (Aug)', short: 'សីហា', en: 'August', num: '08' },
  { value: '9', label: 'កញ្ញា (Sep)', short: 'កញ្ញា', en: 'September', num: '09' },
  { value: '10', label: 'តុលា (Oct)', short: 'តុលា', en: 'October', num: '10' },
  { value: '11', label: 'វិច្ឆិកា (Nov)', short: 'វិច្ឆិកា', en: 'November', num: '11' },
  { value: '12', label: 'ធ្នូ (Dec)', short: 'ធ្នូ', en: 'December', num: '12' },
];

export const KHMER_WEEKS: WeekOption[] = [
  { value: '1', label: 'សប្ដាហ៍ទី ១ (ថ្ងៃ ១ - ៧)', short: 'W1', tag: 'Week 1', days: '1-7' },
  { value: '2', label: 'សប្ដាហ៍ទី ២ (ថ្ងៃ ៨ - ១៤)', short: 'W2', tag: 'Week 2', days: '8-14' },
  { value: '3', label: 'សប្ដាហ៍ទី ៣ (ថ្ងៃ ១៥ - ២១)', short: 'W3', tag: 'Week 3', days: '15-21' },
  { value: '4', label: 'សប្ដាហ៍ទី ៤ (ថ្ងៃ ២២ - ៣១)', short: 'W4', tag: 'Week 4', days: '22-31' },
];

/**
 * Robustly parses a date string into Year, Month, Day, and Week of Month
 */
export function parseDateDetails(dateStr?: string): DateDetails {
  if (!dateStr) return { year: 2026, month: 10, day: 15, week: 3 };
  const s = String(dateStr).trim();
  let y = 2026;
  let m = 1;
  let d = 1;

  // Format 1: YYYY-MM-DD or YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    y = parseInt(ymd[1], 10);
    m = parseInt(ymd[2], 10);
    d = parseInt(ymd[3], 10);
  } else {
    // Format 2: DD-MMM-YYYY (e.g. 15-Oct-2026)
    const dmyWord = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})/);
    if (dmyWord) {
      d = parseInt(dmyWord[1], 10);
      y = parseInt(dmyWord[3], 10);
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const foundIdx = monthNames.findIndex((mn) => dmyWord[2].toLowerCase().startsWith(mn));
      m = foundIdx !== -1 ? foundIdx + 1 : 1;
    } else {
      // Format 3: DD/MM/YYYY or DD-MM-YYYY
      const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmy) {
        d = parseInt(dmy[1], 10);
        m = parseInt(dmy[2], 10);
        y = parseInt(dmy[3], 10);
      } else {
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
          y = parsed.getFullYear();
          m = parsed.getMonth() + 1;
          d = parsed.getDate();
        }
      }
    }
  }

  // Week of Month calculation (Cambodian standard)
  let week = 1;
  if (d <= 7) week = 1;
  else if (d <= 14) week = 2;
  else if (d <= 21) week = 3;
  else week = 4;

  return { year: y, month: m, day: d, week };
}

/**
 * Filter items by period (year, month, week)
 */
export function matchesPeriodFilter(
  dateStr: string | undefined,
  year: string,
  month: string,
  week: string
): boolean {
  if (year === 'all' && month === 'all' && week === 'all') return true;
  const dt = parseDateDetails(dateStr);
  if (year !== 'all' && String(dt.year) !== String(year)) return false;
  if (month !== 'all' && String(dt.month) !== String(month)) return false;
  if (week !== 'all' && String(dt.week) !== String(week)) return false;
  return true;
}

/**
 * Formats a period filter description in Khmer
 */
export function getPeriodFilterSummary(year: string, month: string, week: string): string {
  const parts: string[] = [];
  if (year !== 'all') parts.push(`ឆ្នាំ ${year}`);
  if (month !== 'all') {
    const mObj = KHMER_MONTHS.find((m) => m.value === month);
    parts.push(mObj ? `ខែ ${mObj.short}` : `ខែទី ${month}`);
  }
  if (week !== 'all') {
    const wObj = KHMER_WEEKS.find((w) => w.value === week);
    parts.push(wObj ? wObj.tag : `សប្ដាហ៍ទី ${week}`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'ទិន្នន័យទាំងអស់';
}
