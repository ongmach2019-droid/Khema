import React, { useState, useEffect } from 'react';
import { ExcelRow } from '../types.ts';
import {
  parseDateDetails,
  matchesPeriodFilter,
  getPeriodFilterSummary,
  KHMER_MONTHS,
  KHMER_WEEKS,
} from '../utils/dateFilters.ts';

interface ExcelEditorPanelProps {
  onDataSaved?: () => void;
  onRefreshParent?: () => void;
}

export const ExcelEditorPanel: React.FC<ExcelEditorPanelProps> = ({
  onDataSaved,
  onRefreshParent,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true); // Open by default so table is immediately visible!
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [sheets, setSheets] = useState<string[]>(['All data']);
  const [activeSheet, setActiveSheet] = useState<string>('All data');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [sortField, setSortField] = useState<keyof ExcelRow>('entryNo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Date / Period Filter State (Filter 1 ខែ / 1 សប្ដាហ៍)
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedYearSheetMonth, setSelectedYearSheetMonth] = useState<string>('10'); // Default to Month 10
  const [selectedYearSheetWeek, setSelectedYearSheetWeek] = useState<string>('full'); // 'full' or '1'..'4'

  // New Sheet Modal
  const [showNewSheetModal, setShowNewSheetModal] = useState<boolean>(false);
  const [newSheetInput, setNewSheetInput] = useState<string>('');
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);

  // Fetch Sheets list
  const fetchSheets = async () => {
    try {
      const res = await fetch('/api/excel-sheets');
      const data = await res.json();
      if (data.success && Array.isArray(data.sheets)) {
        const cleanSheets = data.sheets.filter(
          (s: string) => s !== 'Week_5' && s !== 'Week_42_2026' && s !== 'Week_3' && s !== 'ABA Transactions KHR'
        );
        const finalSheets = cleanSheets.includes('All data') ? cleanSheets : ['All data', ...cleanSheets];
        setSheets(finalSheets);
        if (data.activeSheet) {
          const act = (data.activeSheet === 'Week_5' || data.activeSheet === 'ABA Transactions KHR') ? 'All data' : data.activeSheet;
          setActiveSheet(act);
        }
      }
    } catch (err) {
      console.warn('Failed to load sheets:', err);
    }
  };

  // Fetch Excel rows for a specific sheet
  const fetchExcelRows = async (targetSheet?: string) => {
    const sheetToLoad = targetSheet || activeSheet;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/excel-rows?sheet=${encodeURIComponent(sheetToLoad)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = [...data.data].sort((a, b) => (Number(b.entryNo) || 0) - (Number(a.entryNo) || 0));
        const total = sorted.length;
        sorted.forEach((r, i) => { r.no = total - i; });
        setRows(sorted);
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error('Failed to load Excel rows:', err);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
    fetchExcelRows();
  }, []);

  // Keep 2026 Month and Week dropdowns in sync with activeSheet
  useEffect(() => {
    if (activeSheet.startsWith('2026_M')) {
      const match = activeSheet.match(/^2026_M(\d{2})(_Week(\d))?/);
      if (match) {
        const m = String(parseInt(match[1], 10));
        setSelectedYearSheetMonth(m);
        if (match[3]) {
          setSelectedYearSheetWeek(match[3]);
        } else {
          setSelectedYearSheetWeek('full');
        }
      }
    }
  }, [activeSheet]);

  // Switch sheet
  const handleSelectSheet = async (sheetName: string) => {
    if (sheetName === activeSheet) return;
    setActiveSheet(sheetName);
    try {
      await fetch('/api/excel-sheets/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName }),
      });
    } catch (e) {}
    fetchExcelRows(sheetName);
  };

  // Create new sheet
  const handleCreateSheet = async () => {
    const cleanName = newSheetInput.trim();
    if (!cleanName) {
      alert('សូមបញ្ចូលឈ្មោះ Sheet ថ្មី (ឧទាហរណ៍៖ Week 42 ឬ សប្ដាហ៍ទី៤២)!');
      return;
    }
    setIsCreatingSheet(true);
    try {
      const res = await fetch('/api/excel-sheets/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: cleanName }),
      });
      const data = await res.json();
      if (data.success) {
        setSheets(data.sheets || [...sheets, cleanName]);
        setActiveSheet(cleanName);
        setShowNewSheetModal(false);
        setNewSheetInput('');
        setRows([]);
        setSaveSuccessMsg(`បានបង្កើត Sheet «${cleanName}» ជោគជ័យ!`);
        setTimeout(() => setSaveSuccessMsg(''), 3500);
      } else {
        alert('បរាជ័យក្នុងការបង្កើត Sheet៖ ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('មានបញ្ហាក្នុងការតភ្ជាប់បង្កើត Sheet!');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Open Add Sheet modal with smart weekly default name
  const openNewSheetDialog = () => {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    setNewSheetInput(`Week_${weekNum}_${now.getFullYear()}`);
    setShowNewSheetModal(true);
  };

  // Handle cell edit
  const handleCellChange = (
    index: number,
    field: keyof ExcelRow,
    value: any
  ) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  // Add new row at top
  const handleAddNewRow = () => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}-${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear()}`;
    const rememberedEntry = localStorage.getItem('khema_remembered_entry_date') || today.toISOString().split('T')[0];
    const maxEntry = rows.reduce((max, r) => Math.max(max, Number(r.entryNo) || 0), 57558);
    const maxJv = rows.reduce((max, r) => {
      const nums = (r.jvNo || '').match(/\d+/g);
      return nums ? Math.max(max, parseInt(nums[nums.length - 1], 10)) : max;
    }, 604);

    const newRow: ExcelRow = {
      no: rows.length + 1,
      date: formattedDate,
      entryDate: rememberedEntry,
      source: 'GL-JE',
      entryNo: maxEntry + 1,
      jvNo: `JV${String(maxJv + 1).padStart(5, '0')}`,
      reference: '',
      class: 'KHEMA88888',
      vendor: '',
      description: '',
      debit: 0,
      credit: 0,
      balance: null,
    };

    setRows((prev) => [newRow, ...prev]);
  };

  // Delete row
  const handleDeleteRow = (index: number) => {
    if (confirm('តើអ្នកពិតជាចង់លុបជួរនេះចេញពី Excel មែនទេ?')) {
      setRows((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  // Save all rows to backend Excel
  const handleSaveToExcel = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-excel-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: activeSheet,
          rows: rows,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`បានរក្សាទុកទិន្នន័យក្នុង Sheet «${activeSheet}» ចំនួន ${rows.length} ជួរជោគជ័យ!`);
        setTimeout(() => setSaveSuccessMsg(''), 3500);
        if (onDataSaved) onDataSaved();
        if (onRefreshParent) onRefreshParent();
      } else {
        alert('បរាជ័យក្នុងការរក្សាទុក៖ ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('មានបញ្ហាក្នុងការតភ្ជាប់រក្សាទុក Excel!');
    } finally {
      setIsSaving(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Handle download Excel / CSV with automatic auto-save, GL grouping, and active period filter
  const handleDownloadExcel = async (format: 'gl' | 'csv' | 'raw' = 'gl') => {
    setIsDownloading(true);
    try {
      if (rows.length > 0) {
        // Automatically save current rows first so any new / edited rows are immediately stored!
        await fetch('/api/save-excel-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet: activeSheet,
            rows: rows,
          }),
        });
      }
      // Period filter parameters
      const periodParams = `&year=${encodeURIComponent(selectedYear)}&month=${encodeURIComponent(selectedMonth)}&week=${encodeURIComponent(selectedWeek)}`;
      // Download latest file directly with mobile support
      const downloadUrl = format === 'csv'
        ? `/api/download-gl-csv?sheet=${encodeURIComponent(activeSheet)}${periodParams}&t=${Date.now()}`
        : `/api/download-excel?sheet=${encodeURIComponent(activeSheet)}&format=${format}${periodParams}&t=${Date.now()}`;
      window.location.href = downloadUrl;
      const filterSummary = getPeriodFilterSummary(selectedYear, selectedMonth, selectedWeek);
      const typeLabel = format === 'csv' ? 'CSV (គំរូ GL)' : 'Excel គំរូ GL (បូកសរុបតាមប្រភេទ)';
      setSaveSuccessMsg(`បានទាញយក ${typeLabel} (${filterSummary}) ជោគជ័យ!`);
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Download error:', err);
      window.location.href = `/api/download-excel?sheet=${encodeURIComponent(activeSheet)}`;
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSort = (field: keyof ExcelRow) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 1. Filter rows by period (Year, Month, Week)
  const periodFilteredRows = rows.filter((r) =>
    matchesPeriodFilter(r.date, selectedYear, selectedMonth, selectedWeek)
  );

  // 2. Filter rows by search term
  const filteredRows = periodFilteredRows.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (r.vendor && r.vendor.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.jvNo && r.jvNo.toLowerCase().includes(q)) ||
      (r.date && r.date.toLowerCase().includes(q)) ||
      String(r.entryNo).includes(q)
    );
  });

  // Calculate totals for filtered rows
  const filteredTotalCredit = filteredRows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  const filteredTotalDebit = filteredRows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const isPeriodFilterActive = selectedYear !== 'all' || selectedMonth !== 'all' || selectedWeek !== 'all';

  const sortedRows = [...filteredRows].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    if (sortField === 'entryNo' || sortField === 'no' || sortField === 'debit' || sortField === 'credit') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    aVal = String(aVal || '').toLowerCase();
    bVal = String(bVal || '').toLowerCase();
    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  return (
    <div className="w-full mb-space-md flex flex-col gap-2">
      {/* 1. PERMANENT TOP BAR: Add New Sheet & Download Excel (ALWAYS 100% VISIBLE) */}
      <div className="w-full rounded-2xl bg-surface-container-lowest p-3 shadow-sm border-2 border-secondary/30 flex flex-col gap-2.5 overflow-hidden">
        {/* Row 1: Header Text Across Full Width (ជួរដេកពេញលេញ) */}
        <div className="flex items-center gap-2 w-full pb-2 border-b border-surface-container-high/60">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-base shrink-0">
            📊
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-headline-sm text-[13px] text-on-surface font-bold truncate">
              គ្រប់គ្រងសន្លឹកកិច្ចការ Excel (Multi-Sheet)
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant truncate">
              Sheet សកម្ម៖ <strong className="text-emerald-700 underline font-bold">{activeSheet}</strong> ({rows.length} ជួរ)
            </span>
          </div>
        </div>

        {/* Row 2: Action Buttons (Add Sheet + Compact Download Button that never overflows) */}
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={openNewSheetDialog}
            className="flex-1 h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all ring-1 ring-emerald-500/30 cursor-pointer whitespace-nowrap min-w-0 truncate"
            title="បង្កើត Sheet ថ្មីសម្រាប់សប្ដាហ៍បន្ទាប់"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span className="truncate">+ បង្កើត Sheet ថ្មី</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadExcel('gl')}
            disabled={isDownloading}
            className="h-9 px-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-800 border border-emerald-600/30 text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            title={`ទាញយកឯកសារ Excel គំរូ GL (SHEET1 & SHEET2 បូកសរុបតាមប្រភេទ)`}
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-700">
              {isDownloading ? 'hourglass_top' : 'download'}
            </span>
            <span>{isDownloading ? '...' : `ទាញយក Excel (GL)`}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadExcel('csv')}
            disabled={isDownloading}
            className="h-9 px-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface border border-surface-container-high text-[11px] font-semibold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            title="ទាញយកជាឯកសារ CSV (គំរូ GL/ERP)"
          >
            <span className="material-symbols-outlined text-[15px] text-on-surface-variant">
              description
            </span>
            <span>CSV</span>
          </button>
        </div>

        {/* Row 3: Sheet Selector with 'All data' & 2026 Month / Week Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-surface-container-high/60">
          <span className="text-[11px] text-on-surface-variant font-bold shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">tab</span>
            <span>Sheet:</span>
          </span>

          {/* 1. All data button (Replaces ABA Transactions KHR) */}
          <button
            type="button"
            onClick={() => handleSelectSheet('All data')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              activeSheet === 'All data' || activeSheet === 'ABA Transactions KHR'
                ? 'bg-emerald-700 text-white ring-2 ring-emerald-500/50 shadow-sm'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container hover:text-emerald-700 border border-surface-container-high'
            }`}
            title="បង្ហាញទិន្នន័យទាំងអស់ (All data)"
          >
            <span className="text-[13px]">📊</span>
            <span>All data</span>
            {(activeSheet === 'All data' || activeSheet === 'ABA Transactions KHR') && (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            )}
          </button>

          {/* Divider */}
          <span className="text-surface-container-high">|</span>

          {/* 2. 2026 Year Section with 12 Months Dropdown & 4 Weeks Dropdown */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-emerald-700">calendar_month</span>
              <span>ឆ្នាំ 2026:</span>
            </span>

            {/* Dropdown 1: ខែទាំង ១២ (All 12 Months) */}
            <div className="relative">
              <select
                value={selectedYearSheetMonth}
                onChange={(e) => {
                  const newM = e.target.value;
                  setSelectedYearSheetMonth(newM);
                  const mNumStr = String(newM).padStart(2, '0');
                  const mObj = KHMER_MONTHS.find((m) => m.value === newM);
                  const targetSheet = selectedYearSheetWeek === 'full'
                    ? `2026_M${mNumStr}_${mObj ? mObj.short : ''}`
                    : `2026_M${mNumStr}_Week${selectedYearSheetWeek}`;
                  handleSelectSheet(targetSheet);
                }}
                className={`h-8 pl-2 pr-7 rounded-xl text-xs font-bold outline-none cursor-pointer transition-all appearance-none border ${
                  activeSheet.startsWith('2026_M')
                    ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs'
                    : 'bg-surface-container text-on-surface border-surface-container-high hover:border-secondary'
                }`}
                title="ជ្រើសរើសខែក្នុងចំណោមខែទាំង ១២"
              >
                {KHMER_MONTHS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-white text-on-surface font-semibold py-1">
                    ខែទី {m.num} - {m.label}
                  </option>
                ))}
              </select>
              <span className={`material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none ${
                activeSheet.startsWith('2026_M') ? 'text-white' : 'text-on-surface-variant'
              }`}>
                expand_more
              </span>
            </div>

            {/* Dropdown 2: ៤ សប្ដាហ៍ក្នុងខែនោះ (4 Weeks in that month) */}
            <div className="relative">
              <select
                value={selectedYearSheetWeek}
                onChange={(e) => {
                  const newW = e.target.value;
                  setSelectedYearSheetWeek(newW);
                  const mNumStr = String(selectedYearSheetMonth).padStart(2, '0');
                  const mObj = KHMER_MONTHS.find((m) => m.value === selectedYearSheetMonth);
                  const targetSheet = newW === 'full'
                    ? `2026_M${mNumStr}_${mObj ? mObj.short : ''}`
                    : `2026_M${mNumStr}_Week${newW}`;
                  handleSelectSheet(targetSheet);
                }}
                className={`h-8 pl-2 pr-7 rounded-xl text-xs font-bold outline-none cursor-pointer transition-all appearance-none border ${
                  activeSheet.startsWith('2026_M') && selectedYearSheetWeek !== 'full'
                    ? 'bg-secondary text-white border-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface border-surface-container-high hover:border-secondary'
                }`}
                title="ជ្រើសរើសសប្ដាហ៍ក្នុងខែនេះ (4 សប្ដាហ៍)"
              >
                <option value="full" className="bg-white text-on-surface font-semibold py-1">
                  សន្លឹកពេញមួយខែ (Full Month)
                </option>
                <option value="1" className="bg-white text-on-surface font-semibold py-1">
                  សប្ដាហ៍ទី ១ (Week 1: ថ្ងៃ 1 - 7)
                </option>
                <option value="2" className="bg-white text-on-surface font-semibold py-1">
                  សប្ដាហ៍ទី ២ (Week 2: ថ្ងៃ 8 - 14)
                </option>
                <option value="3" className="bg-white text-on-surface font-semibold py-1">
                  សប្ដាហ៍ទី ៣ (Week 3: ថ្ងៃ 15 - 21)
                </option>
                <option value="4" className="bg-white text-on-surface font-semibold py-1">
                  សប្ដាហ៍ទី ៤ (Week 4: ថ្ងៃ 22 - 31)
                </option>
              </select>
              <span className={`material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none ${
                activeSheet.startsWith('2026_M') && selectedYearSheetWeek !== 'full' ? 'text-white' : 'text-on-surface-variant'
              }`}>
                expand_more
              </span>
            </div>
          </div>

          {/* Any other custom user-created sheets (Week_5, ABA Transactions KHR, and 2026 sheets filtered out) */}
          {sheets
            .filter((s) => s !== 'All data' && s !== 'ABA Transactions KHR' && s !== 'Week_5' && s !== 'Week_42_2026' && s !== 'Week_3' && !s.startsWith('2026_M'))
            .map((sheet) => {
              const isActive = sheet === activeSheet;
              return (
                <button
                  key={sheet}
                  type="button"
                  onClick={() => handleSelectSheet(sheet)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-secondary text-white font-bold shadow-xs'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span>{sheet}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                </button>
              );
            })}
        </div>
      </div>

      {/* 2. Collapsible Data Table Panel */}
      <div className="w-full rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-container-high/60 overflow-hidden">
        {/* Toggle table visibility header */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 bg-surface-container-low/40 flex items-center justify-between cursor-pointer hover:bg-surface-container-low transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">
              table_chart
            </span>
            <span className="text-xs font-bold text-on-surface">
              តារាងទិន្នន័យ Excel លម្អិតក្នុង Sheet &apos;{activeSheet}&apos;
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono text-[11px] font-semibold">
              {isPeriodFilterActive ? `${filteredRows.length} / ${rows.length} ជួរ (ចម្រាញ់)` : `${rows.length} ជួរ`}
            </span>
          </div>

          <span
            className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </div>

        {isOpen && (
          <div
            className={`p-3 flex flex-col transition-all ${
              isFullscreen
                ? 'fixed inset-2 z-50 p-4 bg-white flex flex-col max-h-[96vh] rounded-2xl shadow-2xl border-2 border-secondary'
                : ''
            }`}
          >
            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-surface-container-high/60">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder={`ស្វែងរកក្នុង ${activeSheet}...`}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddNewRow}
                  className="h-8 px-2.5 rounded-lg bg-secondary text-white font-label-sm text-[11px] font-semibold flex items-center gap-1 shadow-xs hover:bg-secondary/90 active:scale-95 transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>បន្ថែមជួរថ្មី</span>
                </button>

                {/* Sort Toggle Button (លំដាប់កើន / លំដាប់ចុះ) */}
                <button
                  type="button"
                  onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0 border ${
                    sortDirection === 'asc'
                      ? 'bg-emerald-600/10 text-emerald-800 border-emerald-600/30 hover:bg-emerald-600/20'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high border-surface-container-high'
                  }`}
                  title={`តម្រៀបតាម៖ ${String(sortField)} (${sortDirection === 'asc' ? 'លំដាប់កើន' : 'លំដាប់ចុះ'})`}
                >
                  <span className="material-symbols-outlined text-[15px] text-emerald-700">
                    {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                  <span>{sortDirection === 'desc' ? 'រាប់ពីក្រោមទៅលើ (ថ្មីនៅខាងលើ)' : 'រាប់ពីលើទៅក្រោម (ចាស់នៅខាងលើ)'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchExcelRows()}
                  title="ផ្ទុកឡើងវិញពី Excel"
                  disabled={isLoading}
                  className="w-8 h-8 rounded-lg bg-surface-container text-on-surface flex items-center justify-center hover:bg-surface-container-high active:scale-95 transition-all"
                >
                  <span
                    className={`material-symbols-outlined text-[17px] ${
                      isLoading ? 'animate-spin' : ''
                    }`}
                  >
                    refresh
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'បិទពេញអេក្រង់' : 'ពង្រីកពេញអេក្រង់'}
                  className="w-8 h-8 rounded-lg bg-surface-container text-on-surface flex items-center justify-center hover:bg-surface-container-high active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
              </div>
            </div>

            {/* Success message banner */}
            {saveSuccessMsg && (
              <div className="my-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* 3. Date / Period Filter Bar (ចម្រាញ់ ១ខែ ឫ ១សប្ដាហ៍) */}
            <div className="my-2 p-2.5 rounded-xl bg-surface-container-low/90 border border-secondary/20 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-surface-container-high/50">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-emerald-700">filter_alt</span>
                  <span className="text-xs font-bold text-on-surface">
                    ចម្រាញ់ទិន្នន័យតាមកាលបរិច្ឆេទ (Filter 1 ខែ / 1 សប្ដាហ៍)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {filteredRows.length} ជួរ
                  </span>
                </div>

                {isPeriodFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear('all');
                      setSelectedMonth('all');
                      setSelectedWeek('all');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-error-container/60 hover:bg-error-container text-error text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                    <span>សម្អាត Filter (បង្ហាញទាំងអស់)</span>
                  </button>
                )}
              </div>

              {/* Month selector row (12 Months) */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[11px] font-bold text-on-surface-variant shrink-0 mr-1 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-700">calendar_month</span>
                  <span>ខែ:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMonth('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    selectedMonth === 'all'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  ខែទាំងអស់ (All)
                </button>
                {KHMER_MONTHS.map((m) => {
                  const isSel = selectedMonth === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSelectedMonth(m.value)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-emerald-700 text-white font-bold shadow-xs ring-1 ring-emerald-500'
                          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      }`}
                      title={`ចម្រាញ់ខែ ${m.label}`}
                    >
                      {m.num} {m.short}
                    </button>
                  );
                })}
              </div>

              {/* Week selector row (4 Weeks) */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[11px] font-bold text-on-surface-variant shrink-0 mr-1 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px] text-secondary">view_week</span>
                  <span>សប្ដាហ៍:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedWeek('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    selectedWeek === 'all'
                      ? 'bg-secondary text-white shadow-xs'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  សប្ដាហ៍ទាំងអស់
                </button>
                {KHMER_WEEKS.map((w) => {
                  const isSel = selectedWeek === w.value;
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setSelectedWeek(w.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                        isSel
                          ? 'bg-secondary text-white font-bold shadow-xs ring-1 ring-secondary'
                          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      }`}
                      title={`ចម្រាញ់ ${w.label}`}
                    >
                      <span>{w.tag}</span>
                      <span className="text-[10px] opacity-75 font-mono">({w.days})</span>
                    </button>
                  );
                })}

                {/* Quick Shortcuts */}
                <div className="flex items-center gap-1 ml-auto shrink-0 pl-2 border-l border-surface-container-high">
                  <button
                    type="button"
                    onClick={() => { setSelectedMonth('10'); setSelectedWeek('all'); }}
                    className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold transition-all cursor-pointer"
                    title="ចម្រាញ់ត្រឹមខែតុលា"
                  >
                    ⚡ ខែតុលា
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedMonth('9'); setSelectedWeek('all'); }}
                    className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-semibold transition-all cursor-pointer"
                    title="ចម្រាញ់ត្រឹមខែកញ្ញា"
                  >
                    ខែកញ្ញា
                  </button>
                </div>
              </div>

              {/* Active Filter Summary Banner */}
              {isPeriodFilterActive && (
                <div className="mt-1 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">check_circle</span>
                    <span>
                      កំពុងចម្រាញ់៖ <strong>{getPeriodFilterSummary(selectedYear, selectedMonth, selectedWeek)}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/90 font-mono text-[10px] font-bold">
                      {filteredRows.length} / {rows.length} ជួរ
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span>សរុប Credit: <strong className="text-error">{filteredTotalCredit.toLocaleString()} ៛</strong> (~${(filteredTotalCredit / 4100).toFixed(2)})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Table Container */}
            <div
              className={`w-full overflow-x-auto no-scrollbar my-2 rounded-xl border border-surface-container-high/60 ${
                isFullscreen ? 'flex-1 max-h-[calc(100vh-190px)]' : 'max-h-[380px]'
              }`}
            >
              <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                <thead className="sticky top-0 bg-surface-container-high/90 backdrop-blur-sm text-on-surface-variant font-bold border-b border-surface-container-high z-10 select-none">
                  <tr>
                    <th className="py-2 px-2.5 text-center">#</th>
                    <th
                      onClick={() => handleSort('no')}
                      className="py-2 px-2.5 cursor-pointer hover:bg-surface-container-highest transition-colors"
                      title="ចុចដើម្បីតម្រៀបតាម No. (កើន/ចុះ)"
                    >
                      <div className="flex items-center gap-1">
                        <span>No.</span>
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">
                          {sortField === 'no' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('date')}
                      className="py-2 px-2.5 cursor-pointer hover:bg-surface-container-highest transition-colors"
                      title="ចុចដើម្បីតម្រៀបតាម Date"
                    >
                      <div className="flex items-center gap-1">
                        <span>Date (កាលបរិច្ឆេទ)</span>
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">
                          {sortField === 'date' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th className="py-2 px-2.5">Source</th>
                    <th
                      onClick={() => handleSort('entryNo')}
                      className="py-2 px-2.5 cursor-pointer hover:bg-surface-container-highest transition-colors text-emerald-800 font-bold bg-emerald-50/50"
                      title="ចុចដើម្បីតម្រៀបតាម Entry No (កើន/ចុះ)"
                    >
                      <div className="flex items-center gap-1">
                        <span>Entry No</span>
                        <span className="material-symbols-outlined text-[15px] font-bold text-emerald-700">
                          {sortField === 'entryNo' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('jvNo')}
                      className="py-2 px-2.5 cursor-pointer hover:bg-surface-container-highest transition-colors"
                      title="ចុចដើម្បីតម្រៀបតាម JV No"
                    >
                      <div className="flex items-center gap-1">
                        <span>JV No</span>
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">
                          {sortField === 'jvNo' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('vendor')}
                      className="py-2 px-2.5 min-w-[150px] cursor-pointer hover:bg-surface-container-highest transition-colors"
                      title="ចុចដើម្បីតម្រៀបតាម អ្នកផ្គត់ផ្គង់"
                    >
                      <div className="flex items-center gap-1">
                        <span>Vendor / អ្នកផ្គត់ផ្គង់</span>
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">
                          {sortField === 'vendor' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('description')}
                      className="py-2 px-2.5 min-w-[160px] cursor-pointer hover:bg-surface-container-highest transition-colors"
                      title="ចុចដើម្បីតម្រៀបតាម បរិយាយ"
                    >
                      <div className="flex items-center gap-1">
                        <span>Description / បរិយាយ</span>
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">
                          {sortField === 'description' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('credit')}
                      className="py-2 px-2.5 text-right min-w-[100px] cursor-pointer hover:bg-surface-container-highest transition-colors"
                      title="ចុចដើម្បីតម្រៀបតាម Credit"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Credit (រៀល)</span>
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">
                          {sortField === 'credit' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                    <th className="py-2 px-2.5 text-right">USD ($)</th>
                    <th className="py-2 px-2.5 text-center">លុប</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/40 bg-surface-container-lowest font-body-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin text-[24px] mb-1">
                          progress_activity
                        </span>
                        <p>កំពុងទាញទិន្នន័យពី Sheet «{activeSheet}»...</p>
                      </td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">
                            table_rows
                          </span>
                          <p className="font-semibold">មិនទាន់មានជួរទិន្នន័យក្នុង Sheet &apos;{activeSheet}&apos; នៅឡើយទេ</p>
                          <p className="text-[10px] text-on-surface-variant/70">
                            ចុច «បន្ថែមជួរថ្មី» ខាងលើ ឬស្កេនវិក្កយបត្រដើម្បីកត់ត្រាចូល Sheet នេះដោយស្វ័យប្រវត្តិ
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, idx) => {
                      const actualIdx = rows.indexOf(row);
                      const usdVal = ((row.credit || 0) / 4100).toFixed(2);
                      return (
                        <tr
                          key={actualIdx}
                          className="hover:bg-secondary/5 transition-colors group"
                        >
                          <td className="py-1.5 px-2 text-center text-on-surface-variant/60 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-medium">
                            {row.no || (idx + 1)}
                          </td>
                          <td className="py-1 px-2">
                            <div className="flex flex-col">
                              <input
                                type="text"
                                value={row.date || ''}
                                onChange={(e) =>
                                  handleCellChange(actualIdx, 'date', e.target.value)
                                }
                                className="w-24 px-1.5 py-0.5 rounded bg-transparent hover:bg-surface-container focus:bg-white border border-transparent focus:border-secondary outline-none font-mono"
                                title="កាលបរិច្ឆេទលើក្រដាស (Date)"
                              />
                              {row.entryDate && row.entryDate !== row.date && (
                                <span className="text-[9px] text-emerald-700 font-mono px-1 truncate" title={`ថ្ងៃកត់ត្រា/បញ្ចូល៖ ${row.entryDate}`}>
                                  កត់ត្រា៖ {row.entryDate}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 font-mono text-on-surface-variant">
                            {row.source || 'GL-JE'}
                          </td>
                          <td className="py-1.5 px-2 font-mono font-bold text-on-surface">
                            {row.entryNo}
                          </td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-secondary">
                            {row.jvNo}
                          </td>
                          <td className="py-1 px-2">
                            <input
                              type="text"
                              value={row.vendor || ''}
                              onChange={(e) =>
                                handleCellChange(actualIdx, 'vendor', e.target.value)
                              }
                              placeholder="ឈ្មោះអ្នកផ្គត់ផ្គង់/អ្នកទទួល"
                              className="w-full min-w-[140px] px-1.5 py-0.5 rounded bg-transparent hover:bg-surface-container focus:bg-white border border-transparent focus:border-secondary outline-none font-medium"
                            />
                          </td>
                          <td className="py-1 px-2">
                            <input
                              type="text"
                              value={row.description || ''}
                              onChange={(e) =>
                                handleCellChange(actualIdx, 'description', e.target.value)
                              }
                              placeholder="បរិយាយទំនិញ..."
                              className="w-full min-w-[150px] px-1.5 py-0.5 rounded bg-transparent hover:bg-surface-container focus:bg-white border border-transparent focus:border-secondary outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 text-right">
                            <input
                              type="number"
                              value={row.credit || 0}
                              onChange={(e) =>
                                handleCellChange(
                                  actualIdx,
                                  'credit',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 px-1.5 py-0.5 rounded text-right bg-transparent hover:bg-surface-container focus:bg-white border border-transparent focus:border-secondary outline-none font-mono font-bold text-error"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-on-surface">
                            ${usdVal}
                          </td>
                          <td className="py-1 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(actualIdx)}
                              title="លុបជួរនេះ"
                              className="w-6 h-6 rounded flex items-center justify-center text-error/70 hover:text-error hover:bg-error-container/40 active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                delete
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Save Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container-high/60">
              <span className="text-on-surface-variant font-label-sm text-[11px] flex items-center gap-1.5 flex-wrap">
                <span>
                  Sheet <strong className="text-secondary">{activeSheet}</strong>
                </span>
                <span>•</span>
                <span>
                  {isPeriodFilterActive
                    ? `បង្ហាញ ${filteredRows.length} / ${rows.length} ជួរ (Credit៖ ${filteredTotalCredit.toLocaleString()} ៛)`
                    : `សរុប ${rows.length} ជួរ`}
                </span>
              </span>

              <button
                type="button"
                onClick={handleSaveToExcel}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-secondary text-white font-label-md text-[13px] font-bold flex items-center gap-2 shadow-sm hover:bg-secondary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="text-[16px]">💾</span>
                <span>
                  {isSaving ? 'កំពុងរក្សាទុក...' : `រក្សាទុកក្នុង Sheet «${activeSheet}»`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add New Sheet Modal */}
      {showNewSheetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-surface-container-high relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">post_add</span>
                </div>
                <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
                  បង្កើត Sheet ថ្មី (Add New Sheet)
                </h3>
              </div>
              <button
                onClick={() => setShowNewSheetModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
              បង្កើត Sheet ថ្មីសម្រាប់កត់ត្រាទិន្នន័យប្រចាំសប្ដាហ៍នីមួយៗ (ឧទាហរណ៍៖ <code className="bg-surface-container px-1 py-0.5 rounded text-secondary font-mono">Week_42_2026</code> ឬ <code className="bg-surface-container px-1 py-0.5 rounded text-secondary font-mono">Week_43_2026</code>)។
            </p>

            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs font-bold text-on-surface">
                ឈ្មោះ Sheet ថ្មី:
              </label>
              <input
                type="text"
                value={newSheetInput}
                onChange={(e) => setNewSheetInput(e.target.value)}
                placeholder="Week_42_2026"
                className="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface text-sm font-semibold outline-none focus:ring-2 focus:ring-secondary/30 border border-surface-container-high"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewSheetModal(false)}
                className="flex-1 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleCreateSheet}
                disabled={isCreatingSheet}
                className="flex-1 py-2 rounded-xl bg-secondary text-white text-xs font-bold shadow-sm hover:bg-secondary/90 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isCreatingSheet ? (
                  <span>កំពុងបង្កើត...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>បង្កើត Sheet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
