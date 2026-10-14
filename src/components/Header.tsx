import React from 'react';
import { APP_LOGO, USER_AVATAR } from '../data/mockData.ts';

interface HeaderProps {
  currentTab: string;
  unreadNotifsCount: number;
  userAvatar?: string;
  onOpenNotifications: () => void;
  onGoToSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  unreadNotifsCount,
  userAvatar,
  onOpenNotifications,
  onGoToSettings,
}) => {
  const getSubTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'upload-ingestion':
        return 'Upload Ingestion';
      case 'ledger-list':
        return 'Ledger List';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-surface-container-high/40">
      <div className="max-w-md mx-auto h-16 px-margin flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm min-w-0 flex-1">
          <img
            alt="Khema Digital Dental Solution Logo"
            className="h-9 w-auto max-w-[110px] object-contain shrink-0 rounded-lg p-0.5 bg-white border border-surface-container-high/60 shadow-xs"
            src={APP_LOGO}
          />
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm text-on-surface truncate tracking-tight font-bold">
              ខេមា Dental AI
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {getSubTitle()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-xs shrink-0">
          <button
            aria-label="Notifications"
            className="relative w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-full transition-colors active:scale-95"
            type="button"
            onClick={onOpenNotifications}
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadNotifsCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-error ring-2 ring-surface"></span>
            )}
          </button>
          <button
            aria-label="User Profile"
            className="w-11 h-11 flex items-center justify-center rounded-full hover:ring-2 hover:ring-secondary/40 transition-all active:scale-95"
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
