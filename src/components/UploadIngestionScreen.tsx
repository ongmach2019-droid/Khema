import React, { useState, useRef, useEffect } from 'react';
import { Transaction, AppSettings } from '../types.ts';
import { compressAndPrepareImage } from '../utils/imageUtils.ts';

interface UploadIngestionScreenProps {
  settings: AppSettings;
  onSaveTransaction: (tx: Transaction) => void;
  initialFile?: File | null;
}

export interface ExtractedData {
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

export interface BatchReceiptItem {
  id: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  extractedData: ExtractedData;
  error?: string;
}

export const UploadIngestionScreen: React.FC<UploadIngestionScreenProps> = ({
  settings,
  onSaveTransaction,
  initialFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const EMPTY_EXTRACTED_DATA: ExtractedData = {
    vendor: '---',
    date: '---',
    amountUSD: 0,
    amountKHR: 0,
    vatUSD: 0,
    coaCode: '---',
    coaCategory: '---',
    status: 'paid',
    aiExplanation: 'សូមបញ្ចូលរូបភាព ឬថតរូបវិក្កយបត្រ ដើម្បីឱ្យ AI វិភាគទិន្នន័យ។',
    ocrConfidence: 0,
  };

  // Batch Multi-Image State
  const [batchItems, setBatchItems] = useState<BatchReceiptItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Active review data & image
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [data, setData] = useState<ExtractedData>(EMPTY_EXTRACTED_DATA);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisSource, setAnalysisSource] = useState<string>('gemini');
  const [analysisNotice, setAnalysisNotice] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string>('');
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Sync camera stream to video element whenever modal opens or stream updates
  useEffect(() => {
    if (showCameraModal && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => console.warn('Camera video play error:', err));
    }
  }, [showCameraModal, cameraStream]);

  // If initialFile is passed from dashboard
  useEffect(() => {
    if (initialFile) {
      processMultipleFiles([initialFile]);
    }
  }, [initialFile]);

  // Window paste listener (Ctrl+V) from Telegram or Clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        const imageFiles: File[] = [];
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) imageFiles.push(file);
          }
        }
        if (imageFiles.length > 0) {
          processMultipleFiles(imageFiles);
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
        const imageFiles: File[] = [];
        for (const item of clipboardItems) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            imageFiles.push(new File([blob], `paste_${Date.now()}.png`, { type: imgType }));
          }
        }
        if (imageFiles.length > 0) {
          processMultipleFiles(imageFiles);
          return;
        }
      }
      alert('សូមចុច Ctrl+V លើក្ដារចុចដើម្បី Paste រូបភាពពី Telegram ផ្ទាល់!');
    } catch (err) {
      alert('សូមចុច Ctrl+V ដើម្បី Paste រូបភាពពី Telegram ដោយផ្ទាល់!');
    }
  };

  // Process single or multiple files into batch queue
  const processMultipleFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisProgress(20);

    const newItems: BatchReceiptItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { dataUrl, mimeType } = await compressAndPrepareImage(file);
        if (dataUrl) {
          newItems.push({
            id: `batch-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            dataUrl,
            mimeType,
            fileName: file.name,
            status: 'analyzing',
            extractedData: {
              ...EMPTY_EXTRACTED_DATA,
              vendor: `វិក្កយបត្រ ${file.name.replace(/\.[^/.]+$/, '')}`,
            },
          });
        }
      } catch (err) {
        console.warn('Image compression fallback:', err);
      }
    }

    if (newItems.length === 0) {
      alert('មិនអាចបើករូបភាពបានទេ។ សូមសាកល្បងម្ដងទៀត!');
      setIsAnalyzing(false);
      return;
    }

    setBatchItems((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0 && updated.length > 0) {
        setActiveIndex(0);
        setReceiptImage(updated[0].dataUrl);
        setData(updated[0].extractedData);
      }
      return updated;
    });

    // Run AI analysis sequentially or in small concurrency
    for (const item of newItems) {
      await runAiForItem(item);
    }

    setIsAnalyzing(false);
    setAnalysisProgress(100);
  };

  // Run AI analysis for a specific batch item
  const runAiForItem = async (item: BatchReceiptItem) => {
    const currentKey = (localStorage.getItem('gemini_api_key') || '').trim();

    try {
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: item.dataUrl,
          mimeType: item.mimeType,
          vendorHint: item.fileName,
          apiKey: currentKey || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysisSource(result.source || 'gemini');
        if (result.notice) setAnalysisNotice(result.notice);

        if (result.data) {
          const d = result.data;
          const parsedData: ExtractedData = {
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
          };

          // Update item in batch
          setBatchItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'done', extractedData: parsedData }
                : it
            )
          );

          // If active item, update current view
          setBatchItems((currentList) => {
            const foundIdx = currentList.findIndex((x) => x.id === item.id);
            if (foundIdx === activeIndex || (foundIdx === 0 && currentList.length === 1)) {
              setData(parsedData);
              setReceiptImage(item.dataUrl);
            }
            return currentList;
          });
        }
      } else {
        setBatchItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'error' } : it))
        );
      }
    } catch (err) {
      console.warn('Analysis error for item:', err);
      setBatchItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'error' } : it))
      );
    }
  };

  // Handle switching active receipt thumbnail
  const handleSelectThumbnail = (index: number) => {
    if (index >= 0 && index < batchItems.length) {
      setActiveIndex(index);
      const it = batchItems[index];
      setReceiptImage(it.dataUrl);
      setData(it.extractedData);
    }
  };

  // Remove a receipt from batch queue
  const handleRemoveBatchItem = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = batchItems.filter((_, i) => i !== index);
    setBatchItems(updated);
    if (updated.length === 0) {
      resetForm();
    } else {
      const nextIdx = Math.min(activeIndex, updated.length - 1);
      setActiveIndex(nextIdx);
      setReceiptImage(updated[nextIdx].dataUrl);
      setData(updated[nextIdx].extractedData);
    }
  };

  // Handle File Input Change (Supports Multiple Images)
  const handleMultipleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processMultipleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // Re-run AI for active item
  const analyzeActiveWithAI = async () => {
    if (batchItems.length > 0 && batchItems[activeIndex]) {
      const it = batchItems[activeIndex];
      await runAiForItem(it);
    } else if (receiptImage) {
      setIsAnalyzing(true);
      await runAiForItem({
        id: 'single',
        dataUrl: receiptImage,
        mimeType: 'image/jpeg',
        fileName: 'Receipt',
        status: 'analyzing',
        extractedData: data,
      });
      setIsAnalyzing(false);
    }
  };

  // In-Browser Live Camera
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraInputRef.current?.click();
        return;
      }
      setShowCameraModal(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraStream(stream);
    } catch (err) {
      console.warn('Camera permission denied or unavailable, opening native camera selector:', err);
      setShowCameraModal(false);
      cameraInputRef.current?.click();
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const width = videoRef.current.videoWidth || 1280;
      const height = videoRef.current.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const capturedFile = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopCamera();
            await processMultipleFiles([capturedFile]);
          }
        }, 'image/jpeg', 0.88);
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

  // Helper to make Transaction object from ExtractedData
  const buildTransaction = (d: ExtractedData, img: string): Transaction => {
    return {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      ref: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      vendor: d.vendor,
      vendorKh: d.vendor,
      category: d.coaCategory.split('-')[1]?.trim() || 'សម្ភារៈ',
      categoryCode: d.coaCategory,
      date: d.date,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amountUSD: d.amountUSD,
      amountKHR: d.amountKHR,
      vatUSD: d.vatUSD,
      type: 'expense',
      status: d.status,
      statusTextKh: d.status === 'paid' ? 'បានបង់' : 'ជំពាក់',
      iconName: d.coaCategory.includes('ស្តុក')
        ? 'inventory_2'
        : d.coaCategory.includes('ភ្លើង')
        ? 'bolt'
        : d.coaCategory.includes('ម្ហូប')
        ? 'local_cafe'
        : 'shopping_cart',
      receiptImage: img,
      items: d.items,
      aiExplanation: d.aiExplanation,
      ocrConfidence: d.ocrConfidence,
    };
  };

  // Save current active receipt
  const handleSaveCurrent = () => {
    if (!receiptImage || data.amountUSD === 0) {
      alert('សូមបញ្ចូល ឬថតរូបភាពវិក្កយបត្រជាមុនសិន!');
      fileInputRef.current?.click();
      return;
    }

    const newTx = buildTransaction(data, receiptImage);
    onSaveTransaction(newTx);

    // Also remove from batch queue if present
    if (batchItems.length > 1) {
      const remaining = batchItems.filter((_, i) => i !== activeIndex);
      setBatchItems(remaining);
      const nextIdx = Math.min(activeIndex, remaining.length - 1);
      setActiveIndex(nextIdx);
      setReceiptImage(remaining[nextIdx].dataUrl);
      setData(remaining[nextIdx].extractedData);
      setSavedSuccessMsg(`បានកត់ត្រាវិក្កយបត្រ «${data.vendor}» ជោគជ័យ!`);
    } else {
      setSavedSuccessMsg('បានកត់ត្រាវិក្កយបត្រជោគជ័យ!');
      resetForm();
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setSavedSuccessMsg('');
    }, 2800);
  };

  // Save ALL completed receipts in batch
  const handleSaveAllBatch = async () => {
    const readyItems = batchItems.filter(
      (item) => item.status === 'done' && item.extractedData.amountUSD > 0
    );

    if (readyItems.length === 0) {
      alert('មិនទាន់មានវិក្កយបត្រដែលវិភាគរួចរាល់សម្រាប់កត់ត្រានៅឡើយទេ!');
      return;
    }

    const txsToSave: Transaction[] = readyItems.map((item) =>
      buildTransaction(item.extractedData, item.dataUrl)
    );

    // Save batch to server
    try {
      await fetch('/api/save-batch-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: txsToSave }),
      });
    } catch (e) {
      console.warn('Batch server sync notice:', e);
    }

    // Update frontend state
    txsToSave.forEach((tx) => onSaveTransaction(tx));

    setSavedSuccessMsg(`បានកត់ត្រាវិក្កយបត្រទាំង ${txsToSave.length} ចូលក្នុងបញ្ជីជោគជ័យ!`);
    setSavedSuccess(true);

    // Reset batch state
    setBatchItems([]);
    resetForm();

    setTimeout(() => {
      setSavedSuccess(false);
      setSavedSuccessMsg('');
    }, 3500);
  };

  const resetForm = () => {
    setReceiptImage('');
    setData(EMPTY_EXTRACTED_DATA);
    setAnalysisProgress(0);
    setSavedSuccess(false);
    setSavedSuccessMsg('');
  };

  const completedBatchCount = batchItems.filter((it) => it.status === 'done').length;

  return (
    <div className="flex flex-col w-full px-margin pb-32 pt-2">
      {/* Eyebrow & Headline */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/80 text-on-secondary-container font-label-sm text-[12px] font-semibold border border-secondary/20 shadow-xs">
          <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
          ប្រព័ន្ធ AI ស្កេនច្រើនរូបភាព (Multi-Scan Batch) សកម្ម
        </span>
      </div>

      <div className="mb-space-md">
        <h1 className="font-display-lg-mobile text-[26px] text-on-surface tracking-tight font-bold">
          បញ្ចូល និងស្កេនវិក្កយបត្រ
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">
          អាចដាក់ ឬថតរូបវិក្កយបត្រ<strong>ម្ដងបានច្រើន</strong> • AI នឹងដកស្រង់ទិន្នន័យដោយស្វ័យប្រវត្តិ
        </p>
      </div>

      {/* Upload Target Zone (Supports Multi-Selection) */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-md relative overflow-hidden border border-surface-container-high/60 group">
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-secondary-container/30 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center py-space-md px-space-sm bg-surface-container-low/70 rounded-xl text-center border border-dashed border-surface-container-highest">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-space-sm shadow-inner relative">
            <span className="material-symbols-outlined text-[32px]">photo_camera</span>
            {isAnalyzing && (
              <span className="absolute inset-0 rounded-full border-2 border-secondary border-t-transparent animate-spin"></span>
            )}
          </div>

          <span className="font-headline-sm text-headline-sm text-on-surface mb-1 font-bold">
            ទម្លាក់ឯកសារ ឬ ចុចដើម្បីស្កេន (ច្រើនរូប)
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant max-w-[280px] mb-space-md">
            ជ្រើសរើសរូបពី Gallery ម្ដងបាន ២-១០ រូប ឬចុចថតរូបបន្តបន្ទាប់គ្នា
          </span>

          <div className="flex flex-col items-center gap-space-sm w-full max-w-sm justify-center">
            {/* Direct Native Camera & Multi-Gallery Buttons */}
            <div className="flex items-center gap-space-sm w-full justify-center">
              <label
                htmlFor="upload-native-camera"
                className="flex items-center justify-center gap-1.5 h-12 px-space-md bg-secondary text-on-secondary rounded-xl font-label-lg text-label-lg font-semibold shadow-sm hover:bg-secondary/90 transition-transform active:scale-95 flex-1 min-w-[130px] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                <span>ថតរូបភាព</span>
                <input
                  id="upload-native-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleMultipleFilesChange}
                  className="sr-only"
                />
              </label>

              <label
                htmlFor="upload-gallery-multi"
                className="flex items-center justify-center gap-1.5 h-12 px-space-md bg-surface-container-highest hover:bg-surface-container-high text-on-surface rounded-xl font-label-lg text-label-lg font-semibold shadow-xs transition-transform active:scale-95 flex-1 min-w-[130px] border border-surface-container-high cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">photo_library</span>
                <span>ជ្រើសពី Gallery (ច្រើនរូប)</span>
                <input
                  id="upload-gallery-multi"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultipleFilesChange}
                  className="sr-only"
                />
              </label>
            </div>

            {/* In-Browser Live Video Camera & Paste Telegram Options */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                onClick={startCamera}
                className="flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high border border-surface-container-high text-on-surface font-label-sm text-[12px] font-semibold transition-all active:scale-95"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px] text-secondary">videocam</span>
                <span>កាមេរ៉ាស្កេនផ្ទាល់</span>
              </button>

              <button
                onClick={handleClipboardPasteClick}
                className="flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/30 text-emerald-800 font-label-sm text-[12px] font-semibold transition-all active:scale-95"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px] text-emerald-600">content_paste</span>
                <span>Paste Telegram</span>
              </button>
            </div>
          </div>

          <div className="mt-space-md flex items-center gap-1 text-on-surface-variant text-[12px]">
            <span className="material-symbols-outlined text-[15px]">info</span>
            <span>គាំទ្រស្កេនរូបច្រើនក្នុងពេលតែមួយ (បង្រួមទំហំស្វ័យប្រវត្តិ)</span>
          </div>
        </div>

        {/* Fallback hidden input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={handleMultipleFilesChange}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={cameraInputRef}
          capture="environment"
          onChange={handleMultipleFilesChange}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* Batch Thumbnail Carousel Strip (When multi-images are uploaded) */}
      {batchItems.length > 0 && (
        <div className="w-full bg-surface-container-lowest rounded-2xl p-3 shadow-sm mb-space-md border border-secondary/30 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">collections</span>
              <span className="font-label-md text-xs font-bold text-on-surface">
                បញ្ជីវិក្កយបត្រកំពុងស្កេន ({batchItems.length} រូប)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[11px] font-bold">
              {completedBatchCount}/{batchItems.length} វិភាគរួចរាល់
            </span>
          </div>

          {/* Horizontal scrollable thumbnails */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {batchItems.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectThumbnail(idx)}
                  className={`relative w-20 h-24 rounded-xl overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${
                    isSelected
                      ? 'border-secondary ring-2 ring-secondary/30 scale-102 shadow-sm'
                      : 'border-surface-container-high opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={item.dataUrl}
                    alt={`Receipt ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Status indicator badge */}
                  <div className="absolute top-1 left-1">
                    {item.status === 'analyzing' && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] animate-spin">
                        sync
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="w-4 h-4 rounded-full bg-error text-white flex items-center justify-center text-[10px]">
                        !
                      </span>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleRemoveBatchItem(idx, e)}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-[11px] transition-colors"
                    title="លុបរូបនេះ"
                  >
                    ×
                  </button>

                  {/* Label / Amount overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-center">
                    <span className="text-[10px] text-white font-mono font-bold block truncate">
                      {item.extractedData.amountUSD > 0
                        ? `$${item.extractedData.amountUSD.toFixed(2)}`
                        : `#${idx + 1}`}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Snap / Add More Card at end of strip */}
            <label
              htmlFor="upload-gallery-multi-more"
              className="w-20 h-24 rounded-xl border-2 border-dashed border-secondary/40 bg-secondary/5 hover:bg-secondary/10 flex flex-col items-center justify-center gap-1 cursor-pointer shrink-0 text-secondary transition-colors"
              title="បន្ថែមរូបភាពទៀត"
            >
              <span className="material-symbols-outlined text-[22px]">add_photo_alternate</span>
              <span className="text-[10px] font-bold">+ ថែមរូប</span>
              <input
                id="upload-gallery-multi-more"
                type="file"
                accept="image/*"
                multiple
                onChange={handleMultipleFilesChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}

      {/* Real-time Processing Card with Receipt Preview */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-lg border border-surface-container-high/60">
        {/* Header of preview */}
        <div className="flex items-center justify-between pb-3 mb-space-md border-b border-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">smart_toy</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-[16px] text-on-surface font-bold">
                ដំណើរការវិភាគ AI {batchItems.length > 1 ? `(រូបទី ${activeIndex + 1}/${batchItems.length})` : '(ផ្ទាល់)'}
              </span>
              <span className="text-[10px] text-on-surface-variant">
                ម៉ាស៊ីន: {analysisSource.startsWith('gemini') ? analysisSource : 'Smart Receipt Engine'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {receiptImage && !isAnalyzing && (
              <button
                onClick={analyzeActiveWithAI}
                className="font-label-sm text-[10px] text-secondary bg-secondary-container/40 hover:bg-secondary-container px-2 py-0.5 rounded-full flex items-center gap-0.5 active:scale-95 transition-transform"
                title="សាកល្បងវិភាគឡើងវិញជាមួយ AI"
                type="button"
              >
                <span className="material-symbols-outlined text-[12px]">refresh</span>
                <span>សាកល្បង AI</span>
              </button>
            )}
            <span className="font-label-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2.5 py-1 rounded-full font-bold">
              {isAnalyzing
                ? `កំពុងវិភាគ (${analysisProgress}%)`
                : receiptImage
                ? `${data.ocrConfidence || 95}% រួចរាល់`
                : 'រង់ចាំរូបភាព (០%)'}
            </span>
          </div>
        </div>

        {/* Notice banner */}
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
          {receiptImage ? (
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
          ) : (
            <label
              htmlFor="receipt-dashed-box-input"
              className="w-full sm:w-28 h-40 rounded-xl bg-surface-container-low border border-dashed border-surface-container-highest flex flex-col items-center justify-center text-on-surface-variant p-2 text-center cursor-pointer hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[24px] mb-1">image</span>
              <span className="font-label-sm text-[10px]">មិនទាន់មានរូប</span>
              <input
                id="receipt-dashed-box-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleMultipleFilesChange}
                className="sr-only"
              />
            </label>
          )}

          {/* Real-time confidence card */}
          <div className="flex-1 flex flex-col justify-between py-0.5">
            <div>
              <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1.5 font-medium">
                <span>កម្រិតទំនុកចិត្ត (OCR Confidence)</span>
                <span className="font-mono font-bold text-on-surface">
                  {receiptImage ? `${data.ocrConfidence || 95}%` : '0%'}
                </span>
              </div>
              <div className="w-full bg-surface-container-low rounded-full h-2 overflow-hidden border border-surface-container-high">
                <div
                  className="bg-secondary h-full rounded-full transition-all duration-300"
                  style={{ width: `${receiptImage ? data.ocrConfidence || 95 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-container-low/70 border border-surface-container-high/40 mt-2">
              <span className="font-label-sm text-[11px] text-on-surface-variant block mb-1">
                ស្ថានភាពទិន្នន័យ
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  {data.amountUSD > 0
                    ? `រកឃើញទិន្នន័យ៖ $${data.amountUSD.toFixed(2)} (${data.amountKHR.toLocaleString()} រៀល)`
                    : 'រង់ចាំការបញ្ចូលរូបភាពដើម្បីគណនា'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification & Manual Correction Form */}
        <div className="border-t border-surface-container-high/60 pt-space-md">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              ផ្ទៀងផ្ទាត់ទិន្នន័យស្រង់ចេញ {batchItems.length > 1 && `(រូប #${activeIndex + 1})`}
            </span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="font-label-sm text-label-sm text-secondary hover:underline flex items-center gap-1 font-semibold"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isEditing ? 'check' : 'edit'}
              </span>
              <span>{isEditing ? 'រួចរាល់' : 'កែប្រែដោយដៃ'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            {/* Vendor field */}
            <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
              <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                អ្នកផ្គត់ផ្គង់ / ហាង (Vendor)
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={data.vendor}
                  onChange={(e) => {
                    const newVendor = e.target.value;
                    setData((prev) => ({ ...prev, vendor: newVendor }));
                    if (batchItems[activeIndex]) {
                      setBatchItems((prev) =>
                        prev.map((it, idx) =>
                          idx === activeIndex
                            ? { ...it, extractedData: { ...it.extractedData, vendor: newVendor } }
                            : it
                        )
                      );
                    }
                  }}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-2.5 py-1 text-sm font-semibold outline-none focus:border-secondary"
                />
              ) : (
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold block truncate">
                  {data.vendor}
                </span>
              )}
            </div>

            {/* Date field */}
            <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
              <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                កាលបរិច្ឆេទ (Date)
              </span>
              {isEditing ? (
                <input
                  type="date"
                  value={data.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setData((prev) => ({ ...prev, date: newDate }));
                    if (batchItems[activeIndex]) {
                      setBatchItems((prev) =>
                        prev.map((it, idx) =>
                          idx === activeIndex
                            ? { ...it, extractedData: { ...it.extractedData, date: newDate } }
                            : it
                        )
                      );
                    }
                  }}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-2.5 py-1 text-sm font-semibold outline-none focus:border-secondary"
                />
              ) : (
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold block">
                  {data.date}
                </span>
              )}
            </div>

            {/* Total USD */}
            <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
              <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                ទឹកប្រាក់សរុប (USD)
              </span>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={data.amountUSD}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const khr = Math.round(val * settings.exchangeRate);
                      setData((prev) => ({
                        ...prev,
                        amountUSD: val,
                        amountKHR: khr,
                      }));
                      if (batchItems[activeIndex]) {
                        setBatchItems((prev) =>
                          prev.map((it, idx) =>
                            idx === activeIndex
                              ? { ...it, extractedData: { ...it.extractedData, amountUSD: val, amountKHR: khr } }
                              : it
                          )
                        );
                      }
                    }}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg pl-6 pr-2.5 py-1 text-sm font-bold text-primary outline-none focus:border-secondary"
                  />
                </div>
              ) : (
                <span className="font-headline-sm text-headline-sm text-primary font-bold block">
                  ${data.amountUSD.toFixed(2)}
                </span>
              )}
            </div>

            {/* Total KHR */}
            <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
              <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                ទឹកប្រាក់រៀល (KHR 4,100)
              </span>
              <span className="font-headline-sm text-headline-sm text-secondary font-bold block">
                {data.amountKHR.toLocaleString()} ៛
              </span>
            </div>

            {/* COA Suggestion */}
            <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40 md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  ប្លង់គណនេយ្យកំណត់ដោយ AI (Chart of Accounts)
                </span>
                <span className="text-[11px] font-mono text-secondary font-semibold bg-secondary/10 px-2 py-0.5 rounded">
                  {data.coaCode}
                </span>
              </div>
              <span className="font-label-lg text-label-lg text-on-surface font-semibold block">
                {data.coaCategory}
              </span>
            </div>
          </div>
        </div>

        {/* AI Explanation Accordion */}
        <div className="mt-space-md p-space-sm rounded-xl bg-surface-container-low/50 border border-surface-container-high/40 flex items-start gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">
            auto_awesome
          </span>
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

      {/* Success Banner */}
      {savedSuccessMsg && (
        <div className="mb-space-md p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 shadow-xs animate-in fade-in">
          <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
          <span className="text-xs font-bold">{savedSuccessMsg}</span>
        </div>
      )}

      {/* Primary CTA Action Group */}
      <div className="flex flex-col gap-space-sm w-full">
        {/* If multiple items in batch, provide Batch Save All button */}
        {batchItems.length > 1 ? (
          <>
            <button
              onClick={handleSaveAllBatch}
              disabled={savedSuccess || completedBatchCount === 0}
              className="w-full h-13 rounded-xl font-headline-sm text-[16px] font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] bg-secondary text-on-secondary hover:bg-secondary/90 disabled:opacity-50"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">done_all</span>
              <span>
                កត់ត្រាទាំងអស់ ({completedBatchCount}/{batchItems.length} វិក្កយបត្រ)
              </span>
            </button>

            <button
              onClick={handleSaveCurrent}
              disabled={savedSuccess || data.amountUSD === 0}
              className="w-full h-11 bg-surface-container-lowest text-secondary rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-xs border border-secondary/40 hover:bg-secondary/5 transition-all active:scale-[0.98]"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>កត់ត្រាតែរូបនេះ (#{activeIndex + 1})</span>
            </button>
          </>
        ) : receiptImage ? (
          <button
            onClick={handleSaveCurrent}
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
            <span>
              {savedSuccess ? 'បានកត់ត្រាជោគជ័យ!' : 'បញ្ជាក់ & កត់ត្រាចូលបញ្ជី'}
            </span>
          </button>
        ) : (
          <label
            htmlFor="bottom-primary-camera-input"
            className="w-full h-13 rounded-xl font-headline-sm text-[16px] font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] bg-surface-container-highest text-on-surface hover:bg-surface-container-high border border-surface-container-high cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">photo_camera</span>
            <span>សូមដាក់រូបភាពជាមុនសិន</span>
            <input
              id="bottom-primary-camera-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleMultipleFilesChange}
              className="sr-only"
            />
          </label>
        )}

        <button
          onClick={() => {
            setBatchItems([]);
            resetForm();
          }}
          className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl font-label-lg text-label-lg font-medium flex items-center justify-center gap-2 shadow-sm border border-surface-container-high hover:bg-surface-container-low transition-all active:scale-[0.98]"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          <span>ជម្រះ & ស្កេនរូបភាពថ្មី</span>
        </button>
      </div>

      {/* Live Camera Modal */}
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
              muted
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
