import React, { useState, useEffect } from 'react';

interface SheetManagerBarProps {
  onSheetChanged?: (newSheet: string) => void;
  showDownloadButton?: boolean;
  className?: string;
}

export const SheetManagerBar: React.FC<SheetManagerBarProps> = ({
  onSheetChanged,
  showDownloadButton = true,
  className = '',
}) => {
  const [sheets, setSheets] = useState<string[]>(['ABA Transactions KHR']);
  const [activeSheet, setActiveSheet] = useState<string>('ABA Transactions KHR');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newSheetInput, setNewSheetInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

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

  useEffect(() => {
    fetchSheets();
    const interval = setInterval(fetchSheets, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectSheet = async (sheetName: string) => {
    if (sheetName === activeSheet) return;
    setActiveSheet(sheetName);
    try {
      await fetch('/api/excel-sheets/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName }),
      });
      if (onSheetChanged) onSheetChanged(sheetName);
      setToastMessage(`បានប្ដូរទៅ Sheet: ${sheetName}`);
      setTimeout(() => setToastMessage(''), 2500);
    } catch (err) {
      console.warn('Failed to select sheet:', err);
    }
  };

  const handleOpenModal = () => {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    setNewSheetInput(`Week_${weekNum}_${now.getFullYear()}`);
    setShowModal(true);
  };

  const handleCreateSheet = async () => {
    const cleanName = newSheetInput.trim();
    if (!cleanName) {
      alert('សូមបញ្ចូលឈ្មោះ Sheet ថ្មី (ឧទាហរណ៍៖ Week 42 ឬ សប្ដាហ៍ទី៤២)!');
      return;
    }
    setIsSubmitting(true);
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
        setShowModal(false);
        setNewSheetInput('');
        if (onSheetChanged) onSheetChanged(cleanName);
        setToastMessage(`✓ បានបង្កើត Sheet «${cleanName}» ជោគជ័យ!`);
        setTimeout(() => setToastMessage(''), 3500);
      } else {
        alert('បរាជ័យក្នុងការបង្កើត Sheet៖ ' + (data.error || 'ឈ្មោះស្ទួន ឬមិនត្រឹមត្រូវ'));
      }
    } catch (err) {
      alert('មានបញ្ហាក្នុងការតភ្ជាប់បង្កើត Sheet!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/50 to-blue-50/40 p-3.5 shadow-sm border-2 border-emerald-500/30 ${className}`}>
      {/* Toast popup */}
      {toastMessage && (
        <div className="mb-2 p-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md animate-in fade-in">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Row: Title + Primary Action Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
            📊
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-sm text-[14px] text-emerald-950 font-bold">
                សន្លឹកកិច្ចការ Excel (Multi-Sheet)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 text-[10px] font-extrabold">
                {sheets.length} Sheets
              </span>
            </div>
            <span className="text-[12px] text-emerald-900/80 font-medium">
              Sheet បច្ចុប្បន្ន៖ <strong className="text-emerald-700 font-bold underline decoration-emerald-400">{activeSheet}</strong>
            </span>
          </div>
        </div>

        {/* Buttons: + បង្កើត Sheet ថ្មី & ទាញយក */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all ring-2 ring-emerald-600/30 cursor-pointer"
            title="ចុចត្រង់នេះដើម្បីបង្កើត Sheet ថ្មីសម្រាប់សប្ដាហ៍បន្ទាប់"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span className="tracking-wide">+ បង្កើត Sheet ថ្មី</span>
          </button>

          {showDownloadButton && (
            <a
              href="/api/download-excel"
              download="ABA_Transactions_Latest.xlsx"
              className="h-10 px-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-emerald-800 border border-emerald-600/30 font-label-md text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 shrink-0"
              title="ទាញយកឯកសារ Excel (.xlsx) ទាំងអស់"
            >
              <span className="material-symbols-outlined text-[17px] text-emerald-600">download</span>
              <span className="hidden xs:inline">ទាញយក</span>
              <span>Excel</span>
            </a>
          )}
        </div>
      </div>

      {/* Bottom Row: Horizontal Sheet Tabs */}
      <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] text-emerald-900/70 font-bold shrink-0 mr-1 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">tab</span>
          <span>Sheets:</span>
        </span>
        {sheets.map((sheet) => {
          const isActive = sheet === activeSheet;
          return (
            <button
              key={sheet}
              type="button"
              onClick={() => handleSelectSheet(sheet)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs font-bold ring-1 ring-emerald-700'
                  : 'bg-white/90 text-gray-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/60'
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

      {/* Modal: Add New Sheet */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-surface-container-high/80 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2 text-emerald-700">
                <span className="material-symbols-outlined text-[24px]">post_add</span>
                <span className="font-headline-sm text-base font-bold text-on-surface">
                  បង្កើត Sheet ថ្មី (New Sheet)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              បង្កើត Sheet ថ្មីដើម្បីកត់ត្រាវិក្កយបត្រប្រចាំសប្ដាហ៍ ឬខែដាច់ដោយឡែកពីគ្នា។ ទិន្នន័យចាស់មិនបាត់បង់ឡើយ។
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">ឈ្មោះសន្លឹកកិច្ចការ (Sheet Name) :</label>
              <input
                type="text"
                value={newSheetInput}
                onChange={(e) => setNewSheetInput(e.target.value)}
                placeholder="ឧ. Week_42_2026 ឬ សប្ដាហ៍ទី១"
                autoFocus
                className="w-full h-11 px-3 bg-surface-container-low border-2 border-emerald-500 rounded-xl text-sm font-semibold text-on-surface outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-on-surface-variant">គំរូឈ្មោះរហ័ស:</span>
              {['Week_43', 'Week_44', 'ខែវិច្ឆិកា_2026', 'ចំណាយរដ្ឋបាល'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setNewSheetInput(suggestion)}
                  className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-semibold text-secondary hover:bg-secondary/10"
                >
                  +{suggestion}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 mt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 h-11 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs active:scale-95 transition-all"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleCreateSheet}
                disabled={isSubmitting || !newSheetInput.trim()}
                className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                {isSubmitting ? (
                  <span>កំពុងបង្កើត...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    <span>បង្កើត Sheet ឥឡូវ</span>
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
