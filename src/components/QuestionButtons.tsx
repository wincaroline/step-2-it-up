import React from 'react';

export interface QuestionButtonsProps {
  onUpdate: (amount: number) => void;
  isTestMode: boolean;
  isWarningMode: boolean;
  isSleepMode: boolean;
  isHistoryModal?: boolean;
}

export const QuestionButtons = React.memo(function QuestionButtons({
  onUpdate,
  isTestMode,
  isWarningMode,
  isSleepMode,
  isHistoryModal = false,
}: QuestionButtonsProps) {
  const getButtonClass = (amount: number) => {
    const base = isHistoryModal
      ? 'question-count-clay-btn font-black text-[10px] sm:text-[11px] transition-all rounded-lg flex-1 min-w-0 px-2 py-2 tabular-nums'
      : 'question-count-clay-btn font-black text-sm transition-all rounded-xl flex-1 px-2 sm:px-2.5 py-3';

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
