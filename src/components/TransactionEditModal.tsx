import React, { useState, useEffect } from 'react';
import { Transaction } from '../types.ts';

interface TransactionEditModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Transaction) => Promise<void>;
  onDelete: (id: string, entryNo?: number, jvNo?: string) => Promise<void>;
}

export const TransactionEditModal: React.FC<TransactionEditModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [vendor, setVendor] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [categoryCode, setCategoryCode] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>('');
  const [amountUSD, setAmountUSD] = useState<number>(0);
  const [amountKHR, setAmountKHR] = useState<number>(0);
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (transaction) {
      setVendor(transaction.vendorKh || transaction.vendor || '');
      setCategory(transaction.category || '');
      setCategoryCode(transaction.categoryCode || '6010 - សម្ភារៈប្រើប្រាស់');
      setDate(transaction.date || '');
      setEntryDate(transaction.entryDate || transaction.date || '');
      setAmountUSD(transaction.amountUSD || 0);
      setAmountKHR(transaction.amountKHR || Math.round((transaction.amountUSD || 0) * 4000));
      setStatus(transaction.status || 'paid');
      setAiExplanation(transaction.aiExplanation || '');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleUSDChange = (val: number) => {
    setAmountUSD(val);
    setAmountKHR(Math.round(val * 4000));
  };

  const handleKHRChange = (val: number) => {
    setAmountKHR(val);
    setAmountUSD(Number((val / 4000).toFixed(2)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: Transaction = {
        ...transaction,
        vendor,
        vendorKh: vendor,
        category,
        categoryCode,
        date,
        entryDate,
        amountUSD,
        amountKHR,
        status,
        statusTextKh: status === 'paid' ? 'បានបង់' : 'ជំពាក់',
        aiExplanation,
      };
      await onSave(updated);
      onClose();
    } catch (err) {
      alert('កំហុសក្នុងការរក្សាទុក៖ ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('តើអ្នកពិតជាចង់លុបប្រតិបត្តិការនេះចេញពី Excel និងប្រព័ន្ធមែនទេ?')) {
      setIsDeleting(true);
      try {
        await onDelete(transaction.id, transaction.entryNo, transaction.jvNo || transaction.ref);
        onClose();
      } catch (err) {
        alert('កំហុសក្នុងការលុប៖ ' + err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-container-high/60 flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">edit_note</span>
            <span className="font-headline-sm text-[16px] font-bold text-on-surface">
              កែប្រែទិន្នន័យប្រតិបត្តិការ
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto no-scrollbar flex flex-col gap-3.5 text-xs">
          {/* Reference and Entry */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container font-mono text-[11px]">
            <span className="text-on-surface-variant">
              កូដយោង: <strong className="text-secondary">{transaction.ref || transaction.jvNo}</strong>
            </span>
            {transaction.entryNo && (
              <span className="text-on-surface-variant">
                Entry No: <strong className="text-on-surface">{transaction.entryNo}</strong>
              </span>
            )}
          </div>

          {/* Vendor */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">ឈ្មោះអ្នកផ្គត់ផ្គង់ / អ្នកទទួល (Vendor)</label>
            <input
              type="text"
              required
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-medium outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-sm"
              placeholder="ឧទាហរណ៍៖ ហាងកាហ្វេ ប្រោន"
            />
          </div>

          {/* Amount Row: USD and KHR */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">ចំនួនទឹកប្រាក់ ($ USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amountUSD}
                  onChange={(e) => handleUSDChange(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 pl-7 pr-2 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-mono font-bold outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-sm text-error"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">ចំនួនទឹកប្រាក់ (៛ KHR)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={amountKHR}
                  onChange={(e) => handleKHRChange(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-mono font-bold outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-sm text-on-surface"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-medium text-on-surface-variant">៛</span>
              </div>
            </div>
          </div>

          {/* Date and Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">កាលបរិច្ឆេទលើក្រដាស (Date)</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-mono outline-none focus:border-secondary text-xs"
                placeholder="15-Sep-2026"
                title="កាលបរិច្ឆេទលើក្រដាសវិក្កយបត្រ (រក្សាទុកក្នុង Excel Date)"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-emerald-700">bookmark</span>
                <span>ថ្ងៃបញ្ចូល (Entry Date)</span>
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-10 px-3 rounded-xl bg-surface-container-low border border-emerald-500/50 text-emerald-900 font-mono font-bold outline-none focus:border-emerald-600 text-xs"
                title="ថ្ងៃកត់ត្រាបញ្ចូល (កំណត់ Sheet សប្ដាហ៍ និងខែ)"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">ស្ថានភាពទូទាត់ (Status)</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'paid' | 'pending')}
              className="h-10 px-2 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-medium outline-none focus:border-secondary text-xs"
            >
              <option value="paid">✅ បានបង់រួច (Paid)</option>
              <option value="pending">⏳ នៅជំពាក់ (Pending)</option>
            </select>
          </div>

          {/* Category / Description */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">បរិយាយ / ប្រភេទចំណាយ (Description)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface outline-none focus:border-secondary text-xs"
              placeholder="ឧ. ថ្លៃធ្វើដំណើរ, សម្ភារៈការិយាល័យ..."
            />
          </div>

          {/* Chart of Accounts Code */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">កូដគណនេយ្យ (COA Category)</label>
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className="h-10 px-2 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-medium outline-none focus:border-secondary text-xs"
            >
              <option value="6010 - សម្ភារៈប្រើប្រាស់">6010 - សម្ភារៈប្រើប្រាស់ (Office & Dental Supplies)</option>
              <option value="6020 - ទំនិញស្តុក">6020 - ទំនិញស្តុក (Inventory & Stock)</option>
              <option value="6060 - ថ្លៃភ្លើង & ទឹក">6060 - ថ្លៃភ្លើង & ទឹក (Utilities)</option>
              <option value="6070 - ថ្លៃធ្វើដំណើរ និងម្ហូបអាហារ">6070 - ថ្លៃធ្វើដំណើរ និងម្ហូបអាហារ (Meals & Entertainment)</option>
              <option value="6080 - ថ្លៃសេវាកម្មទូទៅ">6080 - ថ្លៃសេវាកម្មទូទៅ (Delivery & Express)</option>
              <option value="7010 - ចំណូលពីការលក់">7010 - ចំណូលពីការលក់ (Revenue)</option>
            </select>
          </div>

          {/* AI Explanation Note */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">ចំណារពន្យល់ (AI Note)</label>
            <textarea
              rows={2}
              value={aiExplanation}
              onChange={(e) => setAiExplanation(e.target.value)}
              className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface outline-none focus:border-secondary text-xs resize-none"
              placeholder="កំណត់ចំណាំគណនេយ្យ..."
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-surface-container-high/60 mt-1">
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="h-11 px-3 rounded-xl bg-error-container text-error font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-error-container/80 shrink-0"
            >
              <span className="material-symbols-outlined text-[17px]">delete</span>
              <span>{isDeleting ? 'កំពុងលុប...' : 'លុប'}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-neutral-800 shadow-md text-xs"
            >
              <span className="material-symbols-outlined text-[17px]">save</span>
              <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកែប្រែ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
