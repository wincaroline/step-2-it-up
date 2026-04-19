/** Persisted app progress (Firestore document `users/{uid}`). Bump `v` when shape changes. */
export const USER_PROGRESS_VERSION = 1 as const;

export type UserProgressV1 = {
  v: typeof USER_PROGRESS_VERSION;
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
  /** Same meaning as localStorage key `recordDayModalLastShownDate`. */
  recordDayModalLastShown: string | null;
};

export function emptyUserProgress(): UserProgressV1 {
  return {
    v: USER_PROGRESS_VERSION,
    dailyQuestions: 0,
    totalQuestions: 0,
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
  };
}
