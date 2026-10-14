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
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fetch Excel rows when opened
  const fetchExcelRows = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/excel-rows');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRows(data.data);
      }
    } catch (err) {
      console.error('Failed to load Excel rows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExcelRows();
    }
  }, [isOpen]);

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
        body: JSON.stringify(rows),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`បានរក្សាទុកទិន្នន័យ Excel ចំនួន ${rows.length} ជួរជោគជ័យ!`);
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
    <div className="w-full mb-space-md">
      {/* Accordion Toggle Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-2xl bg-surface-container-lowest p-3.5 shadow-sm border border-surface-container-high/60 flex items-center justify-between cursor-pointer hover:border-secondary/50 transition-all select-none group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
            📊
          </div>
          <div className="flex flex-col text-left">
            <span className="font-label-lg text-[14px] text-on-surface font-bold group-hover:text-secondary transition-colors">
              បើកផ្ទាំងកែប្រែទិន្នន័យ Excel ពេញលេញ
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">
              កែប្រែ, លុប ឬបន្ថែមជួរទិន្នន័យក្នុង Sheet &apos;ABA Transactions KHR&apos;
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono text-[11px] font-semibold">
              {rows.length} ជួរ
            </span>
          )}
          <span
            className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Expandable Content Table */}
      {isOpen && (
        <div
          className={`mt-2 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-md overflow-hidden transition-all ${
            isFullscreen
              ? 'fixed inset-2 z-50 p-4 bg-white flex flex-col max-h-[96vh]'
              : 'p-3 flex flex-col'
          }`}
        >
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-container-high/60">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="ស្វែងរកក្នុងតារាង Excel..."
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
                onClick={fetchExcelRows}
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

          {/* Table Container with Horizontal & Vertical Scroll */}
          <div
            className={`w-full overflow-x-auto no-scrollbar my-2 rounded-xl border border-surface-container-high/60 ${
              isFullscreen ? 'flex-1 max-h-[calc(100vh-160px)]' : 'max-h-[380px]'
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
                      <p>កំពុងទាញទិន្នន័យពី Excel...</p>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-on-surface-variant">
                      មិនមានជួរទិន្នន័យត្រូវបង្ហាញទេ
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const actualIdx = rows.indexOf(row);
                    const usdVal = ((row.credit || 0) / 4000).toFixed(2);
                    return (
                      <tr
                        key={actualIdx}
                        className="hover:bg-secondary/5 transition-colors group"
                      >
                        <td className="py-1.5 px-2 text-center text-on-surface-variant/60 font-mono text-[10px]">
                          {actualIdx}
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

          {/* Bottom Save Button - Matching media_1791440311731.png */}
          <div className="pt-2 flex items-center justify-between border-t border-surface-container-high/60">
            <span className="text-on-surface-variant font-label-sm text-[11px]">
              សរុប {rows.length} ជួរ • រាល់ការកែប្រែនឹងត្រូវរក្សាទុកក្នុង Excel ផ្ទាល់
            </span>

            <button
              type="button"
              onClick={handleSaveToExcel}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-surface-container-lowest border border-surface-container-high text-on-surface font-label-md text-[13px] font-bold flex items-center gap-2 shadow-sm hover:border-secondary hover:text-secondary active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="text-[16px]">💾</span>
              <span>
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកែប្រែក្នុង Excel'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
