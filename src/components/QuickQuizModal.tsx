import { useEffect, useRef } from 'react';

import { motion } from 'motion/react';
import { X } from 'lucide-react';

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
  isSubmitting: boolean;
  results: QuickQuizResultItem[];
  onClose: () => void;
};

export function QuickQuizModal({
  questions,
  selectionsByQuestionId,
  onSelectChoice,
  onSubmit,
  hasSubmitted,
  isSubmitting,
  results,
  onClose,
}: QuickQuizModalProps) {
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const questionSectionRefs = useRef<Array<HTMLElement | null>>([]);
  const resultsByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const answeredCount = questions.filter((question) => Boolean(selectionsByQuestionId[question.id])).length;
  const canSubmit = questions.length === 3 && answeredCount === 3;
  const correctCount = results.filter((result) => result.isCorrect).length;
  const correctPercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const bonusPoints = correctCount * 10;
  const scoreSummaryTextClass =
    correctCount === 0
      ? 'text-rose-600'
      : correctCount === 1
        ? 'text-amber-500'
        : 'text-emerald-600';

  useEffect(() => {
    if (!hasSubmitted) {
      return;
    }
    modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hasSubmitted]);

  const handleChoiceSelect = (questionId: string, choiceId: string, questionIndex: number) => {
    onSelectChoice(questionId, choiceId);
    if (hasSubmitted) {
      return;
    }
    const nextQuestionSection = questionSectionRefs.current[questionIndex + 1];
    if (!nextQuestionSection) {
      return;
    }
    window.requestAnimationFrame(() => {
      nextQuestionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

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
          <h3 className="text-lg font-black uppercase tracking-[0.16em] text-cyan-700 sm:text-xl">Quick Quiz</h3>
          {hasSubmitted && (
            <p className="mt-3 font-black text-cyan-800">
              <span className={`text-2xl sm:text-3xl ${scoreSummaryTextClass}`}>
                {correctCount}/3 ({correctPercent}%)
              </span>{' '}
              <span className="text-base sm:text-lg">Correct</span>
            </p>
          )}
          {!hasSubmitted && (
            <p className="mt-2 text-sm font-semibold text-slate-700">Answer all 3 questions, then submit to see your results.</p>
          )}

          <div className="mt-6 space-y-6">
            {questions.map((question, index) => {
              const selectedChoiceId = selectionsByQuestionId[question.id] ?? null;
              const result = resultsByQuestionId.get(question.id) ?? null;
              return (
                <section
                  key={question.id}
                  ref={(el) => {
                    questionSectionRefs.current[index] = el;
                  }}
                  className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Question {index + 1} · {question.domain} · {question.competency}
                    </p>
                    {hasSubmitted && result && (
                      <p className={`text-xs font-black uppercase tracking-wider ${result.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {result.isCorrect ? 'Correct' : 'Incorrect'}
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900">{question.stem}</p>

                  <div className="mt-4 space-y-2">
                    {question.choices.map((choice) => {
                      const isSelected = selectedChoiceId === choice.id;
                      const isCorrectChoice = question.correctChoiceId === choice.id;
                      const showCorrect = hasSubmitted && isCorrectChoice;
                      const showIncorrectPick = hasSubmitted && isSelected && !isCorrectChoice;
                      const showChoiceExplanation = hasSubmitted && (showCorrect || showIncorrectPick);
                      const choiceExplanation = question.explanationsByChoice[choice.id] ?? 'No explanation available.';
                      const correctChoiceClass =
                        result && !result.isCorrect ? 'border-slate-400 bg-slate-100' : 'border-emerald-500 bg-emerald-50';
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => handleChoiceSelect(question.id, choice.id, index)}
                          disabled={hasSubmitted}
                          className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
                            showCorrect
                              ? correctChoiceClass
                              : showIncorrectPick
                                ? 'border-rose-500 bg-rose-50'
                                : isSelected
                                  ? 'border-cyan-500 bg-cyan-50'
                                  : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50'
                          } ${hasSubmitted ? 'cursor-default' : 'active:scale-[0.99]'}`}
                        >
                          <span className="mr-2 font-black text-slate-700">{choice.id}.</span>
                          <span className="font-medium text-slate-900">{choice.label}</span>
                          {showChoiceExplanation && (
                            <div className="mt-3 border-t border-current/20 pt-2">
                              <p className={`text-xs font-black uppercase tracking-wider ${showCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                                {showCorrect ? 'Correct' : 'Incorrect'}
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-800">{choiceExplanation}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {hasSubmitted && result && (
                    <div className="mt-4 space-y-3">
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
            <div className="mt-6 rounded-2xl border-2 border-cyan-100 bg-cyan-50/80 p-4 sm:p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">Summary</p>
              <div className="mt-3 space-y-2 text-left">
                <div className="flex items-center justify-between gap-4 text-sm font-bold text-cyan-950">
                  <span>Questions Completed</span>
                  <span className="font-black tabular-nums text-teal-700">+3</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm font-bold text-cyan-950">
                  <div className="flex flex-col">
                    <span>Bonus Points</span>
                    <span className="text-[11px] font-semibold text-cyan-700">
                      {correctCount} x 10 BP
                    </span>
                  </div>
                  <span className="font-black tabular-nums text-purple-700">+{bonusPoints}</span>
                </div>
                <div className="border-t border-cyan-200 pt-2" />
                <div className="flex items-center justify-between gap-4 text-sm font-black text-cyan-950">
                  <span>Total XP Logged</span>
                  <span className="tabular-nums text-emerald-700">+{3 + bonusPoints}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-6">
          {!hasSubmitted ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || isSubmitting}
              className="question-count-clay-btn w-full rounded-xl bg-cyan-600 py-3 text-base font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? 'Submitting...' : `Submit Quick Quiz (${answeredCount}/3 answered)`}
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
