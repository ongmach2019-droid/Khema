import { Transaction, AppSettings, AppNotification } from '../types.ts';

export const APP_LOGO = '/khema-logo.jpg';
export const APP_ICON = '/khema-icon.jpg';
export const USER_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1QFqUwJU7mQymf9O-wcOeYMuL8tIJ9phc11ip7Z0mSaPYv-BK6oacErrdgdQibC2GjS0HG1iLCLpECWCP4dV9lIzfxAUeYjfceRqvkdPr-nD7uGdp5gUgxwJuPwiGngC3Ky2gUyRmajCgmVPpG-eV6QKjOXcLxyTdXTPyz002cD9val8WzCZf3xanSuy5od1-w_BFeiT-3xxOX8CypfmYOcsgLtZ0BlQkogCGnsR9';
export const SAMPLE_RECEIPT_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcOQ4qCKXwPwUNMzKlRiNyzKOGUC_95YlxP8lEmH0BbBBPvC-abgWHpJAZ_3jEZAYYIcjlIQ2AoP4FLt_0uwYZ-m4vB0DULGF0-xRn8LUvIk-2-GQUou5Fuj2g08j4IBpeItnw_vZ_NxkfvBEDAhM-O_UPSoTdVU5oP7D2rmr-oqeDTEiLIbZev70gKcxgaOJTNsV5_e4fobNwA1xHn6ZL_VxOPfvNA28JDvbrw7xp';

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  userName: 'សុខា រតនៈ',
  userRole: 'គណនេយ្យករ (Accountant)',
  userAvatar: USER_AVATAR,
  currency: 'USD_KHR',
  exchangeRate: 4100,
  language: 'km',
  autoBackup: true,
  aiConfidenceThreshold: 95,
  vatEnabled: true,
  vatRate: 10,
  googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1MZzitc4LeZDaRlJpmj-gwBJzSdbp7C8CKdgMu_hhm1w/edit',
  googleSheetAutoSync: true,
};

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'ស្កេនជោគជ័យដោយ AI',
    message: 'វិក្កយបត្រផ្សារទំនើប ឡាក់គី ចំនួន $84.20 ត្រូវបានកត់ត្រា និងផ្គូផ្គងកូដ 6010 ត្រឹមត្រូវ។',
    time: '10 នាទីមុន',
    read: false,
    type: 'ai',
  },
  {
    id: 'notif-2',
    title: 'ការរំលឹកបង់ប្រាក់ជំពាក់',
    message: 'វិក្កយបត្រ ជីប ម៉ុង $350.00 នឹងដល់ថ្ងៃទូទាត់នៅថ្ងៃទី 30 តុលា។',
    time: '2 ម៉ោងមុន',
    read: false,
    type: 'ledger',
  },
  {
    id: 'notif-3',
    title: 'បម្រុងទុកទិន្នន័យស្វ័យប្រវត្តិ',
    message: 'ទិន្នន័យសៀវភៅធំត្រូវបាន Sync ទៅកាន់ Cloud ដោយជោគជ័យ។',
    time: 'ម្សិលមិញ',
    read: true,
    type: 'system',
  },
];

export const PRESET_RECEIPTS = [
  {
    id: 'preset-lucky',
    title: 'ផ្សារទំនើប ឡាក់គី (Lucky)',
    subtitle: 'វិក្កយបត្រកៅអី និងសម្ភារៈទូទៅ ($84.20)',
    imageUrl: SAMPLE_RECEIPT_IMG,
    hint: 'Lucky',
  },
  {
    id: 'preset-chipmong',
    title: 'ជីប ម៉ុង (Chip Mong)',
    subtitle: 'វិក្កយបត្រទំនិញស្តុក និងដែក ($350.00)',
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
    hint: 'Chip Mong',
  },
  {
    id: 'preset-edc',
    title: 'អគ្គិសនីកម្ពុជា (EDC)',
    subtitle: 'វិក្កយបត្រថ្លៃភ្លើងរដ្ឋាភិបាល ($145.20)',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    hint: 'EDC',
  },
  {
    id: 'preset-brown',
    title: 'ប្រោន កាហ្វេ (Brown Coffee)',
    subtitle: 'បង្កាន់ដៃកាហ្វេ និងអាហារសម្រន់ ($18.50)',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    hint: 'Brown Coffee',
  },
];
