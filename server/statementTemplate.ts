import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
const xlsx = (XLSX as any).readFile ? XLSX : ((XLSX as any).default || XLSX);

export interface StatementTemplateConfig {
  company_name_kh: string;
  company_name_en: string;
  address_kh: string;
  address_en: string;
  telephone: string;
  statement_title_kh: string;
  statement_title_en: string;
  qr_account_name: string;
  qr_khr_account: string;
  qr_usd_rms: string;
  qr_usd_khema: string;
  sig_1_kh: string;
  sig_1_en: string;
  sig_2_kh: string;
  sig_2_en: string;
  sig_3_kh: string;
  sig_3_en: string;
  footer_offset_mm: number;
  qr_size_px: number;
  qr_margin_top_px: number;
  sourcePath?: string;
  lastModified?: string;
}

export const DEFAULT_TEMPLATE_CONFIG: StatementTemplateConfig = {
  company_name_kh: 'ខេមា ឌីជីថល ដេនថល សូលូសិន',
  company_name_en: 'Khema Digital Dental Solution',
  address_kh: 'អាសយដ្ឋាន : ៧៦៩, ស្លែងរលើង, ទឹកថ្លា, សែនសុខ, រាជធានី​ភ្នំពេញ',
  address_en: 'Address : House 769, Sleng Rolerng, Teuk Thlar, Khan Sen Sok, Phnom Penh Cambodia',
  telephone: 'Telephone : 099 744 497',
  statement_title_kh: 'របាយការណ៍អតិថិជន',
  statement_title_en: 'CUSTOMER STATEMENT',
  qr_account_name: 'SAMNANG MEUNG',
  qr_khr_account: '001 180 129',
  qr_usd_rms: '088 928 555',
  qr_usd_khema: '000 193 633',
  sig_1_kh: 'រៀបចំដោយ',
  sig_1_en: 'Prepared By',
  sig_2_kh: 'ត្រួតពិនិត្យដោយ',
  sig_2_en: 'Checked By',
  sig_3_kh: 'អតិថិជន',
  sig_3_en: 'Customer',
  footer_offset_mm: 45,
  qr_size_px: 90,
  qr_margin_top_px: 14
};

export function getTemplateTargetPaths(): { primaryPath: string; localPath: string; statementsDir: string } {
  const candidateDrives = ['H:\\', 'Z:\\', '\\\\192.168.1.7\\Finance_Accounting'];
  let primaryDir = '';
  for (const d of candidateDrives) {
    try {
      if (fs.existsSync(d)) {
        primaryDir = path.join(d, 'InvoiceAI');
        break;
      }
    } catch {}
  }
  if (!primaryDir) {
    primaryDir = 'H:\\InvoiceAI';
  }

  const localDir = path.join(process.cwd(), 'data', 'aba');
  const statementsDir = path.join(primaryDir, 'statements');

  return {
    primaryPath: path.join(primaryDir, 'statement_template.xlsx'),
    localPath: path.join(localDir, 'statement_template.xlsx'),
    statementsDir
  };
}

/**
 * Generate default statement_template.xlsx with both:
 * 1. Sheet "Invoice Template" (visual preview matching website statement)
 * 2. Sheet "Template Settings" (key-value table for easy editing in Excel)
 */
export function createDefaultStatementTemplate(force = false): { path: string; created: boolean } {
  const { primaryPath, localPath } = getTemplateTargetPaths();

  // If already exists and not forced, do nothing
  if (!force && (fs.existsSync(primaryPath) || fs.existsSync(localPath))) {
    return { path: fs.existsSync(primaryPath) ? primaryPath : localPath, created: false };
  }

  const wb = xlsx.utils.book_new();
  const cfg = DEFAULT_TEMPLATE_CONFIG;

  // --- SHEET 1: Visual Invoice Template ---
  const s1: any[][] = [
    [cfg.company_name_kh],
    [cfg.company_name_en],
    [cfg.address_kh],
    [cfg.address_en],
    [cfg.telephone],
    [],
    [cfg.statement_title_kh],
    [cfg.statement_title_en],
    [],
    ['ព័ត៌មានអតិថិជន (Customer Information)'],
    ['ឈ្មោះក្រុមហ៊ុន ឬអតិថិជន :', 'គ្លីនិកធ្មេញ គំរូ (Sample Customer)', '', '', 'លេខអតិថិជន / Customer No :', 'C001'],
    ['Company Name / Customer :', 'Sample Dental Clinic', '', '', 'ថ្ងៃ ខែ ឆ្នាំ / Date :', '31/10/2026'],
    ['ទូរស័ព្ទលេខ / Telephone :', '012 345 678', '', '', 'រូបិយប័ណ្ណ / Currency :', 'USD'],
    ['អាសយដ្ឋាន / Address :', 'ភ្នំពេញ, កម្ពុជា'],
    [],
    ['ល.រ\nNº', 'ប្រភព\nSource', 'លេខឯកសារ\nDocument No.', 'លេខយោង\nReference', 'កាលបរិច្ឆេទ\nDate', 'បរិយាយ\nDescription', 'ចំនួនទឹកប្រាក់\nAmount', 'សមតុល្យ\nRunning Balance'],
    [1, 'AR-IN', 'INV-2026-001', 'PO-101', '05/10/2026', 'Crown Zirconia Layer', 120.00, 120.00],
    [2, 'AR-IN', 'INV-2026-002', 'PO-102', '12/10/2026', 'Emax Press Inlay/Onlay', 80.00, 200.00],
    [3, 'AR-IN', 'INV-2026-003', 'PO-103', '20/10/2026', 'Implant Custom Abutment', 125.00, 325.00],
    [],
    ['', '', '', '', '', 'សមតុល្យសរុប (Total Balance):', 325.00, 325.00],
    [],
    ['ស្កេនទូទាត់ (SCAN TO PAY)', 'ឈ្មោះគណនី (Name): ' + cfg.qr_account_name, '', 'កុងប្រាក់រៀល (KHR): ' + cfg.qr_khr_account, '', 'កុងដុល្លារ RMS (USD): ' + cfg.qr_usd_rms, '', 'កុងដុល្លារ Khema (USD): ' + cfg.qr_usd_khema],
    [],
    [cfg.sig_1_kh + '\n' + cfg.sig_1_en, '', cfg.sig_2_kh + '\n' + cfg.sig_2_en, '', '', cfg.sig_3_kh + '\n' + cfg.sig_3_en, '', ''],
    [],
    ['____________________', '', '____________________', '', '', '____________________', '', '']
  ];

  const ws1 = xlsx.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [
    { wch: 10 }, // A: Nº
    { wch: 12 }, // B: Source
    { wch: 18 }, // C: Doc No
    { wch: 16 }, // D: Ref
    { wch: 14 }, // E: Date
    { wch: 42 }, // F: Description
    { wch: 15 }, // G: Amount
    { wch: 16 }  // H: Balance
  ];
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 7 } }
  ];
  xlsx.utils.book_append_sheet(wb, ws1, 'Invoice Template');

  // --- SHEET 2: Key-Value Settings for Direct User Editing ---
  const s2: any[][] = [
    ['កូដកំណត់ (Key)', 'ឈ្មោះការកំណត់ (Setting Name)', 'តម្លៃកំណត់ (Value)', 'ការពន្យល់ និងការណែនាំ (Description)'],
    ['company_name_kh', 'ឈ្មោះក្រុមហ៊ុនខ្មែរ (Khmer Moul)', cfg.company_name_kh, 'បង្ហាញនៅក្បាលវិក័យបត្រខាងលើជួរទី១'],
    ['company_name_en', 'ឈ្មោះក្រុមហ៊ុនអង់គ្លេស', cfg.company_name_en, 'បង្ហាញនៅក្បាលវិក័យបត្រខាងលើជួរទី២'],
    ['address_kh', 'អាសយដ្ឋានក្រុមហ៊ុន (ខ្មែរ)', cfg.address_kh, 'អាសយដ្ឋានក្រុមហ៊ុនជាភាសាខ្មែរ'],
    ['address_en', 'Address (English)', cfg.address_en, 'អាសយដ្ឋានក្រុមហ៊ុនជាភាសាអង់គ្លេស'],
    ['telephone', 'លេខទូរស័ព្ទក្រុមហ៊ុន', cfg.telephone, 'លេខទូរស័ព្ទទំនាក់ទំនង'],
    ['statement_title_kh', 'ចំណងជើងរបាយការណ៍ (ខ្មែរ)', cfg.statement_title_kh, 'ចំណងជើងធំកណ្ដាលទំព័រ'],
    ['statement_title_en', 'Statement Title (English)', cfg.statement_title_en, 'ចំណងជើងធំជាភាសាអង់គ្លេស'],
    ['qr_account_name', 'ឈ្មោះម្ចាស់គណនី QR', cfg.qr_account_name, 'ឈ្មោះបង្ហាញក្រោមរូប QR Code'],
    ['qr_khr_account', 'លេខគណនី KHR (ប្រាក់រៀល)', cfg.qr_khr_account, 'លេខគណនី ABA ប្រាក់រៀល'],
    ['qr_usd_rms', 'លេខគណនី USD (RMS)', cfg.qr_usd_rms, 'លេខគណនី ABA ប្រាក់ដុល្លារ ឯកសារ RMS'],
    ['qr_usd_khema', 'លេខគណនី USD (Khema)', cfg.qr_usd_khema, 'លេខគណនី ABA ប្រាក់ដុល្លារ ឯកសារ Khema'],
    ['sig_1_kh', 'ហត្ថលេខាទី១ (ខ្មែរ)', cfg.sig_1_kh, 'ឈ្មោះហត្ថលេខាខាងឆ្វេង'],
    ['sig_1_en', 'Signature 1 (English)', cfg.sig_1_en, 'ឈ្មោះហត្ថលេខាខាងឆ្វេងជាភាសាអង់គ្លេស'],
    ['sig_2_kh', 'ហត្ថលេខាទី២ (ខ្មែរ)', cfg.sig_2_kh, 'ឈ្មោះហត្ថលេខាកណ្ដាល'],
    ['sig_2_en', 'Signature 2 (English)', cfg.sig_2_en, 'ឈ្មោះហត្ថលេខាកណ្ដាលជាភាសាអង់គ្លេស'],
    ['sig_3_kh', 'ហត្ថលេខាទី៣ (ខ្មែរ)', cfg.sig_3_kh, 'ឈ្មោះហត្ថលេខាខាងស្ដាំ'],
    ['sig_3_en', 'Signature 3 (English)', cfg.sig_3_en, 'ឈ្មោះហត្ថលេខាខាងស្ដាំជាភាសាអង់គ្លេស'],
    ['footer_offset_mm', 'គម្លាតរំកិលហត្ថលេខា (mm)', cfg.footer_offset_mm, 'ចំនួនរំកិលហត្ថលេខាចុះក្រោម (លំនាំដើម 45mm)'],
    ['qr_size_px', 'ទំហំ QR Code (px)', cfg.qr_size_px, 'ទំហំបណ្ដោយ និងទទឹងរបស់រូប QR (លំនាំដើម 90px)'],
    ['qr_margin_top_px', 'គម្លាត QR ខាងលើ (px)', cfg.qr_margin_top_px, 'គម្លាតរំកិល QR ចុះក្រោម (លំនាំដើម 14px)']
  ];

  const ws2 = xlsx.utils.aoa_to_sheet(s2);
  ws2['!cols'] = [
    { wch: 22 }, // Key
    { wch: 32 }, // Name
    { wch: 55 }, // Value
    { wch: 45 }  // Description
  ];
  xlsx.utils.book_append_sheet(wb, ws2, 'Template Settings');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Save to primary location (Drive H)
  try {
    const primaryDir = path.dirname(primaryPath);
    if (!fs.existsSync(primaryDir)) fs.mkdirSync(primaryDir, { recursive: true });
    fs.writeFileSync(primaryPath, buf);
    console.log('✓ Created statement template in Drive H at:', primaryPath);
  } catch (err) {
    console.warn('Could not write template to primary path:', primaryPath, err);
  }

  // Save to local backup location
  try {
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(localPath, buf);
    console.log('✓ Created statement template in local backup at:', localPath);
  } catch (err) {
    console.warn('Could not write template to local path:', localPath, err);
  }

  const chosenPath = fs.existsSync(primaryPath) ? primaryPath : localPath;
  return { path: chosenPath, created: true };
}

/**
 * Read and parse statement_template.xlsx from Drive H (or local backup).
 * Merges values from Sheet 2 ("Template Settings") and Sheet 1 ("Invoice Template").
 */
export function readStatementTemplate(): StatementTemplateConfig {
  const { primaryPath, localPath } = getTemplateTargetPaths();
  let filePath = '';
  if (fs.existsSync(primaryPath)) filePath = primaryPath;
  else if (fs.existsSync(localPath)) filePath = localPath;
  else {
    const initRes = createDefaultStatementTemplate(true);
    filePath = initRes.path;
  }

  const result: StatementTemplateConfig = Object.assign({}, DEFAULT_TEMPLATE_CONFIG, {
    sourcePath: filePath,
    lastModified: fs.existsSync(filePath) ? fs.statSync(filePath).mtime.toISOString() : new Date().toISOString()
  });

  try {
    const wb = xlsx.readFile(filePath);

    // 1. Read Sheet "Template Settings" if exists
    const s2Name = wb.SheetNames.find(n => /setting/i.test(n) || /កំណត់/i.test(n));
    if (s2Name) {
      const rows: any[][] = xlsx.utils.sheet_to_json(wb.Sheets[s2Name], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const key = String(row[0]).trim();
        const val = row[2] != null ? String(row[2]).trim() : '';
        if (key in result && val !== '') {
          if (key === 'footer_offset_mm' || key === 'qr_size_px' || key === 'qr_margin_top_px') {
            const num = parseFloat(val);
            if (!isNaN(num)) (result as any)[key] = num;
          } else {
            (result as any)[key] = val;
          }
        }
      }
    }

    // 2. Also check Sheet 1 "Invoice Template" for direct cell edits by user
    const s1Name = wb.SheetNames[0];
    if (s1Name) {
      const ws = wb.Sheets[s1Name];
      const getVal = (cell: string) => (ws[cell] && ws[cell].v != null ? String(ws[cell].v).trim() : '');

      const h1 = getVal('A1'); // Company Name Kh
      const h2 = getVal('A2'); // Company Name En
      const h3 = getVal('A3'); // Address Kh
      const h4 = getVal('A4'); // Address En
      const h5 = getVal('A5'); // Telephone
      const titleKh = getVal('A7'); // Statement title Kh
      const titleEn = getVal('A8'); // Statement title En

      if (h1 && !s2Name) result.company_name_kh = h1;
      if (h2 && !s2Name) result.company_name_en = h2;
      if (h3 && !s2Name) result.address_kh = h3;
      if (h4 && !s2Name) result.address_en = h4;
      if (h5 && !s2Name) result.telephone = h5;
      if (titleKh && !s2Name) result.statement_title_kh = titleKh;
      if (titleEn && !s2Name) result.statement_title_en = titleEn;
    }
  } catch (err) {
    console.warn('Error reading statement template from', filePath, err);
  }

  return result;
}

/**
 * Save updated template settings back to statement_template.xlsx in Drive H
 */
export function updateStatementTemplate(newConfig: Partial<StatementTemplateConfig>): StatementTemplateConfig {
  const current = readStatementTemplate();
  const merged: StatementTemplateConfig = Object.assign({}, current, newConfig);

  const { primaryPath, localPath } = getTemplateTargetPaths();

  // Create workbook with updated config
  const wb = xlsx.utils.book_new();

  // Sheet 1
  const s1: any[][] = [
    [merged.company_name_kh],
    [merged.company_name_en],
    [merged.address_kh],
    [merged.address_en],
    [merged.telephone],
    [],
    [merged.statement_title_kh],
    [merged.statement_title_en],
    [],
    ['ព័ត៌មានអតិថិជន (Customer Information)'],
    ['ឈ្មោះក្រុមហ៊ុន ឬអតិថិជន :', 'គ្លីនិកធ្មេញ គំរូ (Sample Customer)', '', '', 'លេខអតិថិជន / Customer No :', 'C001'],
    ['Company Name / Customer :', 'Sample Dental Clinic', '', '', 'ថ្ងៃ ខែ ឆ្នាំ / Date :', '31/10/2026'],
    ['ទូរស័ព្ទលេខ / Telephone :', '012 345 678', '', '', 'រូបិយប័ណ្ណ / Currency :', 'USD'],
    ['អាសយដ្ឋាន / Address :', 'ភ្នំពេញ, កម្ពុជា'],
    [],
    ['ល.រ\nNº', 'ប្រភព\nSource', 'លេខឯកសារ\nDocument No.', 'លេខយោង\nReference', 'កាលបរិច្ឆេទ\nDate', 'បរិយាយ\nDescription', 'ចំនួនទឹកប្រាក់\nAmount', 'សមតុល្យ\nRunning Balance'],
    [1, 'AR-IN', 'INV-2026-001', 'PO-101', '05/10/2026', 'Crown Zirconia Layer', 120.00, 120.00],
    [2, 'AR-IN', 'INV-2026-002', 'PO-102', '12/10/2026', 'Emax Press Inlay/Onlay', 80.00, 200.00],
    [3, 'AR-IN', 'INV-2026-003', 'PO-103', '20/10/2026', 'Implant Custom Abutment', 125.00, 325.00],
    [],
    ['', '', '', '', '', 'សមតុល្យសរុប (Total Balance):', 325.00, 325.00],
    [],
    ['ស្កេនទូទាត់ (SCAN TO PAY)', 'ឈ្មោះគណនី (Name): ' + merged.qr_account_name, '', 'កុងប្រាក់រៀល (KHR): ' + merged.qr_khr_account, '', 'កុងដុល្លារ RMS (USD): ' + merged.qr_usd_rms, '', 'កុងដុល្លារ Khema (USD): ' + merged.qr_usd_khema],
    [],
    [merged.sig_1_kh + '\n' + merged.sig_1_en, '', merged.sig_2_kh + '\n' + merged.sig_2_en, '', '', merged.sig_3_kh + '\n' + merged.sig_3_en, '', ''],
    [],
    ['____________________', '', '____________________', '', '', '____________________', '', '']
  ];
  const ws1 = xlsx.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 42 }, { wch: 15 }, { wch: 16 }
  ];
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 7 } }
  ];
  xlsx.utils.book_append_sheet(wb, ws1, 'Invoice Template');

  // Sheet 2
  const s2: any[][] = [
    ['កូដកំណត់ (Key)', 'ឈ្មោះការកំណត់ (Setting Name)', 'តម្លៃកំណត់ (Value)', 'ការពន្យល់ និងការណែនាំ (Description)'],
    ['company_name_kh', 'ឈ្មោះក្រុមហ៊ុនខ្មែរ (Khmer Moul)', merged.company_name_kh, 'បង្ហាញនៅក្បាលវិក័យបត្រខាងលើជួរទី១'],
    ['company_name_en', 'ឈ្មោះក្រុមហ៊ុនអង់គ្លេស', merged.company_name_en, 'បង្ហាញនៅក្បាលវិក័យបត្រខាងលើជួរទី២'],
    ['address_kh', 'អាសយដ្ឋានក្រុមហ៊ុន (ខ្មែរ)', merged.address_kh, 'អាសយដ្ឋានក្រុមហ៊ុនជាភាសាខ្មែរ'],
    ['address_en', 'Address (English)', merged.address_en, 'អាសយដ្ឋានក្រុមហ៊ុនជាភាសាអង់គ្លេស'],
    ['telephone', 'លេខទូរស័ព្ទក្រុមហ៊ុន', merged.telephone, 'លេខទូរស័ព្ទទំនាក់ទំនង'],
    ['statement_title_kh', 'ចំណងជើងរបាយការណ៍ (ខ្មែរ)', merged.statement_title_kh, 'ចំណងជើងធំកណ្ដាលទំព័រ'],
    ['statement_title_en', 'Statement Title (English)', merged.statement_title_en, 'ចំណងជើងធំជាភាសាអង់គ្លេស'],
    ['qr_account_name', 'ឈ្មោះម្ចាស់គណនី QR', merged.qr_account_name, 'ឈ្មោះបង្ហាញក្រោមរូប QR Code'],
    ['qr_khr_account', 'លេខគណនី KHR (ប្រាក់រៀល)', merged.qr_khr_account, 'លេខគណនី ABA ប្រាក់រៀល'],
    ['qr_usd_rms', 'លេខគណនី USD (RMS)', merged.qr_usd_rms, 'លេខគណនី ABA ប្រាក់ដុល្លារ ឯកសារ RMS'],
    ['qr_usd_khema', 'លេខគណនី USD (Khema)', merged.qr_usd_khema, 'លេខគណនី ABA ប្រាក់ដុល្លារ ឯកសារ Khema'],
    ['sig_1_kh', 'ហត្ថលេខាទី១ (ខ្មែរ)', merged.sig_1_kh, 'ឈ្មោះហត្ថលេខាខាងឆ្វេង'],
    ['sig_1_en', 'Signature 1 (English)', merged.sig_1_en, 'ឈ្មោះហត្ថលេខាខាងឆ្វេងជាភាសាអង់គ្លេស'],
    ['sig_2_kh', 'ហត្ថលេខាទី២ (ខ្មែរ)', merged.sig_2_kh, 'ឈ្មោះហត្ថលេខាកណ្ដាល'],
    ['sig_2_en', 'Signature 2 (English)', merged.sig_2_en, 'ឈ្មោះហត្ថលេខាកណ្ដាលជាភាសាអង់គ្លេស'],
    ['sig_3_kh', 'ហត្ថលេខាទី៣ (ខ្មែរ)', merged.sig_3_kh, 'ឈ្មោះហត្ថលេខាខាងស្ដាំ'],
    ['sig_3_en', 'Signature 3 (English)', merged.sig_3_en, 'ឈ្មោះហត្ថលេខាខាងស្ដាំជាភាសាអង់គ្លេស'],
    ['footer_offset_mm', 'គម្លាតរំកិលហត្ថលេខា (mm)', merged.footer_offset_mm, 'ចំនួនរំកិលហត្ថលេខាចុះក្រោម (លំនាំដើម 45mm)'],
    ['qr_size_px', 'ទំហំ QR Code (px)', merged.qr_size_px, 'ទំហំបណ្ដោយ និងទទឹងរបស់រូប QR (លំនាំដើម 90px)'],
    ['qr_margin_top_px', 'គម្លាត QR ខាងលើ (px)', merged.qr_margin_top_px, 'គម្លាតរំកិល QR ចុះក្រោម (លំនាំដើម 14px)']
  ];
  const ws2 = xlsx.utils.aoa_to_sheet(s2);
  ws2['!cols'] = [
    { wch: 22 }, { wch: 32 }, { wch: 55 }, { wch: 45 }
  ];
  xlsx.utils.book_append_sheet(wb, ws2, 'Template Settings');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  try {
    const pDir = path.dirname(primaryPath);
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
    fs.writeFileSync(primaryPath, buf);
  } catch {}

  try {
    const lDir = path.dirname(localPath);
    if (!fs.existsSync(lDir)) fs.mkdirSync(lDir, { recursive: true });
    fs.writeFileSync(localPath, buf);
  } catch {}

  return readStatementTemplate();
}

/**
 * Save an actual customer statement as an Excel file into H:\InvoiceAI\statements
 */
export function saveCustomerStatementToDriveH(params: {
  custName: string;
  custNo?: string;
  custKh?: string;
  custEn?: string;
  phone?: string;
  address?: string;
  curDateStr?: string;
  currency?: string;
  invoices: Array<{
    no?: number;
    module?: string;
    inv?: string;
    ref?: string;
    date?: string;
    desc?: string;
    amt?: number;
    bal?: number;
    runBal?: number;
    origAmt?: number;
    paidBefore?: number;
  }>;
  totalAmt: number;
}): { success: boolean; filePath: string; fileName: string } {
  const cfg = readStatementTemplate();
  const { statementsDir } = getTemplateTargetPaths();

  if (!fs.existsSync(statementsDir)) {
    try { fs.mkdirSync(statementsDir, { recursive: true }); } catch {}
  }

  const safeCust = (params.custNo || params.custName || 'Statement').replace(/[^\w\u1780-\u17FF\-]+/g, '_').slice(0, 40);
  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `Customer_Statement_${safeCust}_${nowStr}.xlsx`;
  const targetPath = path.join(statementsDir, fileName);

  const s1: any[][] = [
    [cfg.company_name_kh],
    [cfg.company_name_en],
    [cfg.address_kh],
    [cfg.address_en],
    [cfg.telephone],
    [],
    [cfg.statement_title_kh],
    [cfg.statement_title_en],
    [],
    ['ព័ត៌មានអតិថិជន (Customer Information)'],
    ['ឈ្មោះក្រុមហ៊ុន ឬអតិថិជន :', params.custKh || params.custName, '', '', 'លេខអតិថិជន / Customer No :', params.custNo || ''],
    ['Company Name / Customer :', params.custEn || params.custName, '', '', 'ថ្ងៃ ខែ ឆ្នាំ / Date :', params.curDateStr || nowStr],
    ['ទូរស័ព្ទលេខ / Telephone :', params.phone || '-', '', '', 'រូបិយប័ណ្ណ / Currency :', params.currency || 'USD'],
    ['អាសយដ្ឋាន / Address :', params.address || '-'],
    [],
    ['ល.រ\nNº', 'ប្រភព\nSource', 'លេខឯកសារ\nDocument No.', 'លេខយោង\nReference', 'កាលបរិច្ឆេទ\nDate', 'បរិយាយ\nDescription', 'ចំនួនទឹកប្រាក់\nAmount', 'សមតុល្យ\nRunning Balance']
  ];

  params.invoices.forEach((v, idx) => {
    const invAmt = (v.bal != null && !isNaN(v.bal)) ? v.bal : (v.amt || 0);
    let desc = v.desc || '';
    if (v.paidBefore && v.paidBefore > 0.005) {
      desc += ` (ដើម $${Number(v.origAmt || invAmt).toFixed(2)} - សងមុន $${Number(v.paidBefore).toFixed(2)})`;
    }
    s1.push([
      v.no != null ? v.no : (idx + 1),
      v.module || 'AR-IN',
      v.inv || '',
      v.ref || '',
      v.date || '',
      desc,
      invAmt,
      v.runBal != null ? v.runBal : invAmt
    ]);
  });

  s1.push([]);
  s1.push(['', '', '', '', '', 'សមតុល្យសរុប (Total Balance):', params.totalAmt, params.totalAmt]);
  s1.push([]);
  s1.push([
    cfg.sig_1_kh + '\n' + cfg.sig_1_en, '',
    cfg.sig_2_kh + '\n' + cfg.sig_2_en, '', '',
    cfg.sig_3_kh + '\n' + cfg.sig_3_en, '', ''
  ]);
  s1.push([]);
  s1.push(['____________________', '', '____________________', '', '', '____________________', '', '']);

  const wb = xlsx.utils.book_new();
  const ws1 = xlsx.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 42 }, { wch: 15 }, { wch: 16 }
  ];
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 7 } }
  ];
  xlsx.utils.book_append_sheet(wb, ws1, 'Customer Statement');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(targetPath, buf);

  // Also mirror to local data/aba/statements/
  try {
    const localStatementsDir = path.join(process.cwd(), 'data', 'aba', 'statements');
    if (!fs.existsSync(localStatementsDir)) fs.mkdirSync(localStatementsDir, { recursive: true });
    fs.writeFileSync(path.join(localStatementsDir, fileName), buf);
  } catch {}

  return { success: true, filePath: targetPath, fileName };
}
