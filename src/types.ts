export interface ReceiptLineItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export type TransactionType = 'expense' | 'income';
export type PaymentStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  ref: string;
  entryNo?: number;
  jvNo?: string;
  vendor: string;
  vendorKh: string;
  category: string;
  categoryCode: string;
  date: string;
  time?: string;
  amountUSD: number;
  amountKHR: number;
  vatUSD: number;
  type: TransactionType;
  status: PaymentStatus;
  statusTextKh: string; // បានបង់ (Paid) or ជំពាក់ (Pending)
  iconName: string; // Material symbol icon
  receiptImage?: string;
  items?: ReceiptLineItem[];
  aiExplanation?: string;
  ocrConfidence?: number;
}

export interface ExcelRow {
  no: number;
  date: string;
  source: string;
  entryNo: number;
  jvNo: string;
  reference?: string;
  class?: string;
  vendor: string;
  description: string;
  debit: number;
  credit: number;
  balance?: string | null;
}

export interface AppSettings {
  userName: string;
  userRole: string;
  userAvatar: string;
  currency: 'USD_KHR' | 'USD' | 'KHR';
  exchangeRate: number; // e.g. 4100
  language: 'km' | 'en';
  autoBackup: boolean;
  aiConfidenceThreshold: number; // 90 to 99
  vatEnabled: boolean;
  vatRate: number; // 10
  googleSheetUrl?: string;
  googleSheetWebhookUrl?: string;
  googleSheetAutoSync?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'ai' | 'ledger' | 'system';
}
