import React from 'react';

export const AbaVerifyScreen: React.FC = () => {
  return (
    <div className="w-full flex-1 flex flex-col bg-surface-container-lowest min-h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-surface-container-high/60 text-xs">
        <span className="font-semibold text-on-surface">ផ្ទៀងផ្ទាត់ ABA ជាមួយបំណុលគ្រូពេទ្យ</span>
        <a
          href="/aba-verify.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary hover:underline font-bold flex items-center gap-1"
        >
          <span>↗ បើកពេញអេក្រង់ (Open in New Tab)</span>
        </a>
      </div>
      <iframe
        src="/aba-verify.html?v=5"
        title="ផ្ទៀងផ្ទាត់ ABA ជាមួយបំណុលគ្រូពេទ្យ"
        className="w-full flex-1 border-0 min-h-[calc(100vh-6.5rem)]"
        style={{ minHeight: 'calc(100vh - 6.5rem)' }}
      />
    </div>
  );
};
