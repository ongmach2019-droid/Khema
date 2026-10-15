import React, { useState, useEffect } from 'react';
import { ExcelRow } from '../types.ts';

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
  const [sheets, setSheets] = useState<string[]>(['ABA Transactions KHR']);
  const [activeSheet, setActiveSheet] = useState<string>('ABA Transactions KHR');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
        setSheets(data.sheets);
        if (data.activeSheet) {
          setActiveSheet(data.activeSheet);
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
        setRows(data.data);
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
    const maxEntry = rows.reduce((max, r) => Math.max(max, Number(r.entryNo) || 0), 57558);
    const maxJv = rows.reduce((max, r) => {
      const nums = (r.jvNo || '').match(/\d+/g);
      return nums ? Math.max(max, parseInt(nums[nums.length - 1], 10)) : max;
    }, 604);

    const newRow: ExcelRow = {
      no: rows.length + 1,
      date: formattedDate,
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

  const filteredRows = rows.filter((r) => {
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

  return (
    <div className="w-full mb-space-md flex flex-col gap-2">
      {/* 1. PERMANENT TOP BAR: Add New Sheet & Download Excel (ALWAYS 100% VISIBLE) */}
      <div className="w-full rounded-2xl bg-surface-container-lowest p-3.5 shadow-sm border-2 border-secondary/30 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold text-lg shrink-0">
              📑
            </div>
            <div className="flex flex-col text-left">
              <span className="font-label-lg text-[14px] text-on-surface font-bold">
                គ្រប់គ្រងសន្លឹកកិច្ចការ Excel (Multi-Sheet)
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant">
                Sheet សកម្ម៖ <strong className="text-secondary">{activeSheet}</strong> ({rows.length} ជួរ)
              </span>
            </div>
          </div>

          {/* Action Buttons: Add Sheet & Download Excel */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={openNewSheetDialog}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-95 transition-all ring-2 ring-emerald-500/30 cursor-pointer"
              title="បង្កើត Sheet ថ្មីសម្រាប់សប្ដាហ៍បន្ទាប់"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span className="text-[13px] tracking-wide">+ បង្កើត Sheet ថ្មី</span>
            </button>

            <a
              href="/api/download-excel"
              download="ABA_Transactions_Latest.xlsx"
              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="ទាញយកឯកសារ Excel (.xlsx) ប្រចាំសប្ដាហ៍"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span>📥 ទាញយក Excel (.xlsx)</span>
            </a>
          </div>
        </div>

        {/* Sheet Tabs List */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-surface-container-high/60">
          <span className="text-[11px] text-on-surface-variant font-bold shrink-0 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">tab</span>
            <span>បញ្ជី Sheets:</span>
          </span>
          {sheets.map((sheet) => {
            const isActive = sheet === activeSheet;
            return (
              <button
                key={sheet}
                type="button"
                onClick={() => handleSelectSheet(sheet)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-secondary text-white shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container hover:text-secondary'
                }`}
              >
                <span>{sheet}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                )}
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
              {rows.length} ជួរ
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
                  <span>បន្ថែមជួរថ្មី (ខាងលើ)</span>
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

            {/* Table Container */}
            <div
              className={`w-full overflow-x-auto no-scrollbar my-2 rounded-xl border border-surface-container-high/60 ${
                isFullscreen ? 'flex-1 max-h-[calc(100vh-190px)]' : 'max-h-[380px]'
              }`}
            >
              <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                <thead className="sticky top-0 bg-surface-container-high/90 backdrop-blur-sm text-on-surface-variant font-bold border-b border-surface-container-high z-10">
                  <tr>
                    <th className="py-2 px-2.5 text-center">#</th>
                    <th className="py-2 px-2.5">No.</th>
                    <th className="py-2 px-2.5">Date (កាលបរិច្ឆេទ)</th>
                    <th className="py-2 px-2.5">Source</th>
                    <th className="py-2 px-2.5">Entry No</th>
                    <th className="py-2 px-2.5">JV No</th>
                    <th className="py-2 px-2.5 min-w-[150px]">Vendor / អ្នកផ្គត់ផ្គង់</th>
                    <th className="py-2 px-2.5 min-w-[160px]">Description / បរិយាយ</th>
                    <th className="py-2 px-2.5 text-right min-w-[100px]">Credit (រៀល)</th>
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
                  ) : filteredRows.length === 0 ? (
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
                    filteredRows.map((row, idx) => {
                      const actualIdx = rows.indexOf(row);
                      const usdVal = ((row.credit || 0) / 4100).toFixed(2);
                      return (
                        <tr
                          key={actualIdx}
                          className="hover:bg-secondary/5 transition-colors group"
                        >
                          <td className="py-1.5 px-2 text-center text-on-surface-variant/60 font-mono text-[10px]">
                            {actualIdx + 1}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-medium">
                            {row.no}
                          </td>
                          <td className="py-1 px-2">
                            <input
                              type="text"
                              value={row.date || ''}
                              onChange={(e) =>
                                handleCellChange(actualIdx, 'date', e.target.value)
                              }
                              className="w-24 px-1.5 py-0.5 rounded bg-transparent hover:bg-surface-container focus:bg-white border border-transparent focus:border-secondary outline-none font-mono"
                            />
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
              <span className="text-on-surface-variant font-label-sm text-[11px]">
                Sheet <strong className="text-secondary">{activeSheet}</strong> • សរុប {rows.length} ជួរ
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
