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
  status: 'Fully Paid' | 'Partially Paid' | 'Unpaid';
  statusKh: 'សងគ្រប់' | 'សងមួយផ្នែក' | 'មិនទាន់សង';
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
  const candidateDrives = ['H:\\', 'Z:\\'];
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
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {}
  }
  // Check network drive if local is missing
  const netDirs = getNetworkDriveAbaDirs();
  for (const dir of netDirs) {
    try {
      const zp = path.join(dir, filename);
      if (fs.existsSync(zp)) {
        const raw = fs.readFileSync(zp, 'utf-8');
        const parsed = JSON.parse(raw);
        try { fs.writeFileSync(filePath, raw, 'utf-8'); } catch {}
        return parsed;
      }
    } catch {}
  }
  return defaultVal;
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

// Parse customer profiles from customers.xls or customers.xlsx
export function parseCustomerProfiles(): Record<string, any> {
  const profiles: Record<string, any> = {};
  const candidates = ['customers.xls', 'customers.xlsx', 'Customer_List.xls', 'Customer_List.xlsx'];
  let foundFile = '';
  for (const c of candidates) {
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
        profiles[code] = {
          code,
          nameEn: String(r[2] || '').trim(),
          nameKh: String(r[3] || '').trim(),
          phone: String(r[6] || r[4] || '').trim(),
          address: String(r[9] || '').trim(),
          currency: String(r[10] || 'USD').trim()
        };
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
    { entry: 'C00168', customerId: 'C00168', name: 'Ong Mach', acct: '000428736', rawAcct: '000 428 736' },
    { entry: 'C00007', customerId: 'C00007', name: 'Aesthetic Dental Clinic', acct: '000111222', rawAcct: '000 111 222' }
  ]);

  const accCandidates = [
    path.join('H:\\', 'InvoiceAI', 'Account id aba.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'accounts.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'accounts.xls'),
    path.join('Z:\\', 'InvoiceAI', 'Account id aba.xlsx'),
    path.join('Z:\\', 'InvoiceAI', 'accounts.xlsx'),
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
          const entry = String(r['Entry No'] || r['Entry'] || r['Code'] || '').trim();
          const name = String(r['Name'] || r['Customer Name'] || '').trim();
          const rawAcc = String(r['accound aba'] || r['account aba'] || r['aba account'] || '').trim();
          
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
  return readJsonFile<any[]>('tg_directory.json', [
    { id: 'C00168', name: 'Ong Mach', tg: '@ongmach', phone: '0975973959' },
    { id: 'C00007', name: 'Aesthetic Dental Clinic', tg: '727477829', phone: '077 731 777' }
  ]);
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

  // 1. Read debts
  const debtCandidates = [
    path.join('H:\\', 'InvoiceAI', 'debts.xls'),
    path.join('H:\\', 'InvoiceAI', 'debts.xlsx'),
    path.join('Z:\\', 'InvoiceAI', 'debts.xls'),
    path.join('Z:\\', 'InvoiceAI', 'debts.xlsx'),
    path.join(dataDir, 'debts.xls'),
    path.join(dataDir, 'debts.xlsx'),
    path.join(dataDir, 'Aged_Receivable.xls'),
    path.join(dataDir, 'Aged_Receivable.xlsx')
  ];
  let debtFile = '';
  for (const c of debtCandidates) {
    if (fs.existsSync(c)) { debtFile = c; break; }
  }

  const doctorsMap: Record<string, DoctorStatement> = {};
  const doctorOrder: string[] = [];

  if (debtFile) {
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

          // Check if mapped to a custom name (e.g. Ong Mach)
          const matchedAcc = accMap.find(a => 
            (custId && a.customerId && a.customerId.toUpperCase() === custId) ||
            (custId && a.entry && a.entry.toUpperCase() === custId)
          );
          let displayName = rawName;
          if (matchedAcc && matchedAcc.name) {
            displayName = custId ? `${custId} - ${matchedAcc.name}` : matchedAcc.name;
          }

          currentDoc = {
            id: custId || rawName,
            name: displayName,
            customerId: custId,
            entry: custId,
            meta: {
              custNo: custId,
              custKh: prof.nameKh || (matchedAcc?.name || rawName.replace(/^[A-Z]\d+\s*[-–]\s*/i, '')),
              custEn: prof.nameEn || (matchedAcc?.name || rawName.replace(/^[A-Z]\d+\s*[-–]\s*/i, '')),
              phone: prof.phone || '',
              address: prof.address || '',
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

  // 2. Read ABA statements
  const abaCandidates = [
    path.join('H:\\', 'InvoiceAI', 'aba_statement.xlsx'),
    path.join('H:\\', 'InvoiceAI', 'aba_statement.xls'),
    path.join('Z:\\', 'InvoiceAI', 'aba_statement.xlsx'),
    path.join('Z:\\', 'InvoiceAI', 'aba_statement.xls'),
    path.join(dataDir, 'aba_statement.xlsx'),
    path.join(dataDir, 'aba_statement.xls'),
    path.join(dataDir, 'aba.xlsx'),
    path.join(dataDir, 'aba.xls'),
    path.join(dataDir, 'aba.csv')
  ];
  let abaFile = '';
  for (const c of abaCandidates) {
    if (fs.existsSync(c)) { abaFile = c; break; }
  }

  const unmatched: any[] = [];
  if (abaFile) {
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
            if (targetId && doctorsMap[targetId]) hitDoc = doctorsMap[targetId];
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
              if (targetId && doctorsMap[targetId]) hitDoc = doctorsMap[targetId];
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
              const newKey = aId && aName ? `${aId} - ${aName}` : (aName || aId);
              if (!doctorsMap[newKey]) {
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
                  status: 'Fully Paid',
                  statusKh: 'សងគ្រប់',
                  invoices: [],
                  inv: [],
                  payments: [],
                  pay: []
                };
                doctorsMap[newKey] = newDoc;
                doctorOrder.push(newKey);
              }
              hitDoc = doctorsMap[newKey];
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

    const fullDoc = D.rem <= 0.005 && D.paidTotal > 0;
    D.status = fullDoc ? 'Fully Paid' : (D.paidTotal > 0 ? 'Partially Paid' : 'Unpaid');
    D.statusKh = fullDoc ? 'សងគ្រប់' : (D.paidTotal > 0 ? 'សងមួយផ្នែក' : 'មិនទាន់សង');

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
      aba: abaFile ? path.basename(abaFile) : '',
      debt: debtFile ? path.basename(debtFile) : '',
      acc: accFile ? path.basename(accFile) : (fs.existsSync(path.join(dataDir, 'customers.xls')) ? 'customers.xls' : '')
    },
    doctors: resultDoctors,
    unmatched,
    updatedAt: new Date().toISOString()
  };

  writeJsonFile('state.json', finalState);
  return finalState;
}

// Get current state (cached or recomputed)
export function getAbaState(): AbaState {
  const cached = readJsonFile<AbaState | null>('state.json', null);
  if (cached && cached.doctors && cached.doctors.length > 0) {
    const abaExists = !cached.fileNames?.aba || fs.existsSync(path.join(dataDir, cached.fileNames.aba));
    const debtExists = !cached.fileNames?.debt || fs.existsSync(path.join(dataDir, cached.fileNames.debt));
    if (abaExists && debtExists) {
      return cached;
    }
  }
  return computeAbaReconciliation();
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

// Save uploaded file and recompute (with archive backup in data/aba/uploads/)
export function uploadAbaFile(fileType: 'aba' | 'debt' | 'acc', fileName: string, buffer: Buffer): AbaState {
  ensureDataDir();
  const ext = path.extname(fileName) || '.xlsx';
  const cleanOriginalName = path.basename(fileName);
  let targetName = '';

  if (fileType === 'aba') {
    targetName = `aba_statement${ext}`;
  } else if (fileType === 'debt') {
    targetName = `debts${ext}`;
  } else if (fileType === 'acc') {
    const low = cleanOriginalName.toLowerCase();
    if (low.includes('customer') || low.includes('អតិថិជន') || low.includes('profile')) {
      targetName = `customers${ext}`;
    } else {
      targetName = `accounts${ext}`;
    }
  }

  // 1. Save active file in data/aba/
  fs.writeFileSync(path.join(dataDir, targetName), buffer);

  // 2. Also save permanent copy in data/aba/uploads/ for safe drive storage
  const uploadsDir = path.join(dataDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const timeStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFileName = `${timeStr}_${fileType}_${cleanOriginalName}`;
  fs.writeFileSync(path.join(uploadsDir, backupFileName), buffer);

  // 3. Record upload in history
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

  // 4. Also mirror directly to network drive (single primary folder: H:\InvoiceAI)
  try {
    const netDirs = getNetworkDriveAbaDirs();
    for (const zBase of netDirs) {
      fs.writeFileSync(path.join(zBase, targetName), buffer);
      fs.writeFileSync(path.join(zBase, 'uploads_history.json'), JSON.stringify(history, null, 2), 'utf-8');
      console.log(`✓ Synchronized upload file to network drive directly (${zBase}/${targetName})`);
    }
  } catch (zErr) {
    console.warn('Could not mirror file to network drive:', zErr);
  }

  // Recompute and return state
  return computeAbaReconciliation();
}

// Delete single file (aba, debt, or acc) on server and all network drive locations
export function deleteAbaFile(fileType: 'aba' | 'debt' | 'acc'): AbaState {
  ensureDataDir();
  let targetFiles: string[] = [];
  if (fileType === 'aba') {
    targetFiles = ['aba_statement.xlsx', 'aba_statement.xls', 'aba.xlsx', 'aba.xls', 'aba.csv'];
  } else if (fileType === 'debt') {
    targetFiles = ['debts.xls', 'debts.xlsx', 'Aged_Receivable.xls', 'Aged_Receivable.xlsx'];
  } else if (fileType === 'acc') {
    targetFiles = ['accounts.xlsx', 'accounts.xls', 'Account id aba.xlsx', 'customers.xls', 'customers.xlsx'];
  }

  const netDirs = getNetworkDriveAbaDirs();
  targetFiles.forEach(f => {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); console.log(`✓ Deleted local file ${f}`); } catch {}
    }
    netDirs.forEach(dir => {
      try {
        const zp = path.join(dir, f);
        if (fs.existsSync(zp)) {
          fs.unlinkSync(zp);
          console.log(`✓ Deleted network drive file ${zp}`);
        }
      } catch {}
    });
  });

  return computeAbaReconciliation();
}

// Mark Telegram sent
export function markAbaTelegramSent(name: string, custId?: string, target?: string): AbaState {
  ensureDataDir();
  const tgSent = parseTgSent();
  const record = {
    sentAt: new Date().toISOString(),
    target: target || 'Telegram'
  };
  if (name) tgSent[name] = record;
  if (custId) tgSent[custId] = record;
  writeJsonFile('tg_sent.json', tgSent);
  return computeAbaReconciliation();
}

// Reset state completely across local and network drives
export function resetAbaState(): AbaState {
  ensureDataDir();
  const files = [
    'aba_statement.xlsx', 'aba_statement.xls', 'aba.xlsx', 'aba.xls', 'aba.csv',
    'debts.xls', 'debts.xlsx', 'Aged_Receivable.xls', 'Aged_Receivable.xlsx',
    'accounts.xlsx', 'accounts.xls', 'Account id aba.xlsx', 'customers.xls', 'customers.xlsx',
    'state.json'
  ];
  const netDirs = getNetworkDriveAbaDirs();
  files.forEach(f => {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
    netDirs.forEach(dir => {
      try {
        const zp = path.join(dir, f);
        if (fs.existsSync(zp)) { fs.unlinkSync(zp); }
      } catch {}
    });
  });
  return computeAbaReconciliation();
}
