import React, { useState } from 'react';

export const AbaVerifyScreen: React.FC = () => {
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(Date.now());
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [iframeKey]);

  return (
    <div className="w-full flex-1 flex flex-col bg-surface-container-lowest min-h-[calc(100vh-4rem)] relative">
      {/* Top Banner Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-surface border-b border-surface-container-high/60 gap-2 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">fact_check</span>
          <span className="font-semibold text-sm text-on-surface">ផ្ទៀងផ្ទាត់ ABA ជាមួយបំណុលគ្រូពេទ្យ</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            type="button"
            className="px-2.5 py-1 text-xs rounded-lg border border-surface-container-high hover:bg-surface-container text-on-surface-variant flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
            title="ផ្ទុកទិន្នន័យឡើងវិញ"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            <span>ផ្ទុកឡើងវិញ</span>
          </button>

          <a
            href="/aba-verify.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary/90 shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
            title="បើកផ្ទៀងផ្ទាត់ ABA ក្នុងផ្ទាំងថ្មីពេញអេក្រង់ ដើម្បីបោះពុម្ព និងមើលទិន្នន័យស្រួលជាងគេ"
          >
            <span>↗ បើកពេញអេក្រង់ (Full Screen)</span>
          </a>
        </div>
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 top-11 bg-surface/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-secondary text-[36px] animate-spin">
            progress_activity
          </span>
          <p className="text-sm font-semibold text-on-surface">
            កំពុងដំណើរការផ្ទៀងផ្ទាត់ ABA...
          </p>
        </div>
      )}

      {/* Iframe */}
      <iframe
        key={iframeKey}
        src={`/aba-verify.html?v=${iframeKey}`}
        title="ផ្ទៀងផ្ទាត់ ABA ជាមួយបំណុលគ្រូពេទ្យ"
        onLoad={() => setIsLoading(false)}
        className="w-full flex-1 border-0 min-h-[calc(100vh-6.5rem)]"
        style={{ minHeight: 'calc(100vh - 6.5rem)' }}
      />
    </div>
  );
};
