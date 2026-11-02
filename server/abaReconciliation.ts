import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const xlsx = (XLSX as any).readFile ? XLSX : ((XLSX as any).default || XLSX);

export interface DoctorInvoice {
  id: string;
  no: number;
  module: string;
  date: string;
  inv: string;
  ref: string;
  desc: string;
  origAmt: number;
  bal: number;
  amt: number;
  discount?: number;
  paidBefore: number;
  paidNow: number;
  remaining: number;
  runBal: number;
  status: 'Fully Paid' | 'Partially Paid' | 'Unpaid';
  statusKh: 'សងគ្រប់' | 'សងមួយផ្នែក' | 'មិនទាន់សង';
  pp?: number;
  pb?: number;
  rem?: number;
}

export interface DoctorStatement {
  slotKey?: string;
  id: string;
  name: string;
  customerId: string;
  entry: string;
  telegram?: string;
  meta: {
    custNo: string;
    custKh: string;
    custEn: string;
    telegram?: string;
    phone: string;
    address: string;
    currency: string;
  };
  owed: number;
  paidTotal: number;
  paidBeforeTotal: number;
  paidCurrent: number;
  discountTotal?: number;
  rem: number;
  extra: number;
  status: 'Fully Paid' | 'Partially Paid' | 'Unpaid' | 'Advance Payment' | 'No Debt';
  statusKh: 'សងគ្រប់' | 'សងមួយផ្នែក' | 'មិនទាន់សង' | 'ទូទាត់មុន' | 'គ្មានបំណុល';
  tgSent?: {
    sentAt: string;
    target: string;
  } | null;
  invoices: DoctorInvoice[];
  inv: DoctorInvoice[];
  payments: Array<{
    id?: string;
    date: string;
    amt: number;
    text?: string;
    particular?: string;
    ref?: string;
    source?: string;
  }>;
  pay: Array<{
    id?: string;
    date: string;
    amt: number;
    text?: string;
    particular?: string;
    ref?: string;
    source?: string;
  }>;
}

export interface AbaState {
  activeDebtKey?: string;
  activeBankKey?: string;
  success: boolean;
  summary: {
    owed: number;
    paid: number;
    rem: number;
    doctorCount: number;
    tgSentCount: number;
    tgNotSentCount: number;
  };
  fileNames: {
    aba: string;
    debt: string;
    acc: string;
  };
  bankSlots?: Record<string, { exists: boolean; name: string }>;
  debtSlots?: Record<string, { exists: boolean; name: string }>;
  doctors: DoctorStatement[];
  unmatched: Array<{
    id: number;
    date: string;
    amt: number;
    text: string;
    acc?: string;
    name?: string;
  }>;
  tgSent?: Record<string, any>;
  profiles?: Record<string, any>;
  printPrefs?: any;
  discounts?: Record<string, any>;
  updatedAt: string;
}

export interface SharedPrefs {
  printPrefs: any;
  discounts: Record<string, any>;
  activeDebtKey?: string;
  activeBankKey?: string;
  bankSlotsMeta?: Record<string, { exists: boolean; name: string }>;
  debtSlotsMeta?: Record<string, { exists: boolean; name: string }>;
  updatedAt: string;
}

export function readSharedPrefs(): SharedPrefs {
  ensureDataDir();
  const defaultPrefs: SharedPrefs = {
    printPrefs: {
      qrSize: 90,
      qrCardWidth: 164,
      qrMarginTop: 0,
      qrMarginLeft: 0,
      footerOffsetMm: 0,
      tableFontSize: 12,
      tableCellPadding: 5,
      customQrUrl: '',
      customLogoUrl: '',
      liveEditActive: true,
      showQr: true
    },
    discounts: {},
    activeDebtKey: 'khema',
    activeBankKey: 'khema_aba',
    bankSlotsMeta: {
      khema_aba: { exists: false, name: '' },
      khema_acleda: { exists: false, name: '' },
      rms_aba: { exists: false, name: '' },
      rms_acleda: { exists: false, name: '' }
    },
    debtSlotsMeta: {
      khema: { exists: false, name: '' },
      rms: { exists: false, name: '' },
      newsmile: { exists: false, name: '' }
    },
    updatedAt: new Date().toISOString()
  };
  const saved = readJsonFile<SharedPrefs | null>('shared_prefs.json', null);
  if (saved && saved.printPrefs) {
    return {
      printPrefs: Object.assign({}, defaultPrefs.printPrefs, saved.printPrefs),
      discounts: saved.discounts || {},
      activeDebtKey: (saved.activeDebtKey && saved.activeDebtKey !== 'all') ? saved.activeDebtKey : defaultPrefs.activeDebtKey,
      activeBankKey: saved.activeBankKey || defaultPrefs.activeBankKey,
      bankSlotsMeta: Object.assign({}, defaultPrefs.bankSlotsMeta, saved.bankSlotsMeta || {}),
      debtSlotsMeta: Object.assign({}, defaultPrefs.debtSlotsMeta, saved.debtSlotsMeta || {}),
      updatedAt: saved.updatedAt || defaultPrefs.updatedAt
    };
  }
  return defaultPrefs;
}

export function writeSharedPrefs(newPrefs: Partial<SharedPrefs>): SharedPrefs {
  ensureDataDir();
  const current = readSharedPrefs();
  const merged: SharedPrefs = {
    printPrefs: Object.assign({}, current.printPrefs, newPrefs.printPrefs || {}),
    discounts: Object.assign({}, current.discounts, newPrefs.discounts || {}),
    activeDebtKey: (newPrefs.activeDebtKey && newPrefs.activeDebtKey !== 'all') ? newPrefs.activeDebtKey : (current.activeDebtKey || 'khema'),
    activeBankKey: newPrefs.activeBankKey || current.activeBankKey || 'khema_aba',
    bankSlotsMeta: Object.assign({}, current.bankSlotsMeta, newPrefs.bankSlotsMeta || {}),
    debtSlotsMeta: Object.assign({}, current.debtSlotsMeta, newPrefs.debtSlotsMeta || {}),
    updatedAt: new Date().toISOString()
  };
  writeJsonFile('shared_prefs.json', merged);

  const cachedState = readJsonFile<AbaState | null>('state.json', null);
  if (cachedState) {
    cachedState.updatedAt = merged.updatedAt;
    cachedState.printPrefs = merged.printPrefs;
    cachedState.discounts = merged.discounts;
    cachedState.activeDebtKey = merged.activeDebtKey;
    cachedState.activeBankKey = merged.activeBankKey;
    if (merged.bankSlotsMeta) cachedState.bankSlots = merged.bankSlotsMeta;
    if (merged.debtSlotsMeta) cachedState.debtSlots = merged.debtSlotsMeta;
    writeJsonFile('state.json', cachedState);
  }

  // If active slot changed, immediately recompute doctors so all devices see the fresh slot data
  if (newPrefs.activeDebtKey && newPrefs.activeDebtKey !== current.activeDebtKey) {
    try {
      const fresh = computeAbaReconciliation();
      writeJsonFile('state.json', fresh);
    } catch {}
  }

  return merged;
}

export function getAbaStateStatus(): { success: boolean; updatedAt: string; summary?: any } {
  const cached = readJsonFile<AbaState | null>('state.json', null);
  const shared = readSharedPrefs();
  let latestTs = cached?.updatedAt || '';
  if (shared?.updatedAt && (!latestTs || shared.updatedAt > latestTs)) {
    latestTs = shared.updatedAt;
  }
  const tgSentPath = path.join(dataDir, 'tg_sent.json');
  if (fs.existsSync(tgSentPath)) {
    try {
      const tgMtime = fs.statSync(tgSentPath).mtime.toISOString();
      if (!latestTs || tgMtime > latestTs) latestTs = tgMtime;
    } catch {}
  }
  if (!latestTs) latestTs = new Date().toISOString();
  return {
    success: true,
    updatedAt: latestTs,
    summary: cached?.summary
  };
}

const dataDir = path.resolve(process.cwd(), 'data', 'aba');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Helper to get network drive directories (single primary folder: H:\InvoiceAI)
export function getNetworkDriveAbaDirs(): string[] {
  const dirs: string[] = [];
  const candidateDrives = ['H:\\', 'Z:\\', '\\\\192.168.1.7\\Finance_Accounting'];
  for (const d of candidateDrives) {
    try {
      if (fs.existsSync(d)) {
        const p = path.join(d, 'InvoiceAI');
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        dirs.push(p);
        break; // Stop at first available network drive to prevent duplicate network latency
      }
    } catch {}
  }
  return dirs;
}

// Read JSON helper
function readJsonFile<T>(filename: string, defaultVal: T): T {
  ensureDataDir();
  const filePath = path.join(dataDir, filename);
  let localData: any = null;
  let localMtime = 0;
  if (fs.existsSync(filePath)) {
    try {
      localMtime = fs.statSync(filePath).mtimeMs;
      const raw = fs.readFileSync(filePath, 'utf-8');
      localData = JSON.parse(raw);
    } catch {}
  }

  // Check network drives ONLY if local is missing or network file has a newer mtime
  const netDirs = getNetworkDriveAbaDirs();
  for (const dir of netDirs) {
    try {
      const zp = path.join(dir, filename);
      if (fs.existsSync(zp)) {
        const netStat = fs.statSync(zp);
        const netMtime = netStat.mtimeMs;
        if (!localData || netMtime > localMtime + 1000) {
          const raw = fs.readFileSync(zp, 'utf-8');
          const parsed = JSON.parse(raw);
          try { fs.writeFileSync(filePath, raw, 'utf-8'); } catch {}
          localData = parsed;
          localMtime = netMtime;
        }
      }
    } catch {}
  }

  if (localData !== null && localData !== undefined) {
    return localData as T;
  }
  return (localData as T) || defaultVal;
}

// Write JSON helper
function writeJsonFile(filename: string, data: any) {
  ensureDataDir();
  const filePath = path.join(dataDir, filename);
  const jsonStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonStr, 'utf-8');

  // Background async network mirror to prevent blocking main event loop
  setTimeout(() => {
    try {
      getNetworkDriveAbaDirs().forEach(dir => {
        try {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, filename), jsonStr, 'utf-8');
        } catch {}
      });
    } catch {}
  }, 10);
}

// Extract parenthesized ABA / bank account number like (000 428 736) or contiguous digits
export function extractAbaAccount(text: string): string {
  if (!text) return '';
  const str = String(text);
  const m = str.match(/\(\s*([0-9\s\-_]{6,20})\s*\)/);
  if (m) {
    const digits = m[1].replace(/\D/g, '');
    if (digits.length >= 6) return digits;
  }
  const m2 = str.match(/\b(\d{3}[\s\-_]\d{3}[\s\-_]\d{3,4})\b/);
  if (m2) return m2[1].replace(/\D/g, '');
  const m3 = str.match(/(?:ACC|ACCT|ACCOUNT|A\/C)?\s*:?\s*(\d{6,18})\b/i);
  if (m3) return m3[1];
  return '';
}

// Robust date parsing for Excel serial numbers and multiple date string patterns
export function parseDateRobust(val: any): { dateObj: Date | null; dateStr: string; dmyStr: string; shortStr: string } {
  if (!val) return { dateObj: null, dateStr: '', dmyStr: '', shortStr: '' };
  let d: Date | null = null;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number') {
    if (val > 25000 && val < 60000) {
      // Excel serial date
      const ms = Math.round((val - 25569) * 86400 * 1000);
      d = new Date(ms);
      const offset = d.getTimezoneOffset() * 60000;
      d = new Date(d.getTime() + offset);
    }
  } else {
    const s = String(val).trim();
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // YYYY-MM-DD or YYYY/MM/DD
    const mYmd = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (mYmd) d = new Date(+mYmd[1], +mYmd[2] - 1, +mYmd[3]);

    // DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
    if (!d) {
      const mDmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
      if (mDmy) {
        let yr = +mDmy[3];
        if (yr < 100) yr += (yr > 50 ? 1900 : 2000);
        d = new Date(yr, +mDmy[2] - 1, +mDmy[1]);
      }
    }

    // DD-MMM-YY or DD-MMM-YYYY (e.g. 26-Oct-26, 26-Oct-2026, 09-Sep-2026)
    if (!d) {
      const mMon = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{2,4})/);
      if (mMon) {
        const mi = MON.findIndex(m => m.toLowerCase() === mMon[2].slice(0, 3).toLowerCase());
        let yr = +mMon[3];
        if (yr < 100) yr += (yr > 50 ? 1900 : 2000);
        if (mi > -1) d = new Date(yr, mi, +mMon[1]);
      }
    }

    // MMM DD, YYYY (e.g. Oct 26, 2026, Oct 04, 2026)
    if (!d) {
      const mMon2 = s.match(/^([A-Za-z]{3,9})[\s\-\/](\d{1,2})(?:st|nd|rd|th)?,?[\s\-\/]+(\d{2,4})/);
      if (mMon2) {
        const mi2 = MON.findIndex(m => m.toLowerCase() === mMon2[1].slice(0, 3).toLowerCase());
        let yr2 = +mMon2[3];
        if (yr2 < 100) yr2 += (yr2 > 50 ? 1900 : 2000);
        if (mi2 > -1) d = new Date(yr2, mi2, +mMon2[2]);
      }
    }

    if (!d) {
      const trial = new Date(s);
      if (!isNaN(trial.getTime()) && trial.getFullYear() >= 2000 && trial.getFullYear() <= 2040) {
        d = trial;
      }
    }
  }

  if (!d || isNaN(d.getTime())) return { dateObj: null, dateStr: '', dmyStr: '', shortStr: '' };

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const monStr = MON[d.getMonth()];
  const yrFull = d.getFullYear();
  const monNum = String(d.getMonth() + 1).padStart(2, '0');
  const yrShort = String(yrFull).slice(-2);

  const dmyStr = `${day}-${monStr}-${yrFull}`;
  const shortStr = `${day}/${monNum}/${yrShort}`;
  const dateStr = `${yrFull}-${monNum}-${day}`;

  return { dateObj: d, dateStr, dmyStr, shortStr };
}

// Canonical customer name helper: ensures code is prefixed exactly once (e.g. "C01683 - Cam Lab", never "C01683 - C01683 - Cam Lab")
export function getCanonicalCustomerName(code: string, name: string): string {
  const rawName = (name || '').trim();
  let c = (code || '').trim().toUpperCase();
  if (!c) {
    const m = rawName.match(/^([A-Z]\d{4,})/i);
    if (m) c = m[1].toUpperCase();
  }
  if (c === 'C00168' || rawName.toLowerCase().includes('ong mach')) {
    return 'C00168 - Chheung Eng Hong Dental Clinic';
  }
  // Strip any existing repeated code prefixes (e.g. "C00007 - ", "C00007 - C00007 - ")
  const clean = rawName.replace(/^([A-Z]\d{4,}\s*[-–:]\s*)+/gi, '').trim();
  if (c && clean) {
    return `${c} - ${clean}`;
  }
  return clean || c || rawName || 'គ្មានឈ្មោះ';
}

let cachedProfiles: Record<string, any> | null = null;

// Parse customer profiles from customers.xls or customers.xlsx
export function parseCustomerProfiles(forceReload = false): Record<string, any> {
  if (cachedProfiles && !forceReload && Object.keys(cachedProfiles).length > 0) {
    return cachedProfiles;
  }
  const profiles: Record<string, any> = {};

  // 1. First load from public/khema_customers.json or data/aba/khema_customers.json
  const jsonPaths = [
    path.join(dataDir, 'khema_customers.json'),
    path.join(process.cwd(), 'public', 'khema_customers.json')
  ];
  for (const jp of jsonPaths) {
    if (fs.existsSync(jp)) {
      try {
        const d = JSON.parse(fs.readFileSync(jp, 'utf8'));
        if (d && d.map) {
          Object.assign(profiles, d.map);
          break;
        }
      } catch (e) {}
    }
  }

  // 2. Check customer files across local dataDir FIRST, then network
  const candidates = [
    'Customer_Bank_Account_Number_Latest.xlsx',
    'Customer_Bank_Account_Number.xlsx',
    'customers.xls',
    'customers.xlsx',
    'Customer_List.xls',
    'Customer_List.xlsx'
  ];
  const searchDirs = [dataDir, ...getNetworkDriveAbaDirs()];
  let foundFile = '';
  for (const c of candidates) {
    for (const d of searchDirs) {
      const upP = path.join(d, 'uploads', c);
      if (fs.existsSync(upP)) { foundFile = upP; break; }
      const directP = path.join(d, c);
      if (fs.existsSync(directP)) { foundFile = directP; break; }
    }
    if (foundFile) break;
  }
  if (!foundFile) {
    cachedProfiles = profiles;
    return profiles;
  }

  try {
    const wb = xlsx.readFile(foundFile);
    const aoa: any[][] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    let hdrIdx = -1;
    for (let i = 0; i < Math.min(20, aoa.length); i++) {
      const rowStr = (aoa[i] || []).join(' ').toLowerCase();
      if (rowStr.includes('code') || rowStr.includes('clinic id') || rowStr.includes('customer name') || rowStr.includes('telephone') || rowStr.includes('phone')) {
        hdrIdx = i;
        break;
      }
    }
    const hdr = hdrIdx !== -1 ? (aoa[hdrIdx] || []) : [];
    const colCode = hdr.findIndex((c: any) => /code|id|clinic\s*id/i.test(String(c)));
    const colEn = hdr.findIndex((c: any) => /clinic\s*name$|customer\s*name|name.*en/i.test(String(c)));
    const colKh = hdr.findIndex((c: any) => /2nd|kh|lang/i.test(String(c)));
    const colPhone = hdr.findIndex((c: any) => /tel|phone/i.test(String(c)));
    const colAddr = hdr.findIndex((c: any) => /addr/i.test(String(c)));
    const colCur = hdr.findIndex((c: any) => /curr/i.test(String(c)));
    const colAcc = hdr.findIndex((c: any) => /account\s*num|aba|bank/i.test(String(c)));
    const colTg = hdr.findIndex((c: any) => /telegram|tg/i.test(String(c)));
    const colHolder = hdr.findIndex((c: any) => /account\s*holder|^name$/i.test(String(c)));

    const startRow = hdrIdx !== -1 ? hdrIdx + 1 : 0;
    for (let i = startRow; i < aoa.length; i++) {
      const r = aoa[i] || [];
      const codeRaw = colCode !== -1 ? r[colCode] : (r[0] || r[1]);
      const code = String(codeRaw || '').trim().toUpperCase();
      if (code && /^C\d{4,}/i.test(code)) {
        const nameEn = colEn !== -1 ? String(r[colEn] || '').trim() : String(r[1] || r[2] || '').trim();
        const nameKh = colKh !== -1 ? String(r[colKh] || '').trim() : String(r[2] || r[3] || '').trim();
        const phone = colPhone !== -1 ? String(r[colPhone] || '').trim() : String(r[6] || r[4] || '').trim();
        const address = colAddr !== -1 ? String(r[colAddr] || '').trim() : String(r[7] || r[9] || '').trim();
        const currency = colCur !== -1 ? String(r[colCur] || '').trim() : String(r[8] || r[10] || '').trim();
        const bankAccounts = colAcc !== -1 ? String(r[colAcc] || '').trim() : String(r[3] || '').trim();
        const telegram = colTg !== -1 ? String(r[colTg] || '').trim() : String(r[5] || '').trim();
        const accountHolder = colHolder !== -1 ? String(r[colHolder] || '').trim() : String(r[4] || '').trim();

        profiles[code] = Object.assign(profiles[code] || {}, {
          code,
          nameEn: nameEn || (profiles[code] && profiles[code].nameEn) || '',
          nameKh: nameKh || (profiles[code] && profiles[code].nameKh) || '',
          phone: phone || (profiles[code] && profiles[code].phone) || '',
          address: address || (profiles[code] && profiles[code].address) || '',
          currency: currency || (profiles[code] && profiles[code].currency) || 'USD',
          bankAccounts: bankAccounts || (profiles[code] && profiles[code].bankAccounts) || '',
          telegram: telegram || (profiles[code] && profiles[code].telegram) || '',
          accountHolder: accountHolder || (profiles[code] && profiles[code].accountHolder) || ''
        });
      }
    }
  } catch (err) {
    console.warn('Could not read customer Excel profiles from', foundFile, err);
  }

  cachedProfiles = profiles;
  return profiles;
}

let cachedAccountsMap: any[] | null = null;

// Parse accounts mapping
export function parseAccountsMap(forceReload = false): any[] {
  if (cachedAccountsMap && !forceReload && cachedAccountsMap.length > 0) {
    return cachedAccountsMap;
  }
  let list = readJsonFile<any[]>('accounts_map.json', []);

  // Auto-seed accounts from customer profiles (khema_customers.json)
  const profiles = parseCustomerProfiles();
  for (const code in profiles) {
    const prof = profiles[code];
    const rawAcc = String(prof.bankAccounts || prof.abaAcc || '').trim();
    if (!rawAcc) continue;

    const rawParts = rawAcc.split('/').map((p: string) => p.trim()).filter(Boolean);
    const cleanParts = rawParts.map((p: string) => p.replace(/\D/g, '')).filter(Boolean);
    if (!cleanParts.length && !rawParts.length) continue;

    const cCode = (prof.code || code).toUpperCase();
    const cName = prof.nameEn || prof.nameKh || cCode;

    const existing = list.find((x: any) => 
      (x.customerId && x.customerId.toUpperCase() === cCode) ||
      (x.entry && x.entry.toUpperCase() === cCode)
    );

    if (existing) {
      if (!existing.name) existing.name = cName;
      existing.accounts = Array.from(new Set([...(existing.accounts || []), ...cleanParts]));
      existing.rawAccounts = Array.from(new Set([...(existing.rawAccounts || []), ...rawParts]));
      existing.acct = existing.accounts[0] || '';
      existing.rawAcct = existing.rawAccounts.join(' / ');
      if (prof.telegram && !existing.telegram) existing.telegram = prof.telegram;
    } else {
      list.push({
        entry: cCode,
        customerId: cCode,
        name: cName,
        acct: cleanParts[0] || '',
        rawAcct: rawParts.join(' / '),
        accounts: cleanParts,
        rawAccounts: rawParts,
        telegram: prof.telegram || ''
      });
    }
  }

  // Check local dataDir FIRST, then network
  const accCandidates = [
    path.join(dataDir, 'Customer_Bank_Account_Number.xlsx'),
    path.join(dataDir, 'accounts.xlsx'),
    path.join(dataDir, 'Account id aba.xlsx'),
    path.join(dataDir, 'Customer_Bank_Account_Number.xls'),
    path.join(dataDir, 'accounts.xls'),
    path.join(process.cwd(), 'Account id aba.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'uploads', 'Customer_Bank_Account_Number.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'Customer_Bank_Account_Number.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'accounts.xlsx')
  ];
  for (const c of accCandidates) {
    if (fs.existsSync(c)) {
      try {
        const wb = xlsx.readFile(c);
        const s = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = xlsx.utils.sheet_to_json(s);
        rows.forEach(r => {
          const entry = String(r['Clinic ID'] || r['Entry No'] || r['Entry'] || r['Code'] || '').trim();
          const name = String(r['Clinic Name'] || r['Name'] || r['Customer Name'] || '').trim();
          const rawAcc = String(r['Account Number'] || r['accound aba'] || r['account aba'] || r['aba account'] || '').trim();
          
          // Split multiple accounts by '/' (e.g. 025934450001/001 654 720)
          const rawParts = rawAcc ? rawAcc.split('/').map(p => p.trim()).filter(Boolean) : [];
          const cleanParts = rawParts.map(p => p.replace(/\D/g, '')).filter(Boolean);
          const acct = cleanParts[0] || rawAcc.replace(/\D/g, '');

          if (entry || name || cleanParts.length || acct) {
            const existing = list.find(x => 
              (entry && x.entry && x.entry.toUpperCase() === entry.toUpperCase()) || 
              (name && x.name && x.name.toLowerCase() === name.toLowerCase())
            );
            if (existing) {
              if (name) existing.name = name;
              if (cleanParts.length) {
                existing.accounts = Array.from(new Set([...(existing.accounts || []), ...cleanParts]));
                existing.rawAccounts = Array.from(new Set([...(existing.rawAccounts || []), ...rawParts]));
                existing.acct = existing.accounts[0] || '';
                existing.rawAcct = existing.rawAccounts.join(' / ');
              } else if (acct) {
                existing.acct = acct;
                if (rawAcc) existing.rawAcct = rawAcc;
                if (!existing.accounts || !existing.accounts.length) existing.accounts = [acct];
              }
            } else {
              list.push({ 
                entry, 
                customerId: entry, 
                name, 
                acct: cleanParts[0] || acct, 
                rawAcct: rawParts.length > 1 ? rawParts.join(' / ') : rawAcc,
                accounts: cleanParts.length ? cleanParts : (acct ? [acct] : []),
                rawAccounts: rawParts.length ? rawParts : (rawAcc ? [rawAcc] : [])
              });
            }
          }
        });
        break; // Successfully loaded accounts mapping; no need to read remaining files!
      } catch (err) {
        console.warn('Error reading account file candidate:', c, err);
      }
    }
  }
  cachedAccountsMap = list;
  return list;
}

// Parse Telegram directory
export function parseTgDirectory(): any[] {
  let list = readJsonFile<any[]>('tg_directory.json', []);

  // Merge any Telegram from customer profiles
  const profiles = parseCustomerProfiles();
  for (const code in profiles) {
    const prof = profiles[code];
    const cCode = (prof.code || code).toUpperCase();
    const existing = list.find((x: any) => x.id && x.id.toUpperCase() === cCode);
    if (prof.telegram && String(prof.telegram).trim()) {
      const tgVal = String(prof.telegram).trim();
      const cName = prof.nameKh || prof.nameEn || cCode;
      if (existing) {
        existing.tg = tgVal;
        if (prof.phone && !existing.phone) existing.phone = prof.phone;
      } else {
        list.push({
          id: cCode,
          name: cName,
          tg: tgVal,
          phone: prof.phone || ''
        });
      }
    } else if (existing) {
      existing.tg = '';
    }
  }
  return list;
}

// Parse Telegram sent logs
export function parseTgSent(): Record<string, any> {
  return readJsonFile<Record<string, any>>('tg_sent.json', {});
}

// Main server-side reconciliation engine
export function computeAbaReconciliation(): AbaState {
  ensureDataDir();
  const profiles = parseCustomerProfiles();
  const accMap = parseAccountsMap();
  const tgDir = parseTgDirectory();
  const tgSent = parseTgSent();
  const shared = readSharedPrefs();
  const activeDebtKey = (shared && shared.activeDebtKey && shared.activeDebtKey !== 'all') ? shared.activeDebtKey : 'khema';
  const activeBankKey = (shared && shared.activeBankKey) ? shared.activeBankKey : 'khema_aba';

  const localUploadsDir = path.join(dataDir, 'uploads');
  const hUploadsDir = path.join('H:\\', 'InvoiceAI', 'uploads');
  const zUploadsDir = path.join('Z:\\', 'InvoiceAI', 'uploads');

  // Discover debt files per slot strictly - EMPTY SLOTS REMAIN EMPTY (no arbitrary grabbing)
  const debtSlots = ['khema', 'rms', 'newsmile'];
  const debtSlotsMeta: Record<string, { exists: boolean; name: string; count: number }> = {
    khema: { exists: false, name: '', count: 0 },
    rms: { exists: false, name: '', count: 0 },
    newsmile: { exists: false, name: '', count: 0 }
  };
  const debtSlotFiles: Record<string, string> = {};

  debtSlots.forEach(slot => {
    // If user explicitly left slot empty, keep it empty!
    if (shared.debtSlotsMeta && shared.debtSlotsMeta[slot] && shared.debtSlotsMeta[slot].exists === false) {
      debtSlotsMeta[slot] = { exists: false, name: '', count: 0 };
      return;
    }

    const slotPrefix = slot === 'khema' ? 'Khema' : (slot === 'rms' ? 'RMS' : 'New Smile');
    // Check localUploadsDir FIRST for instant zero-latency reading
    const localCandidates = [
      path.join(localUploadsDir, `${slotPrefix} Aged Report 31.10.26.xls`),
      path.join(localUploadsDir, `${slotPrefix} Aged Report 31.10.26.xlsx`),
      path.join(localUploadsDir, `${slotPrefix} Aged Receivable.xlsx`),
      path.join(localUploadsDir, `${slotPrefix} Aged Receivable.xls`),
      path.join(localUploadsDir, `${slot}_debt.xlsx`),
      path.join(localUploadsDir, `${slot}_debt.xls`)
    ];
    let found = localCandidates.find(c => fs.existsSync(c));

    // If not found locally, check H:\ network drive and sync to local
    if (!found) {
      const netCandidates = [
        path.join(hUploadsDir, `${slotPrefix} Aged Report 31.10.26.xls`),
        path.join(hUploadsDir, `${slotPrefix} Aged Report 31.10.26.xlsx`),
        path.join(hUploadsDir, `${slotPrefix} Aged Receivable.xlsx`),
        path.join(hUploadsDir, `${slotPrefix} Aged Receivable.xls`),
        path.join(hUploadsDir, `${slot}_debt.xlsx`),
        path.join(hUploadsDir, `${slot}_debt.xls`)
      ];
      const netFound = netCandidates.find(c => fs.existsSync(c));
      if (netFound) {
        try {
          const dest = path.join(localUploadsDir, path.basename(netFound));
          fs.copyFileSync(netFound, dest);
          found = dest;
        } catch {
          found = netFound;
        }
      }
    }

    if (found) {
      debtSlotFiles[slot] = found;
      let displayName = path.basename(found);
      if (displayName === `${slot}_debt.xls` || displayName === `${slot}_debt.xlsx`) {
        const origMatch = localCandidates.concat([
          path.join(hUploadsDir, `${slotPrefix} Aged Report 31.10.26.xls`),
          path.join(hUploadsDir, `${slotPrefix} Aged Report 31.10.26.xlsx`)
        ]).find(can => fs.existsSync(can) && !can.includes(`${slot}_debt`));
        if (origMatch) displayName = path.basename(origMatch);
      }
      debtSlotsMeta[slot] = { exists: true, name: displayName, count: 0 };
    }
  });

  const doctorsMap: Record<string, DoctorStatement> = {};
  const doctorOrder: string[] = [];

  // Parse each slot independently and tag doctors with slotKey
  for (const slot of debtSlots) {
    const debtFile = debtSlotFiles[slot];
    if (!debtFile || !fs.existsSync(debtFile)) continue;
    let slotInvCount = 0;
    try {
      const wb = xlsx.readFile(debtFile);
      const aoa: any[][] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      let currentDoc: DoctorStatement | null = null;

      for (let i = 0; i < aoa.length; i++) {
        const r = aoa[i] || [];
        if (r.length > 0 && typeof r[0] === 'string' && /^[A-Z]\d{4,}\s*[-–]/i.test(r[0].trim())) {
          const rawName = r[0].trim();
          const custIdMatch = rawName.match(/^([A-Z]\d{4,})/i);
          const custId = custIdMatch ? custIdMatch[1].toUpperCase() : '';
          const prof = profiles[custId] || {};

          const matchedAcc = accMap.find(a => 
            (custId && a.customerId && a.customerId.toUpperCase() === custId) ||
            (custId && a.entry && a.entry.toUpperCase() === custId)
          );

          const englishFromFile = rawName.replace(/^[A-Z]\d+\s*[-–]\s*/i, '').trim();
          const hasLatin = /[a-zA-Z]/.test(englishFromFile);
          const englishClean = hasLatin ? englishFromFile : '';
          const baseName = (prof.nameEn && /[a-zA-Z]/.test(prof.nameEn) ? prof.nameEn : '') ||
                           englishClean ||
                           (matchedAcc?.nameEn && /[a-zA-Z]/.test(matchedAcc.nameEn) ? matchedAcc.nameEn : '') ||
                           (matchedAcc?.name && !/[\u1780-\u17FF]/.test(matchedAcc.name) ? matchedAcc.name : '') ||
                           rawName;
          const displayName = getCanonicalCustomerName(custId, baseName);
          const uniqueKey = `${slot}_${displayName}`;

          if (doctorsMap[uniqueKey]) {
            currentDoc = doctorsMap[uniqueKey];
            continue;
          }

          let custEn = (prof.nameEn && /[a-zA-Z]/.test(prof.nameEn) ? prof.nameEn : '') ||
                       englishClean ||
                       (matchedAcc?.nameEn && /[a-zA-Z]/.test(matchedAcc.nameEn) ? matchedAcc.nameEn : '') ||
                       displayName.replace(/^[A-Z]\d+\s*[-–]\s*/i, '').trim();
          let custKh = prof.nameKh || (matchedAcc?.nameKh || matchedAcc?.name || custEn);
          if (custId === 'C00168' || custKh.toLowerCase().includes('ong mach') || custEn.toLowerCase().includes('ong mach')) {
            custKh = 'ពេទ្យធ្មេញ ឈឿង អេងហុង';
            custEn = 'Chheung Eng Hong Dental Clinic';
          }

          currentDoc = {
            id: custId || rawName,
            name: displayName,
            customerId: custId,
            entry: custId,
            slotKey: slot,
            meta: {
              custNo: custId,
              custKh,
              custEn,
              phone: prof.phone || (custId === 'C00168' ? '093 65 32 06 , 016 666 187' : ''),
              address: prof.address || (custId === 'C00168' ? 'Kampong Spue Province' : ''),
              currency: prof.currency || 'USD'
            },
            owed: 0,
            paidTotal: 0,
            paidBeforeTotal: 0,
            paidCurrent: 0,
            rem: 0,
            extra: 0,
            status: 'Unpaid',
            statusKh: 'មិនទាន់សង',
            tgSent: tgSent[displayName] || tgSent[custId] || null,
            invoices: [],
            payments: [],
            inv: [],
            pay: []
          };
          doctorsMap[uniqueKey] = currentDoc;
          doctorOrder.push(uniqueKey);
          continue;
        }

        if (currentDoc && r.length >= 20) {
          const invNo = String(r[4] || '').trim();
          if (/^INV/i.test(invNo)) {
            if (currentDoc.invoices.some(v => v.inv === invNo)) continue;
            slotInvCount++;
            const origAmt = parseFloat(r[21]) || 0;
            const bal = parseFloat(r[27] != null ? r[27] : r[21]) || 0;
            const isPartial = bal < origAmt || (r[13] && /partial/i.test(String(r[13])));
            const invStatus: 'Fully Paid' | 'Partially Paid' | 'Unpaid' = bal <= 0.005 ? 'Fully Paid' : (isPartial ? 'Partially Paid' : 'Unpaid');
            const invStatusKh = bal <= 0.005 ? 'សងគ្រប់' : (isPartial ? 'សងមួយផ្នែក' : 'មិនទាន់សង');

            // Col 7 is Remark (LF:..., Pt. ...), Col 6 is Employee ("Sale Office KDDS" or staff name)
            const desc = String(r[7] || '').trim() || String(r[6] || '').trim();

            // Discount from sharedPrefs
            const discKey1 = `${currentDoc.name}_${invNo}`;
            const discKey2 = `${currentDoc.id}_${invNo}`;
            const discVal = Number(shared.discounts?.[discKey1] ?? shared.discounts?.[discKey2] ?? shared.discounts?.[invNo] ?? 0) || 0;
            const netBal = Math.max(0, Math.round((bal - discVal) * 100) / 100);

            currentDoc.invoices.push({
              id: `${currentDoc.id}-${invNo}-${currentDoc.invoices.length + 1}`,
              no: currentDoc.invoices.length + 1,
              module: String(r[1] || 'AR-IN'),
              date: String(r[2] || ''),
              inv: invNo,
              ref: String(r[5] || ''),
              desc: desc,
              amt: bal,
              origAmt,
              bal,
              discount: discVal,
              paidBefore: Math.max(0, origAmt - bal),
              paidNow: 0,
              remaining: netBal,
              pp: 0,
              pb: Math.max(0, origAmt - bal),
              rem: netBal,
              status: netBal <= 0.005 ? 'Fully Paid' : invStatus,
              statusKh: netBal <= 0.005 ? 'សងគ្រប់' : invStatusKh,
              runBal: netBal
            });
            currentDoc.inv = currentDoc.invoices;
          }
        }
      }
      debtSlotsMeta[slot].count = slotInvCount;
    } catch (e) {
      console.warn('Error reading debt file for slot ' + slot, e);
    }
  }

  // Discover bank statement files strictly per slot (Local FIRST for instant loading)
  const bankSlots = ['khema_aba', 'khema_acleda', 'rms_aba', 'rms_acleda'];
  const bankSlotsMeta: Record<string, { exists: boolean; name: string }> = {
    khema_aba: { exists: false, name: '' },
    khema_acleda: { exists: false, name: '' },
    rms_aba: { exists: false, name: '' },
    rms_acleda: { exists: false, name: '' }
  };
  const bankSlotFiles: Record<string, string> = {};

  bankSlots.forEach(slot => {
    // If user explicitly left slot empty, keep it empty!
    if (shared.bankSlotsMeta && shared.bankSlotsMeta[slot] && shared.bankSlotsMeta[slot].exists === false) {
      bankSlotsMeta[slot] = { exists: false, name: '' };
      return;
    }

    const localCandidates = [
      path.join(localUploadsDir, `${slot}.xlsx`),
      path.join(localUploadsDir, `${slot}.xls`),
      path.join(localUploadsDir, `${slot}.csv`)
    ];
    let found = localCandidates.find(c => fs.existsSync(c));
    if (!found) {
      const netCandidates = [
        path.join(hUploadsDir, `${slot}.xlsx`),
        path.join(hUploadsDir, `${slot}.xls`),
        path.join(hUploadsDir, `${slot}.csv`)
      ];
      const netFound = netCandidates.find(c => fs.existsSync(c));
      if (netFound) {
        try {
          const dest = path.join(localUploadsDir, path.basename(netFound));
          fs.copyFileSync(netFound, dest);
          found = dest;
        } catch {
          found = netFound;
        }
      }
    }
    if (found) {
      bankSlotFiles[slot] = found;
      bankSlotsMeta[slot] = { exists: true, name: path.basename(found) };
    }
  });

  // Reconcile payments against matching slot doctors
  const unmatched: any[] = [];
  for (const slot of bankSlots) {
    const abaFile = bankSlotFiles[slot];
    if (!abaFile || !fs.existsSync(abaFile)) continue;
    const targetEntitySlot = slot.startsWith('rms') ? 'rms' : 'khema';

    try {
      const wb = xlsx.readFile(abaFile);
      const aoa: any[][] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      let hdrIdx = -1;
      let dateCol = -1;
      let textCol = -1;
      let crCol = -1;
      let balCol = -1;
      let refCol = -1;

      for (let i = 0; i < Math.min(100, aoa.length); i++) {
        const row = aoa[i] || [];
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim().toLowerCase();
          if (!val) continue;
          if (/(txn\s*date|value\s*date|post\s*date|date|កាលបរិច្ឆេទ)/i.test(val) && dateCol === -1) dateCol = c;
          if (/(particular|description|narrative|remark|detail|memo|បរិយាយ|ពិពណ៌នា)/i.test(val) && textCol === -1) textCol = c;
          if (/(deposit|credit|money\s*in|cash\s*in|\bcr\b|amount\s*in|ចូល)/i.test(val) && crCol === -1) crCol = c;
          if (/(balance|running\s*bal|សមតុល្យ)/i.test(val) && balCol === -1) balCol = c;
          if (/(ref|reference|trx\s*id|transaction\s*id|ft\s*ref|លេខយោង)/i.test(val) && refCol === -1) refCol = c;
        }
        if (dateCol !== -1 && (crCol !== -1 || textCol !== -1)) {
          hdrIdx = i;
          break;
        }
      }

      const startRow = hdrIdx !== -1 ? hdrIdx + 1 : 0;
      for (let i = startRow; i < aoa.length; i++) {
        const r = aoa[i] || [];
        let dateRes = dateCol !== -1 ? parseDateRobust(r[dateCol]) : { dateObj: null, dateStr: '', dmyStr: '', shortStr: '' };
        if (!dateRes.dateObj) {
          for (let c = 0; c < Math.min(r.length, 5); c++) {
            const trial = parseDateRobust(r[c]);
            if (trial.dateObj) { dateRes = trial; break; }
          }
        }
        if (!dateRes.dateObj) continue;

        let text = textCol !== -1 ? String(r[textCol] || '').trim() : '';
        if (!text || text.length < 3 || parseDateRobust(text).dateObj) {
          let longest = '';
          for (let c = 0; c < r.length; c++) {
            const s = String(r[c] || '').trim();
            if (s && !parseDateRobust(s).dateObj && isNaN(parseFloat(s)) && !/^(usd|khr)$/i.test(s) && s.length > longest.length) {
              longest = s;
            }
          }
          if (longest) text = longest;
        }

        let crVal = crCol !== -1 ? parseFloat(String(r[crCol] || '').replace(/[^0-9.\-]/g, '')) || 0 : 0;
        if (crVal <= 0) {
          for (let c = 0; c < r.length; c++) {
            if (c === dateCol || c === balCol) continue;
            const n = parseFloat(String(r[c] || '').replace(/[^0-9.\-]/g, ''));
            if (n > 0 && !parseDateRobust(r[c]).dateObj) {
              crVal = n;
              break;
            }
          }
        }
        if (crVal <= 0 && !text) continue;

        let refVal = refCol !== -1 ? String(r[refCol] || '').trim() : '';
        if (!refVal) {
          const mTrx = text.match(/(?:trx\.?\s*id|ref#?|ft#?)\s*[:#\s]*([a-z0-9_-]+)/i);
          if (mTrx) refVal = mTrx[1];
        }

        const txAcc = extractAbaAccount(text);
        const cleanTextDigits = text.replace(/\D/g, '');
        let hitDoc: DoctorStatement | null = null;

        for (const a of accMap) {
          const accList: string[] = (a.accounts && a.accounts.length)
            ? a.accounts
            : [String(a.acct || a.bankAcc || a.rawAcct || '').replace(/\D/g, '')];

          let hitThis = false;
          for (const cleanA of accList) {
            if (cleanA && cleanA.length >= 5 && (cleanTextDigits.includes(cleanA) || (txAcc && txAcc === cleanA))) {
              hitThis = true;
              break;
            }
          }

          if (hitThis) {
            const targetId = (a.customerId || a.entry || '').toUpperCase();
            const targetName = (a.name || '').trim();
            const targetCanon = getCanonicalCustomerName(targetId, targetName);
            const tryKeys = [
              `${targetEntitySlot}_${targetCanon}`,
              `${targetEntitySlot}_${targetName}`,
              `${targetEntitySlot}_${targetId}`
            ];
            for (const tk of tryKeys) {
              if (doctorsMap[tk]) { hitDoc = doctorsMap[tk]; break; }
            }
            if (hitDoc) break;
          }
        }

        if (!hitDoc) {
          for (const a of accMap) {
            const aName = (a.name || '').trim();
            if (aName && aName.length >= 4 && text.toLowerCase().includes(aName.toLowerCase())) {
              const targetId = (a.customerId || a.entry || '').toUpperCase();
              const targetCanon = getCanonicalCustomerName(targetId, aName);
              const tryKeys = [
                `${targetEntitySlot}_${targetCanon}`,
                `${targetEntitySlot}_${aName}`,
                `${targetEntitySlot}_${targetId}`
              ];
              for (const tk of tryKeys) {
                if (doctorsMap[tk]) { hitDoc = doctorsMap[tk]; break; }
              }
              if (hitDoc) break;
            }
          }
        }

        if (hitDoc) {
          hitDoc.payments.push({
            id: `${hitDoc.id}-PAY-${hitDoc.payments.length + 1}`,
            date: dateRes.dmyStr || dateRes.dateStr,
            amt: crVal,
            particular: text,
            ref: refVal,
            source: slot.includes('acleda') ? 'Acleda' : 'ABA'
          });
          hitDoc.pay = hitDoc.payments;
        } else {
          unmatched.push({
            date: dateRes.dmyStr || dateRes.dateStr,
            amt: crVal,
            text,
            ref: refVal
          });
        }
      }
    } catch (e) {
      console.warn('Error reading bank file ' + abaFile, e);
    }
  }

  // Calculate balances per doctor
  const allDoctorsList: DoctorStatement[] = [];
  for (const k of doctorOrder) {
    const D = doctorsMap[k];
    if (!D) continue;

    let running = 0;
    D.invoices.forEach((v, idx) => {
      v.no = idx + 1;
      running += (v.bal != null ? v.bal : v.amt);
      v.runBal = Math.round(running * 100) / 100;
    });

    let availablePay = D.payments.reduce((s, p) => s + p.amt, 0);
    // Total Debt captures strictly Balance from file (matches Excel row 3479 Total Balance: 117,713.15)
    D.owed = Math.round(D.invoices.reduce((s, v) => s + (v.bal != null ? v.bal : v.amt), 0) * 100) / 100;
    D.discountTotal = Math.round(D.invoices.reduce((s, v) => s + (v.discount || 0), 0) * 100) / 100;
    D.paidBeforeTotal = Math.round(D.invoices.reduce((s, v) => s + (v.paidBefore || 0), 0) * 100) / 100;

    D.invoices.forEach(v => {
      const initPb = Math.max(0, (v.origAmt || 0) - (v.bal || 0));
      v.paidBefore = initPb;
      v.pb = initPb;
      v.paidNow = 0;
      v.pp = 0;
      const bAmt = v.bal != null ? v.bal : (v.amt || 0);
      v.amt = bAmt;
      const netRem = Math.max(0, Math.round((bAmt - (v.discount || 0)) * 100) / 100);
      v.remaining = netRem;
      v.rem = netRem;
      v.status = netRem <= 0.005 ? 'Fully Paid' : 'Unpaid';
      v.statusKh = netRem <= 0.005 ? 'សងគ្រប់' : 'មិនទាន់សង';
    });

    const sortedInvsDesc = D.invoices.slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (!isNaN(da) && !isNaN(db) && db !== da) return db - da;
      return (b.no || 0) - (a.no || 0);
    });
    const payList = D.payments.map(p => p.amt).filter(a => a > 0);

    payList.forEach(pAmt => {
      if (pAmt <= 0) return;
      const match = sortedInvsDesc.find(v => v.paidNow === 0 && Math.abs(v.remaining - pAmt) < 0.005);
      if (match && availablePay >= pAmt) {
        match.paidNow = pAmt;
        match.pp = pAmt;
        match.remaining = 0;
        match.rem = 0;
        match.status = 'Fully Paid';
        match.statusKh = 'សងគ្រប់';
        availablePay = Math.max(0, Math.round((availablePay - pAmt) * 100) / 100);
      }
    });

    if (availablePay > 0.005) {
      sortedInvsDesc.forEach(v => {
        if (availablePay <= 0.005) return;
        if (v.remaining > 0.005) {
          const alloc = Math.min(v.remaining, availablePay);
          v.paidNow = Math.round((v.paidNow + alloc) * 100) / 100;
          v.pp = v.paidNow;
          v.remaining = Math.round((v.remaining - alloc) * 100) / 100;
          v.rem = v.remaining;
          v.status = v.remaining <= 0.005 ? 'Fully Paid' : 'Partially Paid';
          v.statusKh = v.remaining <= 0.005 ? 'សងគ្រប់' : 'សងមួយផ្នែក';
          availablePay = Math.max(0, Math.round((availablePay - alloc) * 100) / 100);
        }
      });
    }

    D.paidTotal = D.invoices.reduce((s, v) => s + (v.paidNow || 0), 0);
    D.paidCurrent = D.paidTotal;
    D.rem = Math.max(0, Math.round((D.owed - (D.discountTotal || 0) - D.paidTotal) * 100) / 100);
    D.extra = Math.round(availablePay * 100) / 100;

    if (D.owed > 0 && D.rem <= 0.005) {
      D.status = 'Fully Paid';
      D.statusKh = 'សងគ្រប់';
    } else if (D.paidTotal > 0.005 && D.rem > 0.005) {
      D.status = 'Partially Paid';
      D.statusKh = 'សងមួយផ្នែក';
    } else if (D.owed > 0 && D.paidTotal <= 0.005) {
      D.status = 'Unpaid';
      D.statusKh = 'មិនទាន់សង';
    } else if (D.owed <= 0 && D.extra > 0) {
      D.status = 'Advance Payment';
      D.statusKh = 'ទូទាត់មុន';
    } else {
      D.status = 'No Debt';
      D.statusKh = 'គ្មានបំណុល';
    }

    allDoctorsList.push(D);
  }

  // CRITICAL REQUIREMENT: NEVER CONSOLIDATE KHEMA AND RMS!
  // Filter doctors for the currently active slot ONLY (e.g. 144 for Khema, 48 for RMS, 0 for empty slot)
  const filteredForActiveSlot = allDoctorsList.filter(d => d.slotKey === activeDebtKey);
  const resultDoctors = filteredForActiveSlot;

  let totalOwed = 0;
  let totalPaid = 0;
  let totalRem = 0;
  let tgSentCount = 0;
  let tgNotSentCount = 0;

  resultDoctors.forEach(D => {
    totalOwed += D.owed;
    totalPaid += D.paidTotal;
    totalRem += D.rem;
    if (D.tgSent && D.tgSent.sentAt) tgSentCount++;
    else tgNotSentCount++;
  });

  const activeDebtFile = debtSlotFiles[activeDebtKey] || '';
  const activeBankFile = bankSlotFiles[activeBankKey] || '';

  const finalState: AbaState = {
    success: true,
    summary: {
      owed: Math.round(totalOwed * 100) / 100,
      paid: Math.round(totalPaid * 100) / 100,
      rem: Math.round(totalRem * 100) / 100,
      doctorCount: resultDoctors.length,
      tgSentCount,
      tgNotSentCount
    },
    fileNames: {
      aba: activeBankFile ? path.basename(activeBankFile) : '',
      debt: activeDebtFile ? path.basename(activeDebtFile) : '',
      acc: 'customers.xls'
    },
    bankSlots: bankSlotsMeta,
    debtSlots: debtSlotsMeta,
    activeDebtKey,
    activeBankKey,
    doctors: resultDoctors,
    unmatched,
    tgSent: parseTgSent(),
    updatedAt: new Date().toISOString()
  };

  writeJsonFile('state.json', finalState);
  return finalState;
}

export function getAbaState(force = false): AbaState {
  const shared = readSharedPrefs();
  const cached = force ? null : readJsonFile<AbaState | null>('state.json', null);
  if (cached && !force) {
    const slotsMatch = (!shared.debtSlotsMeta || Object.keys(shared.debtSlotsMeta).every(k => cached.debtSlots?.[k]?.exists === (shared.debtSlotsMeta as any)?.[k]?.exists)) &&
                       (!shared.bankSlotsMeta || Object.keys(shared.bankSlotsMeta).every(k => cached.bankSlots?.[k]?.exists === (shared.bankSlotsMeta as any)?.[k]?.exists));
    if (slotsMatch && cached.doctors && cached.doctors.length > 0) {
      const hasOngMach = cached.doctors.some(d =>
        (d.name && d.name.toLowerCase().includes('ong mach')) ||
        (d.customerId === 'C00168' && !d.name.includes('Eng Hong'))
      );
      if (!hasOngMach) {
        cached.profiles = cached.profiles || parseCustomerProfiles();
        cached.printPrefs = shared.printPrefs;
        cached.discounts = shared.discounts;
        cached.tgSent = parseTgSent();
        let sentCnt = 0;
        if (cached.doctors) {
          cached.doctors.forEach(d => {
            const isSent = cached.tgSent?.[d.name] || cached.tgSent?.[d.customerId] || (d.meta?.custNo && cached.tgSent?.[d.meta.custNo]);
            if (isSent) {
              d.tgSent = isSent;
              sentCnt++;
            } else {
              d.tgSent = null;
            }
          });
          if (cached.summary) {
            cached.summary.tgSentCount = sentCnt;
            cached.summary.tgNotSentCount = cached.doctors.length - sentCnt;
          }
        }
        return cached;
      }
    }
  }
  const fresh = computeAbaReconciliation();
  fresh.profiles = parseCustomerProfiles();
  fresh.printPrefs = shared.printPrefs;
  fresh.discounts = shared.discounts;
  writeJsonFile('state.json', fresh);
  return fresh;
}

// Auto-sync files between network drive (H:\InvoiceAI\data\aba) and local dataDir
export function syncFromNetworkDriveIfNeeded(): void {
  ensureDataDir();
  const netDirs = getNetworkDriveAbaDirs();
  if (!netDirs || !netDirs.length) return;

  const keyFiles = [
    'Customer_Bank_Account_Number.xlsx',
    'Customer_Bank_Account_Number_Latest.xlsx',
    'shared_prefs.json',
    'accounts_map.json',
    'statement_template.xlsx',
    'accounts.xlsx',
    'accounts.xls',
    'Account id aba.xlsx',
    'customers.xls',
    'customers.xlsx',
    'tg_sent.json',
    'tg_directory.json',
    'uploads_history.json',
    'exports_history.json'
  ];

  for (const netDir of netDirs) {
    if (!fs.existsSync(netDir)) continue;
    try {
      for (const f of keyFiles) {
        const netFile = path.join(netDir, f);
        const localFile = path.join(dataDir, f);
        if (fs.existsSync(netFile) && !fs.existsSync(localFile)) {
          try {
            fs.copyFileSync(netFile, localFile);
            console.log(`✓ Synchronized ${f} from network drive (${netDir}) to local dataDir`);
          } catch (e) {
            console.warn(`Could not copy ${f} from network drive:`, e);
          }
        } else if (fs.existsSync(localFile) && !fs.existsSync(netFile)) {
          try {
            fs.copyFileSync(localFile, netFile);
            console.log(`✓ Synchronized ${f} from local dataDir to network drive (${netDir})`);
          } catch (e) {
            console.warn(`Could not copy ${f} to network drive:`, e);
          }
        } else if (fs.existsSync(localFile) && fs.existsSync(netFile)) {
          try {
            const netStat = fs.statSync(netFile);
            const localStat = fs.statSync(localFile);
            if (netStat.mtimeMs > localStat.mtimeMs + 500) {
              fs.copyFileSync(netFile, localFile);
              console.log(`✓ Updated ${f} from newer version on network drive (${netDir})`);
            } else if (localStat.mtimeMs > netStat.mtimeMs + 500) {
              fs.copyFileSync(localFile, netFile);
              console.log(`✓ Synced newer local ${f} to network drive (${netDir})`);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Error during syncFromNetworkDriveIfNeeded:', err);
    }
  }
}

// Save uploaded file and recompute (strictly in uploads/ subfolder)
export function uploadAbaFile(fileType: 'aba' | 'debt' | 'acc', fileName: string, buffer: Buffer, slotKey?: string): AbaState {
  ensureDataDir();
  const ext = (path.extname(fileName) || '.xlsx').toLowerCase();
  const cleanOriginalName = path.basename(fileName);
  let targetName = '';

  if (fileType === 'aba') {
    targetName = slotKey ? `${slotKey}${ext}` : `aba_statement${ext}`;
  } else if (fileType === 'debt') {
    targetName = slotKey ? `${slotKey}_debt${ext}` : `debts${ext}`;
  } else if (fileType === 'acc') {
    const low = cleanOriginalName.toLowerCase();
    if (low.includes('customer') || low.includes('អតិថិជន') || low.includes('profile')) {
      targetName = `customers${ext}`;
    } else {
      targetName = `accounts${ext}`;
    }
  }

  // 1. Save active file strictly in uploads subfolder (data/aba/uploads/)
  const uploadsDir = path.join(dataDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, targetName), buffer);

  // Also save the clean original file name (e.g. "Khema Aged Receivable.xls", "RMS Aged Receivable.xls")
  if (cleanOriginalName && cleanOriginalName !== targetName) {
    try { fs.writeFileSync(path.join(uploadsDir, cleanOriginalName), buffer); } catch {}
  }

  // Update sharedPrefs so this slot is known to exist across all devices
  try {
    if (fileType === 'aba' && slotKey) {
      writeSharedPrefs({
        activeBankKey: slotKey,
        bankSlotsMeta: { [slotKey]: { exists: true, name: cleanOriginalName || targetName } } as any
      });
    } else if (fileType === 'debt' && slotKey) {
      writeSharedPrefs({
        activeDebtKey: slotKey,
        debtSlotsMeta: { [slotKey]: { exists: true, name: cleanOriginalName || targetName } } as any
      });
    }
  } catch (e) {}

  // If slot file, remove older extensions for this slot
  if (slotKey) {
    const basePrefix = fileType === 'debt' ? `${slotKey}_debt` : slotKey;
    ['.xlsx', '.xls', '.csv'].forEach(e => {
      if (e !== ext) {
        const altLocal = path.join(uploadsDir, `${basePrefix}${e}`);
        if (fs.existsSync(altLocal)) { try { fs.unlinkSync(altLocal); } catch {} }
      }
    });
  }

  // 2. Also save timestamped archive backup in data/aba/uploads/
  const timeStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFileName = `${timeStr}_${fileType}_${cleanOriginalName}`;
  try { fs.writeFileSync(path.join(uploadsDir, backupFileName), buffer); } catch {}

  // 3. Mirror strictly to network drive uploads/ subfolder (H:\InvoiceAI\uploads\)
  // NEVER write debt or statement files to root H:\InvoiceAI\ !
  const netDirs = getNetworkDriveAbaDirs();
  try {
    for (const zBase of netDirs) {
      const upDir = path.join(zBase, 'uploads');
      if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true });
      fs.writeFileSync(path.join(upDir, targetName), buffer);

      // Also save clean original filename to network drive uploads/
      if (cleanOriginalName && cleanOriginalName !== targetName) {
        try { fs.writeFileSync(path.join(upDir, cleanOriginalName), buffer); } catch {}
      }
      // Also maintain generic name on network drive
      if (fileType === 'debt' && targetName !== `debts${ext}`) {
        try { fs.writeFileSync(path.join(upDir, `debts${ext}`), buffer); } catch {}
      } else if (fileType === 'aba' && targetName !== `aba_statement${ext}`) {
        try { fs.writeFileSync(path.join(upDir, `aba_statement${ext}`), buffer); } catch {}
      }

      if (slotKey) {
        const basePrefix = fileType === 'debt' ? `${slotKey}_debt` : slotKey;
        ['.xlsx', '.xls', '.csv'].forEach(e => {
          if (e !== ext) {
            const altNet = path.join(upDir, `${basePrefix}${e}`);
            if (fs.existsSync(altNet)) { try { fs.unlinkSync(altNet); } catch {} }
          }
        });
      }
      console.log(`✓ Synchronized upload file to network drive in uploads (${upDir}/${targetName} and ${cleanOriginalName})`);
    }
  } catch (zErr) {
    console.warn('Could not mirror file to network drive:', zErr);
  }

  // 4. Clear stale server calculation data/state so calculation uses ONLY newly uploaded files
  try {
    const localState = path.join(dataDir, 'state.json');
    if (fs.existsSync(localState)) fs.unlinkSync(localState);
    for (const zBase of netDirs) {
      const netState = path.join(zBase, 'state.json');
      if (fs.existsSync(netState)) fs.unlinkSync(netState);
    }
    // Remove stale root legacy files in dataDir so they never interfere
    ['debts.xls', 'debts.xlsx', 'aba_statement.xlsx', 'aba_statement.xls'].forEach(sf => {
      const p = path.join(dataDir, sf);
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
    });
  } catch {}

  // 5. Record upload in history
  const histPath = path.join(dataDir, 'uploads_history.json');
  let history: any[] = [];
  if (fs.existsSync(histPath)) {
    try { history = JSON.parse(fs.readFileSync(histPath, 'utf-8')); } catch {}
  }
  history.unshift({
    id: Date.now(),
    fileType,
    originalName: cleanOriginalName,
    savedAs: targetName,
    backupFile: backupFileName,
    size: buffer.length,
    uploadedAt: new Date().toISOString()
  });
  if (history.length > 100) history = history.slice(0, 100);
  fs.writeFileSync(histPath, JSON.stringify(history, null, 2), 'utf-8');
  for (const zBase of netDirs) {
    try { fs.writeFileSync(path.join(zBase, 'uploads_history.json'), JSON.stringify(history, null, 2), 'utf-8'); } catch {}
  }

  // Recompute fresh from uploaded files and return state
  return computeAbaReconciliation();
}

// Delete single file (aba, debt, or acc) on server and network uploads folder
export function deleteAbaFile(fileType: 'aba' | 'debt' | 'acc', slotKey?: string): AbaState {
  ensureDataDir();
  let targetFiles: string[] = [];
  if (fileType === 'aba') {
    if (slotKey) {
      targetFiles = [`${slotKey}.xlsx`, `${slotKey}.xls`, `${slotKey}.csv`];
      if (slotKey === 'khema_aba') {
        targetFiles.push('aba_statement.xlsx', 'aba_statement.xls');
      }
    } else {
      targetFiles = [
        'aba_statement.xlsx', 'aba_statement.xls', 'aba.xlsx', 'aba.xls', 'aba.csv',
        'khema_aba.xlsx', 'khema_aba.xls', 'khema_acleda.xlsx', 'khema_acleda.xls',
        'rms_aba.xlsx', 'rms_aba.xls', 'rms_acleda.xlsx', 'rms_acleda.xls'
      ];
    }
  } else if (fileType === 'debt') {
    if (slotKey) {
      targetFiles = [`${slotKey}_debt.xlsx`, `${slotKey}_debt.xls`];
      if (slotKey === 'khema') {
        targetFiles.push('Khema Aged Report 31.10.26.xls', 'Khema Aged Report 31.10.26.xlsx', 'Khema Aged Receivable.xls', 'Khema Aged Receivable.xlsx', 'debts.xls', 'debts.xlsx');
      } else if (slotKey === 'rms') {
        targetFiles.push('RMS Aged Report 31.10.26.xls', 'RMS Aged Report 31.10.26.xlsx', 'RMS Aged Receivable.xls', 'RMS Aged Receivable.xlsx');
      }
    } else {
      targetFiles = [
        'debts.xls', 'debts.xlsx', 'Aged_Receivable.xls', 'Aged_Receivable.xlsx',
        'khema_debt.xlsx', 'khema_debt.xls', 'rms_debt.xlsx', 'rms_debt.xls',
        'newsmile_debt.xlsx', 'newsmile_debt.xls',
        'Khema Aged Report 31.10.26.xls', 'Khema Aged Report 31.10.26.xlsx',
        'RMS Aged Report 31.10.26.xls', 'RMS Aged Report 31.10.26.xlsx'
      ];
    }
  } else if (fileType === 'acc') {
    targetFiles = ['accounts.xlsx', 'accounts.xls', 'Account id aba.xlsx', 'customers.xls', 'customers.xlsx'];
  }

  // Update shared_prefs to mark slot as empty
  try {
    if (fileType === 'aba') {
      if (slotKey) {
        writeSharedPrefs({
          bankSlotsMeta: { [slotKey]: { exists: false, name: '' } } as any
        });
      } else {
        const resetMeta: any = {};
        ['khema_aba', 'khema_acleda', 'rms_aba', 'rms_acleda'].forEach(k => {
          resetMeta[k] = { exists: false, name: '' };
        });
        writeSharedPrefs({ bankSlotsMeta: resetMeta });
      }
    } else if (fileType === 'debt') {
      if (slotKey) {
        writeSharedPrefs({
          debtSlotsMeta: { [slotKey]: { exists: false, name: '' } } as any
        });
      } else {
        const resetMeta: any = {};
        ['khema', 'rms', 'newsmile'].forEach(k => {
          resetMeta[k] = { exists: false, name: '' };
        });
        writeSharedPrefs({ debtSlotsMeta: resetMeta });
      }
    }
  } catch (e) {}

  const netDirs = getNetworkDriveAbaDirs();
  const localUploadsDir = path.join(dataDir, 'uploads');

  targetFiles.forEach(f => {
    // Delete from local dataDir and local uploads/
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
    const pUp = path.join(localUploadsDir, f);
    if (fs.existsSync(pUp)) { try { fs.unlinkSync(pUp); } catch {} }

    // Delete ONLY from network drive uploads/ subfolder (never delete master customer files in root H:\)
    netDirs.forEach(dir => {
      try {
        const zpUp = path.join(dir, 'uploads', f);
        if (fs.existsSync(zpUp)) { fs.unlinkSync(zpUp); console.log(`✓ Deleted network drive file ${zpUp}`); }
      } catch {}
    });
  });

  // Clear cached state
  try {
    const localState = path.join(dataDir, 'state.json');
    if (fs.existsSync(localState)) fs.unlinkSync(localState);
  } catch {}

  return computeAbaReconciliation();
}

// Mark or Unmark Telegram sent
export function markAbaTelegramSent(name: string, custId?: string, target?: string, action?: string): AbaState {
  ensureDataDir();
  const tgSent = parseTgSent();
  if (action === 'unmark') {
    if (name) delete tgSent[name];
    if (custId) delete tgSent[custId];
    const m = String(name || '').match(/^([A-Z]\d+)/i);
    if (m) {
      delete tgSent[m[1]];
      delete tgSent[m[1].toUpperCase()];
    }
  } else {
    const record = {
      sentAt: new Date().toISOString(),
      target: target || 'Telegram'
    };
    if (name) tgSent[name] = record;
    if (custId) tgSent[custId] = record;
    const m = String(name || '').match(/^([A-Z]\d+)/i);
    if (m) {
      tgSent[m[1]] = record;
      tgSent[m[1].toUpperCase()] = record;
    }
  }
  writeJsonFile('tg_sent.json', tgSent);

  // Synchronously mirror tg_sent.json to all network drives
  const netDirs = getNetworkDriveAbaDirs();
  netDirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'tg_sent.json'), JSON.stringify(tgSent, null, 2), 'utf-8');
    } catch {}
  });

  // Touch cached state.json so pollServerUpdates sees immediate change
  const cached = readJsonFile<AbaState | null>('state.json', null);
  if (cached) {
    cached.tgSent = tgSent;
    cached.updatedAt = new Date().toISOString();
    writeJsonFile('state.json', cached);
  }

  return computeAbaReconciliation();
}

// Reset all Telegram sent marks
export function resetAbaTelegramSent(): AbaState {
  ensureDataDir();
  writeJsonFile('tg_sent.json', {});
  const netDirs = getNetworkDriveAbaDirs();
  netDirs.forEach(dir => {
    try {
      const netTg = path.join(dir, 'tg_sent.json');
      if (fs.existsSync(netTg)) { fs.unlinkSync(netTg); }
    } catch {}
  });
  const cached = readJsonFile<AbaState | null>('state.json', null);
  if (cached) {
    cached.tgSent = {};
    cached.updatedAt = new Date().toISOString();
    writeJsonFile('state.json', cached);
  }
  return computeAbaReconciliation();
}

// Reset state completely on server while strictly preserving all files in Drive H:\
export function resetAbaState(): AbaState {
  ensureDataDir();
  const filesToDelete = [
    'aba_statement.xlsx', 'aba_statement.xls', 'aba.xlsx', 'aba.xls', 'aba.csv',
    'khema_aba.xlsx', 'khema_aba.xls', 'khema_acleda.xlsx', 'khema_acleda.xls',
    'rms_aba.xlsx', 'rms_aba.xls', 'rms_acleda.xlsx', 'rms_acleda.xls',
    'debts.xls', 'debts.xlsx', 'Aged_Receivable.xls', 'Aged_Receivable.xlsx',
    'khema_debt.xlsx', 'khema_debt.xls', 'rms_debt.xlsx', 'rms_debt.xls',
    'newsmile_debt.xlsx', 'newsmile_debt.xls',
    'state.json',
    'tg_sent.json'
  ];

  // 1. Delete local working calculation files in dataDir
  filesToDelete.forEach(f => {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  });

  // Also ensure empty tg_sent.json
  writeJsonFile('tg_sent.json', {});

  // 2. Also clear slot files from local uploads/
  const localUploadsDir = path.join(dataDir, 'uploads');
  if (fs.existsSync(localUploadsDir)) {
    filesToDelete.forEach(f => {
      const p = path.join(localUploadsDir, f);
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
    });
  }

  // 3. Drive H:\ safety: STRICTLY KEEP all customer and account files in Drive H:\!
  // Only remove temporary cache state.json and tg_sent.json from H:\InvoiceAI if present.
  const netDirs = getNetworkDriveAbaDirs();
  netDirs.forEach(dir => {
    try {
      const netState = path.join(dir, 'state.json');
      if (fs.existsSync(netState)) { fs.unlinkSync(netState); }
      const netTg = path.join(dir, 'tg_sent.json');
      if (fs.existsSync(netTg)) { fs.unlinkSync(netTg); }
    } catch {}
  });

  // 4. Return clean empty state
  const emptyState: AbaState = {
    success: true,
    summary: { owed: 0, paid: 0, rem: 0, doctorCount: 0, tgSentCount: 0, tgNotSentCount: 0 },
    doctors: [],
    unmatched: [],
    fileNames: { aba: '', debt: '', acc: '' },
    bankSlots: {
      khema_aba: { exists: false, name: '' },
      khema_acleda: { exists: false, name: '' },
      rms_aba: { exists: false, name: '' },
      rms_acleda: { exists: false, name: '' }
    },
    debtSlots: {
      khema: { exists: false, name: '' },
      rms: { exists: false, name: '' },
      newsmile: { exists: false, name: '' }
    },
    updatedAt: new Date().toISOString()
  };

  writeJsonFile('state.json', emptyState);
  return emptyState;
}

// Synchronize all Customer Profiles & Doctor Accounts to single file in H:\InvoiceAI\Customer_Bank_Account_Number.xlsx
export function syncCustomerProfilesToFile(customProfiles?: Record<string, any>): { success: boolean; count: number; fileLocked?: boolean } {
  ensureDataDir();
  let profiles: Record<string, any> = customProfiles || parseCustomerProfiles();
  if (!profiles || Object.keys(profiles).length === 0) {
    profiles = parseCustomerProfiles();
  }

  const list = Object.values(profiles);
  list.sort((a: any, b: any) => {
    const aId = a.code || '';
    const bId = b.code || '';
    const aNum = aId.match(/\d+/);
    const bNum = bId.match(/\d+/);
    if (aNum && bNum && aId.charAt(0) === bId.charAt(0)) {
      return parseInt(aNum[0]) - parseInt(bNum[0]);
    }
    return aId.localeCompare(bId);
  });

  const aoa: any[][] = [
    [
      'Clinic ID',
      'Clinic Name',
      'Clinic Name (2nd Lang)',
      'Account Number',
      'Name',
      'Telegram',
      'Telephone',
      'Address',
      'Currency'
    ]
  ];

  list.forEach((item: any) => {
    aoa.push([
      item.code || '',
      item.nameEn || '',
      item.nameKh || '',
      item.bankAccounts || item.abaAcc || '',
      item.accountHolder || item.contact || '',
      item.telegram || '',
      item.phone || '',
      item.address || '',
      item.currency || 'USD'
    ]);
  });

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 35 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 22 },
    { wch: 22 },
    { wch: 45 },
    { wch: 10 }
  ];
  xlsx.utils.book_append_sheet(wb, ws, 'Combined Data');

  // 1. Write to local data/aba/Customer_Bank_Account_Number.xlsx
  const localTarget = path.join(dataDir, 'Customer_Bank_Account_Number.xlsx');
  try {
    xlsx.writeFile(wb, localTarget);
    console.log(`✓ Saved ${localTarget}`);
  } catch (err) {
    console.warn('Could not write local Customer_Bank_Account_Number.xlsx:', err);
  }

  // 2. Write to public/khema_customers.json
  const custJsonPath = path.join(process.cwd(), 'public', 'khema_customers.json');
  try {
    fs.writeFileSync(custJsonPath, JSON.stringify({ map: profiles, list }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not write public/khema_customers.json:', err);
  }

  // 3. Write to accounts_map.json
  const accList: any[] = [];
  list.forEach((c: any) => {
    const raw = String(c.bankAccounts || c.abaAcc || '').trim();
    if (raw) {
      const rawParts = raw.split('/').map((p: string) => p.trim()).filter(Boolean);
      const cleanParts = rawParts.map((p: string) => p.replace(/\D/g, '')).filter(Boolean);
      accList.push({
        entry: c.code,
        customerId: c.code,
        name: c.nameKh || c.nameEn || c.code,
        rawAcct: raw,
        acct: cleanParts[0] || '',
        accounts: cleanParts,
        rawAccounts: rawParts,
        accountHolder: c.accountHolder || '',
        telegram: c.telegram || ''
      });
    }
  });
  writeJsonFile('accounts_map.json', accList);

  // 4. Write directly to network drive H:\InvoiceAI\Customer_Bank_Account_Number.xlsx
  let anyFileLocked = false;
  const netDirs = getNetworkDriveAbaDirs();
  netDirs.forEach(dir => {
    try {
      const targetPath = path.join(dir, 'Customer_Bank_Account_Number.xlsx');
      try {
        xlsx.writeFile(wb, targetPath);
        console.log(`✓ Synced single customer file to network drive: ${targetPath}`);
      } catch (writeErr: any) {
        if (writeErr && writeErr.code === 'EBUSY') {
          anyFileLocked = true;
          console.warn(`File ${targetPath} is locked by Excel. Writing backup to Customer_Bank_Account_Number_Latest.xlsx`);
          const fbPath = path.join(dir, 'Customer_Bank_Account_Number_Latest.xlsx');
          xlsx.writeFile(wb, fbPath);
        } else {
          throw writeErr;
        }
      }
      const targetAccMap = path.join(dir, 'accounts_map.json');
      fs.writeFileSync(targetAccMap, JSON.stringify(accList, null, 2), 'utf8');
    } catch (err) {
      console.warn(`Could not sync customer file to network drive ${dir}:`, err);
    }
  });

    // 5. Invalidate / update state.json with new profiles & bump updatedAt for cross-device sync
  try {
    const cachedState = readJsonFile<AbaState | null>('state.json', null);
    if (cachedState) {
      cachedState.profiles = profiles;
      cachedState.updatedAt = new Date().toISOString();
      if (cachedState.doctors && cachedState.doctors.length > 0) {
        cachedState.doctors.forEach(d => {
          const prof = profiles[d.id] || profiles[d.customerId];
          if (prof) {
            d.meta = Object.assign({}, d.meta || {}, {
              custKh: prof.nameKh || (d.meta && d.meta.custKh),
              custEn: prof.nameEn || (d.meta && d.meta.custEn),
              telegram: prof.telegram != null ? prof.telegram : '',
              phone: prof.phone || (d.meta && d.meta.phone),
              address: prof.address || (d.meta && d.meta.address),
              currency: prof.currency || (d.meta && d.meta.currency)
            });
            d.telegram = prof.telegram != null ? prof.telegram : '';
            if (prof.nameEn) {
              d.name = getCanonicalCustomerName(d.id, prof.nameEn);
            }
          }
        });
      }
      writeJsonFile('state.json', cachedState);
      console.log('✓ Updated state.json with new customer profiles & bumped updatedAt for cross-device sync');
    }
  } catch (syncErr) {
    console.warn('Could not update state.json with new customer profiles:', syncErr);
  }

  cachedProfiles = profiles;
  try { writeJsonFile('tg_directory.json', parseTgDirectory()); } catch {}
  return { success: true, count: list.length, fileLocked: anyFileLocked };
}

