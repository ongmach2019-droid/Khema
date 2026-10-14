import React, { useState, useRef } from 'react';
import { AppSettings, Transaction } from '../types.ts';

const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Khema AI Ledger - Google Sheets Webhook Script
 * សៀវភៅកត់ត្រា ធនាគារ ABA & វិក្កយបត្រ (ABA_Transactions_Latest.xlsx)
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Khema AI Ledger Google Sheets Webhook is active and running!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = getTargetSheet();
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    var action = payload.action || "add_transaction";

    // 1. សាកល្បងការតភ្ជាប់ (Test Connection)
    if (action === "test") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "បានភ្ជាប់ជាមួយ Google Sheet ជោគជ័យ!",
        sheetName: sheet.getName(),
        totalRows: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. កត់ត្រាវិក្កយបត្រថ្មី (Add Single Transaction)
    if (action === "add_transaction" && payload.transaction) {
      appendTransactionRow(sheet, payload.transaction);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "បានកត់ត្រាចូល Google Sheet ជោគជ័យ!",
        totalRows: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. បញ្ជូនទិន្នន័យទាំងអស់ (Sync All Transactions)
    if (action === "sync_all" && Array.isArray(payload.transactions)) {
      var count = 0;
      for (var i = 0; i < payload.transactions.length; i++) {
        appendTransactionRow(sheet, payload.transactions[i]);
        count++;
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "បាន Sync " + count + " ប្រតិបត្តិការចូល Google Sheet ជោគជ័យ!",
        totalRows: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. សម្អាតទិន្នន័យ (Clear all rows except header)
    if (action === "clear_all") {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "បានសម្អាតទិន្នន័យក្នុង Sheet រួចរាល់!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Unknown action"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("ABA Transactions KHR");
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  
  if (sheet.getLastRow() === 0) {
    var headers = [
      "No.", "Date", "Source", "Entry No", "JV No", "Reference",
      "Class", "Vendor / Customer / Employee", "Description",
      "Debit", "Credit", "Balance"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e6f4ea");
  }
  
  return sheet;
}

function appendTransactionRow(sheet, tx) {
  var lastRow = sheet.getLastRow();
  var nextNo = lastRow > 1 ? lastRow : 1;
  
  var dateStr = tx.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy");
  var source = "GL-JE";
  var entryNo = tx.entryNo || (57559 + nextNo);
  var jvNo = tx.jvNo || tx.ref || ("JV-" + (605 + nextNo));
  var ref = tx.ref || "";
  var classCode = "KHEMA88888";
  var vendor = tx.vendorKh || tx.vendor || "ចំណាយទូទៅ";
  var desc = tx.category || tx.aiExplanation || "ប្រតិបត្តិការទូទៅ";
  var debit = tx.type === "income" ? (tx.amountKHR || Math.round((tx.amountUSD || 0) * 4100)) : 0;
  var credit = tx.type !== "income" ? (tx.amountKHR || Math.round((tx.amountUSD || 0) * 4100)) : 0;
  var balance = "";

  sheet.appendRow([
    nextNo,
    dateStr,
    source,
    entryNo,
    jvNo,
    ref,
    classCode,
    vendor,
    desc,
    debit,
    credit,
    balance
  ]);
}`;

interface SettingsScreenProps {
  settings: AppSettings;
  transactions?: Transaction[];
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearAll?: () => void;
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  transactions = [],
  onUpdateSettings,
  onClearAll,
  onLogout,
}) => {
  const [isUpdatingRate, setIsUpdatingRate] = useState<boolean>(false);
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>(settings.userName);
  const [profileRole, setProfileRole] = useState<string>(settings.userRole);
  const [profileAvatar, setProfileAvatar] = useState<string>(settings.userAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets state
  const [sheetWebhookUrl, setSheetWebhookUrl] = useState<string>(settings.googleSheetWebhookUrl || '');
  const [isTestingSheet, setIsTestingSheet] = useState<boolean>(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [sheetNotice, setSheetNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  // Open edit profile modal with current settings
  const handleOpenEditProfile = () => {
    setProfileName(settings.userName);
    setProfileRole(settings.userRole);
    setProfileAvatar(settings.userAvatar);
    setShowEditProfile(true);
  };

  // Handle image upload and instant preview via FileReader
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('សូមជ្រើសរើសឯកសាររូបភាព (PNG, JPG, JPEG)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProfileAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Live Exchange Rate refresh
  const handleRefreshRate = async () => {
    setIsUpdatingRate(true);
    try {
      const res = await fetch('/api/exchange-rate');
      if (res.ok) {
        const data = await res.json();
        if (data.rate) {
          onUpdateSettings({ exchangeRate: data.rate });
        }
      }
    } catch {
      // Fallback
      onUpdateSettings({ exchangeRate: 4100 });
    } finally {
      setTimeout(() => {
        setIsUpdatingRate(false);
      }, 600);
    }
  };

  const handleSaveProfile = () => {
    onUpdateSettings({
      userName: profileName.trim() || settings.userName,
      userRole: profileRole.trim() || settings.userRole,
      userAvatar: profileAvatar || settings.userAvatar,
    });
    setShowEditProfile(false);
  };

  // Save Google Sheets webhook url
  const handleSaveWebhook = async () => {
    const cleanUrl = sheetWebhookUrl.trim();
    onUpdateSettings({ googleSheetWebhookUrl: cleanUrl });
    try {
      await fetch('/api/update-google-sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: cleanUrl }),
      });
      setSheetNotice({ type: 'success', message: 'បានរក្សាទុក Google Sheet Webhook ជោគជ័យ!' });
    } catch {
      setSheetNotice({ type: 'success', message: 'បានរក្សាទុកក្នុង Setting រួចរាល់!' });
    }
    setTimeout(() => setSheetNotice(null), 3500);
  };

  // Test Google Sheets connection
  const handleTestSheetConnection = async () => {
    const targetUrl = sheetWebhookUrl.trim();
    if (!targetUrl) {
      setSheetNotice({ type: 'error', message: 'សូមបញ្ចូល Webhook URL ជាមុនសិន!' });
      setTimeout(() => setSheetNotice(null), 3500);
      return;
    }
    setIsTestingSheet(true);
    setSheetNotice(null);
    try {
      const res = await fetch('/api/google-sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: targetUrl, action: 'test' }),
      });
      const data = await res.json();
      if (data.success && data.data && data.data.success) {
        setSheetNotice({ type: 'success', message: '✅ ' + (data.data.message || 'បានតភ្ជាប់ជោគជ័យ!') });
        onUpdateSettings({ googleSheetWebhookUrl: targetUrl });
      } else {
        setSheetNotice({ type: 'error', message: '❌ បរាជ័យ: ' + (data.error || data.data?.error || 'សូមពិនិត្យមើល Webhook URL') });
      }
    } catch (err: any) {
      setSheetNotice({ type: 'error', message: '❌ មិនអាចភ្ជាប់បាន: ' + err.message });
    } finally {
      setIsTestingSheet(false);
      setTimeout(() => setSheetNotice(null), 5000);
    }
  };

  // Sync all transactions to Google Sheets
  const handleSyncAllToSheet = async () => {
    const targetUrl = sheetWebhookUrl.trim();
    if (!targetUrl) {
      setSheetNotice({ type: 'error', message: 'សូមបញ្ចូល Webhook URL ជាមុនសិន!' });
      setTimeout(() => setSheetNotice(null), 3500);
      return;
    }
    if (transactions.length === 0) {
      setSheetNotice({ type: 'error', message: 'មិនទាន់មានប្រតិបត្តិការដើម្បី Sync នៅឡើយទេ!' });
      setTimeout(() => setSheetNotice(null), 3500);
      return;
    }
    setIsSyncingSheet(true);
    setSheetNotice(null);
    try {
      const res = await fetch('/api/google-sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          action: 'sync_all',
          transactions,
        }),
      });
      const data = await res.json();
      if (data.success && data.data && data.data.success) {
        setSheetNotice({ type: 'success', message: '✅ ' + (data.data.message || 'បាន Sync ទិន្នន័យជោគជ័យ!') });
      } else {
        setSheetNotice({ type: 'error', message: '❌ ' + (data.error || 'ការ Sync បរាជ័យ') });
      }
    } catch (err: any) {
      setSheetNotice({ type: 'error', message: '❌ ' + err.message });
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSheetNotice(null), 5000);
    }
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="flex flex-col w-full px-margin pb-32 pt-2">
      {/* Title */}
      <div className="relative w-full mb-space-md">
        <div className="flex flex-col pt-1">
          <h1 className="font-headline-lg text-[22px] text-on-surface font-bold">
            ការកំណត់កម្មវិធី
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            គ្រប់គ្រងគណនី និងការកំណត់ AI របស់អ្នក
          </p>
        </div>
      </div>

      {/* Profile Mini Card */}
      <section className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-surface-container-high/60 mb-space-lg relative overflow-hidden">
        <div className="flex items-center gap-space-md relative z-10">
          <div className="relative shrink-0">
            <img
              alt={settings.userName}
              className="w-14 h-14 rounded-full object-cover shadow-sm ring-2 ring-surface-container-high"
              src={settings.userAvatar}
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-white ring-2 ring-white">
              <span className="material-symbols-outlined text-[10px] font-bold">check</span>
            </span>
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="font-headline-sm text-[16px] text-on-surface font-bold truncate">
              {settings.userName}
            </h2>
            <p className="font-body-sm text-[12px] text-on-surface-variant truncate">
              {settings.userRole}
            </p>
          </div>

          <button
            onClick={handleOpenEditProfile}
            aria-label="Edit Profile"
            className="w-9 h-9 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center shrink-0 active:scale-95 transition-transform hover:bg-surface-container-high"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>
      </section>

      {/* General Settings */}
      <div className="flex flex-col mb-space-lg">
        <div className="flex items-center gap-space-xs mb-space-sm px-1">
          <div className="w-6 h-6 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">tune</span>
          </div>
          <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
            ការកំណត់ទូទៅ (General Settings)
          </h3>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/60 p-space-md flex flex-col gap-space-md">
          {/* Currency */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 text-secondary">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  រូបិយប័ណ្ណ (Currency)
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {settings.currency === 'USD_KHR'
                    ? 'ប្រាក់ដុល្លារ និង ប្រាក់រៀល'
                    : settings.currency === 'USD'
                    ? 'ប្រាក់ដុល្លារ ($)'
                    : 'ប្រាក់រៀល (៛)'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowRateModal(true)}
              className="px-3 py-1.5 bg-surface-container-low rounded-xl text-on-surface font-label-md text-label-md flex items-center gap-1 shrink-0 font-semibold hover:bg-surface-container-high transition-colors"
              type="button"
            >
              <span>{settings.currency === 'USD_KHR' ? 'USD / KHR' : settings.currency}</span>
              <span className="material-symbols-outlined text-[16px]">unfold_more</span>
            </button>
          </div>

          {/* Exchange Rate */}
          <div className="bg-surface-container-low/70 rounded-xl p-space-sm flex items-center justify-between border border-surface-container-high/40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-[11px] text-on-surface-variant">
                  អត្រាប្តូរប្រាក់ (Rate)
                </span>
                <span className="font-financial-numeric text-[16px] text-on-surface font-bold">
                  1$ = {settings.exchangeRate.toLocaleString()} ៛
                </span>
              </div>
            </div>

            <button
              onClick={handleRefreshRate}
              disabled={isUpdatingRate}
              className="font-label-sm text-[11px] font-semibold bg-surface-container-lowest text-secondary px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 active:scale-95 transition-transform hover:bg-surface-container-low"
              type="button"
            >
              <span
                className={`material-symbols-outlined text-[14px] ${
                  isUpdatingRate ? 'animate-spin' : ''
                }`}
              >
                sync
              </span>
              <span>{isUpdatingRate ? 'កំពុងទាញ...' : 'បច្ចុប្បន្នភាព'}</span>
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 text-on-surface">
                <span className="material-symbols-outlined text-[20px]">translate</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  ភាសា (Language)
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  ភាសាប្រើប្រាស់ក្នុងកម្មវិធី
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowLanguageModal(true)}
              className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-xl shrink-0 font-semibold text-[13px] hover:bg-surface-container-high transition-colors"
              type="button"
            >
              <span>{settings.language === 'km' ? 'ភាសាខ្មែរ' : 'English'}</span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                keyboard_arrow_right
              </span>
            </button>
          </div>

          {/* Cloud Backup Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-surface-container-low">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 text-secondary">
                <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  បម្រុងទុកទិន្នន័យ (Cloud Backup)
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  រក្សាទុកទិន្នន័យស្វ័យប្រវត្តិជារៀងរាល់ថ្ងៃ
                </span>
              </div>
            </div>

            <button
              onClick={() => onUpdateSettings({ autoBackup: !settings.autoBackup })}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${
                settings.autoBackup ? 'bg-secondary' : 'bg-surface-container-high'
              }`}
              type="button"
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  settings.autoBackup ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* AI Automation Section */}
      <div className="flex flex-col mb-space-lg">
        <div className="flex items-center gap-space-xs mb-space-sm px-1">
          <div className="w-6 h-6 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          </div>
          <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
            ការកំណត់ AI & OCR (AI Configuration)
          </h3>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/60 p-space-md flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                កម្រិតភាពជឿជាក់ AI (Confidence Threshold)
              </span>
              <span className="font-financial-numeric text-[14px] text-secondary font-bold">
                {settings.aiConfidenceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="85"
              max="99"
              value={settings.aiConfidenceThreshold}
              onChange={(e) =>
                onUpdateSettings({ aiConfidenceThreshold: parseInt(e.target.value, 10) })
              }
              className="w-full accent-secondary h-2 bg-surface-container-high rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-on-surface-variant mt-1 block">
              AI នឹងស្នើសុំការពិនិត្យឡើងវិញ ប្រសិនបើកម្រិតភាពត្រឹមត្រូវទាបជាង {settings.aiConfidenceThreshold}%
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                គណនាពន្ធអាករស្វ័យប្រវត្តិ (VAT 10%)
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                បំបែកពន្ធអាករ 10% តាមបទប្បញ្ញត្តិពន្ធដារកម្ពុជា
              </span>
            </div>
            <button
              onClick={() => onUpdateSettings({ vatEnabled: !settings.vatEnabled })}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${
                settings.vatEnabled ? 'bg-secondary' : 'bg-surface-container-high'
              }`}
              type="button"
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${
                  settings.vatEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Google Sheets Integration Section */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-surface-container-high/60 mb-space-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">table_chart</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-[15px] font-bold text-on-surface">
                Google Sheets (Google Drive)
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                កត់ត្រាទិន្នន័យផ្ទាល់ទៅកាន់ Google Drive របស់អ្នក
              </span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            sheetWebhookUrl ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-on-surface-variant'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sheetWebhookUrl ? 'bg-emerald-500 animate-pulse' : 'bg-on-surface-variant/40'}`}></span>
            {sheetWebhookUrl ? 'បានភ្ជាប់' : 'មិនទាន់ភ្ជាប់'}
          </span>
        </div>

        {/* Notice alert */}
        {sheetNotice && (
          <div className={`p-2.5 rounded-xl mb-3 text-xs font-semibold flex items-center gap-2 ${
            sheetNotice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>{sheetNotice.message}</span>
          </div>
        )}

        {/* Google Sheet Direct Link */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">📗</span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-on-surface truncate">
                ABA_Transactions_Latest.xlsx
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono truncate">
                docs.google.com/spreadsheets/d/1yo4JVj4...
              </span>
            </div>
          </div>
          <a
            href={settings.googleSheetUrl || 'https://docs.google.com/spreadsheets/d/1yo4JVj4G-YrDqtu5s4EdSCwQn0UGTF4m/edit?usp=sharing'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-white text-secondary hover:bg-secondary/10 text-xs font-bold flex items-center gap-1 border border-surface-container-high shrink-0 shadow-xs active:scale-95 transition-all"
          >
            <span>បើក Sheet</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>

        {/* Webhook URL Input */}
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-on-surface">
              Google Apps Script Web App URL:
            </label>
            <button
              onClick={() => setShowScriptModal(true)}
              className="text-secondary text-[11px] font-bold hover:underline flex items-center gap-0.5"
              type="button"
            >
              <span className="material-symbols-outlined text-[13px]">help</span>
              <span>របៀបដំឡើង (Setup Guide)</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={sheetWebhookUrl}
              onChange={(e) => setSheetWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none focus:border-secondary font-mono"
            />
            <button
              type="button"
              onClick={handleSaveWebhook}
              className="h-10 px-3 bg-secondary text-white rounded-xl text-xs font-semibold hover:bg-secondary/90 active:scale-95 transition-all shadow-xs"
            >
              រក្សាទុក
            </button>
          </div>
        </div>

        {/* Action Buttons: Test Connection & Sync All */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={handleTestSheetConnection}
            disabled={isTestingSheet}
            className="h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 border border-surface-container-high transition-all active:scale-95"
          >
            <span className={`material-symbols-outlined text-[16px] text-secondary ${isTestingSheet ? 'animate-spin' : ''}`}>
              {isTestingSheet ? 'sync' : 'network_check'}
            </span>
            <span>{isTestingSheet ? 'កំពុងតេស្ត...' : 'តេស្តការតភ្ជាប់'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAllToSheet}
            disabled={isSyncingSheet}
            className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSyncingSheet ? 'animate-spin' : ''}`}>
              {isSyncingSheet ? 'sync' : 'cloud_upload'}
            </span>
            <span>{isSyncingSheet ? 'កំពុង Sync...' : `Sync ទិន្នន័យ (${transactions.length})`}</span>
          </button>
        </div>

        {/* Auto Sync Toggle */}
        <div className="flex items-center justify-between pt-2.5 border-t border-surface-container-low">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-on-surface">
              បញ្ជូនទិន្នន័យស្វ័យប្រវត្តិ (Auto-Sync)
            </span>
            <span className="text-[11px] text-on-surface-variant">
              រាល់ពេលស្កេនវិក្កយបត្រថ្មី បញ្ជូនចូល Google Sheet ភ្លាមៗ
            </span>
          </div>
          <button
            onClick={() => onUpdateSettings({ googleSheetAutoSync: settings.googleSheetAutoSync === false ? true : false })}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              settings.googleSheetAutoSync !== false ? 'bg-secondary' : 'bg-surface-container-high'
            }`}
            type="button"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                settings.googleSheetAutoSync !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Data Management Section */}
      {onClearAll && (
        <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-surface-container-high/60 mb-space-md">
          <div className="flex items-center gap-space-sm mb-3">
            <span className="material-symbols-outlined text-[20px] text-error">auto_delete</span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              គ្រប់គ្រងទិន្នន័យ (Data Management)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body-sm text-[12px] text-on-surface-variant">
              លុបទិន្នន័យប្រតិបត្តិការទាំងអស់ ដើម្បីកំណត់ឡើងវិញទៅជា ចំណូល $0.00 និង ចំណាយ $0.00។
            </p>
            <button
              onClick={onClearAll}
              className="mt-1 w-full h-11 bg-surface-container hover:bg-error-container/60 hover:text-error text-on-surface font-label-md text-label-md font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-surface-container-high"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-error">delete_sweep</span>
              <span>សម្អាតទិន្នន័យទាំងអស់ (Reset All to $0.00)</span>
            </button>
          </div>
        </div>
      )}

      {/* Logout Button */}
      <div className="flex flex-col items-center gap-space-md mt-space-sm mb-space-lg">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full h-12 bg-error-container text-on-error-container hover:bg-error-container/80 rounded-xl flex items-center justify-center gap-space-xs font-label-lg text-label-lg font-bold shadow-sm transition-all active:scale-[0.99]"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>ចេញពីគណនី (Logout)</span>
        </button>
      </div>

      {/* App Version Footer Card */}
      <div className="flex flex-col items-center justify-center text-center p-space-md bg-surface-container-low/50 rounded-2xl border border-surface-container-high/40">
        <img
          src="/khema-logo.jpg"
          alt="Khema Digital Dental Solution"
          className="h-12 w-auto max-w-[150px] object-contain rounded-lg bg-white p-1 shadow-sm border border-surface-container-high/60 mb-2"
        />
        <span className="font-label-md text-label-md text-on-surface font-bold">
          ខេមា Digital Dental Solution • សៀវភៅកត់ត្រា AI
        </span>
        <span className="font-body-sm text-[11px] text-on-surface-variant mt-0.5 max-w-[280px]">
          ប្រព័ន្ធកត់ត្រាគណនេយ្យ និងវិក្កយបត្រស្វ័យប្រវត្តិកម្រិតខ្ពស់
        </span>
        <span className="font-label-sm text-[10px] text-on-surface-variant/70 mt-2 font-mono">
          រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 Khema Digital Dental Solution
        </span>
      </div>

      {/* Profile Edit Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-surface-container-high relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">account_circle</span>
                </div>
                <h3 className="font-headline-sm text-[17px] font-bold text-on-surface">
                  កែប្រែព័ត៌មានគណនី (Edit Profile)
                </h3>
              </div>
              <button
                onClick={() => setShowEditProfile(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Avatar Preview & Upload */}
            <div className="flex flex-col items-center justify-center mb-5 pb-4 border-b border-surface-container-high/60">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleAvatarFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer group mb-3"
                title="ចុចដើម្បីប្តូររូបថត (Click to change photo)"
              >
                <img
                  src={profileAvatar || settings.userAvatar}
                  alt={profileName || settings.userName}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-secondary/20 shadow-md group-hover:opacity-85 transition-opacity"
                />
                <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                </div>
                <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-white ring-2 ring-white shadow-sm">
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container-high text-secondary text-xs font-semibold border border-surface-container-high/70 transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>ជ្រើសរើសរូបភាពថ្មី (PNG, JPG)</span>
              </button>
            </div>

            {/* Name and Role Inputs */}
            <div className="flex flex-col gap-3.5 mb-6">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  ឈ្មោះបង្ហាញ (Display Name)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-on-surface-variant">
                    person
                  </span>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="បញ្ចូលឈ្មោះរបស់អ្នក..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-sm font-semibold outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  តួនាទី / ផ្នែក (Role / Department)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-on-surface-variant">
                    badge
                  </span>
                  <input
                    type="text"
                    value={profileRole}
                    onChange={(e) => setProfileRole(e.target.value)}
                    placeholder="បញ្ចូលតួនាទី..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-sm font-semibold outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-sm hover:bg-surface-container-high/80 transition-colors"
                type="button"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-white font-semibold text-sm shadow-md hover:bg-secondary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">check</span>
                <span>រក្សាទុក (Save)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-surface-container-high">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-3">
              ជ្រើសរើសរូបិយប័ណ្ណបង្ហាញ
            </h3>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { id: 'USD_KHR', label: 'USD / KHR (បង្ហាញទាំងពីរ)', desc: 'ដុល្លារ និង រៀល' },
                { id: 'USD', label: 'USD ($ តែមួយគត់)', desc: 'ប្រាក់ដុល្លារអាមេរិក' },
                { id: 'KHR', label: 'KHR (៛ តែមួយគត់)', desc: 'ប្រាក់រៀលកម្ពុជា' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onUpdateSettings({ currency: c.id as any });
                    setShowRateModal(false);
                  }}
                  className={`p-3 rounded-xl text-left border flex items-center justify-between transition-all ${
                    settings.currency === c.id
                      ? 'border-secondary bg-secondary-container/20 text-on-surface'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-sm block">{c.label}</span>
                    <span className="text-xs text-on-surface-variant">{c.desc}</span>
                  </div>
                  {settings.currency === c.id && (
                    <span className="material-symbols-outlined text-secondary">check</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowRateModal(false)}
              className="w-full py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-sm"
            >
              បិទ
            </button>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-surface-container-high">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-3">
              ជ្រើសរើសភាសា (Language)
            </h3>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { id: 'km', label: 'ភាសាខ្មែរ (Khmer)', desc: 'ភាសាដើម' },
                { id: 'en', label: 'English', desc: 'International' },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    onUpdateSettings({ language: l.id as any });
                    setShowLanguageModal(false);
                  }}
                  className={`p-3 rounded-xl text-left border flex items-center justify-between transition-all ${
                    settings.language === l.id
                      ? 'border-secondary bg-secondary-container/20 text-on-surface'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-sm block">{l.label}</span>
                    <span className="text-xs text-on-surface-variant">{l.desc}</span>
                  </div>
                  {settings.language === l.id && (
                    <span className="material-symbols-outlined text-secondary">check</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLanguageModal(false)}
              className="w-full py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-sm"
            >
              បិទ
            </button>
          </div>
        </div>
      )}

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-surface-container-high text-center">
            <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-[24px]">logout</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-1">
              ចាកចេញពីគណនី?
            </h3>
            <p className="text-sm text-on-surface-variant mb-5">
              តើអ្នកពិតជាចង់ចេញពីគណនីរបស់អ្នកមែនទេ? (Are you sure you want to log out?)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-sm"
              >
                បោះបង់
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-error text-white font-semibold text-sm shadow-sm"
              >
                ចេញពីគណនី
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Apps Script Setup Guide Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl p-5 w-full max-w-md shadow-2xl border border-surface-container-high max-h-[88vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">table_chart</span>
                </div>
                <h3 className="font-headline-sm text-[16px] font-bold text-on-surface">
                  របៀបភ្ជាប់ Google Sheets
                </h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Scrollable instructions */}
            <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-3 text-xs leading-relaxed text-on-surface">
              <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high/60 flex flex-col gap-2">
                <span className="font-bold text-secondary text-sm">៤ ជំហានងាយៗ (1 នាទី):</span>
                <ol className="list-decimal list-inside space-y-1.5 text-on-surface-variant font-medium">
                  <li>
                    បើក <a href={settings.googleSheetUrl || 'https://docs.google.com/spreadsheets/d/1yo4JVj4G-YrDqtu5s4EdSCwQn0UGTF4m/edit'} target="_blank" rel="noreferrer" className="text-secondary font-bold underline">Google Sheets របស់អ្នក</a>
                  </li>
                  <li>
                    ចុចម៉ឺនុយ <span className="text-on-surface font-bold">Extensions (ផ្នែកបន្ថែម)</span> &gt; <span className="text-on-surface font-bold">Apps Script</span>
                  </li>
                  <li>
                    លុបកូដចាស់ចោល ហើយ Paste កូដខាងក្រោមនេះចូល រួចចុច <span className="text-on-surface font-bold">Save (💾)</span>
                  </li>
                  <li>
                    ចុចប៊ូតុងខៀវ <span className="text-on-surface font-bold">Deploy</span> &gt; <span className="text-on-surface font-bold">New deployment</span>:
                    <ul className="list-disc list-inside pl-3 mt-1 text-[11px] text-on-surface-variant/90 space-y-0.5">
                      <li>Select type: <span className="font-bold text-on-surface">Web app</span></li>
                      <li>Execute as: <span className="font-bold text-on-surface">Me</span></li>
                      <li>Who has access: <span className="font-bold text-emerald-700">Anyone</span></li>
                    </ul>
                  </li>
                  <li>
                    ចុច <b>Deploy</b> រួចចម្លង (Copy) យក <b>Web app URL</b> មកដាក់ក្នុងប្រអប់ខាងលើ!
                  </li>
                </ol>
              </div>

              {/* Code Snippet Box */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface text-[12px]">កូដ Google Apps Script:</span>
                  <button
                    type="button"
                    onClick={handleCopyScriptCode}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedCode ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedCode ? 'បានចម្លង!' : 'ចម្លងកូដ (Copy)'}</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-3 rounded-2xl bg-neutral-900 text-neutral-100 font-mono text-[10px] max-h-48 overflow-y-auto leading-normal border border-white/10 select-all">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-3 pt-3 border-t border-surface-container-high shrink-0">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="w-full h-10 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-neutral-800 transition-all shadow-sm"
              >
                យល់ព្រម (Done)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
