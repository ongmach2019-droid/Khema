import React, { useState, useRef } from 'react';
import { AppSettings } from '../types.ts';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onLogout,
}) => {
  const [isUpdatingRate, setIsUpdatingRate] = useState<boolean>(false);
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>(settings.userName);
  const [profileRole, setProfileRole] = useState<string>(settings.userRole);
  const [profileAvatar, setProfileAvatar] = useState<string>(settings.userAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
};
