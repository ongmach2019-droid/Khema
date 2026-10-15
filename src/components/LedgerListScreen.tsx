import React, { useState } from 'react';
import { Transaction, AppSettings } from '../types.ts';
import { ExcelEditorPanel } from './ExcelEditorPanel.tsx';

interface LedgerListScreenProps {
  transactions: Transaction[];
  settings: AppSettings;
  onSelectTransaction: (tx: Transaction) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (id: string, entryNo?: number, jvNo?: string) => void;
  onClearAll?: () => void;
  onRefresh: () => void;
}

export const LedgerListScreen: React.FC<LedgerListScreenProps> = ({
  transactions,
  settings,
  onSelectTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onClearAll,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'expense' | 'income'>('all');
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'amount-desc'>('date-desc');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    const matchesCategory =
      activeCategory === 'all' ||
      (activeCategory === 'expense' && tx.type === 'expense') ||
      (activeCategory === 'income' && tx.type === 'income');

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tx.vendor.toLowerCase().includes(q) ||
      tx.vendorKh.toLowerCase().includes(q) ||
      tx.ref.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'date-desc') return b.date.localeCompare(a.date);
    if (sortOrder === 'date-asc') return a.date.localeCompare(b.date);
    if (sortOrder === 'amount-desc') return b.amountUSD - a.amountUSD;
    return 0;
  });

  // Calculate monthly total
  const totalExpenseUSD = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountUSD, 0);

  // Trigger export real Excel with 100% mobile browser compatibility
  const handleExport = (targetSheet?: string) => {
    const url = `/api/download-excel?t=${Date.now()}${targetSheet ? `&sheet=${encodeURIComponent(targetSheet)}` : ''}`;
    
    // Direct location navigation triggers the native download prompt on iOS Safari and Android Chrome
    window.location.href = url;

    setToastMessage('កំពុងទាញយកឯកសារ Excel (ទិន្នន័យគ្រប់ Sheet ទាំងអស់)...');
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3500);
  };

  return (
    <div className="flex flex-col w-full px-margin pb-32 pt-2 relative">
      {/* Toast Notification */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 w-11/12 max-w-sm pointer-events-none ${
          showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="bg-primary text-on-primary p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
          <span className="material-symbols-outlined text-secondary-fixed text-[24px]">task_alt</span>
          <div className="flex flex-col text-left">
            <span className="font-label-md text-label-md font-semibold text-white">
              ទាញយកបានជោគជ័យ!
            </span>
            <span className="font-label-sm text-label-sm text-surface-variant">
              {toastMessage || 'របាយការណ៍សៀវភៅធំត្រូវបានរក្សាទុក'}
            </span>
          </div>
        </div>
      </div>

      {/* Subtle Breadcrumb / Section Eyebrow */}
      <div className="flex items-center justify-between mt-1 mb-2">
        <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-[12px]">
          <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
          <span>ផ្ទៀងផ្ទាត់ដោយ AI • តុល្យការត្រឹមត្រូវ</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          ទាន់សម័យ
        </span>
      </div>

      {/* Section Header */}
      <div className="flex flex-col mb-space-md">
        <div className="flex items-center justify-between">
          <h1 className="font-headline-lg text-[20px] text-on-surface tracking-tight font-bold">
            បញ្ជីវិក្កយបត្រ (Receipts & Invoices)
          </h1>
          <div className="flex items-center gap-1.5">
            {onClearAll && transactions.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-2.5 py-1.5 rounded-xl bg-error-container/60 text-error hover:bg-error-container text-[12px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-xs"
                type="button"
                title="សម្អាតទិន្នន័យទាំងអស់ទៅជា $0.00"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                <span>សម្អាតទាំងអស់</span>
              </button>
            )}
            <button
              onClick={onRefresh}
              aria-label="Refresh Data"
              className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center active:scale-95 transition-transform hover:bg-surface-container-highest"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
          វិក្កយបត្រ និងបង្កាន់ដៃទាំងអស់ដែលបានស្កេន និងរក្សាទុក
        </p>
      </div>

      {/* Search & Quick Filter Controls */}
      <div className="flex flex-col gap-space-sm mb-space-md">
        {/* Search Bar */}
        <div className="relative flex items-center w-full">
          <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">
            search
          </span>
          <input
            className="w-full h-12 pl-10 pr-10 rounded-2xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 font-body-md text-body-md shadow-sm border border-surface-container-high/60 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            placeholder="ស្វែងរកតាមលេខកូដ, អ្នកផ្គត់ផ្គង់..."
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          ) : (
            <button
              aria-label="Filters"
              className="absolute right-2 w-8 h-8 rounded-xl bg-surface-container text-on-surface flex items-center justify-center active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md shrink-0 shadow-sm transition-all ${
              activeCategory === 'all'
                ? 'bg-primary text-on-primary font-bold'
                : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high/60'
            }`}
            type="button"
          >
            <span>ទាំងអស់ (All)</span>
          </button>

          <button
            onClick={() => setActiveCategory('expense')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md shrink-0 shadow-sm transition-all ${
              activeCategory === 'expense'
                ? 'bg-primary text-on-primary font-bold'
                : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high/60'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-error"></span>
            <span>ចំណាយ (Expense)</span>
          </button>

          <button
            onClick={() => setActiveCategory('income')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md shrink-0 shadow-sm transition-all ${
              activeCategory === 'income'
                ? 'bg-primary text-on-primary font-bold'
                : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-high/60'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span>ចំណូល (Income)</span>
          </button>
        </div>
      </div>

      {/* Ledger Balance Bento Banner (Debits vs Credits) */}
      <div className="w-full rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60 mb-space-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              ចំណាយសរុបខែនេះ
            </span>
            <span className="font-financial-numeric text-[20px] text-on-surface font-bold">
              ${totalExpenseUSD.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold">
          <span className="material-symbols-outlined text-[14px] text-secondary font-bold">
            check_circle
          </span>
          <span>{transactions.length} វិក្កយបត្រ</span>
        </div>
      </div>

      {/* ផ្ទាំងកែប្រែទិន្នន័យ Excel ពេញលេញ (Placed directly above 'ប្រតិបត្តិការថ្មីៗ') */}
      <ExcelEditorPanel
        onDataSaved={onRefresh}
        onRefreshParent={onRefresh}
      />

      {/* General Ledger Entries Header */}
      <div className="flex items-center justify-between mb-space-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-headline-sm text-[15px] text-on-surface font-bold truncate">
            ប្រតិបត្តិការថ្មីៗ
          </span>
          <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[11px] font-semibold shrink-0">
            {sorted.length} ធាតុ
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Download Excel Button right on ប្រតិបត្តិការថ្មីៗ */}
          <button
            onClick={() => handleExport()}
            className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-sm text-[11px] font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            title="ទាញយកទិន្នន័យប្រតិបត្តិការថ្មីៗជា Excel"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>ទាញយក Excel</span>
          </button>

          {/* Quick Sync/Fetch button */}
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            title="ទាញយកទិន្នន័យថ្មី (Refresh)"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
          </button>

          {/* Sort Button */}
          <button
            onClick={() => {
              setSortOrder((prev) =>
                prev === 'date-desc' ? 'date-asc' : prev === 'date-asc' ? 'amount-desc' : 'date-desc'
              );
            }}
            className="h-8 px-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary font-label-sm text-[11px] font-semibold flex items-center gap-0.5 transition-all shrink-0 cursor-pointer"
            type="button"
            title="តម្រៀបតាមកាលបរិច្ឆេទ ឬទឹកប្រាក់"
          >
            <span>
              {sortOrder === 'date-desc'
                ? 'ថ្មីមុន'
                : sortOrder === 'date-asc'
                ? 'ចាស់មុន'
                : 'ច្រើនមុន'}
            </span>
            <span className="material-symbols-outlined text-[15px]">swap_vert</span>
          </button>
        </div>
      </div>

      {/* Transaction Cards List */}
      <div className="flex flex-col gap-space-sm mb-space-lg">
        {sorted.length === 0 ? (
          <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">
              {transactions.length === 0 ? 'receipt_long' : 'search_off'}
            </span>
            <p className="font-label-lg font-bold text-on-surface mb-1">
              {transactions.length === 0 ? 'មិនទាន់មានវិក្កយបត្រក្នុងប្រព័ន្ធទេ' : 'មិនមានវិក្កយបត្រត្រូវនឹងការស្វែងរកនេះទេ'}
            </p>
            <p className="font-label-sm text-on-surface-variant max-w-[280px]">
              {transactions.length === 0
                ? 'ចំណូល $0.00 • ចំណាយ $0.00 • សូមស្កេន ឬបញ្ចូលរូបភាពវិក្កយបត្រដើម្បីកត់ត្រា'
                : 'សូមព្យាយាមស្វែងរកពាក្យគន្លឹះផ្សេងទៀត'}
            </p>
          </div>
        ) : (
          sorted.map((tx, idx) => (
            <div
              key={tx.id}
              onClick={() => onSelectTransaction(tx)}
              className="ledger-card w-full rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60 hover:border-secondary/40 transition-all duration-200 cursor-pointer active:scale-[0.99] group relative"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 text-on-surface shadow-xs mt-0.5">
                    <span className="material-symbols-outlined text-[22px]">
                      {tx.iconName || 'receipt'}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-label-lg text-[14px] text-on-surface font-bold truncate">
                        {tx.vendorKh || tx.vendor}
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✨ ថ្មី
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-medium">
                        {tx.category}
                      </span>
                      <span className="text-on-surface-variant font-body-sm text-[12px]">
                        {tx.date}
                      </span>
                      {tx.ref && (
                        <span className="text-on-surface-variant/70 font-mono text-[10px]">
                          {tx.ref}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span
                    className={`font-financial-numeric text-[17px] font-bold ${
                      tx.type === 'expense' ? 'text-error' : 'text-secondary'
                    }`}
                  >
                    {tx.type === 'expense' ? '-' : '+'}${tx.amountUSD.toFixed(2)}
                  </span>
                  <span
                    className={`font-label-sm text-[11px] flex items-center gap-0.5 mt-0.5 ${
                      tx.status === 'paid' ? 'text-secondary font-semibold' : 'text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {tx.status === 'paid' ? 'check_circle' : 'schedule'}
                    </span>
                    <span>{tx.statusTextKh || (tx.status === 'paid' ? 'បានបង់' : 'ជំពាក់')}</span>
                  </span>
                </div>
              </div>

              {/* Quick Action Buttons on Card (Edit & Delete) */}
              <div className="mt-2.5 pt-2 border-t border-surface-container-high/40 flex items-center justify-between text-xs">
                <span className="text-on-surface-variant/70 font-mono text-[11px]">
                  {tx.amountKHR ? `${tx.amountKHR.toLocaleString()} ៛` : ''}
                </span>

                <div className="flex items-center gap-1.5">
                  {onEditTransaction && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTransaction(tx);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-secondary/10 hover:text-secondary text-on-surface font-semibold text-[11px] flex items-center gap-1 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>កែប្រែ</span>
                    </button>
                  )}

                  {onDeleteTransaction && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`តើអ្នកពិតជាចង់លុប "${tx.vendorKh || tx.vendor}" មែនទេ?`)) {
                          onDeleteTransaction(tx.id, tx.entryNo, tx.jvNo || tx.ref);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-surface-container hover:bg-error-container/40 hover:text-error text-on-surface-variant font-semibold text-[11px] flex items-center gap-1 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      <span>លុប</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Floating Action Utility */}
      <div className="w-full flex flex-col gap-space-xs sticky bottom-20 z-20">
        <div className="w-full p-2.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md shadow-xl border border-surface-container-high/80 flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-2.5 pl-1.5">
            <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">file_download</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-[13px] text-on-surface font-bold">
                ទាញយករបាយការណ៍
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant">
                Excel (.xlsx) • {transactions.length} ប្រតិបត្តិការ
              </span>
            </div>
          </div>

          <button
            onClick={() => handleExport()}
            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-sm font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>ទាញយក Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
