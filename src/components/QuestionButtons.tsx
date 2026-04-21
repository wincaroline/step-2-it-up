import React from 'react';

export interface QuestionButtonsProps {
  onUpdate: (amount: number) => void;
  isTestMode: boolean;
  isWarningMode: boolean;
  isSleepMode: boolean;
  isHistoryModal?: boolean;
  compact?: boolean;
  reviewLayout?: boolean;
  reviewCount?: number;
}

export const QuestionButtons = React.memo(function QuestionButtons({
  onUpdate,
  isTestMode,
  isWarningMode,
  isSleepMode,
  isHistoryModal = false,
  compact = false,
  reviewLayout = false,
  reviewCount,
}: QuestionButtonsProps) {
  const getButtonClass = (amount: number) => {
    const base = compact
      ? 'question-count-clay-btn font-black text-xs transition-all rounded-lg flex-1 px-2 py-2'
      : isHistoryModal
      ? 'question-count-clay-btn font-black text-[10px] sm:text-[11px] transition-all rounded-lg flex-1 min-w-0 px-2 py-2 tabular-nums'
      : 'question-count-clay-btn font-black text-sm transition-all rounded-xl flex-1 px-2 sm:px-2.5 py-3';

    if (reviewLayout) {
      if (amount < 0) {
        if (isSleepMode) return `${base} bg-emerald-900 border-emerald-950 text-emerald-100 hover:bg-emerald-800`;
        if (isWarningMode) return `${base} bg-emerald-700 border-emerald-800 text-white hover:bg-emerald-600`;
        return `${base} bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600`;
      }
      if (isSleepMode) return `${base} bg-white/15 border-white/20 text-blue-100 backdrop-blur-md hover:bg-white/25`;
      if (isWarningMode) return `${base} bg-white/75 border-white/70 text-gray-900 backdrop-blur-md hover:bg-white/90`;
      return `${base} bg-white/20 border-white/30 text-[#118AC0] backdrop-blur-md hover:bg-white/30`;
    }

    if (amount < 0) {
      if (isSleepMode) return `${base} bg-gray-800 border-gray-950 text-white hover:bg-gray-700`;
      if (isWarningMode) return `${base} bg-red-900 border-red-950 text-red-100 hover:bg-red-800`;
      return `${base} bg-gray-400 border-gray-500 text-white hover:bg-gray-500`;
    }
    if (isSleepMode) return `${base} bg-blue-900 border-blue-950 text-blue-100 hover:bg-blue-800`;
    if (isWarningMode) return `${base} bg-white border-gray-200 text-gray-900 hover:bg-gray-100`;
    return `${base} bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600`;
  };

  const getOpacity = (amount: number) => {
    if (amount === 1) return 'bg-opacity-60';
    if (amount === 10) return 'bg-opacity-80';
    return 'bg-opacity-100';
  };

  const shouldShowReviewMinusTen = !reviewLayout || typeof reviewCount !== 'number' || reviewCount >= 10;

  if (reviewLayout) {
    return (
      <div className="flex flex-nowrap items-stretch gap-1 sm:gap-1.5 w-full min-w-0">
        <button type="button" onClick={() => onUpdate(1)} className={`${getButtonClass(1)} ${getOpacity(1)}`}>
          +1
        </button>
        <button type="button" onClick={() => onUpdate(10)} className={`${getButtonClass(10)} ${getOpacity(10)}`}>
          +10
        </button>
        <div className="w-2 shrink-0" aria-hidden />
        <button type="button" onClick={() => onUpdate(-1)} className={getButtonClass(-1)}>
          <span className="inline-flex items-center justify-center gap-1">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3 w-3"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.5 8.5L6.5 11.5L12.5 4.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>1</span>
          </span>
        </button>
        {shouldShowReviewMinusTen && (
          <button type="button" onClick={() => onUpdate(-10)} className={getButtonClass(-10)}>
            <span className="inline-flex items-center justify-center gap-1">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="h-3 w-3"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.5 8.5L6.5 11.5L12.5 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>10</span>
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-nowrap items-stretch gap-1 sm:gap-1.5 w-full min-w-0">
      {isTestMode && (
        <button type="button" onClick={() => onUpdate(-100)} className={getButtonClass(-100)}>
          -100
        </button>
      )}
      <button type="button" onClick={() => onUpdate(-10)} className={getButtonClass(-10)}>
        -10
      </button>
      <button type="button" onClick={() => onUpdate(-1)} className={getButtonClass(-1)}>
        -1
      </button>
      <button type="button" onClick={() => onUpdate(1)} className={`${getButtonClass(1)} ${getOpacity(1)}`}>
        +1
      </button>
      <button type="button" onClick={() => onUpdate(10)} className={`${getButtonClass(10)} ${getOpacity(10)}`}>
        +10
      </button>
      {isTestMode && (
        <button type="button" onClick={() => onUpdate(100)} className={`${getButtonClass(100)} ${getOpacity(100)}`}>
          +100
        </button>
      )}
    </div>
  );
});
