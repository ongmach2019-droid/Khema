import React from 'react';
import { Transaction } from '../types.ts';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onToggleStatus,
  onDelete,
  onEdit,
}) => {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-surface-container-high animate-slide-up">
        {/* Modal Handle & Header */}
        <div className="sticky top-0 bg-surface-container-lowest/90 backdrop-blur-md pt-3 pb-3 px-5 border-b border-surface-container-low flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
              {transaction.ref}
            </span>
            <span
              className={`font-label-sm text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                transaction.status === 'paid'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">
                {transaction.status === 'paid' ? 'check_circle' : 'schedule'}
              </span>
              <span>{transaction.statusTextKh || (transaction.status === 'paid' ? 'បានបង់' : 'ជំពាក់')}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(transaction);
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary font-semibold text-xs flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span>កែប្រែ</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Main vendor & Total */}
          <div className="flex flex-col items-center text-center py-2 bg-surface-container-low/60 rounded-2xl p-4 border border-surface-container-high/40">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-secondary mb-2 shadow-xs">
              <span className="material-symbols-outlined text-[26px]">
                {transaction.iconName || 'receipt'}
              </span>
            </div>
            <h2 className="font-headline-sm text-[18px] font-bold text-on-surface">
              {transaction.vendorKh || transaction.vendor}
            </h2>
            <div className="mt-2">
              <span className="font-financial-numeric text-[30px] font-bold text-on-surface block">
                -${transaction.amountUSD.toFixed(2)}
              </span>
              <span className="text-on-surface-variant font-body-sm text-[13px] font-medium">
                {transaction.amountKHR.toLocaleString()} ៛
              </span>
            </div>
          </div>

          {/* Key metadata grid */}
          <div className="bg-surface-container-low/60 rounded-xl p-3 flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">កាលបរិច្ឆេទ & ម៉ោង:</span>
              <span className="font-semibold text-on-surface">
                {transaction.date} {transaction.time ? `• ${transaction.time}` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">កូដគណនេយ្យ (COA):</span>
              <span className="font-semibold text-on-surface">{transaction.categoryCode}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">ពន្ធអាករ (VAT 10%):</span>
              <span className="font-semibold text-secondary">${transaction.vatUSD.toFixed(2)}</span>
            </div>

            {transaction.ocrConfidence && (
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">កម្រិតភាពត្រឹមត្រូវ AI:</span>
                <span className="font-semibold text-secondary">
                  {transaction.ocrConfidence}% ផ្ទៀងផ្ទាត់
                </span>
              </div>
            )}
          </div>

          {/* AI Explanation */}
          {transaction.aiExplanation && (
            <div className="p-3 rounded-xl bg-secondary-container/20 border border-secondary/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">
                auto_awesome
              </span>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-on-surface mb-0.5">ចំណារពន្យល់ពី AI</span>
                <p className="text-on-surface-variant leading-relaxed">
                  {transaction.aiExplanation}
                </p>
              </div>
            </div>
          )}

          {/* Items breakdown if available */}
          {transaction.items && transaction.items.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-label-sm text-xs font-bold text-on-surface">
                បញ្ជីទំនិញលម្អិត ({transaction.items.length})
              </span>
              <div className="bg-surface-container-low/50 rounded-xl divide-y divide-surface-container-high/60 border border-surface-container-high/40">
                {transaction.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-on-surface truncate">{item.name}</span>
                      <span className="text-on-surface-variant text-[11px]">
                        ចំនួន {item.quantity} x ${item.price.toFixed(2)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-on-surface">
                      ${item.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt image preview */}
          {transaction.receiptImage && (
            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-xs font-bold text-on-surface">
                រូបភាពវិក្កយបត្រដើម
              </span>
              <div className="w-full h-44 rounded-xl overflow-hidden border border-surface-container-high bg-black/5 flex items-center justify-center">
                <img
                  src={transaction.receiptImage}
                  alt="Original receipt"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-container-low">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(transaction);
                  onClose();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>កែប្រែ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleStatus(transaction.id)}
              className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-container-high active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              <span>
                ប្តូរជា {transaction.status === 'paid' ? 'ជំពាក់' : 'បានបង់'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('តើអ្នកពិតជាចង់លុបវិក្កយបត្រនេះមែនទេ?')) {
                  onDelete(transaction.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2.5 rounded-xl bg-error-container text-error hover:bg-error-container/80 font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>លុប</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
