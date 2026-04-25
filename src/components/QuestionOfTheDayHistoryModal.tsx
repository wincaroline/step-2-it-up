import { motion } from 'motion/react';

import type { QuestionOfTheDayItem } from '../types/qotd';

type QuestionOfTheDayHistoryModalProps = {
  entries: Array<{
    id: string;
    source: 'qotd' | 'quick-quiz';
    dateKey: string;
    question: QuestionOfTheDayItem | null;
    selectedChoiceId: string;
    isCorrect: boolean | null;
    explanationShown: string;
    mnemonicShown: string;
    bpEarned: number;
  }>;
  onClose: () => void;
};

export function QuestionOfTheDayHistoryModal({ entries, onClose }: QuestionOfTheDayHistoryModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[94] overflow-y-auto overflow-x-hidden bg-[#001a2c]/90 backdrop-blur-md p-4 sm:p-6"
      data-modal-scroll="true"
    >
      <div className="flex min-h-full items-center justify-center">
        <motion.div
          initial={{ scale: 0.95, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 24 }}
          className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90dvh] border-4 border-cyan-400 shadow-2xl flex flex-col min-h-0 overflow-hidden"
        >
          <div className="shrink-0 p-6 border-b border-slate-200">
            <h3 className="text-xl font-black uppercase tracking-tight text-cyan-900">Quiz Questions Completed</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
              Completed entries: {entries.length}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4" data-modal-scroll="true">
            {entries.length === 0 ? (
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-slate-700 font-semibold">No completed quiz questions yet.</p>
              </div>
            ) : (
              entries.map((entry) => {
                const resultLabel =
                  entry.isCorrect === true ? 'Correct' : entry.isCorrect === false ? 'Incorrect' : 'Result unavailable';
                const resultClass =
                  entry.isCorrect === true
                    ? 'text-emerald-700'
                    : entry.isCorrect === false
                      ? 'text-rose-700'
                      : 'text-slate-600';
                const selectedLabel =
                  entry.question?.choices.find((c) => c.id === entry.selectedChoiceId)?.label ?? entry.selectedChoiceId;
                return (
                  <div key={entry.id} className="rounded-xl border-2 border-slate-200 p-4 bg-white space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{entry.dateKey}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                          {entry.source === 'qotd' ? 'Question of the Day' : 'Quick Quiz'}
                        </span>
                      </div>
                      <p className={`text-xs font-black uppercase tracking-wider ${resultClass}`}>{resultLabel}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{entry.question?.stem ?? 'Question unavailable.'}</p>
                    <p className="text-sm text-slate-700">
                      <span className="font-black">Your answer:</span>{' '}
                      {entry.selectedChoiceId ? `${entry.selectedChoiceId}. ${selectedLabel}` : 'Unavailable'}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-black">Explanation:</span> {entry.explanationShown}
                    </p>
                    <p className="text-sm text-amber-900">
                      <span className="font-black">Mnemonic:</span> {entry.mnemonicShown}
                    </p>
                    <p className="text-sm text-purple-700 font-semibold">BP earned: {entry.bpEarned}</p>
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 p-4 sm:p-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="question-count-clay-btn w-full bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded-xl font-black text-base"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
