import React from 'react';

export const AbaVerifyScreen: React.FC = () => {
  return (
    <div className="w-full flex-1 flex flex-col bg-surface-container-lowest min-h-[calc(100vh-4rem)]">
      <iframe
        src="/aba-verify.html"
        title="ផ្ទៀងផ្ទាត់ ABA ជាមួយបំណុលគ្រូពេទ្យ"
        className="w-full flex-1 border-0 min-h-[calc(100vh-4rem)] w-full"
        style={{ minHeight: 'calc(100vh - 4.5rem)' }}
      />
    </div>
  );
};
