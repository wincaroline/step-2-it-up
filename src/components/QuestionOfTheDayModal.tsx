import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle } from 'lucide-react';

import type { QuestionOfTheDayItem } from '../types/qotd';

type QuestionOfTheDayModalProps = {
  question: QuestionOfTheDayItem;
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
  onSubmit: () => void;
  hasSubmitted: boolean;
  isCorrect: boolean;
  explanation: string;
  mnemonic: string;
  bpEarned: number;
  onClose: () => void;
};

export function QuestionOfTheDayModal({
  question,
  selectedChoiceId,
  onSelectChoice,
  onSubmit,
  hasSubmitted,
  isCorrect,
  explanation,
  mnemonic,
  bpEarned,
  onClose,
}: QuestionOfTheDayModalProps) {
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasSubmitted) return;
    const container = modalBodyRef.current;
    const resultEl = resultRef.current;
    if (!container || !resultEl) return;

    const top = resultEl.offsetTop - 12;
    container.scrollTo({ top, behavior: 'smooth' });
  }, [hasSubmitted]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[94] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 28 }}
        className="bg-white rounded-[2rem] w-[92vw] sm:w-[86vw] lg:w-[74vw] max-w-[56rem] max-h-[90dvh] flex flex-col min-h-0 overflow-hidden border-4 border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.35)]"
      >
        <div
          ref={modalBodyRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-6 sm:p-8"
        >
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Question of the Day</h3>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {question.domain} · {question.competency}
          </p>
          <p className="mt-4 text-left text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
            {question.stem}
          </p>

          <div className="mt-6 space-y-3">
            {question.choices.map((choice) => {
              const isSelected = selectedChoiceId === choice.id;
              const isChoiceCorrect = question.correctChoiceId === choice.id;
              const showCorrect = hasSubmitted && isChoiceCorrect;
              const showIncorrectPick = hasSubmitted && isSelected && !isChoiceCorrect;
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelectChoice(choice.id)}
                  disabled={hasSubmitted}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                    showCorrect
                      ? 'border-emerald-500 bg-emerald-50'
                      : showIncorrectPick
                        ? 'border-rose-500 bg-rose-50'
                        : isSelected
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50'
                  } ${hasSubmitted ? 'cursor-default' : 'active:scale-[0.99]'}`}
                >
                  <span className="font-black mr-2 text-slate-700">{choice.id}.</span>
                  <span className="font-medium text-slate-900">{choice.label}</span>
                </button>
              );
            })}
          </div>

          {hasSubmitted && (
            <div ref={resultRef} className="mt-6 space-y-4">
              <div
                className={`rounded-xl border-2 p-4 ${
                  isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-700 shrink-0" />
                  )}
                  <p className={`font-black uppercase text-sm ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {isCorrect ? 'Correct' : 'Not quite'}
                  </p>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{explanation}</p>
              </div>

              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-amber-700">Silly mnemonic</p>
                <p className="mt-1 text-sm font-semibold text-amber-900">{mnemonic}</p>
              </div>

              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-600">Points summary</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  +1 Questions Complete (Questions Done Today + Total Questions)
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {bpEarned > 0 ? '+10 BP (Bonus Points)' : '+0 BP (Bonus Points)'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-200 bg-white">
          {!hasSubmitted ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!selectedChoiceId}
              className="question-count-clay-btn w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-base"
            >
              Submit Answer
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="question-count-clay-btn w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-base"
            >
              Done
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
