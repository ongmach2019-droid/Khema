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

// Read JSON helper
function readJsonFile<T>(filename: string, defaultVal: T): T {
  ensureDataDir();
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) return defaultVal;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

// Write JSON helper
function writeJsonFile(filename: string, data: any) {
  ensureDataDir();
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    if (fs.existsSync('Z:\\')) {
      const zDir = path.join('Z:\\', 'InvoiceAI', 'data', 'aba');
      if (!fs.existsSync(zDir)) fs.mkdirSync(zDir, { recursive: true });
      fs.writeFileSync(path.join(zDir, filename), JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {}
}

// Extract parenthesized ABA account number like (000 428 736)
export function extractAbaAccount(text: string): string {
  if (!text) return '';
  const m = text.match(/\(\s*(\d{3}[\s\-_]?\d{3}[\s\-_]?\d{3})\s*\)/);
  if (m) return m[1].replace(/\D/g, '');
  const m2 = text.match(/\b(\d{3}[\s\-_]\d{3}[\s\-_]\d{3})\b/);
  if (m2) return m2[1].replace(/\D/g, '');
  return '';
}

// Parse customer profiles from customers.xls or customers.xlsx
export function parseCustomerProfiles(): Record<string, any> {
  const profiles: Record<string, any> = {};
  const candidates = ['customers.xls', 'customers.xlsx', 'Customer_List.xls', 'Customer_List.xlsx'];
  let foundFile = '';
  for (const c of candidates) {
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
    path.join(dataDir, 'Account id aba.xlsx'),
    path.join(process.cwd(), 'Account id aba.xlsx'),
    path.join(dataDir, 'accounts.xlsx'),
    path.join(dataDir, 'accounts.xls')
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
          const acct = rawAcc.replace(/\D/g, '');
          if (entry || name || acct) {
            const existing = list.find(x => (entry && x.entry === entry) || (name && x.name && x.name.toLowerCase() === name.toLowerCase()));
            if (existing) {
              if (name) existing.name = name;
              if (acct) existing.acct = acct;
              if (rawAcc) existing.rawAcct = rawAcc;
            } else {
              list.push({ entry, customerId: entry, name, acct, rawAcct: rawAcc });
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
  const debtCandidates = ['debts.xls', 'debts.xlsx', 'Aged_Receivable.xls', 'Aged_Receivable.xlsx'];
  let debtFile = '';
  for (const c of debtCandidates) {
    const p = path.join(dataDir, c);
    if (fs.existsSync(p)) { debtFile = p; break; }
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
  const abaCandidates = ['aba_statement.xlsx', 'aba_statement.xls', 'aba.xlsx', 'aba.xls', 'aba.csv'];
  let abaFile = '';
  for (const c of abaCandidates) {
    const p = path.join(dataDir, c);
    if (fs.existsSync(p)) { abaFile = p; break; }
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

      for (let i = 0; i < Math.min(25, aoa.length); i++) {
        const row = aoa[i] || [];
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').toLowerCase();
          if (val.includes('date') || val.includes('កាលបរិច្ឆេទ')) dateCol = c;
          if (val.includes('description') || val.includes('narrative') || val.includes('remark') || val.includes('detail')) textCol = c;
          if (val.includes('credit') || val.includes('money in') || val.includes('amount') || val.includes('cr')) crCol = c;
        }
        if (dateCol !== -1 && (crCol !== -1 || textCol !== -1)) {
          hdrIdx = i;
          break;
        }
      }

      const startRow = hdrIdx !== -1 ? hdrIdx + 1 : 1;
      for (let i = startRow; i < aoa.length; i++) {
        const r = aoa[i] || [];
        const text = r.map(x => String(x || '')).join(' ');
        const crVal = parseFloat(String(crCol !== -1 ? r[crCol] : r[3] || '').replace(/[^0-9.\-]/g, '')) || 0;
        const dateVal = String(dateCol !== -1 ? r[dateCol] : r[0] || '').trim();

        if (crVal <= 0 || !text.trim()) continue;

        // Match ABA transaction
        const txAcc = extractAbaAccount(text);
        let hitDoc: DoctorStatement | null = null;

        if (txAcc) {
          const matchedAcc = accMap.find(a => {
            const cleanA = String(a.acct || a.bankAcc || a.rawAcct || '').replace(/\D/g, '');
            return cleanA && cleanA === txAcc;
          });
          if (matchedAcc) {
            const targetId = (matchedAcc.customerId || matchedAcc.entry || '').toUpperCase();
            const targetName = (matchedAcc.name || '').trim();
            if (targetId && doctorsMap[targetId]) hitDoc = doctorsMap[targetId];
            if (!hitDoc && targetName && doctorsMap[targetName]) hitDoc = doctorsMap[targetName];
            if (!hitDoc && targetId && targetName && doctorsMap[`${targetId} - ${targetName}`]) {
              hitDoc = doctorsMap[`${targetId} - ${targetName}`];
            }
          }
        }

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

        if (hitDoc) {
          hitDoc.payments.push({
            date: dateVal,
            amt: crVal,
            text
          });
        } else {
          unmatched.push({
            id: i,
            date: dateVal,
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
  const accCandidates = ['accounts.xlsx', 'accounts.xls'];
  let accFile = '';
  for (const c of accCandidates) {
    const p = path.join(dataDir, c);
    if (fs.existsSync(p)) { accFile = p; break; }
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

    // Allocate payment
    let availablePay = D.payments.reduce((s, p) => s + p.amt, 0);
    D.owed = D.invoices.reduce((s, v) => s + v.amt, 0);

    D.invoices.forEach(v => {
      v.paidBefore = 0;
      const alloc = Math.min(v.amt, availablePay);
      v.paidNow = Math.round(alloc * 100) / 100;
      availablePay -= alloc;
      v.remaining = Math.max(0, Math.round((v.amt - v.paidNow) * 100) / 100);

      const isFull = v.remaining <= 0.005;
      const isPart = v.paidNow > 0 || v.status === 'Partially Paid';
      v.status = isFull ? 'Fully Paid' : (isPart ? 'Partially Paid' : 'Unpaid');
      v.statusKh = isFull ? 'សងគ្រប់' : (isPart ? 'សងមួយផ្នែក' : 'មិនទាន់សង');

      v.pp = v.paidNow;
      v.pb = v.paidBefore;
      v.rem = v.remaining;
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
    return cached;
  }
  return computeAbaReconciliation();
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

  // 4. Also mirror directly to Z:\ drive if available (e.g. \\192.168.1.7\Public\InvoiceAI)
  try {
    if (fs.existsSync('Z:\\')) {
      const zBase = path.join('Z:\\', 'InvoiceAI', 'data', 'aba');
      const zUploads = path.join(zBase, 'uploads');
      if (!fs.existsSync(zUploads)) fs.mkdirSync(zUploads, { recursive: true });
      fs.writeFileSync(path.join(zBase, targetName), buffer);
      fs.writeFileSync(path.join(zUploads, backupFileName), buffer);
      fs.writeFileSync(path.join(zBase, 'uploads_history.json'), JSON.stringify(history, null, 2), 'utf-8');
      console.log(`✓ Synchronized upload file to Z: drive (${targetName}, ${backupFileName})`);
    }
  } catch (zErr) {
    console.warn('Could not mirror file to Z: drive:', zErr);
  }

  // Recompute and return state
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

// Reset state
export function resetAbaState(): AbaState {
  ensureDataDir();
  const files = ['aba_statement.xlsx', 'aba_statement.xls', 'debts.xls', 'debts.xlsx', 'state.json'];
  files.forEach(f => {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
    try {
      if (fs.existsSync('Z:\\')) {
        const zp = path.join('Z:\\', 'InvoiceAI', 'data', 'aba', f);
        if (fs.existsSync(zp)) { try { fs.unlinkSync(zp); } catch {} }
      }
    } catch {}
  });
  return computeAbaReconciliation();
}
