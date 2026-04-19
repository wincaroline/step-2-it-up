import { doc, setDoc, serverTimestamp, type Firestore, type DocumentData } from 'firebase/firestore';
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
  };
}
