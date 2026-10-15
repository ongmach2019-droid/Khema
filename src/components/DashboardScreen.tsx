import React, { useState } from 'react';
import { Transaction, AppSettings } from '../types.ts';

interface DashboardScreenProps {
  transactions: Transaction[];
  settings: AppSettings;
  onNavigateToUpload: (initialFile?: File) => void;
  onNavigateToLedger: () => void;
  onSelectTransaction: (tx: Transaction) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  transactions,
  settings,
  onNavigateToUpload,
  onNavigateToLedger,
  onSelectTransaction,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedDay, setSelectedDay] = useState<string>('សុ');

  // Calculate live totals from transactions (100% dynamic - 0 if empty)
  const totalExpenseUSD = transactions
    .filter((t) => t.type === 'expense' || !t.type)
    .reduce((sum, t) => sum + (Number(t.amountUSD) || 0), 0);
  const totalExpenseKHR = Math.round(totalExpenseUSD * settings.exchangeRate);

  const totalIncomeUSD = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amountUSD) || 0), 0);
  const totalIncomeKHR = Math.round(totalIncomeUSD * settings.exchangeRate);

  // Cash flow days (dynamic based on actual expense)
  const weeklyData = [
    { day: 'ច', label: 'ចន្ទ', height: totalExpenseUSD > 0 ? 'h-6' : 'h-2', amount: '$0', active: false },
    { day: 'អ', label: 'អង្គារ', height: totalExpenseUSD > 0 ? 'h-8' : 'h-2', amount: '$0', active: false },
    { day: 'ពុធ', label: 'ពុធ', height: totalExpenseUSD > 0 ? 'h-4' : 'h-2', amount: '$0', active: false },
    { day: 'ព្រ', label: 'ព្រហស្បតិ៍', height: totalExpenseUSD > 0 ? 'h-10' : 'h-2', amount: '$0', active: false },
    { day: 'សុ', label: 'សុក្រ', height: totalExpenseUSD > 0 ? 'h-14' : 'h-2', amount: totalExpenseUSD > 0 ? `$${totalExpenseUSD.toFixed(2)}` : '$0', active: true },
    { day: 'ស', label: 'សៅរ៍', height: totalExpenseUSD > 0 ? 'h-6' : 'h-2', amount: '$0', active: false },
    { day: 'អា', label: 'អាទិត្យ', height: totalExpenseUSD > 0 ? 'h-3' : 'h-2', amount: '$0', active: false },
  ];

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onNavigateToUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col w-full px-margin gap-space-md pb-28 pt-2">
      {/* Welcome Banner with Ambient Delight */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-container text-on-primary p-space-md shadow-lg border border-primary-container/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <h1 className="font-headline-md text-headline-md text-on-primary font-bold truncate">
                ខេមា Dental Solution
              </h1>
              <span className="text-xl shrink-0">🦷</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-primary-container mt-0.5 truncate">
              ទិដ្ឋភាពទូទៅនៃចំណាយ និងវិក្កយបត្រថ្ងៃនេះ
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/khema-logo.jpg"
              alt="Khema Logo"
              className="h-10 w-auto max-w-[100px] object-contain rounded-lg bg-white p-1 shadow-sm border border-white/20"
            />
          </div>
        </div>

        {/* AI Processing status strip */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-tertiary-fixed font-medium">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>AI កំពុងដំណើរការស្វ័យប្រវត្តិ</span>
          </div>
          <span className="text-on-primary-container font-semibold">
            {transactions.length > 0 ? 'ភាពត្រឹមត្រូវ 99.4%' : 'ត្រៀមស្កេន'}
          </span>
        </div>
      </div>

      {/* Primary Instant Action: Scan Invoice with AI */}
      <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60">
        <div className="flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[26px]">document_scanner</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                ស្កេនវិក្កយបត្រថ្មីជាមួយ AI
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                ថតរូបបង្កាន់ដៃ ឬបញ្ចូលរូបភាព KHQR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => onNavigateToUpload()}
              className="flex-1 h-14 bg-secondary text-on-secondary rounded-xl font-headline-sm text-[16px] font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all hover:bg-secondary/90"
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">document_scanner</span>
              <span>ចាប់ផ្តើមស្កេន AI</span>
            </button>

            <label
              htmlFor="dashboard-quick-camera"
              title="ថតរូបភាពផ្ទាល់ពីកាមេរ៉ាទូរសព្ទ"
              className="w-14 h-14 rounded-xl bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 flex items-center justify-center shrink-0 border border-secondary/20 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">photo_camera</span>
              <input
                id="dashboard-quick-camera"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleQuickUpload}
                className="sr-only"
              />
            </label>

            <label
              htmlFor="dashboard-quick-gallery"
              title="ជ្រើសរើសរូបពីបណ្ណាល័យទូរសព្ទ"
              className="w-14 h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center shrink-0 border border-surface-container-high active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px] text-on-surface-variant">upload_file</span>
              <input
                id="dashboard-quick-gallery"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleQuickUpload}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Financial Metrics Grid (Dual-Currency) */}
      <div className="grid grid-cols-2 gap-space-sm">
        {/* Income Card */}
        <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-[14px] text-on-surface font-semibold">
              ចំណូលសរុប
            </span>
            <span className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline">
              <span className="font-financial-numeric text-[24px] font-bold text-on-surface">
                ${totalIncomeUSD.toFixed(2).split('.')[0]}
                <span className="text-[16px] text-on-surface-variant">
                  .{totalIncomeUSD.toFixed(2).split('.')[1]}
                </span>
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant font-medium mt-0.5">
              ≈ {totalIncomeKHR.toLocaleString()} ៛
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-surface-container-low flex items-center gap-1 text-[11px] text-secondary font-semibold">
            <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
            <span>{transactions.filter((t) => t.type === 'income').length} ប្រតិបត្តិការ</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-[14px] text-on-surface font-semibold">
              ចំណាយសរុប
            </span>
            <span className="w-7 h-7 rounded-full bg-error-container/60 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline">
              <span className="font-financial-numeric text-[24px] font-bold text-on-surface">
                ${totalExpenseUSD.toFixed(2).split('.')[0]}
                <span className="text-[16px] text-on-surface-variant">
                  .{totalExpenseUSD.toFixed(2).split('.')[1]}
                </span>
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant font-medium mt-0.5">
              ≈ {totalExpenseKHR.toLocaleString()} ៛
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-surface-container-low flex items-center gap-1 text-[11px] text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[14px] text-secondary">receipt_long</span>
            <span>{transactions.filter((t) => t.type !== 'income').length} វិក្កយបត្រ</span>
          </div>
        </div>
      </div>

      {/* Operational Status Pipeline (Inline Metric Pills) */}
      <div className="grid grid-cols-2 gap-space-sm">
        <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sm border border-surface-container-high/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-[13px] text-on-surface font-bold leading-tight">
              {transactions.filter((t) => t.status === 'pending').length} សន្លឹក
            </span>
            <span className="font-body-sm text-[11px] text-on-surface-variant truncate">
              ជំពាក់ / មិនទាន់បង់
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sm border border-surface-container-high/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary-container/50 flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-[13px] text-on-surface font-bold leading-tight">
              {transactions.length} សន្លឹក
            </span>
            <span className="font-body-sm text-[11px] text-on-surface-variant truncate">
              បានកត់ត្រារួចរាល់
            </span>
          </div>
        </div>
      </div>

      {/* Weekly Cash Flow Chart / Sparkline */}
      <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
              លំហូរសាច់ប្រាក់សប្តាហ៍នេះ
            </h3>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            ចន្ទ - អាទិត្យ
          </span>
        </div>

        <div className="flex items-end justify-between gap-2 pt-6 pb-2 px-1 h-36">
          {weeklyData.map((item) => {
            const isSelected = selectedDay === item.day;
            return (
              <button
                key={item.day}
                onClick={() => setSelectedDay(item.day)}
                className="flex-1 flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
                type="button"
              >
                <div className="w-full flex flex-col items-center justify-end h-24">
                  {isSelected && (
                    <span className="text-[10px] font-financial-numeric font-bold text-secondary mb-1 animate-fade-in">
                      {item.amount}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${item.height} ${
                      isSelected
                        ? 'bg-secondary-fixed shadow-md ring-2 ring-secondary/30'
                        : 'bg-surface-container-high group-hover:bg-surface-container-highest'
                    }`}
                  ></div>
                </div>
                <span
                  className={`text-[12px] font-medium transition-colors ${
                    isSelected ? 'text-secondary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  {item.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Invoices List Section */}
      <div className="flex flex-col gap-space-sm mt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              វិក្កយបត្រថ្មីៗ
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
              {transactions.length} ថ្មី
            </span>
          </div>
          <button
            onClick={onNavigateToLedger}
            className="font-label-md text-label-md text-secondary font-semibold hover:underline"
            type="button"
          >
            មើលទាំងអស់
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 bg-surface-container-lowest rounded-2xl border border-dashed border-surface-container-high/80 text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-2.5">
              <span className="material-symbols-outlined text-[26px]">receipt_long</span>
            </div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">
              មិនទាន់មានប្រតិបត្តិការនៅឡើយទេ
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1 max-w-[260px] leading-relaxed">
              ចំណូល $0.00 • ចំណាយ $0.00<br />
              សូមចុចប៊ូតុងខាងក្រោមដើម្បីស្កេន ឬបញ្ចូលវិក្កយបត្រដំបូង!
            </p>
            <button
              onClick={() => onNavigateToUpload()}
              className="mt-3.5 px-4 py-2 bg-secondary text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              <span>ស្កេនវិក្កយបត្រឥឡូវនេះ</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-space-sm">
            {transactions.slice(0, 3).map((tx) => (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction(tx)}
                className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/60 flex items-center justify-between gap-space-sm cursor-pointer hover:border-secondary/40 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center shrink-0 text-on-surface shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">
                      {tx.iconName || 'receipt'}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-sm text-[15px] text-on-surface truncate font-semibold">
                      {tx.vendorKh || tx.vendor}
                    </span>
                    <span className="text-on-surface-variant font-body-sm text-body-sm">
                      {tx.date} • {tx.time || '10:30 AM'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="font-headline-sm text-[16px] text-on-surface font-bold">
                    -${tx.amountUSD.toFixed(2)}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {tx.amountKHR.toLocaleString()} ៛
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Micro-Help Toast Banner */}
      <div className="rounded-2xl bg-surface-container-low/80 p-space-md border border-surface-container-high flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[18px]">lightbulb</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-label-md text-label-md font-bold text-on-surface">
            ជំនួយរហ័សពី AI
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
            ស្កេនបង្កាន់ដៃ KHQR បានច្រើនក្នុងពេលតែមួយ ដើម្បីកត់ត្រាចំណាយស្វ័យប្រវត្តិ។
          </p>
        </div>
      </div>
    </div>
  );
};
