import { motion } from 'motion/react';

import type { QotdAttemptRecord, QuestionOfTheDayItem } from '../types/qotd';

type QuestionOfTheDayHistoryModalProps = {
  entries: Array<{ attempt: QotdAttemptRecord; question: QuestionOfTheDayItem | null }>;
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
            <h3 className="text-xl font-black uppercase tracking-tight text-cyan-900">Questions of the Day History</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
              Completed entries: {entries.length}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4" data-modal-scroll="true">
            {entries.length === 0 ? (
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-slate-700 font-semibold">No completed Questions of the Day yet.</p>
              </div>
            ) : (
              entries.map(({ attempt, question }) => {
                const selectedLabel =
                  question?.choices.find((c) => c.id === attempt.selectedChoiceId)?.label ?? attempt.selectedChoiceId;
                return (
                  <div key={attempt.dateKey} className="rounded-xl border-2 border-slate-200 p-4 bg-white space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{attempt.dateKey}</p>
                      <p
                        className={`text-xs font-black uppercase tracking-wider ${
                          attempt.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {attempt.isCorrect ? 'Correct' : 'Incorrect'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{question?.stem ?? 'Question unavailable.'}</p>
                    <p className="text-sm text-slate-700">
                      <span className="font-black">Your answer:</span> {attempt.selectedChoiceId}. {selectedLabel}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-black">Explanation:</span> {attempt.explanationShown}
                    </p>
                    <p className="text-sm text-amber-900">
                      <span className="font-black">Mnemonic:</span> {attempt.mnemonicShown}
                    </p>
                    <p className="text-sm text-purple-700 font-semibold">BP earned: {attempt.bpEarned}</p>
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
