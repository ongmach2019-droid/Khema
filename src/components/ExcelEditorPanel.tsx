import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ExcelRow } from '../types.ts';
import {
  parseDateDetails,
  matchesPeriodFilter,
  getPeriodFilterSummary,
  toComparableDate,
  isDateInRange,
  isRowInDateRange,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(true); // Open by default so table is immediately visible!
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [sheets, setSheets] = useState<string[]>(['All data']);
  const [activeSheet, setActiveSheet] = useState<string>('All data');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [showGoogleShareHelpModal, setShowGoogleShareHelpModal] = useState<boolean>(false);
  const [googleSheetShareUrl, setGoogleSheetShareUrl] = useState<string>(
    'https://docs.google.com/spreadsheets/d/1MZzitc4LeZDaRlJpmj-gwBJzSdbp7C8CKdgMu_hhm1w/edit'
  );
  const [filterBasis, setFilterBasis] = useState<'entryDate' | 'paperDate'>('entryDate');
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
  const [selectedYearSheetWeek, setSelectedYearSheetWeek] = useState<string>('full'); // 'full' or '1'..'4' or 'custom'

  // Custom Date Range State (ចាប់ពីថ្ងៃណា ទៅថ្ងៃណា)
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomDateActive, setIsCustomDateActive] = useState<boolean>(false);

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
          setIsCustomDateActive(false);
        } else if (!isCustomDateActive) {
          setSelectedYearSheetWeek('full');
        }
      }
    }
  }, [activeSheet, isCustomDateActive]);

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
      let periodParams = `&year=${encodeURIComponent(selectedYear)}&month=${encodeURIComponent(selectedMonth)}&week=${encodeURIComponent(selectedWeek)}`;
      if (isCustomDateActive && (customStartDate || customEndDate)) {
        periodParams += `&startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(customEndDate)}`;
      }
      // Download latest file directly with mobile support
      const downloadUrl = format === 'csv'
        ? `/api/download-gl-csv?sheet=${encodeURIComponent(activeSheet)}${periodParams}&t=${Date.now()}`
        : `/api/download-excel?sheet=${encodeURIComponent(activeSheet)}&format=${format}${periodParams}&t=${Date.now()}`;
      window.location.href = downloadUrl;
      const filterSummary = isCustomDateActive && (customStartDate || customEndDate)
        ? `ចាប់ពី ${customStartDate || 'ដើមដំបូង'} ដល់ ${customEndDate || 'បច្ចុប្បន្ន'}`
        : getPeriodFilterSummary(selectedYear, selectedMonth, selectedWeek);
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

  // Handle importing Excel / CSV file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheetName =
        wb.SheetNames.find(
          (s) =>
            s.toLowerCase().includes('all') ||
            s.toLowerCase().includes('aba') ||
            s.toLowerCase().includes('sheet1')
        ) || wb.SheetNames[0];
      const parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

      if (!parsedRows || parsedRows.length === 0) {
        alert('ឯកសារនេះមិនមានទិន្នន័យជួរឡើយ!');
        return;
      }

      const res = await fetch('/api/import-sheet-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          defaultEntryDate: '2026-10-20',
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setSaveSuccessMsg(`បាននាំចូលទិន្នន័យ ${resData.count} ជួរចូល All data ដោយជោគជ័យ!`);
        setTimeout(() => setSaveSuccessMsg(''), 4500);
        fetchExcelRows('All data');
        if (onRefreshParent) onRefreshParent();
        if (onDataSaved) onDataSaved();
      } else {
        alert(resData.error || 'ការនាំចូលបានបរាជ័យ');
      }
    } catch (err: any) {
      console.error('Import file error:', err);
      alert('មានបញ្ហាក្នុងការអានឯកសារ៖ ' + err.message);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle immediate sync with Google Sheet
  const handleSyncGoogleSheetNow = async () => {
    setIsSyncingGoogle(true);
    try {
      const res = await fetch('/api/sync-google-sheet-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl: googleSheetShareUrl,
          entryDate: '2026-10-20',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`បាន Sync ទិន្នន័យ ${data.count} ជួរពី Google Sheet ជោគជ័យ!`);
        setTimeout(() => setSaveSuccessMsg(''), 4500);
        fetchExcelRows('All data');
        if (onRefreshParent) onRefreshParent();
        if (onDataSaved) onDataSaved();
      } else if (data.requiresShare) {
        setGoogleSheetShareUrl(data.sheetUrl || googleSheetShareUrl);
        setShowGoogleShareHelpModal(true);
      } else {
        alert(data.error || 'Sync ពី Google Sheet មិនបានជោគជ័យ');
      }
    } catch (err: any) {
      console.error('Sync Google Sheet error:', err);
      alert('ការភ្ជាប់ទៅ Google Sheet មានបញ្ហា៖ ' + err.message);
    } finally {
      setIsSyncingGoogle(false);
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

  // 1. Filter rows by period (Year, Month, Week) OR custom date range (ចាប់ពីថ្ងៃណា ទៅថ្ងៃណា)
  // Strictly filter by entryDate (ថ្ងៃកត់ត្រា/បញ្ចូល) when filterBasis === 'entryDate', NOT paper date!
  const periodFilteredRows = rows.filter((r) => {
    if (isCustomDateActive && (customStartDate || customEndDate)) {
      return isRowInDateRange(r, customStartDate, customEndDate, filterBasis);
    }
    return matchesPeriodFilter(
      r.date,
      selectedYear,
      selectedMonth,
      selectedWeek,
      undefined,
      undefined,
      r.entryDate,
      filterBasis
    );
  });

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
  const isPeriodFilterActive =
    selectedYear !== 'all' ||
    selectedMonth !== 'all' ||
    selectedWeek !== 'all' ||
    (isCustomDateActive && Boolean(customStartDate || customEndDate));

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

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            title="នាំចូលឯកសារ Excel (.xlsx) ឬ CSV ដែលទាញយកពី Google Sheet ចូល All data ភ្លាមៗ"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isImporting ? 'hourglass_top' : 'file_upload'}
            </span>
            <span>{isImporting ? 'កំពុងនាំចូល...' : '📥 នាំចូល Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncGoogleSheetNow}
            disabled={isSyncingGoogle}
            className="h-9 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            title="ទាញយក និង Sync ទិន្នន័យ ៥៤ ជួរពី Google Sheet ចូល All data ដោយស្វ័យប្រវត្តិ"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSyncingGoogle ? 'sync' : 'cloud_sync'}
            </span>
            <span>{isSyncingGoogle ? 'កំពុង Sync...' : '🔄 Sync Google Sheet'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
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
                  if (selectedYearSheetWeek === 'custom' || isCustomDateActive) {
                    const targetSheet = `2026_M${mNumStr}_${mObj ? mObj.short : ''}`;
                    handleSelectSheet(targetSheet);
                    const maxDays = newM === '2' ? '28' : ['4', '6', '9', '11'].includes(newM) ? '30' : '31';
                    setCustomStartDate(`2026-${mNumStr}-01`);
                    setCustomEndDate(`2026-${mNumStr}-${maxDays}`);
                  } else {
                    const targetSheet = selectedYearSheetWeek === 'full'
                      ? `2026_M${mNumStr}_${mObj ? mObj.short : ''}`
                      : `2026_M${mNumStr}_Week${selectedYearSheetWeek}`;
                    handleSelectSheet(targetSheet);
                  }
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

            {/* Dropdown 2: ៤ សប្ដាហ៍ក្នុងខែនោះ ឬ ចាប់ពីថ្ងៃណាទៅថ្ងៃណា (Highlighted in user screenshot) */}
            <div className="relative">
              <select
                value={isCustomDateActive || selectedYearSheetWeek === 'custom' ? 'custom' : selectedYearSheetWeek}
                onChange={(e) => {
                  const newW = e.target.value;
                  const mNumStr = String(selectedYearSheetMonth).padStart(2, '0');
                  const mObj = KHMER_MONTHS.find((m) => m.value === selectedYearSheetMonth);
                  if (newW === 'custom') {
                    setSelectedYearSheetWeek('custom');
                    setIsCustomDateActive(true);
                    const targetSheet = activeSheet === 'All data'
                      ? 'All data'
                      : `2026_M${mNumStr}_${mObj ? mObj.short : ''}`;
                    if (targetSheet !== activeSheet) {
                      handleSelectSheet(targetSheet);
                    }
                    if (!customStartDate) {
                      setCustomStartDate(`2026-${mNumStr}-01`);
                    }
                    if (!customEndDate) {
                      const maxDays = selectedYearSheetMonth === '2' ? '28' : ['4', '6', '9', '11'].includes(selectedYearSheetMonth) ? '30' : '31';
                      setCustomEndDate(`2026-${mNumStr}-${maxDays}`);
                    }
                  } else {
                    setIsCustomDateActive(false);
                    setSelectedYearSheetWeek(newW);
                    const targetSheet = newW === 'full'
                      ? `2026_M${mNumStr}_${mObj ? mObj.short : ''}`
                      : `2026_M${mNumStr}_Week${newW}`;
                    handleSelectSheet(targetSheet);
                  }
                }}
                className={`h-8 pl-2 pr-7 rounded-xl text-xs font-bold outline-none cursor-pointer transition-all appearance-none border ${
                  isCustomDateActive || selectedYearSheetWeek === 'custom'
                    ? 'bg-emerald-800 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400/50'
                    : activeSheet.startsWith('2026_M') && selectedYearSheetWeek !== 'full'
                    ? 'bg-secondary text-white border-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface border-surface-container-high hover:border-secondary'
                }`}
                title="ជ្រើសរើសសប្ដាហ៍ ឬ កំណត់ចាប់ពីថ្ងៃណា ទៅថ្ងៃណា"
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
                <option value="custom" className="bg-emerald-50 text-emerald-950 font-bold py-1">
                  📅 ជ្រើសរើសចាប់ពីថ្ងៃណា ទៅថ្ងៃណា... (Custom Range)
                </option>
              </select>
              <span className={`material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none ${
                (isCustomDateActive || selectedYearSheetWeek === 'custom' || (activeSheet.startsWith('2026_M') && selectedYearSheetWeek !== 'full'))
                  ? 'text-white'
                  : 'text-on-surface-variant'
              }`}>
                expand_more
              </span>
            </div>

            {/* Inline Custom Date Range Pickers: Always shown when custom mode is on, or accessible via quick button */}
            {(isCustomDateActive || selectedYearSheetWeek === 'custom') ? (
              <div className="flex items-center gap-1.5 bg-emerald-50/95 border-2 border-emerald-500/70 rounded-xl px-2.5 py-1 shadow-xs">
                <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-0.5 shrink-0">
                  <span className="material-symbols-outlined text-[14px] text-emerald-700">calendar_today</span>
                  <span>ចាប់ពី:</span>
                </span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setIsCustomDateActive(true);
                  }}
                  className="h-7 px-1.5 rounded-lg border border-emerald-300 text-xs text-on-surface bg-white font-mono focus:ring-1 focus:ring-emerald-600 outline-none cursor-pointer"
                  title="កាលបរិច្ឆេទចាប់ផ្ដើម"
                />
                <span className="text-[11px] font-bold text-emerald-900 shrink-0">➔ ដល់:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setIsCustomDateActive(true);
                  }}
                  className="h-7 px-1.5 rounded-lg border border-emerald-300 text-xs text-on-surface bg-white font-mono focus:ring-1 focus:ring-emerald-600 outline-none cursor-pointer"
                  title="កាលបរិច្ឆេទបញ្ចប់"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDateActive(false);
                    setSelectedYearSheetWeek('full');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-error-container hover:text-error text-on-surface text-[11px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
                  title="បិទការជ្រើសរើសចន្លោះកាលបរិច្ឆេទ"
                >
                  <span>✕ បិទ</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const mNumStr = String(selectedYearSheetMonth).padStart(2, '0');
                  const mObj = KHMER_MONTHS.find((m) => m.value === selectedYearSheetMonth);
                  setSelectedYearSheetWeek('custom');
                  setIsCustomDateActive(true);
                  const targetSheet = activeSheet === 'All data'
                    ? 'All data'
                    : `2026_M${mNumStr}_${mObj ? mObj.short : ''}`;
                  if (targetSheet !== activeSheet) {
                    handleSelectSheet(targetSheet);
                  }
                  if (!customStartDate) setCustomStartDate(`2026-${mNumStr}-01`);
                  if (!customEndDate) {
                    const maxDays = selectedYearSheetMonth === '2' ? '28' : ['4', '6', '9', '11'].includes(selectedYearSheetMonth) ? '30' : '31';
                    setCustomEndDate(`2026-${mNumStr}-${maxDays}`);
                  }
                }}
                className="h-8 px-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                title="ជ្រើសរើសចាប់ពីថ្ងៃណា ទៅថ្ងៃណា (Custom Date Range)"
              >
                <span className="material-symbols-outlined text-[15px] text-emerald-700">date_range</span>
                <span>ពីថ្ងៃ... ដល់ថ្ងៃ...</span>
              </button>
            )}
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="material-symbols-outlined text-[17px] text-emerald-700">filter_alt</span>
                  <span className="text-xs font-bold text-on-surface">
                    ចម្រាញ់ទិន្នន័យតាមកាលបរិច្ឆេទ
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {filteredRows.length} ជួរ
                  </span>

                  {/* Filter Basis Selector: ថ្ងៃកត់ត្រា (Default) vs ថ្ងៃលើក្រដាស */}
                  <div className="flex items-center gap-1 bg-surface-container px-1.5 py-0.5 rounded-lg border border-surface-container-high text-[10px] ml-1">
                    <span className="text-on-surface-variant font-medium">ចម្រាញ់តាម៖</span>
                    <button
                      type="button"
                      onClick={() => setFilterBasis('entryDate')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        filterBasis === 'entryDate'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                      title="ចម្រាញ់តាមថ្ងៃកត់ត្រា/បញ្ចូល (មិនយកតាមកាលបរិច្ឆេទលើក្រដាសទេ)"
                    >
                      🎯 ថ្ងៃកត់ត្រា (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterBasis('paperDate')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        filterBasis === 'paperDate'
                          ? 'bg-secondary text-white font-bold shadow-2xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                      title="ចម្រាញ់តាមកាលបរិច្ឆេទលើក្រដាសវិក្កយបត្រ"
                    >
                      📄 ថ្ងៃលើក្រដាស
                    </button>
                  </div>
                </div>

                {isPeriodFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear('all');
                      setSelectedMonth('all');
                      setSelectedWeek('all');
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setIsCustomDateActive(false);
                      setSelectedYearSheetWeek('full');
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

              {/* Custom Date Range Row (ចាប់ពីថ្ងៃណា ទៅថ្ងៃណា) */}
              <div className="flex items-center gap-2 flex-wrap py-1 border-t border-surface-container-high/40">
                <span className="text-[11px] font-bold text-on-surface-variant shrink-0 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[14px] text-emerald-700">date_range</span>
                  <span>ចន្លោះកាលបរិច្ឆេទ (Custom):</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-on-surface-variant font-medium">ចាប់ពី</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setIsCustomDateActive(true);
                    }}
                    className="h-7 px-2 rounded-lg border border-surface-container-high text-xs text-on-surface bg-surface-container font-mono focus:ring-1 focus:ring-secondary outline-none cursor-pointer"
                  />
                  <span className="text-[11px] text-on-surface-variant font-medium">ដល់</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setIsCustomDateActive(true);
                    }}
                    className="h-7 px-2 rounded-lg border border-surface-container-high text-xs text-on-surface bg-surface-container font-mono focus:ring-1 focus:ring-secondary outline-none cursor-pointer"
                  />
                  {(customStartDate || customEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setIsCustomDateActive(false);
                        setSelectedYearSheetWeek('full');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-error-container/60 hover:bg-error-container text-error transition-colors cursor-pointer"
                      title="សម្អាតចន្លោះកាលបរិច្ឆេទ"
                    >
                      ✕ សម្អាត
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filter Summary Banner */}
              {isPeriodFilterActive && (
                <div className="mt-1 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">check_circle</span>
                    <span>
                      កំពុងចម្រាញ់៖{' '}
                      <strong>
                        {isCustomDateActive && (customStartDate || customEndDate)
                          ? `ចាប់ពី ${customStartDate || 'ដើមដំបូង'} ដល់ ${customEndDate || 'បច្ចុប្បន្ន'}`
                          : getPeriodFilterSummary(selectedYear, selectedMonth, selectedWeek)}
                      </strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/90 font-mono text-[10px] font-bold">
                      {filteredRows.length} / {rows.length} ជួរ
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-emerald-300 text-emerald-800 font-bold shadow-2xs">
                      {filterBasis === 'entryDate' ? '🎯 តាមថ្ងៃកត់ត្រា/បញ្ចូល (មិនយកតាមក្រដាស)' : '📄 តាមថ្ងៃលើក្រដាស'}
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

      {/* Google Sheet Public Sharing Guide Modal */}
      {showGoogleShareHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-lg w-full border border-surface-container-high shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📗</span>
                <div>
                  <h3 className="font-bold text-on-surface text-base">របៀបទាញយកទិន្នន័យ ៥៤ ជួរពី Google Sheet</h3>
                  <p className="text-[11px] text-on-surface-variant font-mono truncate max-w-xs">{googleSheetShareUrl}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleShareHelpModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-on-surface leading-relaxed">
              <p className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-amber-900">
                ⚠️ Google Sheet របស់លោកអ្នកបច្ចុប្បន្នស្ថិតក្នុងកម្រិត <strong>«បានកម្រិត (Restricted)»</strong>។ ដើម្បីឱ្យប្រព័ន្ធអាចទាញយកទិន្នន័យ ៥៤ ជួរចូល All data បាន សូមជ្រើសរើសជម្រើសមួយក្នុងចំណោមពីរខាងក្រោម៖
              </p>

              <div className="flex flex-col gap-2 bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200">
                <div className="font-bold text-emerald-800 text-[13px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-emerald-700">share</span>
                  <span>វិធីទី ១៖ បើកសិទ្ធិមើល (Share) — ងាយស្រួលបំផុត (ចំណាយពេល ១០ វិនាទី)</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-on-surface-variant text-[11px]">
                  <li>ចុចប៊ូតុង <strong>[បើក Google Sheet]</strong> ខាងក្រោម</li>
                  <li>ចុចប៊ូតុង <strong>[ចែករំលែក (Share)]</strong> ពណ៌ខៀវនៅជ្រុងខាងលើស្តាំនៃ Google Sheet</li>
                  <li>នៅត្រង់ <em>«កម្រិតចូលប្រើទូទៅ (General access)»</em> សូមប្តូរពី <em>«បានកម្រិត (Restricted)»</em> ទៅជា <strong>«អ្នកដែលមានតំណភ្ជាប់ (Anyone with the link)»</strong> អាចមើលបាន (Viewer)</li>
                  <li>ចុច <strong>[រួចរាល់ (Done)]</strong> ហើយត្រឡប់មកកម្មវិធីនេះវិញ រួចចុច <strong>[🔄 Sync ឥឡូវនេះ]</strong>!</li>
                </ol>
              </div>

              <div className="flex flex-col gap-2 bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200">
                <div className="font-bold text-blue-800 text-[13px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-blue-700">download</span>
                  <span>វិធីទី ២៖ ទាញយក Excel ពី Google Sheet រួចចុច «នាំចូល (Import)»</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-on-surface-variant text-[11px]">
                  <li>ក្នុង Google Sheet ចុចម៉ឺនុយ <strong>ឯកសារ (File)</strong> &gt; <strong>ទាញយក (Download)</strong> &gt; <strong>Microsoft Excel (.xlsx)</strong></li>
                  <li>រួចត្រឡប់មកកម្មវិធីនេះ ចុចប៊ូតុង <strong>«📥 នាំចូល Excel»</strong> ខាងលើដើម្បីបញ្ចូល ៥៤ ជួរភ្លាមៗ!</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <a
                href={googleSheetShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-surface-container text-secondary font-bold text-xs flex items-center gap-1 hover:bg-surface-container-high transition-all"
              >
                <span>បើក Google Sheet</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleShareHelpModal(false);
                  handleSyncGoogleSheetNow();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>ខ្ញុំបាន Share រួចហើយ - Sync ឥឡូវនេះ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
