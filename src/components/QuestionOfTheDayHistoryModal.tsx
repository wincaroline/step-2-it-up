import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import type { QotdClinicalDomain, QotdCompetency, QuestionOfTheDayItem } from '../types/qotd';

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

type StatRow = {
  label: string;
  correct: number;
  total: number;
  percentage: number;
};

function getBarColorClass(percentage: number): string {
  if (percentage <= 40) return 'bg-rose-500';
  if (percentage <= 70) return 'bg-yellow-400';
  return 'bg-emerald-500';
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

export function QuestionOfTheDayHistoryModal({ entries, onClose }: QuestionOfTheDayHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'stats'>('questions');
  const [domainFilter, setDomainFilter] = useState<'all' | QotdClinicalDomain>('all');
  const [competencyFilter, setCompetencyFilter] = useState<'all' | QotdCompetency>('all');
  const [resultFilter, setResultFilter] = useState<'both' | 'correct' | 'incorrect'>('both');

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
    return entries.filter((entry) => {
      if (domainFilter !== 'all' && entry.question?.domain !== domainFilter) return false;
      if (competencyFilter !== 'all' && entry.question?.competency !== competencyFilter) return false;
      if (resultFilter === 'correct' && entry.isCorrect !== true) return false;
      if (resultFilter === 'incorrect' && entry.isCorrect !== false) return false;
      return true;
    });
  }, [entries, domainFilter, competencyFilter, resultFilter]);

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

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4" data-modal-scroll="true">
            {activeTab === 'questions' && (entries.length === 0 ? (
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-slate-700 font-semibold">No completed quiz questions yet.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                        <option value="both">Both</option>
                        <option value="correct">Correct</option>
                        <option value="incorrect">Incorrect</option>
                      </select>
                    </label>
                  </div>
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
                const cardBgClass =
                  entry.isCorrect === true
                    ? 'bg-emerald-50'
                    : entry.isCorrect === false
                      ? 'bg-rose-50'
                      : 'bg-white';
                const selectedLabel =
                  entry.question?.choices.find((c) => c.id === entry.selectedChoiceId)?.label ?? entry.selectedChoiceId;
                return (
                  <div key={entry.id} className={`rounded-xl border-2 border-slate-200 p-4 space-y-3 ${cardBgClass}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{entry.dateKey}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                          {entry.source === 'qotd' ? 'Question of the Day' : 'Quick Quiz'}
                        </span>
                        <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-800">
                          Domain: {entry.question?.domain ?? 'Unavailable'}
                        </span>
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-purple-800">
                          Competency: {entry.question?.competency ?? 'Unavailable'}
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
                })}
              </>
            ))}

            {activeTab === 'stats' && (
              <div className="space-y-6">
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
                              className={`h-full rounded-full transition-all ${getBarColorClass(row.percentage)}`}
                              style={{ width: `${row.percentage}%` }}
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
                              className={`h-full rounded-full transition-all ${getBarColorClass(row.percentage)}`}
                              style={{ width: `${row.percentage}%` }}
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
      </div>
    </motion.div>
  );
}
