import React from 'react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    {
      id: 'dashboard',
      label: 'ទំព័រដើម',
      icon: 'dashboard',
    },
    {
      id: 'aba-verify',
      label: 'ផ្ទៀងផ្ទាត់ ABA',
      icon: 'fact_check',
    },
    {
      id: 'upload-ingestion',
      label: 'បញ្ចូលពត៌មាន',
      icon: 'cloud_upload',
    },
    {
      id: 'ledger-list',
      label: 'បញ្ជីទិន្នន័យ',
      icon: 'receipt_long',
    },
    {
      id: 'settings',
      label: 'ការកំណត់',
      icon: 'settings',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-surface/90 backdrop-blur-xl md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.04)] border-t border-surface-container-high/40">
      <div className="w-full max-w-lg mx-auto flex items-center justify-around h-16 px-space-xs">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[64px] h-12 transition-all active:scale-95 ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform ${
                  isActive ? 'scale-110 font-bold fill-1' : ''
                }`}
              >
                {tab.icon}
              </span>
              <span className={`font-label-sm text-label-sm mt-space-xs ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
