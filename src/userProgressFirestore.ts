import {
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import { RECORD_DAY_MODAL_LAST_SHOWN_KEY } from './constants';
import { USER_PROGRESS_VERSION, emptyUserProgress, type UserProgressV1 } from './userProgressSchema';
import type { QotdAttemptRecord } from './types/qotd';

const REVIEW_PENALTY_MAX_MULTIPLIER = 5;

export function userProgressDocRef(db: Firestore, uid: string) {
  return doc(db, 'users', uid);
}

function asNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asRecordNum(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function asCompletionDates(v: unknown): Record<string, true> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, true> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === true || val === 'true') out[k] = true;
  }
  return out;
}

function asRecordStr(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string') out[k] = val;
  }
  return out;
}

function asStrArr(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter((x): x is string => typeof x === 'string');
}

function asExamDateKey(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
}

function asDailyGoalQuestions(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(9999, Math.round(n));
}

function asQotdAttemptRecord(v: unknown): QotdAttemptRecord | null {
  if (!v || typeof v !== 'object') return null;
  const row = v as Record<string, unknown>;
  const dateKey = typeof row.dateKey === 'string' ? row.dateKey : '';
  const questionId = typeof row.questionId === 'string' ? row.questionId : '';
  const selectedChoiceId = typeof row.selectedChoiceId === 'string' ? row.selectedChoiceId : '';
  const explanationShown = typeof row.explanationShown === 'string' ? row.explanationShown : '';
  const mnemonicShown = typeof row.mnemonicShown === 'string' ? row.mnemonicShown : '';
  const isCorrect = row.isCorrect === true;
  const bpEarnedRaw = typeof row.bpEarned === 'number' ? row.bpEarned : Number(row.bpEarned);
  const completedAtMsRaw =
    typeof row.completedAtMs === 'number' ? row.completedAtMs : Number(row.completedAtMs);
  if (!dateKey || !questionId || !selectedChoiceId || !explanationShown || !mnemonicShown) return null;
  if (!Number.isFinite(bpEarnedRaw) || !Number.isFinite(completedAtMsRaw)) return null;
  return {
    dateKey,
    questionId,
    selectedChoiceId,
    isCorrect,
    explanationShown,
    mnemonicShown,
    bpEarned: Math.max(0, Math.round(bpEarnedRaw)),
    completedAtMs: Math.max(0, Math.round(completedAtMsRaw)),
  };
}

function asQotdByDate(v: unknown): Record<string, QotdAttemptRecord> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, QotdAttemptRecord> = {};
  for (const [k, row] of Object.entries(v)) {
    const parsed = asQotdAttemptRecord(row);
    const isDateKey = /^\d{4}-\d{2}-\d{2}$/.test(k);
    if (parsed && isDateKey) {
      out[k] = parsed;
    }
  }
  return out;
}

/** Reads Firestore document fields into `UserProgressV1`. Missing fields use defaults. Accepts legacy `v: 1`. */
export function parseUserProgressDoc(data: DocumentData | undefined): UserProgressV1 | null {
  if (!data || typeof data !== 'object') return null;
  const base = emptyUserProgress();
  const docVersion = data.v;
  if (docVersion !== 1 && docVersion !== USER_PROGRESS_VERSION) return null;

  return {
    v: USER_PROGRESS_VERSION,
    dailyQuestions: asNum(data.dailyQuestions, base.dailyQuestions),
    totalQuestions: asNum(data.totalQuestions, base.totalQuestions),
    bonusPoints: Math.max(0, asNum(data.bonusPoints, base.bonusPoints)),
    bonusPointsHistory:
      docVersion >= 2 ? asRecordNum(data.bonusPointsHistory) : {},
    history: asRecordNum(data.history),
    lastLevel: asNum(data.lastLevel, base.lastLevel),
    selectedVariants: asRecordStr(data.selectedVariants),
    isTestMode: asBool(data.isTestMode, base.isTestMode),
    isWarningMode: asBool(data.isWarningMode, base.isWarningMode),
    practiceTestCompletionDates: asCompletionDates(data.practiceTestCompletionDates),
    totalPracticeTests: asNum(data.totalPracticeTests, base.totalPracticeTests),
    practiceTestScores: asRecordNum(data.practiceTestScores),
    practiceTestQuestionCredits: asRecordNum(data.practiceTestQuestionCredits),
    practiceTestQuestionCounts: asRecordNum(data.practiceTestQuestionCounts),
    practiceTestPercents: asRecordNum(data.practiceTestPercents),
    questionsToReviewToday: Math.max(0, asNum(data.questionsToReviewToday, base.questionsToReviewToday)),
    reviewPenaltyMultiplier: Math.max(
      1,
      Math.min(
        REVIEW_PENALTY_MAX_MULTIPLIER,
        Math.round(asNum(data.reviewPenaltyMultiplier, base.reviewPenaltyMultiplier))
      )
    ),
    totalQuestionsReviewed: Math.max(0, asNum(data.totalQuestionsReviewed, base.totalQuestionsReviewed)),
    lastAchievedIds: asStrArr(data.lastAchievedIds, base.lastAchievedIds),
    recordDayModalLastShown:
      typeof data.recordDayModalLastShown === 'string'
        ? data.recordDayModalLastShown
        : null,
    examDateKey: asExamDateKey(data.examDateKey, base.examDateKey),
    dailyGoalQuestions: asDailyGoalQuestions(data.dailyGoalQuestions, base.dailyGoalQuestions),
    questionsOfTheDayCompletedTotal: Math.max(
      0,
      asNum(data.questionsOfTheDayCompletedTotal, base.questionsOfTheDayCompletedTotal)
    ),
    qotdByDate: asQotdByDate(data.qotdByDate),
  };
}

export async function saveUserProgress(db: Firestore, uid: string, progress: UserProgressV1): Promise<void> {
  const { v, ...rest } = progress;
  await setDoc(
    userProgressDocRef(db, uid),
    {
      v,
      ...rest,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Same fields as cloud doc; when `recordDayModalLastShown` is omitted, reads localStorage key if present. */
export function buildProgressFromAppState(args: {
  /** Calendar day for `dailyQuestions` (app “today”); merged into `history` so cloud hydrate matches UI. */
  calendarDayKey: string;
  dailyQuestions: number;
  totalQuestions: number;
  bonusPoints: number;
  bonusPointsHistory: Record<string, number>;
  history: Record<string, number>;
  lastLevel: number;
  selectedVariants: Record<string, string>;
  isTestMode: boolean;
  isWarningMode: boolean;
  practiceTestCompletionDates: Record<string, true>;
  totalPracticeTests: number;
  practiceTestScores: Record<string, number>;
  practiceTestQuestionCredits: Record<string, number>;
  practiceTestQuestionCounts: Record<string, number>;
  practiceTestPercents: Record<string, number>;
  questionsToReviewToday: number;
  reviewPenaltyMultiplier: number;
  totalQuestionsReviewed: number;
  lastAchievedIds: string[];
  recordDayModalLastShown?: string | null;
  examDateKey: string;
  dailyGoalQuestions: number;
  questionsOfTheDayCompletedTotal: number;
  qotdByDate: Record<string, QotdAttemptRecord>;
}): UserProgressV1 {
  const recordDayModalLastShown =
    args.recordDayModalLastShown !== undefined
      ? args.recordDayModalLastShown
      : typeof localStorage !== 'undefined'
        ? localStorage.getItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY)
        : null;

  return {
    v: USER_PROGRESS_VERSION,
    dailyQuestions: args.dailyQuestions,
    totalQuestions: args.totalQuestions,
    bonusPoints: Math.max(0, args.bonusPoints),
    bonusPointsHistory: args.bonusPointsHistory,
    history: { ...args.history, [args.calendarDayKey]: args.dailyQuestions },
    lastLevel: args.lastLevel,
    selectedVariants: args.selectedVariants,
    isTestMode: args.isTestMode,
    isWarningMode: args.isWarningMode,
    practiceTestCompletionDates: args.practiceTestCompletionDates,
    totalPracticeTests: args.totalPracticeTests,
    practiceTestScores: args.practiceTestScores,
    practiceTestQuestionCredits: args.practiceTestQuestionCredits,
    practiceTestQuestionCounts: args.practiceTestQuestionCounts,
    practiceTestPercents: args.practiceTestPercents,
    questionsToReviewToday: Math.max(0, args.questionsToReviewToday),
    reviewPenaltyMultiplier: Math.max(
      1,
      Math.min(REVIEW_PENALTY_MAX_MULTIPLIER, Math.round(args.reviewPenaltyMultiplier))
    ),
    totalQuestionsReviewed: Math.max(0, args.totalQuestionsReviewed),
    lastAchievedIds: args.lastAchievedIds,
    recordDayModalLastShown,
    examDateKey: args.examDateKey,
    dailyGoalQuestions: args.dailyGoalQuestions,
    questionsOfTheDayCompletedTotal: Math.max(0, Math.round(args.questionsOfTheDayCompletedTotal)),
    qotdByDate: args.qotdByDate,
  };
}

export function getUpdatedAtMillis(data: DocumentData | undefined): number {
  const u = data?.updatedAt;
  return u instanceof Timestamp ? u.toMillis() : 0;
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysDeep(obj[key]);
  }
  return sorted;
}

/** Canonical JSON for comparing local vs remote progress (key order independent). */
export function stableStringifyProgress(p: UserProgressV1): string {
  const copy: UserProgressV1 = {
    ...p,
    lastAchievedIds: [...p.lastAchievedIds].sort(),
  };
  return JSON.stringify(sortKeysDeep(copy));
}
