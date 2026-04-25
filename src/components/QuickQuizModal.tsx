import { useEffect, useRef } from 'react';

import { motion } from 'motion/react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

import type { QuestionOfTheDayItem } from '../types/qotd';

export type QuickQuizResultItem = {
  questionId: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  explanation: string;
  mnemonic: string;
};

type QuickQuizModalProps = {
  questions: QuestionOfTheDayItem[];
  selectionsByQuestionId: Record<string, string>;
  onSelectChoice: (questionId: string, choiceId: string) => void;
  onSubmit: () => void;
  hasSubmitted: boolean;
  results: QuickQuizResultItem[];
  onClose: () => void;
};

export function QuickQuizModal({
  questions,
  selectionsByQuestionId,
  onSelectChoice,
  onSubmit,
  hasSubmitted,
  results,
  onClose,
}: QuickQuizModalProps) {
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const resultsByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const answeredCount = questions.filter((question) => Boolean(selectionsByQuestionId[question.id])).length;
  const canSubmit = questions.length === 3 && answeredCount === 3;
  const correctCount = results.filter((result) => result.isCorrect).length;
  const bonusPoints = correctCount * 10;

  useEffect(() => {
    if (!hasSubmitted) {
      return;
    }
    modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hasSubmitted]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#001a2c]/90 p-4 backdrop-blur-md sm:p-6"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        className="relative flex max-h-[90dvh] min-h-0 w-[92vw] max-w-[58rem] flex-col overflow-hidden rounded-[2rem] border-4 border-cyan-400 bg-white shadow-[0_0_50px_rgba(34,211,238,0.35)] sm:w-[86vw] lg:w-[74vw]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick quiz"
          className="question-count-clay-btn absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition-all hover:bg-white hover:text-slate-900 active:scale-[0.97]"
        >
          <X className="h-5 w-5" />
        </button>
        <div
          ref={modalScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-6 sm:p-8"
          data-modal-scroll="true"
        >
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Quick Quiz</h3>
          <p className="mt-2 text-sm font-semibold text-slate-700">Answer all 3 questions, then submit to see your results.</p>

          <div className="mt-6 space-y-6">
            {questions.map((question, index) => {
              const selectedChoiceId = selectionsByQuestionId[question.id] ?? null;
              const result = resultsByQuestionId.get(question.id) ?? null;
              return (
                <section key={question.id} className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Question {index + 1} · {question.domain} · {question.competency}
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900">{question.stem}</p>

                  <div className="mt-4 space-y-2">
                    {question.choices.map((choice) => {
                      const isSelected = selectedChoiceId === choice.id;
                      const isCorrectChoice = question.correctChoiceId === choice.id;
                      const showCorrect = hasSubmitted && isCorrectChoice;
                      const showIncorrectPick = hasSubmitted && isSelected && !isCorrectChoice;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => onSelectChoice(question.id, choice.id)}
                          disabled={hasSubmitted}
                          className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
                            showCorrect
                              ? 'border-emerald-500 bg-emerald-50'
                              : showIncorrectPick
                                ? 'border-rose-500 bg-rose-50'
                                : isSelected
                                  ? 'border-cyan-500 bg-cyan-50'
                                  : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50'
                          } ${hasSubmitted ? 'cursor-default' : 'active:scale-[0.99]'}`}
                        >
                          <span className="mr-2 font-black text-slate-700">{choice.id}.</span>
                          <span className="font-medium text-slate-900">{choice.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {hasSubmitted && result && (
                    <div className="mt-4 space-y-3">
                      <div
                        className={`rounded-xl border-2 p-3 ${
                          result.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
                          ) : (
                            <XCircle className="h-5 w-5 shrink-0 text-rose-700" />
                          )}
                          <p className={`text-sm font-black uppercase ${result.isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                            {result.isCorrect ? 'Correct' : 'Incorrect'}
                          </p>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-800">{result.explanation}</p>
                      </div>
                      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-700">Mnemonic</p>
                        <p className="mt-1 text-sm font-semibold text-amber-900">{result.mnemonic}</p>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {hasSubmitted && (
            <div className="mt-6 rounded-xl border-2 border-slate-200 bg-slate-100 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-600">Summary</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Questions Completed = +3</p>
              <p className="text-sm font-semibold text-slate-900">Bonus Points = {correctCount} x 10 BP = +{bonusPoints} BP</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-6">
          {!hasSubmitted ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="question-count-clay-btn w-full rounded-xl bg-cyan-600 py-3 text-base font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Submit Quick Quiz ({answeredCount}/3 answered)
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="question-count-clay-btn w-full rounded-xl bg-emerald-600 py-3 text-base font-black text-white hover:bg-emerald-700"
            >
              Done
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
