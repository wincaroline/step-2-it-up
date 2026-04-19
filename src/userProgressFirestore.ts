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

/** Reads Firestore document fields into `UserProgressV1`. Missing fields use defaults. */
export function parseUserProgressDoc(data: DocumentData | undefined): UserProgressV1 | null {
  if (!data || typeof data !== 'object') return null;
  const base = emptyUserProgress();
  if (data.v !== USER_PROGRESS_VERSION) return null;

  return {
    v: USER_PROGRESS_VERSION,
    dailyQuestions: asNum(data.dailyQuestions, base.dailyQuestions),
    totalQuestions: asNum(data.totalQuestions, base.totalQuestions),
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
    lastAchievedIds: asStrArr(data.lastAchievedIds, base.lastAchievedIds),
    recordDayModalLastShown:
      typeof data.recordDayModalLastShown === 'string'
        ? data.recordDayModalLastShown
        : null,
    examDateKey: asExamDateKey(data.examDateKey, base.examDateKey),
    dailyGoalQuestions: asDailyGoalQuestions(data.dailyGoalQuestions, base.dailyGoalQuestions),
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
  dailyQuestions: number;
  totalQuestions: number;
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
  lastAchievedIds: string[];
  recordDayModalLastShown?: string | null;
  examDateKey: string;
  dailyGoalQuestions: number;
}): UserProgressV1 {
  let recordDayModalLastShown: string | null = null;
  if (args.recordDayModalLastShown !== undefined) {
    recordDayModalLastShown = args.recordDayModalLastShown;
  } else if (typeof localStorage !== 'undefined') {
    recordDayModalLastShown = localStorage.getItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY);
  }

  return {
    v: USER_PROGRESS_VERSION,
    dailyQuestions: args.dailyQuestions,
    totalQuestions: args.totalQuestions,
    history: args.history,
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
    lastAchievedIds: args.lastAchievedIds,
    recordDayModalLastShown,
    examDateKey: args.examDateKey,
    dailyGoalQuestions: args.dailyGoalQuestions,
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
