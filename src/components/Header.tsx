import React from 'react';
import { APP_LOGO, USER_AVATAR } from '../data/mockData.ts';

interface HeaderProps {
  currentTab: string;
  unreadNotifsCount: number;
  userAvatar?: string;
  onTabChange?: (tab: string) => void;
  onOpenNotifications: () => void;
  onGoToSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  unreadNotifsCount,
  userAvatar,
  onTabChange,
  onOpenNotifications,
  onGoToSettings,
}) => {
  const navTabs = [
    { id: 'dashboard', label: 'ទំព័រដើម', icon: 'dashboard' },
    { id: 'aba-verify', label: 'ផ្ទៀងផ្ទាត់ ABA', icon: 'fact_check' },
    { id: 'upload-ingestion', label: 'បញ្ចូលពត៌មាន', icon: 'cloud_upload' },
    { id: 'ledger-list', label: 'បញ្ជីទិន្នន័យ (Excel)', icon: 'receipt_long' },
    { id: 'settings', label: 'ការកំណត់', icon: 'settings' },
  ];

  const getSubTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'ទិដ្ឋភាពទូទៅ';
      case 'aba-verify':
        return 'ផ្ទៀងផ្ទាត់ ABA ជាមួយបំណុល';
      case 'upload-ingestion':
        return 'បញ្ចូលវិក្កយបត្រ';
      case 'ledger-list':
        return 'សៀវភៅធំ Excel';
      case 'settings':
        return 'ការកំណត់';
      default:
        return 'ទិដ្ឋភាពទូទៅ';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-xs border-b border-surface-container-high/50">
      <div className="w-full max-w-[1600px] mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-space-sm">
        {/* Brand / Logo */}
        <div className="flex items-center gap-space-sm shrink-0">
          <img
            alt="Khema Digital Dental Solution Logo"
            className="h-9 w-auto max-w-[110px] object-contain shrink-0 rounded-lg p-0.5 bg-white border border-surface-container-high/60 shadow-xs cursor-pointer"
            src={APP_LOGO}
            onClick={() => onTabChange && onTabChange('dashboard')}
          />
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-[16px] text-on-surface truncate tracking-tight font-bold">
              ខេមា Dental AI
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant truncate md:hidden">
              {getSubTitle()}
            </span>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on mobile, visible on desktop) */}
        {onTabChange && (
          <nav className="hidden md:flex items-center gap-1.5 bg-surface-container-low/80 p-1.5 rounded-2xl border border-surface-container-high/60 shadow-xs">
            {navTabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  type="button"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-label-md text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-secondary text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Action icons: notifications & avatar */}
        <div className="flex items-center gap-space-xs shrink-0">
          <button
            aria-label="Notifications"
            className="relative w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-full transition-colors active:scale-95 cursor-pointer"
            type="button"
            onClick={onOpenNotifications}
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadNotifsCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-error ring-2 ring-surface"></span>
            )}
          </button>
          <button
            aria-label="User Profile"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:ring-2 hover:ring-secondary/40 transition-all active:scale-95 cursor-pointer"
            type="button"
            onClick={onGoToSettings}
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-surface-container-high"
              src={userAvatar || USER_AVATAR}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
