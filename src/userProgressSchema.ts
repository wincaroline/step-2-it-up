import { DAILY_GOAL, DEFAULT_EXAM_DATE_KEY } from './constants';

/** Persisted app progress (Firestore document `users/{uid}`). Bump `v` when shape changes. */
export const USER_PROGRESS_VERSION = 2 as const;

export type UserProgressV1 = {
  v: typeof USER_PROGRESS_VERSION;
  dailyQuestions: number;
  totalQuestions: number;
  /** Accuracy / score-improvement bonuses — contributes to XP with totalQuestions. */
  bonusPoints: number;
  /** Bonus points earned per calendar day (`YYYY-MM-DD`), for UI such as “BP earned today”. */
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
  lastAchievedIds: string[];
  /** Same meaning as localStorage key `recordDayModalLastShownDate`. */
  recordDayModalLastShown: string | null;
  /** Step 2 exam day in local calendar `YYYY-MM-DD`. */
  examDateKey: string;
  dailyGoalQuestions: number;
};

export function emptyUserProgress(): UserProgressV1 {
  return {
    v: USER_PROGRESS_VERSION,
    dailyQuestions: 0,
    totalQuestions: 0,
    bonusPoints: 0,
    bonusPointsHistory: {},
    history: {},
    lastLevel: 0,
    selectedVariants: {},
    isTestMode: false,
    isWarningMode: false,
    practiceTestCompletionDates: {},
    totalPracticeTests: 0,
    practiceTestScores: {},
    practiceTestQuestionCredits: {},
    practiceTestQuestionCounts: {},
    practiceTestPercents: {},
    lastAchievedIds: ['plankton'],
    recordDayModalLastShown: null,
    examDateKey: DEFAULT_EXAM_DATE_KEY,
    dailyGoalQuestions: DAILY_GOAL,
  };
}
