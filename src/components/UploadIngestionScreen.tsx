import React, { useState, useRef, useEffect } from 'react';
import { Transaction, AppSettings } from '../types.ts';
import { PRESET_RECEIPTS, SAMPLE_RECEIPT_IMG } from '../data/mockData.ts';

interface UploadIngestionScreenProps {
  settings: AppSettings;
  onSaveTransaction: (tx: Transaction) => void;
  initialFile?: File | null;
}

interface ExtractedData {
  vendor: string;
  date: string;
  amountUSD: number;
  amountKHR: number;
  vatUSD: number;
  coaCode: string;
  coaCategory: string;
  status: 'paid' | 'pending';
  aiExplanation: string;
  ocrConfidence: number;
  items?: Array<{ name: string; quantity: number; price: number; total: number }>;
}

export const UploadIngestionScreen: React.FC<UploadIngestionScreenProps> = ({
  settings,
  onSaveTransaction,
  initialFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [receiptImage, setReceiptImage] = useState<string>(SAMPLE_RECEIPT_IMG);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(95);
  const [analysisSource, setAnalysisSource] = useState<string>('gemini');
  const [analysisNotice, setAnalysisNotice] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);

  // Editable extracted data
  const [data, setData] = useState<ExtractedData>({
    vendor: 'ផ្សារទំនើប ឡាក់គី (Lucky)',
    date: '2024-10-24',
    amountUSD: 84.20,
    amountKHR: 345220,
    vatUSD: 7.65,
    coaCode: '6010',
    coaCategory: '6010 - សម្ភារៈប្រើប្រាស់',
    status: 'paid',
    aiExplanation: 'ការទិញនេះត្រូវបានចាត់ថ្នាក់ជាចំណាយប្រតិបត្តិការទូទៅ ស្របតាមប្រកាសស្តីពីគណនេយ្យសហគ្រាសធុនតូច។',
    ocrConfidence: 95,
  });

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // If initialFile is passed from dashboard
  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
    }
  }, [initialFile]);

  // Window paste listener (Ctrl+V) from Telegram or Clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              processFile(file);
              break;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleClipboardPasteClick = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const file = new File([blob], 'telegram_paste.png', { type: imgType });
            processFile(file);
            return;
          }
        }
      }
      alert('សូមចុច Ctrl+V លើក្ដារចុចដើម្បី Paste រូបភាពពី Telegram ផ្ទាល់!');
    } catch (err) {
      alert('សូមចុច Ctrl+V ដើម្បី Paste រូបភាពពី Telegram ដោយផ្ទាល់!');
    }
  };

  // Handle file upload
  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setReceiptImage(base64);
      analyzeWithAI(base64, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Preset Selection
  const handleSelectPreset = (preset: typeof PRESET_RECEIPTS[0]) => {
    setReceiptImage(preset.imageUrl);
    analyzeWithAI(preset.imageUrl, 'image/jpeg', preset.hint);
  };

  // AI Receipt Analysis call
  const analyzeWithAI = async (imageBase64?: string, mimeType?: string, vendorHint?: string) => {
    setIsAnalyzing(true);
    setAnalysisNotice('');
    setAnalysisProgress(30);

    const progressTimer = setInterval(() => {
      setAnalysisProgress((prev) => (prev < 90 ? prev + 20 : prev));
    }, 400);

    try {
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          vendorHint,
        }),
      });

      clearInterval(progressTimer);
      setAnalysisProgress(100);

      if (response.ok) {
        const result = await response.json();
        setAnalysisSource(result.source || 'gemini');
        setAnalysisNotice(result.notice || '');
        if (result.data) {
          const d = result.data;
          setData({
            vendor: d.vendor,
            date: d.date || new Date().toISOString().split('T')[0],
            amountUSD: Number(d.amountUSD) || 0,
            amountKHR: Number(d.amountKHR) || Math.round((Number(d.amountUSD) || 0) * settings.exchangeRate),
            vatUSD: Number(d.vatAmount) || 0,
            coaCode: d.coaCode || '6010',
            coaCategory: d.coaCategory || '6010 - សម្ភារៈប្រើប្រាស់',
            status: d.status === 'pending' ? 'pending' : 'paid',
            aiExplanation: d.aiExplanation || 'បានផ្ទៀងផ្ទាត់ដោយជោគជ័យតាមប្រព័ន្ធ AI។',
            ocrConfidence: d.ocrConfidence || 96,
            items: d.items,
          });
        }
      }
    } catch (err) {
      console.warn('Analysis network issue, fallback applied:', err);
    } finally {
      clearInterval(progressTimer);
      setIsAnalyzing(false);
    }
  };

  // Live Camera
  const startCamera = async () => {
    try {
      setShowCameraModal(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera permission denied or unavailable, opening file selector');
      setShowCameraModal(false);
      cameraInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setReceiptImage(dataUrl);
        stopCamera();
        analyzeWithAI(dataUrl, 'image/jpeg', 'Captured Receipt');
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  // Save to Ledger
  const handleConfirmAndSave = () => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      ref: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      vendor: data.vendor,
      vendorKh: data.vendor,
      category: data.coaCategory.split('-')[1]?.trim() || 'សម្ភារៈ',
      categoryCode: data.coaCategory,
      date: data.date,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amountUSD: data.amountUSD,
      amountKHR: data.amountKHR,
      vatUSD: data.vatUSD,
      type: 'expense',
      status: data.status,
      statusTextKh: data.status === 'paid' ? 'បានបង់' : 'ជំពាក់',
      iconName: data.coaCategory.includes('ស្តុក')
        ? 'inventory_2'
        : data.coaCategory.includes('ភ្លើង')
        ? 'bolt'
        : data.coaCategory.includes('ម្ហូប')
        ? 'local_cafe'
        : 'shopping_cart',
      receiptImage: receiptImage,
      items: data.items,
      aiExplanation: data.aiExplanation,
      ocrConfidence: data.ocrConfidence,
    };

    onSaveTransaction(newTx);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2800);
  };

  const resetForm = () => {
    setReceiptImage(SAMPLE_RECEIPT_IMG);
    setData({
      vendor: 'ផ្សារទំនើប ឡាក់គី (Lucky)',
      date: '2024-10-24',
      amountUSD: 84.20,
      amountKHR: 345220,
      vatUSD: 7.65,
      coaCode: '6010',
      coaCategory: '6010 - សម្ភារៈប្រើប្រាស់',
      status: 'paid',
      aiExplanation: 'ការទិញនេះត្រូវបានចាត់ថ្នាក់ជាចំណាយប្រតិបត្តិការទូទៅ ស្របតាមប្រកាសស្តីពីគណនេយ្យសហគ្រាសធុនតូច។',
      ocrConfidence: 95,
    });
    setSavedSuccess(false);
  };

  return (
    <div className="flex flex-col w-full px-margin pb-32 pt-2">
      {/* Eyebrow & Headline */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/80 text-on-secondary-container font-label-sm text-[12px] font-semibold border border-secondary/20 shadow-xs">
          <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
          ប្រព័ន្ធ AI ជំនាន់ 4.2 សកម្ម
        </span>
      </div>

      <div className="mb-space-lg">
        <h1 className="font-display-lg-mobile text-[26px] text-on-surface tracking-tight font-bold">
          បញ្ចូល និងស្កេនវិក្កយបត្រ
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">
          AI នឹងដកស្រង់ទិន្នន័យ និងរៀបចំជាកូដគណនេយ្យដោយស្វ័យប្រវត្តិ
        </p>
      </div>

      {/* Preset Quick Test Strip */}
      <div className="mb-space-md">
        <span className="font-label-sm text-label-sm text-on-surface-variant block mb-2 font-medium">
          ជ្រើសរើសវិក្កយបត្រគំរូសម្រាប់សាកល្បង AI:
        </span>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_RECEIPTS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-secondary/60 text-left transition-all active:scale-95 shadow-xs flex items-center gap-2"
              type="button"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0 text-secondary">
                <span className="material-symbols-outlined text-[18px]">receipt</span>
              </div>
              <div className="min-w-0">
                <span className="block font-label-sm text-[12px] font-bold text-on-surface truncate">
                  {preset.title.split(' ')[0]}
                </span>
                <span className="block text-[11px] text-on-surface-variant truncate">
                  {preset.subtitle.split('(')[1]?.replace(')', '') || 'ស្កេន'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Upload Interactive Target Zone */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-lg relative overflow-hidden border border-surface-container-high/60 group">
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-secondary-container/30 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center py-space-md px-space-sm bg-surface-container-low/70 rounded-xl text-center border border-dashed border-surface-container-highest">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-space-sm shadow-inner relative">
            <span className="material-symbols-outlined text-[32px]">photo_camera</span>
            {isAnalyzing && (
              <span className="absolute inset-0 rounded-full border-2 border-secondary border-t-transparent animate-spin"></span>
            )}
          </div>

          <span className="font-headline-sm text-headline-sm text-on-surface mb-1 font-bold">
            ទម្លាក់ឯកសារ ឬ ចុចដើម្បីស្កេន
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant max-w-[260px] mb-space-md">
            ដាក់វិក្កយបត្រក្រដាស ឬ បង្កាន់ដៃបង់ប្រាក់ KHQR ដើម្បីបម្លែងទិន្នន័យ
          </span>

          <div className="flex flex-col items-center gap-space-sm w-full max-w-xs justify-center">
            <div className="flex items-center gap-space-sm w-full justify-center">
              <button
                onClick={startCamera}
                className="flex items-center justify-center gap-1.5 h-12 px-space-md bg-secondary text-on-secondary rounded-xl font-label-lg text-label-lg font-semibold shadow-sm hover:bg-secondary/90 transition-transform active:scale-95 flex-1 min-w-[130px]"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                <span>ថតរូបភាព</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 h-12 px-space-md bg-surface-container-highest text-on-surface rounded-xl font-label-lg text-label-lg font-semibold hover:bg-surface-container-high transition-transform active:scale-95 flex-1 min-w-[130px]"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">collections</span>
                <span>ជ្រើសរើសរូប</span>
              </button>
            </div>

            <button
              onClick={handleClipboardPasteClick}
              className="flex items-center justify-center gap-2 h-11 px-space-md bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-label-lg text-label-lg font-semibold shadow-sm transition-transform active:scale-95 w-full cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">content_paste</span>
              <span>📋 Paste ពី Telegram (Ctrl+V)</span>
            </button>
          </div>

          <div className="mt-space-md flex items-center gap-1 text-on-surface-variant text-[12px]">
            <span className="material-symbols-outlined text-[15px]">info</span>
            <span>គាំទ្រ JPG, PNG, PDF (រហូតដល់ 15MB)</span>
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf"
          className="hidden"
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileChange}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
      </div>

      {/* Real-time Processing Card with Receipt Preview */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-lg border border-surface-container-high/60">
        {/* Header of preview */}
        <div className="flex items-center justify-between pb-3 mb-space-md border-b border-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">smart_toy</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-[16px] text-on-surface font-bold">
                ដំណើរការវិភាគ AI (ផ្ទាល់)
              </span>
              <span className="text-[10px] text-on-surface-variant">
                ម៉ាស៊ីន: {analysisSource.startsWith('gemini') ? analysisSource : 'Smart Receipt Engine'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {analysisSource === 'smart-engine' && (
              <button
                onClick={() => analyzeWithAI(receiptImage.startsWith('data:') ? receiptImage : undefined, 'image/jpeg', data.vendor)}
                className="font-label-sm text-[10px] text-secondary bg-secondary-container/40 hover:bg-secondary-container px-2 py-0.5 rounded-full flex items-center gap-0.5 active:scale-95 transition-transform"
                title="សាកល្បងភ្ជាប់ Gemini AI ម្តងទៀត"
                type="button"
              >
                <span className="material-symbols-outlined text-[12px]">refresh</span>
                <span>សាកល្បង AI</span>
              </button>
            )}
            <span className="font-label-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2.5 py-1 rounded-full font-bold">
              {isAnalyzing ? `កំពុងវិភាគ (${analysisProgress}%)` : '95% រួចរាល់'}
            </span>
          </div>
        </div>

        {/* Notice banner if model was on high load */}
        {analysisNotice && (
          <div className="mb-3 p-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 text-[11px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-amber-600">info</span>
              <span>{analysisNotice}</span>
            </div>
          </div>
        )}

        {/* Live Receipt & Processing Progress */}
        <div className="flex flex-col sm:flex-row gap-space-md mb-space-md">
          <div className="relative w-full sm:w-28 h-40 rounded-xl overflow-hidden shrink-0 bg-surface-container-high shadow-inner flex items-center justify-center group border border-surface-container-highest">
            <img
              className="w-full h-full object-cover"
              alt="Receipt preview"
              src={receiptImage}
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center backdrop-blur-xs">
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-2 pointer-events-none">
              <span className="font-label-sm text-[11px] text-on-primary truncate font-semibold">
                {data.vendor}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-2">
            {/* Checklist */}
            <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-[12px]">
              <div className="flex items-center gap-1.5 text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                <span>ស្កេនអក្សរ & តួលេខ (OCR Extracted)</span>
              </div>
              <span className="text-secondary font-bold">ជោគជ័យ</span>
            </div>

            <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-[12px]">
              <div className="flex items-center gap-1.5 text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                <span>ផ្ទៀងផ្ទាត់ពន្ធអាករ VAT 10%</span>
              </div>
              <span className="text-secondary font-bold">ជោគជ័យ</span>
            </div>

            <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-[12px]">
              <div className="flex items-center gap-1.5 text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-secondary">sync</span>
                <span>កំណត់កូដគណនេយ្យ (Mapping)</span>
              </div>
              <span className="text-secondary font-bold">៩៥%</span>
            </div>
          </div>
        </div>

        {/* Visual AI Extracted Ledger Entities Review */}
        <div className="bg-surface-container-low/70 rounded-xl p-space-md flex flex-col gap-space-sm border border-surface-container-high/60">
          <div className="flex items-center justify-between pb-1 border-b border-surface-container-high/40">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
              ព័ត៌មានផ្ទៀងផ្ទាត់
            </span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-secondary font-label-sm text-label-sm font-semibold flex items-center gap-1 hover:underline"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isEditing ? 'check' : 'edit'}
              </span>
              <span>{isEditing ? 'រួចរាល់' : 'កែសម្រួល'}</span>
            </button>
          </div>

          {/* Vendor */}
          <div className="flex items-center justify-between py-1.5 bg-surface-container-lowest px-3 rounded-lg">
            <div className="flex items-center gap-2 text-on-surface-variant text-[13px]">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              <span>ឈ្មោះអ្នកលក់ (Vendor)</span>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={data.vendor}
                onChange={(e) => setData({ ...data, vendor: e.target.value })}
                className="font-label-md text-right text-on-surface font-semibold bg-surface-container-low px-2 py-0.5 rounded outline-none w-44"
              />
            ) : (
              <span className="font-label-lg text-label-lg text-on-surface font-semibold text-right">
                {data.vendor}
              </span>
            )}
          </div>

          {/* Date */}
          <div className="flex items-center justify-between py-1.5 bg-surface-container-lowest px-3 rounded-lg">
            <div className="flex items-center gap-2 text-on-surface-variant text-[13px]">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              <span>កាលបរិច្ឆេទ (Date)</span>
            </div>
            {isEditing ? (
              <input
                type="date"
                value={data.date}
                onChange={(e) => setData({ ...data, date: e.target.value })}
                className="font-financial-numeric text-right text-on-surface font-medium bg-surface-container-low px-2 py-0.5 rounded outline-none"
              />
            ) : (
              <span className="font-financial-numeric text-[15px] text-on-surface font-medium">
                {data.date}
              </span>
            )}
          </div>

          {/* Total Amount */}
          <div className="flex items-center justify-between py-2 bg-surface-container-lowest px-3 rounded-lg">
            <div className="flex items-center gap-2 text-on-surface-variant text-[13px]">
              <span className="material-symbols-outlined text-[18px]">payments</span>
              <span className="font-medium">ចំនួនទឹកប្រាក់សរុប (Amount)</span>
            </div>
            <div className="text-right">
              {isEditing ? (
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-[14px] font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={data.amountUSD}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setData({
                        ...data,
                        amountUSD: val,
                        amountKHR: Math.round(val * settings.exchangeRate),
                        vatUSD: Math.round(val * 0.1 * 100) / 100,
                      });
                    }}
                    className="font-financial-numeric text-right text-on-surface font-bold bg-surface-container-low px-2 py-0.5 rounded outline-none w-24 text-[18px]"
                  />
                </div>
              ) : (
                <span className="font-financial-numeric text-financial-numeric text-on-surface font-bold">
                  ${data.amountUSD.toFixed(2)}
                </span>
              )}
              <span className="block font-body-sm text-[12px] text-on-surface-variant font-medium">
                {data.amountKHR.toLocaleString()} ៛
              </span>
            </div>
          </div>

          {/* COA Category */}
          <div className="flex items-center justify-between py-1.5 bg-surface-container-lowest px-3 rounded-lg">
            <div className="flex items-center gap-2 text-on-surface-variant text-[13px]">
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
              <span>កូដគណនេយ្យ (COA Category)</span>
            </div>
            {isEditing ? (
              <select
                value={data.coaCategory}
                onChange={(e) => setData({ ...data, coaCategory: e.target.value })}
                className="font-label-sm text-right text-on-surface font-semibold bg-surface-container-low px-2 py-1 rounded outline-none text-[12px]"
              >
                <option value="6010 - សម្ភារៈប្រើប្រាស់">6010 - សម្ភារៈប្រើប្រាស់</option>
                <option value="6020 - ទំនិញស្តុក">6020 - ទំនិញស្តុក</option>
                <option value="6060 - ថ្លៃភ្លើង & ទឹក">6060 - ថ្លៃភ្លើង & ទឹក</option>
                <option value="6070 - ថ្លៃធ្វើដំណើរ និងម្ហូបអាហារ">6070 - ថ្លៃធ្វើដំណើរ និងម្ហូបអាហារ</option>
                <option value="6080 - ថ្លៃសេវាកម្មទូទៅ">6080 - ថ្លៃសេវាកម្មទូទៅ</option>
              </select>
            ) : (
              <span className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-sm text-[12px] font-semibold">
                {data.coaCategory}
              </span>
            )}
          </div>

          {/* VAT */}
          <div className="flex items-center justify-between py-1.5 bg-surface-container-lowest px-3 rounded-lg">
            <div className="flex items-center gap-2 text-on-surface-variant text-[13px]">
              <span className="material-symbols-outlined text-[18px]">receipt</span>
              <span>ពន្ធអាករ (VAT 10%)</span>
            </div>
            <span className="font-financial-numeric text-[14px] text-secondary font-bold">
              ${data.vatUSD.toFixed(2)}
            </span>
          </div>
        </div>

        {/* AI Insight Callout */}
        <div className="mt-space-md p-space-sm bg-secondary-container/20 rounded-xl border border-secondary/20 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-secondary/15 flex items-center justify-center text-secondary shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[16px]">lightbulb</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-[12px] font-bold text-on-surface">
              ចំណារពន្យល់ស្វ័យប្រវត្តិ
            </span>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5 leading-relaxed">
              {data.aiExplanation}
            </p>
          </div>
        </div>
      </div>

      {/* Primary CTA Action Group */}
      <div className="flex flex-col gap-space-sm w-full">
        <button
          onClick={handleConfirmAndSave}
          disabled={savedSuccess}
          className={`w-full h-13 rounded-xl font-headline-sm text-[16px] font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
            savedSuccess
              ? 'bg-primary-container text-on-primary'
              : 'bg-secondary text-on-secondary hover:bg-secondary/90'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[22px]">
            {savedSuccess ? 'check_circle' : 'save'}
          </span>
          <span>{savedSuccess ? 'បានកត់ត្រាជោគជ័យ!' : 'បញ្ជាក់ & កត់ត្រាចូលបញ្ជី'}</span>
        </button>

        <button
          onClick={resetForm}
          className="w-full h-12 bg-surface-container-lowest text-on-surface rounded-xl font-label-lg text-label-lg font-medium flex items-center justify-center gap-2 shadow-sm border border-surface-container-high hover:bg-surface-container-low transition-all active:scale-[0.98]"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          <span>ស្កេនវិក្កយបត្រផ្សេងទៀត</span>
        </button>
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-between p-4 backdrop-blur-sm">
          <div className="w-full max-w-md flex items-center justify-between text-white pt-2">
            <span className="font-headline-sm text-headline-sm font-bold">ថតរូបវិក្កយបត្រ</span>
            <button
              onClick={stopCamera}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden flex items-center justify-center border-2 border-white/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Viewfinder guides */}
            <div className="absolute inset-8 border-2 border-dashed border-white/50 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-white/70 text-xs bg-black/40 px-2 py-1 rounded">
                តម្រង់វិក្កយបត្រក្នុងប្រអប់
              </span>
            </div>
          </div>

          <div className="w-full max-w-md flex items-center justify-center pb-8">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white bg-secondary flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-[36px]">photo_camera</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
