import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, XCircle } from 'lucide-react';

import type { QotdClinicalDomain, QotdCompetency, QuestionOfTheDayItem } from '../types/qotd';

type QuestionOfTheDayHistoryModalProps = {
  entries: Array<{
    id: string;
    source: 'qotd' | 'quick-quiz';
    dateKey: string;
    completedAtMs: number;
    question: QuestionOfTheDayItem | null;
    selectedChoiceId: string;
    isCorrect: boolean | null;
    explanationShown: string;
    mnemonicShown: string;
    bpEarned: number;
  }>;
  isAdminMode: boolean;
  onRemoveUnavailableQuickQuiz: (questionId: string) => void;
  onClose: () => void;
};

type StatRow = {
  label: string;
  correct: number;
  total: number;
  percentage: number;
};

function formatCompletedAtEasternTime(timestampMs: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(timestampMs));
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = valueByType.get('year') ?? '0000';
  const month = valueByType.get('month') ?? '00';
  const day = valueByType.get('day') ?? '00';
  const hour = valueByType.get('hour') ?? '00';
  const minute = valueByType.get('minute') ?? '00';
  const dayPeriod = valueByType.get('dayPeriod') ?? '';
  return `${year}-${month}-${day} ${hour}:${minute} ${dayPeriod} ET`;
}

function getQbankQuestionNumber(questionId: string | undefined): string {
  if (!questionId) return '#?';
  const match = questionId.match(/(\d+)$/);
  if (!match) return '#?';
  return `#${String(Number.parseInt(match[1], 10))}`;
}

function getBarColorClass(percentage: number): string {
  if (percentage <= 40) return 'bg-rose-500';
  if (percentage <= 70) return 'bg-yellow-400';
  return 'bg-emerald-500';
}

/** When correct is 0, real % is 0 but we still show a small fill so the bar is visible. */
const MIN_ZERO_CORRECT_BAR_PERCENT = 3;

function barFillWidthPercent(percentage: number, total: number, correct: number): number {
  if (total === 0) return 0;
  if (correct === 0) return Math.max(percentage, MIN_ZERO_CORRECT_BAR_PERCENT);
  return percentage;
}

const ALL_DOMAINS: QotdClinicalDomain[] = [
  'Cardiovascular',
  'Respiratory',
  'GI/Hepatobiliary',
  'Renal/Urinary',
  'Endocrine/Metabolic',
  'Neurology',
  'Hematology/Oncology/Immune',
  'Behavioral Health',
  'OB-GYN',
  'Pediatrics',
  'MSK/Skin/Surgery',
  'Critical Care/Toxicology',
];

const ALL_COMPETENCIES: QotdCompetency[] = [
  'Diagnosis',
  'Management',
  'Prevention',
  'Communication',
  'Professionalism/Ethics',
  'Systems/Safety',
  'Biostats/Evidence',
];

export function QuestionOfTheDayHistoryModal({
  entries,
  isAdminMode,
  onRemoveUnavailableQuickQuiz,
  onClose,
}: QuestionOfTheDayHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'stats'>('questions');
  const [domainFilter, setDomainFilter] = useState<'all' | QotdClinicalDomain>('all');
  const [competencyFilter, setCompetencyFilter] = useState<'all' | QotdCompetency>('all');
  const [resultFilter, setResultFilter] = useState<'both' | 'correct' | 'incorrect'>('both');
  const [sortBy, setSortBy] = useState<'date-time' | 'question-number'>('date-time');
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const totalAnsweredCount = entries.filter((entry) => typeof entry.isCorrect === 'boolean').length;
  const totalCorrectCount = entries.filter((entry) => entry.isCorrect === true).length;
  const overallCorrectPercent = totalAnsweredCount > 0 ? Math.round((totalCorrectCount / totalAnsweredCount) * 100) : 0;

  const { domainStats, competencyStats } = useMemo(() => {
    const makeRows = <T extends string>(labels: T[], keySelector: (entry: QuestionOfTheDayHistoryModalProps['entries'][number]) => T | null): StatRow[] =>
      labels.map((label) => {
        const matchingEntries = entries.filter((entry) => keySelector(entry) === label && typeof entry.isCorrect === 'boolean');
        const total = matchingEntries.length;
        const correct = matchingEntries.filter((entry) => entry.isCorrect === true).length;
        return {
          label,
          correct,
          total,
          percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      });

    return {
      domainStats: makeRows(ALL_DOMAINS, (entry) => entry.question?.domain ?? null),
      competencyStats: makeRows(ALL_COMPETENCIES, (entry) => entry.question?.competency ?? null),
    };
  }, [entries]);

  const filteredQuestionEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => {
        if (sortBy === 'question-number') {
          const aMatch = a.question?.id.match(/(\d+)$/);
          const bMatch = b.question?.id.match(/(\d+)$/);
          const aQuestionNumber = aMatch ? Number.parseInt(aMatch[1], 10) : Number.POSITIVE_INFINITY;
          const bQuestionNumber = bMatch ? Number.parseInt(bMatch[1], 10) : Number.POSITIVE_INFINITY;
          return aQuestionNumber - bQuestionNumber;
        }
        return b.completedAtMs - a.completedAtMs;
      })
      .filter((entry) => {
        if (domainFilter !== 'all' && entry.question?.domain !== domainFilter) return false;
        if (competencyFilter !== 'all' && entry.question?.competency !== competencyFilter) return false;
        if (resultFilter === 'correct' && entry.isCorrect !== true) return false;
        if (resultFilter === 'incorrect' && entry.isCorrect !== false) return false;
        return true;
      });
  }, [entries, domainFilter, competencyFilter, resultFilter, sortBy]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[94] flex items-center justify-center overflow-x-hidden overflow-y-hidden bg-[#001a2c]/90 backdrop-blur-md p-4 sm:p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 24 }}
        className="flex w-full min-h-0 max-h-[90dvh] max-w-4xl flex-col overflow-hidden rounded-[2rem] border-4 border-cyan-400 bg-white shadow-2xl"
      >
          <div className="shrink-0 p-6 border-b border-slate-200">
            <h3 className="text-xl font-black uppercase tracking-tight text-cyan-900">Quiz Questions Completed</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
              Completed entries: {entries.length}
            </p>
            <div className="mt-4 inline-flex rounded-xl border-2 border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  activeTab === 'questions' ? 'bg-cyan-600 text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Questions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  activeTab === 'stats' ? 'bg-cyan-600 text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Stats
              </button>
            </div>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4"
            data-modal-scroll="true"
          >
            {activeTab === 'questions' && (entries.length === 0 ? (
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-slate-700 font-semibold">No completed quiz questions yet.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Domain filter</span>
                    <select
                      value={domainFilter}
                      onChange={(e) => setDomainFilter(e.target.value as 'all' | QotdClinicalDomain)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    >
                      <option value="all">All domains</option>
                      {ALL_DOMAINS.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Competency filter</span>
                    <select
                      value={competencyFilter}
                      onChange={(e) => setCompetencyFilter(e.target.value as 'all' | QotdCompetency)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    >
                      <option value="all">All competencies</option>
                      {ALL_COMPETENCIES.map((competency) => (
                        <option key={competency} value={competency}>
                          {competency}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Result filter</span>
                    <select
                      value={resultFilter}
                      onChange={(e) => setResultFilter(e.target.value as 'both' | 'correct' | 'incorrect')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    >
                      <option value="both">All results</option>
                      <option value="correct">Correct</option>
                      <option value="incorrect">Incorrect</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Sort By</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date-time' | 'question-number')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    >
                      <option value="date-time">Date &amp; Time</option>
                      <option value="question-number">Question Number</option>
                    </select>
                  </label>
                </div>
                {filteredQuestionEntries.length === 0 && (
                  <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-slate-700 font-semibold">No questions match your selected filters.</p>
                  </div>
                )}
                {filteredQuestionEntries.map((entry) => {
                const resultLabel =
                  entry.isCorrect === true ? 'Correct' : entry.isCorrect === false ? 'Incorrect' : 'Result unavailable';
                const resultClass =
                  entry.isCorrect === true
                    ? 'text-emerald-700'
                    : entry.isCorrect === false
                      ? 'text-rose-700'
                      : 'text-slate-600';
                const ResultIcon =
                  entry.isCorrect === true
                    ? CheckCircle2
                    : entry.isCorrect === false
                      ? XCircle
                      : null;
                const cardBgClass =
                  entry.isCorrect === true
                    ? 'bg-emerald-50'
                    : entry.isCorrect === false
                      ? 'bg-rose-50'
                      : 'bg-white';
                const selectedLabel =
                  entry.question?.choices.find((c) => c.id === entry.selectedChoiceId)?.label ?? entry.selectedChoiceId;
                const correctChoiceId = entry.question?.correctChoiceId;
                const correctChoiceLabel = correctChoiceId
                  ? entry.question?.choices.find((c) => c.id === correctChoiceId)?.label
                  : undefined;
                const completedAtLabel = formatCompletedAtEasternTime(entry.completedAtMs);
                const qbankQuestionNumber = getQbankQuestionNumber(entry.question?.id);
                const correctOnlyExplanation =
                  entry.question && correctChoiceId
                    ? entry.question.explanationsByChoice[correctChoiceId] ?? ''
                    : '';
                const wrongChoiceExplanation =
                  entry.isCorrect === false && entry.question && entry.selectedChoiceId
                    ? (entry.question.explanationsByChoice[entry.selectedChoiceId] ?? '').trim()
                    : '';
                const incorrectAnswerExplanationText =
                  entry.isCorrect === false
                    ? wrongChoiceExplanation !== ''
                      ? wrongChoiceExplanation
                      : entry.explanationShown
                    : '';
                const legacyQuickQuizQuestionId =
                  entry.source === 'quick-quiz' &&
                  entry.isCorrect === null &&
                  entry.id.startsWith('quick-quiz:legacy:')
                    ? entry.id.replace('quick-quiz:legacy:', '')
                    : null;
                const removableQuestionId =
                  entry.source === 'quick-quiz' &&
                  entry.isCorrect === null &&
                  isAdminMode
                    ? (entry.question?.id ?? legacyQuickQuizQuestionId)
                    : null;
                const isExpanded = expandedEntryIds[entry.id] === true;
                return (
                  <div key={entry.id} className={`rounded-xl border-2 border-slate-200 ${cardBgClass}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEntryIds((prev) => ({
                          ...prev,
                          [entry.id]: !isExpanded,
                        }))
                      }
                      className="w-full flex items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{completedAtLabel}</p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                          {qbankQuestionNumber}
                        </span>
                        <span
                          className="min-w-0 max-w-[9rem] truncate rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-800"
                          title={entry.question?.domain ?? 'Unavailable'}
                        >
                          {entry.question?.domain ?? 'Unavailable'}
                        </span>
                        <span
                          className="min-w-0 max-w-[9rem] truncate rounded-full bg-purple-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-purple-800"
                          title={entry.question?.competency ?? 'Unavailable'}
                        >
                          {entry.question?.competency ?? 'Unavailable'}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <p className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider ${resultClass}`}>
                          {ResultIcon ? <ResultIcon className="h-3.5 w-3.5" /> : null}
                          <span>{resultLabel}</span>
                        </p>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="space-y-3 border-t border-slate-200 p-4">
                        <p className="text-sm font-semibold text-slate-900">{entry.question?.stem ?? 'Question unavailable.'}</p>
                        <p className="text-sm text-slate-700">
                          <span className="font-black">Your answer:</span>{' '}
                          {entry.selectedChoiceId ? `${entry.selectedChoiceId}. ${selectedLabel}` : 'Unavailable'}
                        </p>
                        {entry.isCorrect === false ? (
                          <>
                            <p className="text-sm text-slate-700">
                              <span className="font-black">Incorrect answer explanation:</span> {incorrectAnswerExplanationText}
                            </p>
                            {entry.question && correctChoiceId && (
                              <>
                                <p className="text-sm text-slate-700">
                                  <span className="font-black">Correct Answer:</span>{' '}
                                  {correctChoiceLabel != null
                                    ? `${correctChoiceId}. ${correctChoiceLabel}`
                                    : `${correctChoiceId}.`}
                                </p>
                                {correctOnlyExplanation ? (
                                  <p className="text-sm text-slate-700">
                                    <span className="font-black">Explanation:</span> {correctOnlyExplanation}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-slate-700">
                            <span className="font-black">Explanation:</span> {entry.explanationShown}
                          </p>
                        )}
                        <p className="text-sm text-amber-900">
                          <span className="font-black">Mnemonic:</span> {entry.mnemonicShown}
                        </p>
                        <p className="text-sm text-purple-700 font-semibold">BP earned: {entry.bpEarned}</p>
                        {removableQuestionId && (
                          <button
                            type="button"
                            onClick={() => {
                              const confirmed = window.confirm(
                                'Remove this unavailable legacy quick quiz entry and make this question eligible again?'
                              );
                              if (!confirmed) return;
                              onRemoveUnavailableQuickQuiz(removableQuestionId);
                            }}
                            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-rose-700 hover:bg-rose-100"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
                })}
              </>
            ))}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-black uppercase tracking-wider text-cyan-900">Total Correct</h4>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                      {totalCorrectCount}/{totalAnsweredCount} ({overallCorrectPercent}%)
                    </p>
                  </div>
                  {totalAnsweredCount > 0 && (
                    <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full min-w-px rounded-full transition-all ${getBarColorClass(overallCorrectPercent)}`}
                        style={{ width: `${barFillWidthPercent(overallCorrectPercent, totalAnsweredCount, totalCorrectCount)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-xl border-2 border-slate-200 bg-white p-4 sm:p-5">
                  <h4 className="text-sm font-black uppercase tracking-wider text-cyan-900 mb-4">Domains</h4>
                  <div className="space-y-3">
                    {domainStats.map((row) => (
                      <div key={row.label} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                          {row.total > 0 ? (
                            <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                              {row.correct}/{row.total} ({row.percentage}%)
                            </p>
                          ) : (
                            <p className="text-xs font-semibold normal-case tracking-normal text-slate-500">None captured yet.</p>
                          )}
                        </div>
                        {row.total > 0 && (
                          <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full min-w-px rounded-full transition-all ${getBarColorClass(row.percentage)}`}
                              style={{ width: `${barFillWidthPercent(row.percentage, row.total, row.correct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border-2 border-slate-200 bg-white p-4 sm:p-5">
                  <h4 className="text-sm font-black uppercase tracking-wider text-cyan-900 mb-4">Competencies</h4>
                  <div className="space-y-3">
                    {competencyStats.map((row) => (
                      <div key={row.label} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                          {row.total > 0 ? (
                            <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                              {row.correct}/{row.total} ({row.percentage}%)
                            </p>
                          ) : (
                            <p className="text-xs font-semibold normal-case tracking-normal text-slate-500">None captured yet.</p>
                          )}
                        </div>
                        {row.total > 0 && (
                          <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full min-w-px rounded-full transition-all ${getBarColorClass(row.percentage)}`}
                              style={{ width: `${barFillWidthPercent(row.percentage, row.total, row.correct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
    </motion.div>
  );
}
