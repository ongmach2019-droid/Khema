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
  id: string;
  name: string;
  customerId: string;
  entry: string;
  meta: {
    custNo: string;
    custKh: string;
    custEn: string;
    phone: string;
    address: string;
    currency: string;
  };
  owed: number;
  paidTotal: number;
  paidBeforeTotal: number;
  paidCurrent: number;
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
    date: string;
    amt: number;
    text: string;
    ref?: string;
  }>;
  pay: Array<{
    date: string;
    amt: number;
    text: string;
    ref?: string;
  }>;
}

export interface AbaState {
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
  updatedAt: string;
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
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      localData = JSON.parse(raw);
    } catch {}
  }

  // Check network drive if local is missing, empty, or smaller
  const netDirs = getNetworkDriveAbaDirs();
  for (const dir of netDirs) {
    try {
      const zp = path.join(dir, filename);
      if (fs.existsSync(zp)) {
        const raw = fs.readFileSync(zp, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!Array.isArray(localData) || localData.length < parsed.length) {
            try { fs.writeFileSync(filePath, raw, 'utf-8'); } catch {}
            return parsed as T;
          }
        } else if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          if (!localData || Object.keys(localData).length < Object.keys(parsed).length) {
            try { fs.writeFileSync(filePath, raw, 'utf-8'); } catch {}
            return parsed as T;
          }
        }
      }
    } catch {}
  }

  if (localData !== null && localData !== undefined && (!Array.isArray(localData) || localData.length > 0)) {
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
  getNetworkDriveAbaDirs().forEach(dir => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), jsonStr, 'utf-8');
    } catch {}
  });
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
  const clean = rawName.replace(/^([A-Z]\d{4,}\s*[-–]\s*)+/gi, '').trim();
  if (c && clean) {
    return `${c} - ${clean}`;
  }
  return clean || c || rawName || 'គ្មានឈ្មោះ';
}

// Parse customer profiles from customers.xls or customers.xlsx
export function parseCustomerProfiles(): Record<string, any> {
  const profiles: Record<string, any> = {};

  // 1. First load from public/khema_customers.json or data/aba/khema_customers.json
  const jsonPaths = [
    path.join(process.cwd(), 'public', 'khema_customers.json'),
    path.join(dataDir, 'khema_customers.json')
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

  // 2. Check uploaded customer files if present to override / supplement
  const candidates = ['customers.xls', 'customers.xlsx', 'Customer_List.xls', 'Customer_List.xlsx'];
  let foundFile = '';
  for (const c of candidates) {
    const upH = path.join('H:\\', 'InvoiceAI', 'uploads', c);
    if (fs.existsSync(upH)) { foundFile = upH; break; }
    const directH = path.join('H:\\', 'InvoiceAI', c);
    if (fs.existsSync(directH)) { foundFile = directH; break; }
    const p = path.join(dataDir, c);
    if (fs.existsSync(p)) { foundFile = p; break; }
  }
  if (!foundFile) return profiles;

  try {
    const wb = xlsx.readFile(foundFile);
    const aoa: any[][] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    let hdrIdx = -1;
    for (let i = 0; i < Math.min(20, aoa.length); i++) {
      const rowStr = (aoa[i] || []).join(' ').toLowerCase();
      if (rowStr.includes('code') || rowStr.includes('customer name') || rowStr.includes('telephone') || rowStr.includes('phone')) {
        hdrIdx = i;
        break;
      }
    }
    const startRow = hdrIdx !== -1 ? hdrIdx + 1 : 0;
    for (let i = startRow; i < aoa.length; i++) {
      const r = aoa[i] || [];
      const code = String(r[1] || r[0] || '').trim().toUpperCase();
      if (code && /^C\d{4,}/i.test(code)) {
        profiles[code] = Object.assign(profiles[code] || {}, {
          code,
          nameEn: String(r[2] || (profiles[code] && profiles[code].nameEn) || '').trim(),
          nameKh: String(r[3] || (profiles[code] && profiles[code].nameKh) || '').trim(),
          phone: String(r[6] || r[4] || (profiles[code] && profiles[code].phone) || '').trim(),
          address: String(r[9] || (profiles[code] && profiles[code].address) || '').trim(),
          currency: String(r[10] || (profiles[code] && profiles[code].currency) || 'USD').trim()
        });
      }
    }
  } catch (err) {
    console.warn('Error reading customer profiles on server:', err);
  }
  return profiles;
}

// Parse accounts mapping
export function parseAccountsMap(): any[] {
  let list = readJsonFile<any[]>('accounts_map.json', [
    { entry: 'C00007', customerId: 'C00007', name: 'Aesthetic Dental Clinic', acct: '000111222', rawAcct: '000 111 222' }
  ]);

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
    const cName = prof.nameKh || prof.nameEn || cCode;

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

  const accCandidates = [
    path.join('H:\\', 'InvoiceAI', 'uploads', 'Customer_Bank_Account_Number.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'uploads', 'Customer_Bank_Account_Number.xls'),
    path.join('H:\\', 'InvoiceAI', 'Customer_Bank_Account_Number.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'Customer_Bank_Account_Number.xls'),
    path.join('H:\\', 'InvoiceAI', 'uploads', 'Account id aba.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'uploads', 'accounts.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'uploads', 'accounts.xls'),
    path.join('H:\\', 'InvoiceAI', 'Account id aba.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'accounts.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'accounts.xls'),
    path.join('Z:\\', 'InvoiceAI', 'uploads', 'Account id aba.xlsx'),
    path.join('Z:\\', 'InvoiceAI', 'uploads', 'accounts.xlsx'),
    path.join(dataDir, 'Customer_Bank_Account_Number.xlsx'),
    path.join(dataDir, 'Account id aba.xlsx'),
    path.join(dataDir, 'accounts.xlsx'),
    path.join(dataDir, 'accounts.xls'),
    path.join(process.cwd(), 'Account id aba.xlsx')
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
      } catch (err) {
        console.warn('Error reading account file candidate:', c, err);
      }
    }
  }
  return list;
}

// Parse Telegram directory
export function parseTgDirectory(): any[] {
  let list = readJsonFile<any[]>('tg_directory.json', [
    { id: 'C00007', name: 'Aesthetic Dental Clinic', tg: '727477829', phone: '077 731 777' }
  ]);

  // Merge any Telegram from customer profiles
  const profiles = parseCustomerProfiles();
  for (const code in profiles) {
    const prof = profiles[code];
    if (prof.telegram) {
      const tgVal = String(prof.telegram).trim();
      const cCode = (prof.code || code).toUpperCase();
      const cName = prof.nameKh || prof.nameEn || cCode;
      const existing = list.find((x: any) => x.id && x.id.toUpperCase() === cCode);
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

  // 1. Read debts: ONLY from uploads folder! Deduplicated per slot
  const localUploadsDir = path.join(dataDir, 'uploads');
  const hUploadsDir = path.join('H:\\', 'InvoiceAI', 'uploads');
  const zUploadsDir = path.join('Z:\\', 'InvoiceAI', 'uploads');

  const debtSlots = ['khema', 'rms', 'newsmile'];
  const debtFilesToRead: string[] = [];

  debtSlots.forEach(slot => {
    const slotPrefix = slot === 'khema' ? 'Khema' : (slot === 'rms' ? 'RMS' : 'New Smile');
    const candidates = [
      path.join(hUploadsDir, `${slot}_debt.xlsx`),
      path.join(hUploadsDir, `${slot}_debt.xls`),
      path.join(hUploadsDir, `${slotPrefix} Aged Receivable.xlsx`),
      path.join(hUploadsDir, `${slotPrefix} Aged Receivable.xls`),
      path.join(localUploadsDir, `${slot}_debt.xlsx`),
      path.join(localUploadsDir, `${slot}_debt.xls`),
      path.join(localUploadsDir, `${slotPrefix} Aged Receivable.xlsx`),
      path.join(localUploadsDir, `${slotPrefix} Aged Receivable.xls`),
      path.join(zUploadsDir, `${slot}_debt.xlsx`),
      path.join(zUploadsDir, `${slot}_debt.xls`),
      path.join(zUploadsDir, `${slotPrefix} Aged Receivable.xlsx`),
      path.join(zUploadsDir, `${slotPrefix} Aged Receivable.xls`)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        debtFilesToRead.push(c);
        break; // Exactly one file per slot
      }
    }
  });

  // If no slot debts found, fallback to debts.xlsx or debts.xls in uploads ONLY
  if (debtFilesToRead.length === 0) {
    const fallbackDebts = [
      path.join(hUploadsDir, 'debts.xlsx'),
      path.join(hUploadsDir, 'debts.xls'),
      path.join(localUploadsDir, 'debts.xlsx'),
      path.join(localUploadsDir, 'debts.xls'),
      path.join(zUploadsDir, 'debts.xlsx'),
      path.join(zUploadsDir, 'debts.xls')
    ];
    for (const c of fallbackDebts) {
      if (fs.existsSync(c)) {
        debtFilesToRead.push(c);
        break; // Only one fallback file
      }
    }
  }

  const doctorsMap: Record<string, DoctorStatement> = {};
  const doctorOrder: string[] = [];

  for (const debtFile of (debtFilesToRead.length ? debtFilesToRead : [''])) {
    if (!debtFile) continue;
    try {
      const wb = xlsx.readFile(debtFile);
      const aoa: any[][] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      let currentDoc: DoctorStatement | null = null;

      for (let i = 0; i < aoa.length; i++) {
        const r = aoa[i] || [];
        // Header row of customer: e.g. "C00007 - Aesthetic Dental Clinic"
        if (r.length > 0 && typeof r[0] === 'string' && /^[A-Z]\d{4,}\s*[-–]/i.test(r[0].trim())) {
          const rawName = r[0].trim();
          const custIdMatch = rawName.match(/^([A-Z]\d{4,})/i);
          const custId = custIdMatch ? custIdMatch[1].toUpperCase() : '';
          const prof = profiles[custId] || {};

          const matchedAcc = accMap.find(a => 
            (custId && a.customerId && a.customerId.toUpperCase() === custId) ||
            (custId && a.entry && a.entry.toUpperCase() === custId)
          );

          // Check if mapped to a customer profile or custom name
          const baseName = prof.nameEn || prof.nameKh || (matchedAcc && matchedAcc.name) || rawName;
          const displayName = getCanonicalCustomerName(custId, baseName);

          if (doctorsMap[displayName] || (custId && doctorsMap[custId])) {
            currentDoc = doctorsMap[displayName] || (custId ? doctorsMap[custId] : null);
            continue;
          }

          let custKh = prof.nameKh || (matchedAcc?.name || rawName.replace(/^[A-Z]\d+\s*[-–]\s*/i, ''));
          let custEn = prof.nameEn || (matchedAcc?.name || rawName.replace(/^[A-Z]\d+\s*[-–]\s*/i, ''));
          if (custId === 'C00168' || custKh.toLowerCase().includes('ong mach') || custEn.toLowerCase().includes('ong mach')) {
            custKh = 'ពេទ្យធ្មេញ ឈឿង អេងហុង';
            custEn = 'Chheung Eng Hong Dental Clinic';
          }

          currentDoc = {
            id: custId || rawName,
            name: displayName,
            customerId: custId,
            entry: custId,
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
          doctorsMap[displayName] = currentDoc;
          if (custId) doctorsMap[custId] = currentDoc;
          doctorOrder.push(displayName);
          continue;
        }

        // Invoice row
        if (currentDoc && r.length >= 20) {
          const invNo = String(r[4] || '').trim();
          if (/^INV/i.test(invNo)) {
            if (currentDoc.invoices.some(v => v.inv === invNo)) continue;
            const origAmt = parseFloat(r[21]) || 0;
            const bal = parseFloat(r[27] != null ? r[27] : r[21]) || 0;
            const isPartial = bal < origAmt || (r[13] && /partial/i.test(String(r[13])));
            const invStatus: 'Fully Paid' | 'Partially Paid' | 'Unpaid' = bal <= 0.005 ? 'Fully Paid' : (isPartial ? 'Partially Paid' : 'Unpaid');
            const invStatusKh = bal <= 0.005 ? 'សងគ្រប់' : (isPartial ? 'សងមួយផ្នែក' : 'មិនទាន់សង');

            currentDoc.invoices.push({
              id: `${currentDoc.id}-${invNo}-${currentDoc.invoices.length + 1}`,
              no: currentDoc.invoices.length + 1,
              module: String(r[1] || 'AR-IN'),
              date: String(r[2] || ''),
              inv: invNo,
              ref: String(r[5] || ''),
              desc: String(r[7] || ''),
              origAmt,
              bal,
              amt: bal,
              paidBefore: 0,
              paidNow: 0,
              remaining: bal,
              runBal: 0,
              status: invStatus,
              statusKh: invStatusKh
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error reading debts on server:', err);
    }
  }

  // 2. Read ABA statements: ONLY from uploads folder! Deduplicated per slot
  const bankSlots = ['khema_aba', 'khema_acleda', 'rms_aba', 'rms_acleda'];
  const bankFilesToRead: string[] = [];

  bankSlots.forEach(slot => {
    const candidates = [
      path.join(hUploadsDir, `${slot}.xlsx`),
      path.join(hUploadsDir, `${slot}.xls`),
      path.join(hUploadsDir, `${slot}.csv`),
      path.join(localUploadsDir, `${slot}.xlsx`),
      path.join(localUploadsDir, `${slot}.xls`),
      path.join(localUploadsDir, `${slot}.csv`),
      path.join(zUploadsDir, `${slot}.xlsx`),
      path.join(zUploadsDir, `${slot}.xls`),
      path.join(zUploadsDir, `${slot}.csv`)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        bankFilesToRead.push(c);
        break; // Exactly one file per slot
      }
    }
  });

  if (bankFilesToRead.length === 0) {
    const fallbackBank = [
      path.join(hUploadsDir, 'aba_statement.xlsx'),
      path.join(hUploadsDir, 'aba_statement.xls'),
      path.join(localUploadsDir, 'aba_statement.xlsx'),
      path.join(localUploadsDir, 'aba_statement.xls'),
      path.join(zUploadsDir, 'aba_statement.xlsx'),
      path.join(zUploadsDir, 'aba_statement.xls')
    ];
    for (const c of fallbackBank) {
      if (fs.existsSync(c)) {
        bankFilesToRead.push(c);
        break;
      }
    }
  }

  const unmatched: any[] = [];
  for (const abaFile of bankFilesToRead) {
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

        // 1. Resolve date
        let dateRes = dateCol !== -1 ? parseDateRobust(r[dateCol]) : { dateObj: null, dateStr: '', dmyStr: '', shortStr: '' };
        if (!dateRes.dateObj) {
          // Check first 5 cells for shifted column (e.g. row 60 shifted to col 1)
          for (let c = 0; c < Math.min(r.length, 5); c++) {
            const trial = parseDateRobust(r[c]);
            if (trial.dateObj) { dateRes = trial; break; }
          }
        }
        if (!dateRes.dateObj) continue;

        // 2. Resolve description
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

        // 3. Resolve credit / payment amount
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

        // 4. Resolve reference
        let refVal = refCol !== -1 ? String(r[refCol] || '').trim() : '';
        if (!refVal) {
          const mTrx = text.match(/(?:trx\.?\s*id|ref#?|ft#?)\s*[:#\s]*([a-z0-9_-]+)/i);
          if (mTrx) refVal = mTrx[1];
        }

        // 5. Match customer from accMap or existing doctors
        const txAcc = extractAbaAccount(text);
        const cleanTextDigits = text.replace(/\D/g, '');
        let hitDoc: DoctorStatement | null = null;

        // Match by account number in accMap
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
            if (targetId && doctorsMap[targetId]) hitDoc = doctorsMap[targetId];
            if (!hitDoc && targetCanon && doctorsMap[targetCanon]) hitDoc = doctorsMap[targetCanon];
            if (!hitDoc && targetName && doctorsMap[targetName]) hitDoc = doctorsMap[targetName];
            if (!hitDoc && targetId && targetName && doctorsMap[`${targetId} - ${targetName}`]) {
              hitDoc = doctorsMap[`${targetId} - ${targetName}`];
            }
            if (hitDoc) break;
          }
        }

        // Match by customer name in accMap
        if (!hitDoc) {
          for (const a of accMap) {
            const aName = (a.name || '').trim();
            if (aName && aName.length >= 4 && text.toLowerCase().includes(aName.toLowerCase())) {
              const targetId = (a.customerId || a.entry || '').toUpperCase();
              const targetCanon = getCanonicalCustomerName(targetId, aName);
              if (targetId && doctorsMap[targetId]) hitDoc = doctorsMap[targetId];
              if (!hitDoc && targetCanon && doctorsMap[targetCanon]) hitDoc = doctorsMap[targetCanon];
              if (!hitDoc && doctorsMap[aName]) hitDoc = doctorsMap[aName];
              if (!hitDoc && targetId && doctorsMap[`${targetId} - ${aName}`]) {
                hitDoc = doctorsMap[`${targetId} - ${aName}`];
              }
              if (hitDoc) break;
            }
          }
        }

        // Match by doctor order list
        if (!hitDoc) {
          for (const dName of doctorOrder) {
            const D = doctorsMap[dName];
            if (!D) continue;
            const cId = D.customerId;
            if (cId && text.toUpperCase().includes(cId)) { hitDoc = D; break; }
            const cleanDName = dName.replace(/^[A-Z]\d+\s*[-–]\s*/i, '').trim();
            if (cleanDName.length >= 4 && text.toLowerCase().includes(cleanDName.toLowerCase())) {
              hitDoc = D;
              break;
            }
          }
        }

        // Auto-create customer entry if accMap has record but doctor had no debt row
        if (!hitDoc) {
          for (const a of accMap) {
            const accList: string[] = (a.accounts && a.accounts.length)
              ? a.accounts
              : [String(a.acct || a.bankAcc || a.rawAcct || '').replace(/\D/g, '')];
            const matchAcc = accList.some(cleanA => cleanA && cleanA.length >= 5 && cleanTextDigits.includes(cleanA));
            const aName = (a.name || '').trim();
            const aId = (a.customerId || a.entry || '').toUpperCase();
            const hasMatch = matchAcc ||
                             (aName && aName.length >= 4 && text.toLowerCase().includes(aName.toLowerCase())) ||
                             (aId && aId.length >= 4 && text.toUpperCase().includes(aId));
            if (hasMatch) {
              const newKey = getCanonicalCustomerName(aId, aName || aId);
              if (!doctorsMap[newKey] && !(aId && doctorsMap[aId])) {
                const newDoc: DoctorStatement = {
                  id: newKey,
                  name: newKey,
                  customerId: aId,
                  entry: aId,
                  meta: {
                    custNo: aId,
                    custKh: aName,
                    custEn: aName,
                    phone: '',
                    address: '',
                    currency: 'USD'
                  },
                  owed: 0,
                  paidTotal: 0,
                  paidBeforeTotal: 0,
                  paidCurrent: 0,
                  rem: 0,
                  extra: 0,
                  status: 'No Debt',
                  statusKh: 'គ្មានបំណុល',
                  invoices: [],
                  inv: [],
                  payments: [],
                  pay: []
                };
                doctorsMap[newKey] = newDoc;
                if (aId) doctorsMap[aId] = newDoc;
                doctorOrder.push(newKey);
              }
              hitDoc = doctorsMap[newKey] || (aId ? doctorsMap[aId] : null);
              break;
            }
          }
        }

        if (hitDoc) {
          hitDoc.payments.push({
            date: dateRes.dmyStr,
            amt: crVal,
            text,
            ref: refVal
          });
        } else {
          unmatched.push({
            id: i,
            date: dateRes.dmyStr,
            amt: crVal,
            text,
            acc: txAcc
          });
        }
      }
    } catch (err) {
      console.warn('Error reading ABA statement on server:', err);
    }
  }

  // 2.5. Read accounts.xlsx for OR/JV payments and accounts mapping
  const accCandidates = [
    path.join('H:\\', 'InvoiceAI', 'data', 'aba', 'accounts.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'data', 'aba', 'accounts.xls'),
    path.join(dataDir, 'accounts.xlsx'),
    path.join(dataDir, 'accounts.xls'),
    path.join(dataDir, 'Account id aba.xlsx')
  ];
  let accFile = '';
  for (const c of accCandidates) {
    if (fs.existsSync(c)) { accFile = c; break; }
  }

  if (accFile) {
    try {
      const wb = xlsx.readFile(accFile);
      const s1Name = wb.SheetNames.find((s: string) => s.toUpperCase() === 'SHEET1') || wb.SheetNames[0];
      const s2Name = wb.SheetNames.find((s: string) => s.toUpperCase() === 'SHEET2') || wb.SheetNames[1];

      if (s1Name && s2Name) {
        const rowsS1: any[] = xlsx.utils.sheet_to_json(wb.Sheets[s1Name]);
        const rowsS2: any[] = xlsx.utils.sheet_to_json(wb.Sheets[s2Name]);

        const orMap: Record<string, { custId: string; date: string; entryNo: string }> = {};
        rowsS1.forEach(r => {
          const entryNo = String(r['Entry No'] || '').trim();
          const custId = String(r['Customer ID'] || '').trim().toUpperCase();
          const dVal = String(r['Date (dd-MMM-YYYY)'] || r['Date'] || '').trim();
          if (entryNo && custId) {
            orMap[entryNo] = { custId, date: dVal, entryNo };
          }
        });

        rowsS2.forEach(r => {
          const entryNo = String(r['Entry No'] || '').trim();
          const invNo = String(r['Invoice No/Account ID'] || r['Invoice No'] || '').trim();
          const paidAmt = parseFloat(String(r['Receive to Cash Acc./Amount'] || r['Amount'] || '').replace(/[^0-9.-]/g, '')) || 0;
          const desc = String(r['Description'] || '').trim();
          const orInfo = orMap[entryNo];

          if (orInfo && orInfo.custId && paidAmt > 0) {
            let hitDoc = doctorsMap[orInfo.custId];
            if (!hitDoc) {
              for (const name of doctorOrder) {
                if (doctorsMap[name] && doctorsMap[name].customerId === orInfo.custId) {
                  hitDoc = doctorsMap[name];
                  break;
                }
              }
            }
            if (hitDoc) {
              hitDoc.payments.push({
                date: orInfo.date,
                amt: paidAmt,
                text: `${entryNo} (${invNo}): ${desc || 'Payment in OR'}`
              });
            }
          }
        });
      }
    } catch (err) {
      console.warn('Error reading accounts.xlsx on server:', err);
    }
  }

  // 3. Reconcile invoices and calculate totals for each doctor
  let totalOwed = 0;
  let totalPaid = 0;
  let totalRem = 0;
  let tgSentCount = 0;
  let tgNotSentCount = 0;

  const resultDoctors: DoctorStatement[] = [];

  for (const dName of doctorOrder) {
    const D = doctorsMap[dName];
    if (!D) continue;

    // Running balance computation
    let running = 0;
    D.invoices.forEach((v, idx) => {
      v.no = idx + 1;
      running += v.amt;
      v.runBal = Math.round(running * 100) / 100;
    });

    // Allocate payment: smart matching against newest invoices first (វិក័យបត្រថ្មីៗ)
    let availablePay = D.payments.reduce((s, p) => s + p.amt, 0);
    D.owed = D.invoices.reduce((s, v) => s + v.amt, 0);

    // Initialize all invoices as unpaid
    D.invoices.forEach(v => {
      v.paidBefore = 0;
      v.paidNow = 0;
      v.remaining = v.amt;
      v.pp = 0;
      v.pb = 0;
      v.rem = v.amt;
      v.status = 'Unpaid';
      v.statusKh = 'មិនទាន់សង';
    });

    // Step 1: Exact amount matching against newest invoices first
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

    // Step 2: Allocate remaining available payment to newest unpaid invoices
    if (availablePay > 0.005) {
      sortedInvsDesc.forEach(v => {
        if (availablePay <= 0.005) return;
        if (v.remaining > 0.005) {
          const alloc = Math.min(v.remaining, availablePay);
          v.paidNow = Math.round((v.paidNow + alloc) * 100) / 100;
          v.pp = v.paidNow;
          v.remaining = Math.max(0, Math.round((v.amt - v.paidNow) * 100) / 100);
          v.rem = v.remaining;
          const isFull = v.remaining <= 0.005;
          v.status = isFull ? 'Fully Paid' : 'Partially Paid';
          v.statusKh = isFull ? 'សងគ្រប់' : 'សងមួយផ្នែក';
          availablePay = Math.max(0, Math.round((availablePay - alloc) * 100) / 100);
        }
      });
    }

    // Sort invoices inside doctor: paid invoices first
    D.invoices.sort((a, b) => {
      const pa = (a.paidNow > 0 || a.remaining <= 0.005) ? 0 : 1;
      const pb = (b.paidNow > 0 || b.remaining <= 0.005) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.no || 0) - (b.no || 0);
    });

    D.paidCurrent = D.invoices.reduce((s, v) => s + v.paidNow, 0);
    D.paidTotal = D.paidCurrent;
    D.paidBeforeTotal = 0;
    D.extra = Math.max(0, Math.round(availablePay * 100) / 100);
    D.rem = Math.max(0, Math.round((D.owed - D.paidTotal) * 100) / 100);

    D.inv = D.invoices;
    D.pay = D.payments;
    (D as any).before = 0;
    (D as any).per = D.payments.reduce((s, p) => s + p.amt, 0);
    let maxServerPayDate: string | null = null;
    let maxDateMs = 0;
    D.payments.forEach(p => {
      const pD = parseDateRobust(p.date).dateObj;
      if (pD && pD.getTime() > maxDateMs) {
        maxDateMs = pD.getTime();
        maxServerPayDate = parseDateRobust(p.date).dmyStr;
      }
    });
    (D as any).lastD = maxServerPayDate;
    (D as any).lastPaymentDate = maxServerPayDate;

    const fullDoc = D.owed > 0 && D.rem <= 0.005;
    const partialDoc = D.owed > 0 && D.paidTotal > 0.005 && D.rem > 0.005;
    const unpaidDoc = D.owed > 0 && D.paidTotal <= 0.005;

    if (fullDoc) {
      D.status = 'Fully Paid';
      D.statusKh = 'សងគ្រប់';
    } else if (partialDoc) {
      D.status = 'Partially Paid';
      D.statusKh = 'សងមួយផ្នែក';
    } else if (unpaidDoc) {
      D.status = 'Unpaid';
      D.statusKh = 'មិនទាន់សង';
    } else if (D.owed === 0 && D.payments.length > 0) {
      D.status = 'Advance Payment';
      D.statusKh = 'ទូទាត់មុន';
    } else {
      D.status = 'No Debt';
      D.statusKh = 'គ្មានបំណុល';
    }

    // Sort invoices inside doctor: paid invoices first (សងគ្រប់/សងខ្លះ នៅខាងលើ)
    D.invoices.sort((a, b) => {
      const aPaid = (a.paidNow > 0 || a.remaining <= 0.005) ? 1 : 0;
      const bPaid = (b.paidNow > 0 || b.remaining <= 0.005) ? 1 : 0;
      if (aPaid !== bPaid) return bPaid - aPaid;
      return a.no - b.no;
    });

    if (D.tgSent) tgSentCount++;
    else tgNotSentCount++;

    totalOwed += D.owed;
    totalPaid += D.paidTotal;
    totalRem += D.rem;

    resultDoctors.push(D);
  }

  // SORT DOCTORS: Fully Paid (សងគ្រប់) FIRST (ខាងលើគេ), then Partially Paid (សងមួយផ្នែក), then Unpaid (មិនទាន់សង)
  resultDoctors.sort((a, b) => {
    const rank = (d: DoctorStatement) => {
      if (d.rem <= 0.005 && d.paidTotal > 0) return 0; // សងគ្រប់ (Fully Paid)
      if (d.paidTotal > 0) return 1;                   // សងមួយផ្នែក (Partially Paid)
      return 2;                                        // មិនទាន់សង (Unpaid)
    };
    const rA = rank(a);
    const rB = rank(b);
    if (rA !== rB) return rA - rB;
    if (rA < 2 && b.paidTotal !== a.paidTotal) {
      return b.paidTotal - a.paidTotal; // Higher paid amount first
    }
    return 0; // Keep code order within same group
  });

  // Compute bank & debt slots existence (strictly from uploads folders)
  const bankSlotsMeta: Record<string, { exists: boolean; name: string }> = {
    khema_aba: { exists: false, name: '' },
    khema_acleda: { exists: false, name: '' },
    rms_aba: { exists: false, name: '' },
    rms_acleda: { exists: false, name: '' }
  };
  ['khema_aba', 'khema_acleda', 'rms_aba', 'rms_acleda'].forEach(k => {
    const candidates = [
      path.join(hUploadsDir, `${k}.xlsx`),
      path.join(hUploadsDir, `${k}.xls`),
      path.join(hUploadsDir, `${k}.csv`),
      path.join(localUploadsDir, `${k}.xlsx`),
      path.join(localUploadsDir, `${k}.xls`),
      path.join(localUploadsDir, `${k}.csv`)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        bankSlotsMeta[k] = { exists: true, name: path.basename(c) };
        break;
      }
    }
  });

  const debtSlotsMeta: Record<string, { exists: boolean; name: string }> = {
    khema: { exists: false, name: '' },
    rms: { exists: false, name: '' },
    newsmile: { exists: false, name: '' }
  };
  ['khema', 'rms', 'newsmile'].forEach(k => {
    const candidates = [
      path.join(hUploadsDir, `${k}_debt.xlsx`),
      path.join(hUploadsDir, `${k}_debt.xls`),
      path.join(localUploadsDir, `${k}_debt.xlsx`),
      path.join(localUploadsDir, `${k}_debt.xls`)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        debtSlotsMeta[k] = { exists: true, name: path.basename(c) };
        break;
      }
    }
  });

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
      aba: bankFilesToRead.length ? bankFilesToRead.map(f => path.basename(f)).join(', ') : '',
      debt: debtFilesToRead.length ? debtFilesToRead.map(f => path.basename(f)).join(', ') : '',
      acc: accFile ? path.basename(accFile) : (fs.existsSync(path.join(dataDir, 'customers.xls')) ? 'customers.xls' : '')
    },
    bankSlots: bankSlotsMeta,
    debtSlots: debtSlotsMeta,
    doctors: resultDoctors,
    unmatched,
    updatedAt: new Date().toISOString()
  };

  writeJsonFile('state.json', finalState);
  return finalState;
}

export function getAbaState(): AbaState {
  const cached = readJsonFile<AbaState | null>('state.json', null);
  if (cached) {
    if (cached.doctors && cached.doctors.length > 0) {
      // Invalidate stale cache containing old test name Ong Mach
      const hasOngMach = cached.doctors.some(d =>
        (d.name && d.name.toLowerCase().includes('ong mach')) ||
        (d.customerId === 'C00168' && !d.name.includes('Eng Hong'))
      );
      if (!hasOngMach) {
        return cached;
      }
      console.log('Invalidating stale cache containing old test name Ong Mach');
    } else {
      // Cached state exists (e.g. clean state after reset). Return it with stable timestamp to prevent continuous client re-sync
      return cached;
    }
  }
  const fresh = computeAbaReconciliation();
  writeJsonFile('state.json', fresh);
  return fresh;
}

// Auto-sync files between network drive (H:\InvoiceAI\data\aba) and local dataDir
export function syncFromNetworkDriveIfNeeded(): void {
  ensureDataDir();
  const netDirs = getNetworkDriveAbaDirs();
  if (!netDirs || !netDirs.length) return;

  const keyFiles = [
    'aba_statement.xlsx',
    'aba_statement.xls',
    'debts.xls',
    'debts.xlsx',
    'accounts.xlsx',
    'accounts.xls',
    'Account id aba.xlsx',
    'customers.xls',
    'customers.xlsx',
    'state.json',
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
  // Also maintain generic name for backwards compatibility
  if (fileType === 'debt' && targetName !== `debts${ext}`) {
    try { fs.writeFileSync(path.join(uploadsDir, `debts${ext}`), buffer); } catch {}
  } else if (fileType === 'aba' && targetName !== `aba_statement${ext}`) {
    try { fs.writeFileSync(path.join(uploadsDir, `aba_statement${ext}`), buffer); } catch {}
  }

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
    } else {
      targetFiles = [
        'debts.xls', 'debts.xlsx', 'Aged_Receivable.xls', 'Aged_Receivable.xlsx',
        'khema_debt.xlsx', 'khema_debt.xls', 'rms_debt.xlsx', 'rms_debt.xls',
        'newsmile_debt.xlsx', 'newsmile_debt.xls'
      ];
    }
  } else if (fileType === 'acc') {
    targetFiles = ['accounts.xlsx', 'accounts.xls', 'Account id aba.xlsx', 'customers.xls', 'customers.xlsx'];
  }

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

  return { success: true, count: list.length, fileLocked: anyFileLocked };
}

