import {
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Zap,
  Anchor,
  Star,
  Settings,
  Calendar,
  X,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  Award,
  Flame,
  LogIn,
  Flag,
  Check,
  Loader2,
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';

import { auth, db } from './firebase';
import {
  buildProgressFromAppState,
  parseUserProgressDoc,
  saveUserProgress,
  stableStringifyProgress,
} from './userProgressFirestore';
import { submitFeedbackReport, type FeedbackReportCategory } from './feedbackFirestore';
import { useFirestoreUserProgressListener } from './useFirestoreUserProgressListener';
import { emptyUserProgress, type UserProgressV1 } from './userProgressSchema';

import {
  LEVELS,
  LEVEL_VARIANTS,
  ACHIEVEMENTS,
  SILLY_STATEMENTS,
  DAILY_GOAL,
  MILESTONE_1,
  DEFAULT_EXAM_DATE_KEY,
  RECORD_DAY_MODAL_LAST_SHOWN_KEY,
  ONBOARDING_COMPLETE_STORAGE_KEY,
} from './constants';
import {
  calculateCurrentStreak,
  getAchievementStatus,
  dateKeyFromDate,
  getHistoryColor,
  PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS,
  publicAsset,
  graphicAsset,
  buildPracticeTestChartSeries,
  streakFlameVariantFromCount,
  streakStatNumberColorFromVariant,
  clampDailyGoal,
} from './utils';
import { Bubble, BUBBLE_COUNT_SLEEP, SeaCreature } from './components/OceanElements';
import { LevelSection } from './components/LevelSection';
import { AchievementsSection } from './components/AchievementsSection';
import { QuestionButtons } from './components/QuestionButtons';
import { PracticeTestScoresChart, type PracticeTestChartPress } from './components/PracticeTestScoresChart';
import { OnboardingScreen } from './components/OnboardingScreen';
import { FeedbackSummaryAdminView } from './components/FeedbackSummaryAdminView';
import { SettingsModal } from './components/SettingsModal';
import { GoalReachedModal } from './components/GoalReachedModal';
import { RecordDayModal } from './components/RecordDayModal';
import { VariantPickerModal } from './components/VariantPickerModal';
import { HARD_ASS_STATEMENTS } from './warningCopy';
import type { Level, Achievement } from './types';

const URL_DANCE_MUSIC = publicAsset('assets/dancemusic.mp3');
const URL_FIREWORKS = publicAsset('assets/fireworks.mp3');

type LogWinTier = 60 | 70 | 80 | 100;
type LogWinOutcome = LogWinTier | 'effort';

type GreatProgressPendingState = {
  id: number;
  bonusPoints: number;
  deltaPoints: number;
  previousScore: number;
  newScore: number;
  highlightDateKey: string;
};

function parsePracticeTestBaseQuestionsFromRaw(questionsRaw: string): number {
  const trimmedQ = questionsRaw.trim();
  if (trimmedQ === '') return 0;
  const q = parseInt(trimmedQ.replace(/,/g, ''), 10);
  if (Number.isNaN(q) || q < 0) return 0;
  return q;
}

function parseOptionalPercentRaw(percentRaw: string): number | undefined {
  const trimmedP = percentRaw.trim();
  if (trimmedP === '') return undefined;
  const n = parseFloat(trimmedP.replace(/,/g, ''));
  if (Number.isNaN(n) || n < 0 || n > 100) return undefined;
  return n;
}

/** Accuracy bonus points from % correct: round(q × % / 100). */
function accuracyBonusPointsFor(q: number, percent: number | undefined): number {
  return percent === undefined ? 0 : Math.round((q * percent) / 100);
}

/** Same as accuracy bonus except at 100%+, where the tier-100 celebration uses round(q × % × 3 / 100). */
function bonusPointsForLoggedAccuracy(q: number, percent: number): number {
  return percent >= 100 ? Math.round((q * percent * 3) / 100) : accuracyBonusPointsFor(q, percent);
}

/** Minimum spinner duration for feedback submit and sign-out (perceived progress). */
const MIN_SPINNER_MS = 800;

/** Level 1 Plankton is granted by default — never show the achievement celebration modal for it. */
const NO_ACHIEVEMENT_CELEBRATION_IDS = new Set(['plankton']);
const PRE_LOGIN_PROGRESS_BACKUP_STORAGE_KEY = 'preLoginProgressBackupV1';

function achievementIdsForCelebration(newlyAchieved: Achievement[]): Achievement[] {
  return newlyAchieved.filter((a) => !NO_ACHIEVEMENT_CELEBRATION_IDS.has(a.id));
}

/** Ensures default-granted badges are in `lastAchievedIds` so they never register as newly unlocked. */
function mergeDefaultSeenAchievementIds(ids: string[]): string[] {
  const next = new Set(ids);
  next.add('plankton');
  return [...next].sort();
}

/** True only if the user has real tracked progress — not merely `{ today: 0 }` seeded on first mount. */
function hasLocalPriorUsage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const tq = localStorage.getItem('totalQuestions');
    if (tq != null && parseInt(tq, 10) > 0) return true;

    const rawHistory = localStorage.getItem('history');
    if (rawHistory) {
      const parsed = JSON.parse(rawHistory) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        for (const v of Object.values(parsed)) {
          const n = typeof v === 'number' ? v : parseInt(String(v), 10);
          if (!Number.isNaN(n) && n > 0) return true;
        }
      }
    }

    const lastLevelSaved = localStorage.getItem('lastLevel');
    if (lastLevelSaved != null && parseInt(lastLevelSaved, 10) > 0) return true;

    const tpt = localStorage.getItem('totalPracticeTests');
    if (tpt != null && parseInt(tpt, 10) > 0) return true;
  } catch {
    // ignore corrupt storage
  }
  return false;
}

function mergeBonusPointsHistoryDay(
  prev: Record<string, number>,
  dateKey: string,
  delta: number
): Record<string, number> {
  const next = { ...prev };
  const nv = Math.max(0, Number(next[dateKey] ?? 0) + delta);
  if (nv === 0) delete next[dateKey];
  else next[dateKey] = nv;
  return next;
}

/** Fade-up props for main page panels — applied per section so nothing is staggered via parent variants. */
const mainSectionLoadProps = {
  initial: { opacity: 0, y: 36 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.95,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
} as const;

/** Local evening window 8pm–midnight (`hour` from Date#getHours). Warn if below half of today's goal. */
function computeAutoWarningMode(hour: number, dailyQuestions: number, dailyGoalQuestions: number): boolean {
  const goal = Math.max(1, dailyGoalQuestions);
  const inEveningWindow = hour >= 20 && hour <= 23;
  if (!inEveningWindow) return false;
  return dailyQuestions < goal / 2;
}

export default function App() {
  const isFeedbackSummaryView =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('adminView') === 'feedback';

  // --- State ---
  const [dailyQuestions, setDailyQuestions] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const todayStr = dateKeyFromDate(new Date());
    const savedHistory = localStorage.getItem('history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory) as Record<string, number>;
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed[todayStr] === 'number') return Math.max(0, parsed[todayStr]);
          // History exists for other days but not today — treat as a new day, not stale `dailyQuestions`.
          if (Object.keys(parsed).length > 0) return 0;
        }
      } catch (e) {
        console.error('Failed to parse history for dailyQuestions init', e);
      }
    }
    const saved = localStorage.getItem('dailyQuestions');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [totalQuestions, setTotalQuestions] = useState(() => {
    const savedHistory = typeof window !== 'undefined' ? localStorage.getItem('history') : null;
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        const calculatedTotal = Object.values(parsedHistory).reduce((sum: number, val: any) => sum + Number(val), 0);
        return calculatedTotal;
      } catch (e) {
        console.error("Failed to parse history for totalQuestions", e);
      }
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('totalQuestions') : null;
    return saved ? parseInt(saved) : 0;
  });

  const [bonusPoints, setBonusPoints] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('bonusPoints') : null;
    if (saved == null) return 0;
    const n = parseInt(saved, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });

  const [bonusPointsHistory, setBonusPointsHistory] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem('bonusPointsHistory');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          ([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0
        )
      ) as Record<string, number>;
    } catch {
      return {};
    }
  });

  const [history, setHistory] = useState<Record<string, number>>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('history') : null;
    return saved ? JSON.parse(saved) : {};
  });
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const [selectedHistoryDate, setSelectedHistoryDate] = useState<{ date: string, count: number, dateKey: string, isExamDay?: boolean } | null>(null);

  const [lastLevel, setLastLevel] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lastLevel') : null;
    return saved ? parseInt(saved) : 0;
  });

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedVariants') : null;
    return saved ? JSON.parse(saved) : {};
  });

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showRecordDayModal, setShowRecordDayModal] = useState(false);
  const [recordDayModalCount, setRecordDayModalCount] = useState(0);
  const [showLevelMap, setShowLevelMap] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportFeedbackModal, setShowReportFeedbackModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<FeedbackReportCategory>('bug');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitPending, setReportSubmitPending] = useState(false);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const feedbackSuccessToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFeedbackSuccessToast, setShowFeedbackSuccessToast] = useState(false);
  const [showRestorePreLoginDataModal, setShowRestorePreLoginDataModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [isTestMode, setIsTestMode] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('isTestMode') : null;
    return saved === 'true';
  });
  const [isWarningMode, setIsWarningMode] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('isWarningMode') : null;
    return saved === 'true';
  });
  const [showTestCodeInput, setShowTestCodeInput] = useState(false);
  const [testCodeInput, setTestCodeInput] = useState("");
  const [examDateKey, setExamDateKey] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_EXAM_DATE_KEY;
    const saved = localStorage.getItem('examDateKey');
    return saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : DEFAULT_EXAM_DATE_KEY;
  });
  const [dailyGoalQuestions, setDailyGoalQuestions] = useState(() => {
    if (typeof window === 'undefined') return DAILY_GOAL;
    const saved = localStorage.getItem('dailyGoalQuestions');
    const n = saved ? parseInt(saved, 10) : DAILY_GOAL;
    return clampDailyGoal(n);
  });
  const [editingExamDate, setEditingExamDate] = useState(false);
  const [editingDailyGoal, setEditingDailyGoal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingExamDraft, setOnboardingExamDraft] = useState(DEFAULT_EXAM_DATE_KEY);
  const [onboardingDailyGoalDraft, setOnboardingDailyGoalDraft] = useState(DAILY_GOAL);
  const [adminSleepModeForceOn, setAdminSleepModeForceOn] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('adminSleepModeForceOn') === 'true';
  });
  const adminCodeInputRef = useRef<HTMLInputElement>(null);
  const [practiceTestCompletionDates, setPracticeTestCompletionDates] = useState<Record<string, true>>(() => {
    if (typeof window === 'undefined') return {};
    const savedCompletionDates = localStorage.getItem('practiceTestCompletionDates');
    if (savedCompletionDates) {
      try {
        const parsed = JSON.parse(savedCompletionDates);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse practiceTestCompletionDates', e);
      }
    }
    const savedDate = localStorage.getItem('lastPracticeTestCompletedDate');
    if (savedDate) return { [savedDate]: true };
    // Backward compatibility: migrate old weekly completion flag to "today completed".
    const legacyCompleted = localStorage.getItem('isWeeklyMissionComplete') === 'true';
    return legacyCompleted ? { [dateKeyFromDate(new Date())]: true } : {};
  });
  const [totalPracticeTests, setTotalPracticeTests] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('totalPracticeTests') : null;
    return saved ? parseInt(saved, 10) : 0;
  });
  const [practiceTestScores, setPracticeTestScores] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem('practiceTestScores');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))
        ) as Record<string, number>;
      }
    } catch (e) {
      console.error('Failed to parse practiceTestScores', e);
    }
    return {};
  });
  const [practiceTestQuestionCredits, setPracticeTestQuestionCredits] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem('practiceTestQuestionCredits');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v) && v >= 0)
        ) as Record<string, number>;
      }
    } catch (e) {
      console.error('Failed to parse practiceTestQuestionCredits', e);
    }
    return {};
  });
  const [showPracticeTestEntryModal, setShowPracticeTestEntryModal] = useState(false);
  const [showLogSetModal, setShowLogSetModal] = useState(false);
  const [showLogReviewModal, setShowLogReviewModal] = useState(false);
  const [logReviewQuestionDraft, setLogReviewQuestionDraft] = useState('');
  const [logSetQuestionDraft, setLogSetQuestionDraft] = useState('');
  const [logSetPercentDraft, setLogSetPercentDraft] = useState('');
  const [questionsToReviewToday, setQuestionsToReviewToday] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('questionsToReviewToday') : null;
    const parsed = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const [displayQuestionsToReview, setDisplayQuestionsToReview] = useState(questionsToReviewToday);
  const [isReviewCountdownActive, setIsReviewCountdownActive] = useState(false);
  const [reviewZeroTransitionPhase, setReviewZeroTransitionPhase] = useState<'zero' | null>(null);
  const [showReviewCompleteModal, setShowReviewCompleteModal] = useState(false);
  const [isBpPulseActive, setIsBpPulseActive] = useState(false);
  const [displayBonusPointsEarnedToday, setDisplayBonusPointsEarnedToday] = useState(0);
  const [isBpCountupActive, setIsBpCountupActive] = useState(false);
  const [totalQuestionsReviewed, setTotalQuestionsReviewed] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('totalQuestionsReviewed') : null;
    const parsed = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const [pendingLogSetTier, setPendingLogSetTier] = useState<LogWinOutcome | null>(null);
  const [showLogWinCelebrateModal, setShowLogWinCelebrateModal] = useState(false);
  const [logWinCelebrate, setLogWinCelebrate] = useState<{
    tier: LogWinOutcome;
    questionsCovered: number;
    percentCorrect: number;
    bonusPointsEarned: number;
    newDailyTotal: number;
    questionsToReview: number;
    context: 'logSet' | 'practiceTest';
  } | null>(null);
  const [practiceTestEntryIntent, setPracticeTestEntryIntent] = useState<'completed' | 'adminPlus' | null>(null);
  const [practiceTestEntryQuestions, setPracticeTestEntryQuestions] = useState('');
  const [practiceTestEntryScore, setPracticeTestEntryScore] = useState('');
  const [practiceTestEntryPercent, setPracticeTestEntryPercent] = useState('');
  const [greatProgressPending, setGreatProgressPending] = useState<GreatProgressPendingState | null>(null);
  const [showGreatProgressModal, setShowGreatProgressModal] = useState(false);
  const [greatProgressSnapshot, setGreatProgressSnapshot] = useState<Omit<GreatProgressPendingState, 'id'> | null>(null);
  const greatProgressBonusAppliedIds = useRef<Set<number>>(new Set());
  const bpPulseTimeoutRef = useRef<number | null>(null);
  const bpPulseStartDelayTimeoutRef = useRef<number | null>(null);
  const bpCountupIntervalRef = useRef<number | null>(null);
  const reviewZeroHoldTimeoutRef = useRef<number | null>(null);
  const logSetFirstInputRef = useRef<HTMLInputElement>(null);
  const logReviewFirstInputRef = useRef<HTMLInputElement>(null);
  const practiceTestEntryFirstInputRef = useRef<HTMLInputElement>(null);
  /** Tracks calendar day for `todayKey` so we can reset daily counts at local midnight (or when simulated time jumps). */
  const prevCalendarDayKeyRef = useRef<string | null>(null);
  const [practiceScoreSpotlight, setPracticeScoreSpotlight] = useState<{
    dateKey: string;
    testNumber: number;
    draft: string;
    draftQuestions: string;
    draftPercent: string;
    isLatest: boolean;
    hadScore: boolean;
  } | null>(null);
  const [adminHistoryPracticeScoreDraft, setAdminHistoryPracticeScoreDraft] = useState('');
  const [adminHistoryPracticeQuestionsDraft, setAdminHistoryPracticeQuestionsDraft] = useState('');
  const [adminHistoryPracticePercentDraft, setAdminHistoryPracticePercentDraft] = useState('');
  const [practiceTestQuestionCounts, setPracticeTestQuestionCounts] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem('practiceTestQuestionCounts');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v) && v >= 0)
        ) as Record<string, number>;
      }
    } catch (e) {
      console.error('Failed to parse practiceTestQuestionCounts', e);
    }
    return {};
  });
  const [practiceTestPercents, setPracticeTestPercents] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem('practiceTestPercents');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return Object.fromEntries(
          Object.entries(parsed).filter(
            ([, v]) => typeof v === 'number' && !Number.isNaN(v) && v >= 0 && v <= 100
          )
        ) as Record<string, number>;
      }
    } catch (e) {
      console.error('Failed to parse practiceTestPercents', e);
    }
    return {};
  });
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showAchievementCelebration, setShowAchievementCelebration] = useState(false);
  const [queuedAchievements, setQueuedAchievements] = useState<Achievement[]>([]);
  const [lastAchievedIds, setLastAchievedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return mergeDefaultSeenAchievementIds([]);
    const saved = localStorage.getItem('lastAchievedIds');
    if (!saved) return mergeDefaultSeenAchievementIds([]);
    try {
      const parsed = JSON.parse(saved) as unknown;
      return mergeDefaultSeenAchievementIds(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return mergeDefaultSeenAchievementIds([]);
    }
  });
  const [levelMusic, setLevelMusic] = useState<HTMLAudioElement | null>(null);
  /** Sync source for looped dance music — always set immediately when creating `new Audio(URL_DANCE_MUSIC)`. */
  const celebrationLoopAudioRef = useRef<HTMLAudioElement | null>(null);

  /** Pauses looped celebration dance audio and clears `levelMusic`; safe to call anytime. */
  const stopAllCelebrationMusic = useCallback(() => {
    const el = celebrationLoopAudioRef.current;
    celebrationLoopAudioRef.current = null;
    el?.pause();
    if (el) el.currentTime = 0;
    setLevelMusic((prev) => {
      if (prev && prev !== el) {
        prev.pause();
        prev.currentTime = 0;
      }
      return null;
    });
  }, []);

  const [simulatedTime, setSimulatedTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [authActionPending, setAuthActionPending] = useState(false);
  const shouldOfferRestoreAfterSignOutRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showLogSetModal) return;
    const t = window.setTimeout(() => logSetFirstInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [showLogSetModal]);

  useEffect(() => {
    if (!showLogReviewModal) return;
    const t = window.setTimeout(() => logReviewFirstInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [showLogReviewModal]);

  useEffect(() => {
    if (!showPracticeTestEntryModal) return;
    const t = window.setTimeout(() => practiceTestEntryFirstInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [showPracticeTestEntryModal]);

  useEffect(() => {
    if (isReviewCountdownActive) return;
    setDisplayQuestionsToReview(questionsToReviewToday);
  }, [questionsToReviewToday, isReviewCountdownActive]);

  const handleSignOut = useCallback(async () => {
    setAuthActionPending(true);
    try {
      shouldOfferRestoreAfterSignOutRef.current = true;
      await new Promise((resolve) => window.setTimeout(resolve, MIN_SPINNER_MS));
      await signOut(auth);
    } catch (err) {
      shouldOfferRestoreAfterSignOutRef.current = false;
      console.error('Sign-out failed', err);
    } finally {
      setAuthActionPending(false);
    }
  }, []);

  /** Restore real clock + automatic warning/sleep behavior when leaving admin. */
  const exitAdminMode = useCallback(() => {
    setIsTestMode(false);
    setSimulatedTime(null);
    setAdminSleepModeForceOn(false);
    setShowTestCodeInput(false);
    setTestCodeInput('');
    const hours = new Date().getHours();
    setIsWarningMode(computeAutoWarningMode(hours, dailyQuestions, dailyGoalQuestions));
  }, [dailyQuestions, dailyGoalQuestions]);

  const applyProgressFromCloud = useCallback((p: UserProgressV1) => {
    historyRef.current = p.history;
    setDailyQuestions(p.dailyQuestions);
    setTotalQuestions(p.totalQuestions);
    setBonusPoints(Math.max(0, p.bonusPoints ?? 0));
    setBonusPointsHistory(p.bonusPointsHistory ?? {});
    setHistory(p.history);
    setLastLevel(p.lastLevel);
    setSelectedVariants(p.selectedVariants);
    setIsTestMode(p.isTestMode);
    setIsWarningMode(p.isWarningMode);
    setPracticeTestCompletionDates(p.practiceTestCompletionDates);
    setTotalPracticeTests(p.totalPracticeTests);
    setPracticeTestScores(p.practiceTestScores);
    setPracticeTestQuestionCredits(p.practiceTestQuestionCredits);
    setPracticeTestQuestionCounts(p.practiceTestQuestionCounts);
    setPracticeTestPercents(p.practiceTestPercents);
    setQuestionsToReviewToday(Math.max(0, p.questionsToReviewToday ?? 0));
    setTotalQuestionsReviewed(Math.max(0, p.totalQuestionsReviewed ?? 0));
    setLastAchievedIds(mergeDefaultSeenAchievementIds(p.lastAchievedIds));
    setExamDateKey(p.examDateKey);
    setDailyGoalQuestions(clampDailyGoal(p.dailyGoalQuestions));
    if (typeof localStorage !== 'undefined') {
      if (p.recordDayModalLastShown) {
        localStorage.setItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY, p.recordDayModalLastShown);
      } else {
        localStorage.removeItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY);
      }
    }
  }, []);

  const progressSnapshot = useMemo(
    () =>
      buildProgressFromAppState({
        dailyQuestions,
        totalQuestions,
        bonusPoints,
        bonusPointsHistory,
        history,
        lastLevel,
        selectedVariants,
        isTestMode,
        isWarningMode,
        practiceTestCompletionDates,
        totalPracticeTests,
        practiceTestScores,
        practiceTestQuestionCredits,
        practiceTestQuestionCounts,
        practiceTestPercents,
        questionsToReviewToday,
        totalQuestionsReviewed,
        lastAchievedIds,
        examDateKey,
        dailyGoalQuestions,
      }),
    [
      dailyQuestions,
      totalQuestions,
      bonusPoints,
      bonusPointsHistory,
      history,
      lastLevel,
      selectedVariants,
      isTestMode,
      isWarningMode,
      practiceTestCompletionDates,
      totalPracticeTests,
      practiceTestScores,
      practiceTestQuestionCredits,
      practiceTestQuestionCounts,
      practiceTestPercents,
      questionsToReviewToday,
      totalQuestionsReviewed,
      lastAchievedIds,
      examDateKey,
      dailyGoalQuestions,
    ]
  );

  const hasMeaningfulLocalProgress = useMemo(
    () => stableStringifyProgress(progressSnapshot) !== stableStringifyProgress(emptyUserProgress()),
    [progressSnapshot]
  );

  const readPreLoginBackupProgress = useCallback((): UserProgressV1 | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(PRE_LOGIN_PROGRESS_BACKUP_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      const backupPayload =
        parsed && typeof parsed === 'object' && 'progress' in parsed
          ? (parsed as { progress?: unknown }).progress
          : parsed;
      return parseUserProgressDoc(backupPayload as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }, []);

  const overwriteCloudWithLocalFirstRef = useRef(false);
  const previousAuthUidRef = useRef<string | null>(null);
  const progressSnapshotRef = useRef(progressSnapshot);
  progressSnapshotRef.current = progressSnapshot;

  const runGoogleSignInPopup = useCallback(async () => {
    setAuthActionPending(true);
    try {
      if (!firebaseUser && hasMeaningfulLocalProgress && typeof window !== 'undefined') {
        localStorage.setItem(
          PRE_LOGIN_PROGRESS_BACKUP_STORAGE_KEY,
          JSON.stringify({ savedAtMs: Date.now(), progress: progressSnapshotRef.current })
        );
      }
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error('Google sign-in failed', err);
    } finally {
      setAuthActionPending(false);
    }
  }, [firebaseUser, hasMeaningfulLocalProgress]);

  const handleContinueWithGoogleClick = useCallback(() => {
    overwriteCloudWithLocalFirstRef.current = false;
    void runGoogleSignInPopup();
  }, [runGoogleSignInPopup]);

  const getMigrationPayload = useCallback(() => progressSnapshot, [progressSnapshot]);

  const lastPushedProgressJsonRef = useRef('');
  const lastSeenServerTimeMsRef = useRef(0);

  useEffect(() => {
    lastPushedProgressJsonRef.current = '';
    lastSeenServerTimeMsRef.current = 0;
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser) {
      overwriteCloudWithLocalFirstRef.current = false;
    }
  }, [firebaseUser]);

  useEffect(() => {
    const prevUid = previousAuthUidRef.current;
    const nextUid = firebaseUser?.uid ?? null;
    const signedOutNow = prevUid && !nextUid;
    const explicitSignOutRestore =
      !nextUid && shouldOfferRestoreAfterSignOutRef.current && Boolean(readPreLoginBackupProgress());
    if ((signedOutNow || explicitSignOutRestore) && readPreLoginBackupProgress()) {
      setShowRestorePreLoginDataModal(true);
      shouldOfferRestoreAfterSignOutRef.current = false;
    }
    previousAuthUidRef.current = nextUid;
  }, [firebaseUser, readPreLoginBackupProgress]);

  const handleRestorePreLoginData = useCallback(() => {
    stopAllCelebrationMusic();
    const backup = readPreLoginBackupProgress();
    setShowRestorePreLoginDataModal(false);
    if (!backup) return;
    flushSync(() => {
      applyProgressFromCloud(backup);
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PRE_LOGIN_PROGRESS_BACKUP_STORAGE_KEY);
    }
  }, [applyProgressFromCloud, readPreLoginBackupProgress, stopAllCelebrationMusic]);

  const handleKeepSignedOutData = useCallback(() => {
    stopAllCelebrationMusic();
    setShowRestorePreLoginDataModal(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PRE_LOGIN_PROGRESS_BACKUP_STORAGE_KEY);
    }
  }, [stopAllCelebrationMusic]);

  const openFeedbackSummaryTab = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('adminView', 'feedback');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }, []);

  const cloudFirestoreReady = useFirestoreUserProgressListener({
    uid: firebaseUser?.uid ?? null,
    authResolved,
    getMigrationPayload,
    applyProgress: applyProgressFromCloud,
    getLocalProgressJson: () => stableStringifyProgress(progressSnapshotRef.current),
    lastPushedJsonRef: lastPushedProgressJsonRef,
    lastSeenServerTimeMsRef: lastSeenServerTimeMsRef,
    overwriteCloudWithLocalFirstRef,
  });

  const waitingForCloudOnboarding =
    authResolved &&
    Boolean(firebaseUser) &&
    !cloudFirestoreReady &&
    typeof window !== 'undefined' &&
    localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) !== 'true' &&
    !hasLocalPriorUsage();

  useEffect(() => {
    if (!authResolved) return;

    if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) === 'true') {
      setShowOnboarding(false);
      return;
    }

    if (hasLocalPriorUsage()) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, 'true');
      }
      setShowOnboarding(false);
      return;
    }

    if (firebaseUser && !cloudFirestoreReady) {
      return;
    }

    if (firebaseUser && cloudFirestoreReady) {
      const hasProgress =
        totalQuestions > 0 ||
        bonusPoints > 0 ||
        Object.values(history).some((c) => Number(c) > 0) ||
        lastLevel > 0 ||
        totalPracticeTests > 0;
      if (hasProgress) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, 'true');
        }
        setShowOnboarding(false);
        return;
      }
    }

    setShowOnboarding(true);
  }, [
    authResolved,
    firebaseUser,
    cloudFirestoreReady,
    totalQuestions,
    bonusPoints,
    history,
    lastLevel,
    totalPracticeTests,
  ]);

  useEffect(() => {
    if (!showOnboarding) return;
    setOnboardingExamDraft(examDateKey);
    setOnboardingDailyGoalDraft(dailyGoalQuestions);
    // Seed drafts only when onboarding opens — not on every exam/goal change while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnboarding]);

  const handleOnboardingContinue = useCallback(() => {
    const key =
      typeof onboardingExamDraft === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(onboardingExamDraft)
        ? onboardingExamDraft
        : DEFAULT_EXAM_DATE_KEY;
    setExamDateKey(key);
    setDailyGoalQuestions(clampDailyGoal(Number(onboardingDailyGoalDraft)));
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, 'true');
    }
    setShowOnboarding(false);
  }, [onboardingExamDraft, onboardingDailyGoalDraft]);

  useEffect(() => {
    if (!firebaseUser || !cloudFirestoreReady) return;
    const uid = firebaseUser.uid;
    const t = window.setTimeout(() => {
      const payload = progressSnapshotRef.current;
      saveUserProgress(db, uid, payload)
        .then(() => {
          lastPushedProgressJsonRef.current = stableStringifyProgress(payload);
        })
        .catch((e) => console.error('[Firestore] save failed', e));
    }, 900);
    return () => window.clearTimeout(t);
  }, [firebaseUser, cloudFirestoreReady, progressSnapshot]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (simulatedTime) {
        // If simulated, we increment it by 1 second every second to keep it ticking
        setSimulatedTime(prev => prev ? new Date(prev.getTime() + 1000) : null);
      } else {
        setCurrentTime(new Date());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [simulatedTime]);

  const effectiveTime = simulatedTime || currentTime;
  const todayKey = dateKeyFromDate(effectiveTime);
  const bonusPointsEarnedToday = Math.max(0, Number(bonusPointsHistory[todayKey] ?? 0) || 0);
  const isPracticeTestMissionCompleteToday = Boolean(practiceTestCompletionDates[todayKey]);

  /** Run before `useEffect` so `dailyQuestions` is reset before any effect can write stale counts into `history[todayKey]`. */
  useLayoutEffect(() => {
    const prev = prevCalendarDayKeyRef.current;
    if (prev === null) {
      prevCalendarDayKeyRef.current = todayKey;
      return;
    }
    if (prev === todayKey) return;

    prevCalendarDayKeyRef.current = todayKey;
    const countForDay = history[todayKey];
    setDailyQuestions(typeof countForDay === 'number' ? Math.max(0, countForDay) : 0);
    setQuestionsToReviewToday(0);
  }, [todayKey, history]);

  useEffect(() => {
    if (isBpCountupActive) return;
    setDisplayBonusPointsEarnedToday(bonusPointsEarnedToday);
  }, [bonusPointsEarnedToday, isBpCountupActive]);

  const practiceTestChartSeries = useMemo(
    () => buildPracticeTestChartSeries(practiceTestCompletionDates, practiceTestScores),
    [practiceTestCompletionDates, practiceTestScores]
  );

  const practiceTestScoreSeries = useMemo(
    () =>
      practiceTestChartSeries
        .filter((e) => e.score !== null)
        .map((e) => ({ dateKey: e.dateKey, testNumber: e.testNumber, score: e.score as number })),
    [practiceTestChartSeries]
  );

  const practiceChartSalmonGlow = useMemo(() => {
    const scored = practiceTestChartSeries.filter((e) => e.score !== null);
    if (scored.length < 2) return false;
    const lastEntry = practiceTestChartSeries[practiceTestChartSeries.length - 1];
    if (lastEntry.score === null) return false;
    return (
      scored[scored.length - 1].score! > scored[scored.length - 2].score!
    );
  }, [practiceTestChartSeries]);

  const evaluateLevelProgress = useCallback((xpTotal: number) => {
    let newLevelIndex = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xpTotal >= LEVELS[i].min) {
        newLevelIndex = i;
        break;
      }
    }

    setLastLevel((prevLast) => {
      if (newLevelIndex <= prevLast) return prevLast;
      const level = LEVELS[newLevelIndex];
      const levelUpMsg = isWarningMode
        ? `You've grown into a ${level.name}, but you're still just prey.`
        : SILLY_STATEMENTS[level.name]?.levelUp || `You've reached level ${level.name}!`;
      setGoalMessage(levelUpMsg);

      localStorage.setItem('lastLevel', newLevelIndex.toString());
      return newLevelIndex;
    });
  }, [isWarningMode]);

  const checkMilestones = (
    newDaily: number,
    newQuestionTotal: number,
    newHistory: Record<string, number> = history,
    practiceTestsForAchievementCheck?: number,
    xpTotalForLevels?: number,
    bonusPointsForAchievements?: number
  ) => {
    const practiceTestsUsed = practiceTestsForAchievementCheck ?? totalPracticeTests;
    const effectiveBonus = bonusPointsForAchievements ?? bonusPoints;
    const xpTotal = xpTotalForLevels ?? newQuestionTotal + effectiveBonus;

    evaluateLevelProgress(xpTotal);

    // Milestone badges use raw QP; main level-tier badges match the XP ladder (`questions + bonus`).
    const todayStr = dateKeyFromDate(effectiveTime);
    const historyForAchievements = { ...newHistory, [todayStr]: newDaily };
    const newlyAchieved = ACHIEVEMENTS.filter(
      (a) =>
        getAchievementStatus(a, newQuestionTotal, historyForAchievements, effectiveTime, practiceTestsUsed, effectiveBonus) &&
        !lastAchievedIds.includes(a.id)
    );
    const toCelebrate = achievementIdsForCelebration(newlyAchieved);
    if (newlyAchieved.length > 0) {
      const [first, ...rest] = toCelebrate;
      const deferAchievementModal =
        selectedAchievement || showAchievementCelebration || selectedHistoryDate;
      if (toCelebrate.length > 0) {
        if (deferAchievementModal) {
          setQueuedAchievements((prev) => {
            const existing = new Set(prev.map((a) => a.id));
            const additions = toCelebrate.filter((a) => !existing.has(a.id));
            return [...prev, ...additions];
          });
        } else {
          setSelectedAchievement(first);
          setShowAchievementCelebration(true);
          if (rest.length > 0) {
            setQueuedAchievements((prev) => {
              const existing = new Set(prev.map((a) => a.id));
              const additions = rest.filter((a) => !existing.has(a.id));
              return [...prev, ...additions];
            });
          }
        }
      }
      setLastAchievedIds(prev => {
        const next = [...prev, ...newlyAchieved.map(a => a.id)];
        localStorage.setItem('lastAchievedIds', JSON.stringify(next));
        return next;
      });
      if (!selectedHistoryDate && toCelebrate.length > 0) {
        triggerFireworks();

        if (!isMuted) {
          celebrationLoopAudioRef.current?.pause();
          const music = new Audio(URL_DANCE_MUSIC);
          celebrationLoopAudioRef.current = music;
          music.loop = true;
          music.volume = 0.5;
          music.play().catch(err => console.error("Achievement music failed:", err));
          setLevelMusic(music);
        }
      }
    }
  };

  const naturalSleepMode = useMemo(() => {
    const hours = effectiveTime.getHours();
    return hours >= 0 && hours < 4;
  }, [effectiveTime]);

  const isSleepMode = useMemo(() => {
    if (isTestMode) return adminSleepModeForceOn;
    return naturalSleepMode;
  }, [isTestMode, adminSleepModeForceOn, naturalSleepMode]);

  useEffect(() => {
    if (isTestMode) return;
    const hours = effectiveTime.getHours();
    setIsWarningMode(computeAutoWarningMode(hours, dailyQuestions, dailyGoalQuestions));
  }, [dailyQuestions, dailyGoalQuestions, effectiveTime, isTestMode]);

  /** Sync `goalMessage` with Warning Mode (Anglerfish): harsh on enter, SILLY motivational on exit — same pool as +10 taps in normal mode. */
  const prevWarningAnglerfishActiveRef = useRef(false);
  useEffect(() => {
    const active = isWarningMode && !isSleepMode;
    if (active && !prevWarningAnglerfishActiveRef.current) {
      setGoalMessage(HARD_ASS_STATEMENTS[Math.floor(Math.random() * HARD_ASS_STATEMENTS.length)]);
    } else if (!active && prevWarningAnglerfishActiveRef.current) {
      const xpTotal = Math.max(0, totalQuestions + bonusPoints);
      let levelIdx = 0;
      for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xpTotal >= LEVELS[i].min) {
          levelIdx = i;
          break;
        }
      }
      const levelName = LEVELS[levelIdx].name;
      const levelStats = SILLY_STATEMENTS[levelName];
      const category = dailyQuestions >= MILESTONE_1 ? 'high' : 'moderate';
      const bucket = levelStats[category];
      setGoalMessage(bucket[Math.floor(Math.random() * bucket.length)]);
    }
    prevWarningAnglerfishActiveRef.current = active;
  }, [
    isWarningMode,
    isSleepMode,
    totalQuestions,
    bonusPoints,
    dailyQuestions,
  ]);

  useEffect(() => {
    localStorage.setItem('isWarningMode', isWarningMode.toString());
  }, [isWarningMode]);

  useEffect(() => {
    localStorage.setItem('selectedVariants', JSON.stringify(selectedVariants));
  }, [selectedVariants]);

  useEffect(() => {
    localStorage.setItem('examDateKey', examDateKey);
  }, [examDateKey]);

  useEffect(() => {
    localStorage.setItem('dailyGoalQuestions', dailyGoalQuestions.toString());
  }, [dailyGoalQuestions]);

  useEffect(() => {
    localStorage.setItem('adminSleepModeForceOn', adminSleepModeForceOn.toString());
  }, [adminSleepModeForceOn]);

  useEffect(() => {
    if (!showSettingsModal || !showTestCodeInput || isTestMode) return;
    requestAnimationFrame(() => {
      adminCodeInputRef.current?.focus();
    });
  }, [showSettingsModal, showTestCodeInput, isTestMode]);

  useEffect(() => {
    if (showSettingsModal) return;
    setEditingExamDate(false);
    setEditingDailyGoal(false);
  }, [showSettingsModal]);

  // --- Derived State ---
  /** Total XP = question points (QP) + bonus points (BP). */
  const totalExperiencePoints = useMemo(
    () => Math.max(0, totalQuestions + bonusPoints),
    [totalQuestions, bonusPoints]
  );

  const currentLevelIndex = useMemo(() => {
    let index = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalExperiencePoints >= LEVELS[i].min) {
        index = i;
        break;
      }
    }
    return index;
  }, [totalExperiencePoints]);

  const currentLevel = LEVELS[currentLevelIndex];
  const nextLevel = LEVELS[currentLevelIndex + 1];
  const xpToNext = nextLevel ? Math.max(0, nextLevel.min - totalExperiencePoints) : 0;

  const currentLevelVariants = LEVEL_VARIANTS[currentLevel.graphic] || [currentLevel.graphic];
  const unlockedVariants = currentLevelVariants.filter(variant => {
    if (variant === currentLevel.graphic) return true;
    const achievement = ACHIEVEMENTS.find(a => a.image === variant);
    return achievement
      ? getAchievementStatus(achievement, totalQuestions, history, effectiveTime, totalPracticeTests, bonusPoints, lastAchievedIds)
      : false;
  });

  const defaultVariant = unlockedVariants[unlockedVariants.length - 1];
  const displayVariant = (selectedVariants[currentLevel.graphic] && unlockedVariants.includes(selectedVariants[currentLevel.graphic])) 
    ? selectedVariants[currentLevel.graphic] 
    : defaultVariant;


  const examCalendarDate = useMemo(() => {
    const [y, m, d] = examDateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [examDateKey]);

  /** Calendar months from fixed study start through exam day (expands when exam date moves). */
  const historyCalendarMonths = useMemo(() => {
    const HISTORY_GRID_START = new Date(2026, 3, 5);
    const rangeStart = new Date(
      HISTORY_GRID_START.getFullYear(),
      HISTORY_GRID_START.getMonth(),
      HISTORY_GRID_START.getDate()
    );
    const rangeEnd = new Date(
      examCalendarDate.getFullYear(),
      examCalendarDate.getMonth(),
      examCalendarDate.getDate()
    );
    const end = rangeEnd < rangeStart ? rangeStart : rangeEnd;

    const todayStr = dateKeyFromDate(effectiveTime);
    const historyTierMid = Math.max(1, Math.round(dailyGoalQuestions * (MILESTONE_1 / DAILY_GOAL)));

    let cumulativeTotal = 0;
    Object.keys(history).forEach((dateStr) => {
      const [yy, mm, dd] = dateStr.split('-').map(Number);
      const dt = new Date(yy, mm - 1, dd);
      if (dt < rangeStart) cumulativeTotal += Number(history[dateStr]) || 0;
    });

    const levelUpsByDay = new Map<string, Level[]>();
    for (let cur = new Date(rangeStart); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dk = dateKeyFromDate(cur);
      const count = Number(history[dk]) || 0;
      cumulativeTotal += count;
      LEVELS.forEach((level) => {
        const thresholdQ = Math.max(0, level.min - bonusPoints);
        if (cumulativeTotal >= thresholdQ && cumulativeTotal - count < thresholdQ) {
          const arr = levelUpsByDay.get(dk) ?? [];
          arr.push(level);
          levelUpsByDay.set(dk, arr);
        }
      });
    }

    const months: ReactNode[] = [];
    let monthWalker = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const lastMonthFirst = new Date(end.getFullYear(), end.getMonth(), 1);
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    while (monthWalker <= lastMonthFirst) {
      const y = monthWalker.getFullYear();
      const mo = monthWalker.getMonth();
      const daysInMonth = new Date(y, mo + 1, 0).getDate();
      const firstWeekday = new Date(y, mo, 1).getDay();

      const levelsReachedThisMonth: Level[] = [];
      const seenLevel = new Set<string>();
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const date = new Date(y, mo, dayNum);
        if (date < rangeStart || date > end) continue;
        const dk = dateKeyFromDate(date);
        const ups = levelUpsByDay.get(dk);
        if (ups) {
          for (const l of ups) {
            if (!seenLevel.has(l.name)) {
              seenLevel.add(l.name);
              levelsReachedThisMonth.push(l);
            }
          }
        }
      }

      const cells: ReactNode[] = [];

      for (let i = 0; i < firstWeekday; i++) {
        cells.push(<div key={`lead-${y}-${mo}-${i}`} className="aspect-square min-h-0" aria-hidden />);
      }

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const date = new Date(y, mo, dayNum);
        const dateKey = dateKeyFromDate(date);
        const outOfRange = date < rangeStart || date > end;

        if (outOfRange) {
          cells.push(
            <div key={dateKey} className="aspect-square rounded-lg bg-white/[0.03] min-h-0" aria-hidden />
          );
          continue;
        }

        const count = Number(history[dateKey]) || 0;
        const isToday = dateKey === todayStr;
        const isFuture = date > effectiveTime;
        const isExamDay = dateKey === examDateKey;
        const isTrophyOnLightBackground = count > 45;

        const dynamicColor =
          !isSleepMode && !isWarningMode && !isExamDay && !(isFuture && !isTestMode)
            ? getHistoryColor(count, dailyGoalQuestions)
            : null;

        cells.push(
          <div
            key={dateKey}
            onClick={() =>
              setSelectedHistoryDate({
                date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                count,
                dateKey,
                isExamDay,
              })
            }
            className={`question-count-clay-btn aspect-square rounded-lg flex items-center justify-center text-xs font-black cursor-pointer transition-all hover:scale-110 active:scale-95 relative min-h-0 ${
              isExamDay
                ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                : isFuture && !isTestMode
                  ? 'bg-white/5 text-white/20'
                  : dynamicColor
                    ? ''
                    : isToday
                      ? 'bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                      : count >= dailyGoalQuestions
                        ? 'bg-emerald-500 text-white'
                        : count >= historyTierMid
                          ? 'bg-amber-600 text-white'
                          : count > 0
                            ? 'bg-red-800 text-white'
                            : 'bg-white/10 text-white/40'
            }`}
            style={
              dynamicColor
                ? {
                    backgroundColor: dynamicColor,
                    color: count > 45 ? 'black' : 'white',
                  }
                : {}
            }
          >
            {!isExamDay && (
              <span className="absolute top-0.5 left-1 text-[9px] font-black leading-none text-white/40">
                {dayNum}
              </span>
            )}
            {isExamDay ? (
              'EXAM'
            ) : (
              <div className="flex flex-col items-center justify-center leading-none">
                <span>{count > 0 ? count : ''}</span>
                {practiceTestCompletionDates[dateKey] && (
                  <Trophy className={`w-3 h-3 mt-0.5 ${isTrophyOnLightBackground ? 'text-black' : 'text-yellow-300'}`} />
                )}
              </div>
            )}
            {isToday && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping" />
            )}
          </div>
        );
      }

      const totalCells = firstWeekday + daysInMonth;
      const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let i = 0; i < trailing; i++) {
        cells.push(<div key={`trail-${y}-${mo}-${i}`} className="aspect-square min-h-0" aria-hidden />);
      }

      months.push(
        <div key={`hist-cal-${y}-${mo}`} className="space-y-2">
          <div className="flex justify-between items-center px-1 gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/55">
              {new Date(y, mo, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            {levelsReachedThisMonth.length > 0 && (
              <div className="flex gap-1 shrink-0">
                {levelsReachedThisMonth.map((l, idx) => (
                  <span key={`${l.name}-${idx}`} title={`Reached ${l.name}`} className="text-xs">
                    {l.emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((wd, wi) => (
              <div
                key={`wd-${y}-${mo}-${wi}`}
                className="text-center text-[9px] font-black uppercase tracking-wider text-white/35 py-0.5"
              >
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">{cells}</div>
        </div>
      );

      monthWalker = new Date(y, mo + 1, 1);
    }

    return months;
  }, [
    bonusPoints,
    dailyGoalQuestions,
    effectiveTime,
    examCalendarDate,
    examDateKey,
    history,
    isSleepMode,
    isTestMode,
    isWarningMode,
    practiceTestCompletionDates,
  ]);

  const daysUntilExam = Math.ceil((examCalendarDate.getTime() - effectiveTime.getTime()) / (1000 * 60 * 60 * 24));
  const modalPanelSizeClass = 'w-[92vw] sm:w-[86vw] lg:w-[74vw] max-w-[44rem] max-h-[90dvh]';
  /** Outer modal frame: clips to rounded border; scrolling happens in a child using {@link modalBodyScrollClass}. */
  const modalShellLayoutClass = 'min-h-0 flex flex-col overflow-hidden';
  const modalBodyScrollClass = 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain';

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('dailyQuestions', dailyQuestions.toString());
  }, [dailyQuestions]);

  useEffect(() => {
    localStorage.setItem('totalQuestions', totalQuestions.toString());
  }, [totalQuestions]);

  /** Keep `history[today]` aligned with `dailyQuestions`; depends on calendar day + count only (see midnight layout effect). */
  useEffect(() => {
    setHistory((prev) => {
      const newHistory = { ...prev, [todayKey]: dailyQuestions };
      localStorage.setItem('history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, [dailyQuestions, todayKey]);

  useEffect(() => {
    localStorage.setItem('bonusPoints', bonusPoints.toString());
  }, [bonusPoints]);

  useEffect(() => {
    localStorage.setItem('bonusPointsHistory', JSON.stringify(bonusPointsHistory));
  }, [bonusPointsHistory]);

  useEffect(() => {
    localStorage.setItem('questionsToReviewToday', questionsToReviewToday.toString());
  }, [questionsToReviewToday]);

  useEffect(() => {
    localStorage.setItem('totalQuestionsReviewed', totalQuestionsReviewed.toString());
  }, [totalQuestionsReviewed]);

  const adjustBonusPointsForDay = useCallback((dateKey: string, delta: number) => {
    if (delta === 0) return;
    setBonusPoints((prev) => Math.max(0, prev + delta));
    setBonusPointsHistory((prev) => mergeBonusPointsHistoryDay(prev, dateKey, delta));
  }, []);

  useEffect(() => {
    localStorage.setItem('isTestMode', isTestMode.toString());
  }, [isTestMode]);

  useEffect(() => {
    localStorage.setItem('practiceTestCompletionDates', JSON.stringify(practiceTestCompletionDates));
    const completionDates = Object.keys(practiceTestCompletionDates).sort();
    const latestCompletionDate = completionDates.length > 0 ? completionDates[completionDates.length - 1] : null;
    if (latestCompletionDate) {
      localStorage.setItem('lastPracticeTestCompletedDate', latestCompletionDate);
    } else {
      localStorage.removeItem('lastPracticeTestCompletedDate');
    }
    localStorage.removeItem('isWeeklyMissionComplete');
    localStorage.removeItem('lastWeeklyReset');
    localStorage.setItem('totalPracticeTests', totalPracticeTests.toString());
  }, [practiceTestCompletionDates, totalPracticeTests]);

  useEffect(() => {
    const n = Object.keys(practiceTestCompletionDates).length;
    if (n === 0) return;
    setTotalPracticeTests((prev) => (n > prev ? n : prev));
  }, [practiceTestCompletionDates]);

  useEffect(() => {
    localStorage.setItem('practiceTestScores', JSON.stringify(practiceTestScores));
  }, [practiceTestScores]);

  useEffect(() => {
    localStorage.setItem('practiceTestQuestionCredits', JSON.stringify(practiceTestQuestionCredits));
  }, [practiceTestQuestionCredits]);

  useEffect(() => {
    localStorage.setItem('practiceTestQuestionCounts', JSON.stringify(practiceTestQuestionCounts));
  }, [practiceTestQuestionCounts]);

  useEffect(() => {
    localStorage.setItem('practiceTestPercents', JSON.stringify(practiceTestPercents));
  }, [practiceTestPercents]);

  useEffect(() => {
    // Lock body scroll when any modal is open
    const isAnyModalOpen =
      showGoalModal ||
      showRecordDayModal ||
      showRestorePreLoginDataModal ||
      showSettingsModal ||
      showReportFeedbackModal ||
      showImageViewer ||
      showPracticeTestEntryModal ||
      showLogSetModal ||
      showLogReviewModal ||
      showReviewCompleteModal ||
      showLogWinCelebrateModal ||
      showGreatProgressModal ||
      Boolean(practiceScoreSpotlight) ||
      Boolean(selectedHistoryDate);
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [
    showGoalModal,
    showRecordDayModal,
    showRestorePreLoginDataModal,
    showSettingsModal,
    showReportFeedbackModal,
    showImageViewer,
    showPracticeTestEntryModal,
    showLogSetModal,
    showLogReviewModal,
    showReviewCompleteModal,
    showLogWinCelebrateModal,
    showGreatProgressModal,
    practiceScoreSpotlight?.dateKey,
    selectedHistoryDate?.dateKey,
  ]);

  useEffect(() => {
    const isAnyModalOpen =
      showGoalModal ||
      showRecordDayModal ||
      showRestorePreLoginDataModal ||
      showSettingsModal ||
      showReportFeedbackModal ||
      showImageViewer ||
      showPracticeTestEntryModal ||
      showLogSetModal ||
      showLogReviewModal ||
      showReviewCompleteModal ||
      showLogWinCelebrateModal ||
      showGreatProgressModal ||
      Boolean(practiceScoreSpotlight) ||
      Boolean(selectedHistoryDate) ||
      Boolean(selectedAchievement);
    if (!isAnyModalOpen) return;

    // When any modal opens, scroll modal panels to top; keep the main page scroll position unchanged.
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('[data-modal-scroll="true"]').forEach((el) => {
        el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    });
  }, [
    showGoalModal,
    showRecordDayModal,
    showRestorePreLoginDataModal,
    showSettingsModal,
    showReportFeedbackModal,
    showImageViewer,
    showPracticeTestEntryModal,
    showLogSetModal,
    showLogReviewModal,
    showReviewCompleteModal,
    showLogWinCelebrateModal,
    showGreatProgressModal,
    practiceScoreSpotlight?.dateKey,
    selectedHistoryDate?.dateKey,
    selectedAchievement?.id,
  ]);

  useEffect(() => {
    return () => {
      if (feedbackSuccessToastTimeoutRef.current) clearTimeout(feedbackSuccessToastTimeoutRef.current);
      if (bpPulseTimeoutRef.current) clearTimeout(bpPulseTimeoutRef.current);
      if (bpPulseStartDelayTimeoutRef.current) clearTimeout(bpPulseStartDelayTimeoutRef.current);
      if (bpCountupIntervalRef.current) clearInterval(bpCountupIntervalRef.current);
      if (reviewZeroHoldTimeoutRef.current) clearTimeout(reviewZeroHoldTimeoutRef.current);
    };
  }, []);

  // --- Handlers ---
  const addQuestions = (amount: number, practiceTestsForAchievementCheck?: number, bonusPointsForAchievements?: number) => {
    const newDaily = Math.max(0, dailyQuestions + amount);
    const diff = newDaily - dailyQuestions;
    const setRandomSillyMotivationForLine = () => {
      const levelStats = SILLY_STATEMENTS[currentLevel.name];
      const category = newDaily >= MILESTONE_1 ? 'high' : 'moderate';
      const bucket = levelStats[category];
      setGoalMessage(bucket[Math.floor(Math.random() * bucket.length)]);
    };
    const todayStrForRecord = dateKeyFromDate(effectiveTime);
    const maxOnOtherDays = Math.max(
      0,
      ...Object.entries(history)
        .filter(([k]) => k !== todayStrForRecord)
        .map(([, v]) => Number(v))
    );
    const previousDayRecord = Math.max(0, dailyQuestions, maxOnOtherDays);
    const brokeDayRecord = amount > 0 && newDaily > previousDayRecord;
    const canShowRecordDayModal =
      brokeDayRecord &&
      typeof window !== 'undefined' &&
      localStorage.getItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY) !== todayStrForRecord;
    const hitDailyGoal =
      newDaily >= dailyGoalQuestions && dailyQuestions < dailyGoalQuestions;
    
    // Play interaction sounds
    if (!isMuted && amount !== 0) {
      let soundPath = amount > 0 ? publicAsset('assets/bubble_up.mp3') : publicAsset('assets/bubble_down.mp3');
      
      if (amount > 0 && (hitDailyGoal || canShowRecordDayModal)) {
        soundPath = URL_FIREWORKS;
      }

      console.log(`Playing sound: ${soundPath}`);
      const audio = new Audio(soundPath);
      audio.volume = 0.7;
      audio.play().catch(err => console.error("Audio play failed:", err));
    }

    // Update Statement on +10 — never use HARD_ASS on the tap that completes the daily goal (Goal Reached modal).
    if (amount > 0) {
      if (isWarningMode && !hitDailyGoal) {
        setGoalMessage(HARD_ASS_STATEMENTS[Math.floor(Math.random() * HARD_ASS_STATEMENTS.length)]);
      } else {
        setRandomSillyMotivationForLine();
      }
    }

    if (hitDailyGoal) {
      triggerExtremeCelebration();
    } else if (canShowRecordDayModal) {
      localStorage.setItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY, todayStrForRecord);
      setRecordDayModalCount(newDaily);
      setShowRecordDayModal(true);
      triggerFireworks();
    }

    setDailyQuestions(newDaily);
    const newTotal = Math.max(0, totalQuestions + diff);
    setTotalQuestions(newTotal);
    
    // Check for milestones directly in the click handler to satisfy browser audio requirements
    checkMilestones(newDaily, newTotal, history, practiceTestsForAchievementCheck, undefined, bonusPointsForAchievements);

    // Level-up can overwrite `goalMessage` with warning-mode tough love — restore SILLY copy for Goal Reached.
    if (hitDailyGoal && amount > 0) {
      setRandomSillyMotivationForLine();
    }
  };

  useEffect(() => {
    if (!greatProgressPending) return;
    if (showAchievementCelebration) return;
    if (greatProgressBonusAppliedIds.current.has(greatProgressPending.id)) return;
    greatProgressBonusAppliedIds.current.add(greatProgressPending.id);

    const p = greatProgressPending;
    setGreatProgressPending(null);
    const delta = p.bonusPoints;
    let xpAfter = 0;
    flushSync(() => {
      setBonusPoints((prev) => {
        const next = prev + delta;
        xpAfter = totalQuestions + next;
        return next;
      });
      setBonusPointsHistory((prev) => mergeBonusPointsHistoryDay(prev, p.highlightDateKey, delta));
    });
    evaluateLevelProgress(xpAfter);
    setGreatProgressSnapshot({
      bonusPoints: p.bonusPoints,
      deltaPoints: p.deltaPoints,
      previousScore: p.previousScore,
      newScore: p.newScore,
      highlightDateKey: p.highlightDateKey,
    });
    setShowGreatProgressModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only when achievement UI clears after practice-test submit
  }, [greatProgressPending, selectedAchievement, showAchievementCelebration]);

  const dismissAchievementView = () => {
    if (queuedAchievements.length > 0 && selectedHistoryDate) {
      setSelectedAchievement(null);
      setShowAchievementCelebration(false);
      stopAllCelebrationMusic();
      return;
    }
    if (queuedAchievements.length > 0) {
      const celebrationQueue = achievementIdsForCelebration(queuedAchievements);
      if (celebrationQueue.length === 0) {
        setQueuedAchievements([]);
        setSelectedAchievement(null);
        setShowAchievementCelebration(false);
        stopAllCelebrationMusic();
        return;
      }
      const [next, ...rest] = celebrationQueue;
      setQueuedAchievements(rest);
      setSelectedAchievement(next);
      setShowAchievementCelebration(true);
      return;
    }
    setSelectedAchievement(null);
    setShowAchievementCelebration(false);
    stopAllCelebrationMusic();
  };

  const openLogSetModal = () => {
    setLogSetQuestionDraft('');
    setLogSetPercentDraft('');
    setShowLogSetModal(true);
  };

  const cancelLogSetModal = () => {
    setShowLogSetModal(false);
    setLogSetQuestionDraft('');
    setLogSetPercentDraft('');
  };

  const openLogReviewModal = () => {
    setLogReviewQuestionDraft('');
    setShowLogReviewModal(true);
  };

  const cancelLogReviewModal = () => {
    setShowLogReviewModal(false);
    setLogReviewQuestionDraft('');
  };

  const triggerBpPulse = (fromBp: number | null = null, toBp: number | null = null) => {
    if (bpPulseStartDelayTimeoutRef.current) {
      window.clearTimeout(bpPulseStartDelayTimeoutRef.current);
      bpPulseStartDelayTimeoutRef.current = null;
    }
    if (
      fromBp !== null &&
      toBp !== null &&
      Number.isFinite(fromBp) &&
      Number.isFinite(toBp) &&
      toBp > fromBp
    ) {
      if (bpCountupIntervalRef.current) {
        window.clearInterval(bpCountupIntervalRef.current);
      }
      setIsBpCountupActive(true);
      setDisplayBonusPointsEarnedToday(fromBp);
      const diff = toBp - fromBp;
      const stepMs = Math.max(36, Math.min(85, Math.floor(780 / diff)));
      let current = fromBp;
      bpCountupIntervalRef.current = window.setInterval(() => {
        current += 1;
        if (current >= toBp) {
          if (bpCountupIntervalRef.current) {
            window.clearInterval(bpCountupIntervalRef.current);
            bpCountupIntervalRef.current = null;
          }
          setDisplayBonusPointsEarnedToday(toBp);
          setIsBpCountupActive(false);
          return;
        }
        setDisplayBonusPointsEarnedToday(current);
      }, stepMs);
    }
    setIsBpPulseActive(true);
    if (bpPulseTimeoutRef.current) {
      window.clearTimeout(bpPulseTimeoutRef.current);
    }
    bpPulseTimeoutRef.current = window.setTimeout(() => {
      setIsBpPulseActive(false);
      bpPulseTimeoutRef.current = null;
    }, 800);
  };

  const animateReviewCountdown = (
    from: number,
    to: number,
    bpFromForPulse: number,
    bpToForPulse: number
  ) => {
    const maybeShowReviewCompleteModal = () => {
      if (to !== 0) return;
      setReviewZeroTransitionPhase('zero');
      if (reviewZeroHoldTimeoutRef.current) {
        window.clearTimeout(reviewZeroHoldTimeoutRef.current);
      }
      reviewZeroHoldTimeoutRef.current = window.setTimeout(() => {
        setReviewZeroTransitionPhase(null);
        setShowReviewCompleteModal(true);
        triggerFireworks();
        reviewZeroHoldTimeoutRef.current = null;
      }, 400);
    };

    const triggerBpPulseWithDelay = () => {
      if (bpPulseStartDelayTimeoutRef.current) {
        window.clearTimeout(bpPulseStartDelayTimeoutRef.current);
      }
      bpPulseStartDelayTimeoutRef.current = window.setTimeout(() => {
        triggerBpPulse(bpFromForPulse, bpToForPulse);
        bpPulseStartDelayTimeoutRef.current = null;
      }, 400);
    };

    if (from <= to) {
      setDisplayQuestionsToReview(to);
      maybeShowReviewCompleteModal();
      triggerBpPulseWithDelay();
      return;
    }
    setIsReviewCountdownActive(true);
    setDisplayQuestionsToReview(from);
    const diff = from - to;
    const stepMs = Math.max(28, Math.min(70, Math.floor(560 / diff)));
    let current = from;
    const interval = window.setInterval(() => {
      current -= 1;
      if (current <= to) {
        window.clearInterval(interval);
        setDisplayQuestionsToReview(to);
        setIsReviewCountdownActive(false);
        maybeShowReviewCompleteModal();
        triggerBpPulseWithDelay();
        return;
      }
      setDisplayQuestionsToReview(current);
    }, stepMs);
  };

  const confirmLogReview = () => {
    const n = parseInt(logReviewQuestionDraft.replace(/,/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    const prevQuestionsToReview = questionsToReviewToday;
    const nextQuestionsToReview = Math.max(0, prevQuestionsToReview - n);
    const prevBpEarnedToday = bonusPointsEarnedToday;
    const nextBpEarnedToday = prevBpEarnedToday + n;
    adjustBonusPointsForDay(dateKeyFromDate(effectiveTime), n);
    setQuestionsToReviewToday(nextQuestionsToReview);
    setTotalQuestionsReviewed((prev) => prev + n);
    animateReviewCountdown(prevQuestionsToReview, nextQuestionsToReview, prevBpEarnedToday, nextBpEarnedToday);
    setShowLogReviewModal(false);
    setLogReviewQuestionDraft('');
  };

  const adjustQuestionsToReviewFromButtons = (amount: number) => {
    if (amount === 0) return;

    if (amount < 0) {
      const prevQuestionsToReview = questionsToReviewToday;
      const decrement = Math.abs(amount);
      const reviewedNow = Math.min(prevQuestionsToReview, decrement);
      if (reviewedNow <= 0) return;
      const nextQuestionsToReview = Math.max(0, prevQuestionsToReview - reviewedNow);

      const prevBpEarnedToday = bonusPointsEarnedToday;
      const nextBpEarnedToday = prevBpEarnedToday + reviewedNow;
      adjustBonusPointsForDay(dateKeyFromDate(effectiveTime), reviewedNow);
      setQuestionsToReviewToday(nextQuestionsToReview);
      setTotalQuestionsReviewed((prev) => prev + reviewedNow);
      triggerBpPulse(prevBpEarnedToday, nextBpEarnedToday);
      if (nextQuestionsToReview === 0) {
        setReviewZeroTransitionPhase('zero');
        if (reviewZeroHoldTimeoutRef.current) {
          window.clearTimeout(reviewZeroHoldTimeoutRef.current);
        }
        reviewZeroHoldTimeoutRef.current = window.setTimeout(() => {
          setReviewZeroTransitionPhase(null);
          setShowReviewCompleteModal(true);
          triggerFireworks();
          reviewZeroHoldTimeoutRef.current = null;
        }, 400);
      }
      return;
    }

    setReviewZeroTransitionPhase(null);
    setQuestionsToReviewToday((prev) => prev + amount);
  };

  const triggerModerateCelebration = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00BFFF', '#1E90FF', '#ADD8E6']
    });
  }, []);

  const confirmLogSet = () => {
    const n = parseInt(logSetQuestionDraft.replace(/,/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    const percentInput = logSetPercentDraft.trim();
    const percent = percentInput === '' ? null : parseFloat(percentInput.replace(/,/g, ''));
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) return;

    const bonusPts = percent === null ? 0 : bonusPointsForLoggedAccuracy(n, percent);
    const newDailyTotal = dailyQuestions + n;
    flushSync(() => {
      if (bonusPts > 0) {
        adjustBonusPointsForDay(dateKeyFromDate(effectiveTime), bonusPts);
      }
    });
    addQuestions(n, undefined, bonusPoints + bonusPts);
    const highestTier: LogWinOutcome | null =
      percent === null
        ? null
        : percent >= 100
          ? 100
          : percent >= 80
            ? 80
            : percent >= 70
              ? 70
              : percent >= 60
                ? 60
                : 'effort';
    const questionsToReview =
      percent === null ? 0 : Math.max(0, n - Math.round((n * percent) / 100));

    if (questionsToReview > 0) {
      setQuestionsToReviewToday((prev) => prev + questionsToReview);
    }

    if (highestTier && percent !== null) {
      setLogWinCelebrate({
        tier: highestTier,
        questionsCovered: n,
        percentCorrect: percent,
        bonusPointsEarned: bonusPts,
        newDailyTotal,
        questionsToReview,
        context: 'logSet',
      });
      setPendingLogSetTier(highestTier);
    } else {
      setLogWinCelebrate(null);
      setPendingLogSetTier(null);
    }
    setShowLogSetModal(false);
    setShowLogReviewModal(false);
    setShowReviewCompleteModal(false);
    setLogReviewQuestionDraft('');
    setLogSetQuestionDraft('');
    setLogSetPercentDraft('');
  };

  useEffect(() => {
    if (!logWinCelebrate) return;
    if (showLogWinCelebrateModal) return;
    if (showAchievementCelebration || selectedAchievement) return;
    if (!pendingLogSetTier) return;
    triggerModerateCelebration();
    setShowLogWinCelebrateModal(true);
    setPendingLogSetTier(null);
  }, [pendingLogSetTier, showLogWinCelebrateModal, showAchievementCelebration, selectedAchievement, logWinCelebrate, triggerModerateCelebration]);

  useEffect(() => {
    if (!showLogWinCelebrateModal || !logWinCelebrate || logWinCelebrate.tier !== 100 || isMuted) return;

    celebrationLoopAudioRef.current?.pause();
    const music = new Audio(URL_DANCE_MUSIC);
    celebrationLoopAudioRef.current = music;
    music.loop = true;
    music.volume = 0.5;
    setLevelMusic((prev) => {
      prev?.pause();
      if (prev) prev.currentTime = 0;
      return music;
    });
    music.play().catch((err) => console.error('Log win celebration music failed:', err));

    return () => {
      stopAllCelebrationMusic();
    };
  }, [showLogWinCelebrateModal, logWinCelebrate, isMuted, stopAllCelebrationMusic]);

  const clearAllData = () => {
    stopAllCelebrationMusic();
    setDailyQuestions(0);
    setTotalQuestions(0);
    setBonusPoints(0);
    setBonusPointsHistory({});
    setQuestionsToReviewToday(0);
    setTotalQuestionsReviewed(0);
    setLastLevel(0);
    setPracticeTestCompletionDates({});
    setPracticeTestScores({});
    setPracticeTestQuestionCredits({});
    setTotalPracticeTests(0);
    setGreatProgressPending(null);
    setShowGreatProgressModal(false);
    setGreatProgressSnapshot(null);
    greatProgressBonusAppliedIds.current.clear();
    setPracticeScoreSpotlight(null);
    setShowLogSetModal(false);
    setLogSetQuestionDraft('');
    setLogSetPercentDraft('');
    setPendingLogSetTier(null);
    setShowLogWinCelebrateModal(false);
    setLogWinCelebrate(null);
    setHistory({});
    setLastAchievedIds(['plankton']);
    setIsTestMode(false);
    setSimulatedTime(null);
    setIsWarningMode(false);
    setExamDateKey(DEFAULT_EXAM_DATE_KEY);
    setDailyGoalQuestions(DAILY_GOAL);
    setAdminSleepModeForceOn(false);
    setEditingExamDate(false);
    setEditingDailyGoal(false);

    localStorage.clear();
    localStorage.setItem('lastAchievedIds', JSON.stringify(['plankton']));
    
    setIsConfirmingClear(false);
    setShowSettingsModal(false);
    setShowRecordDayModal(false);
  };

  const updateHistoryCount = (dateKey: string, newCount: number) => {
    const todayStr = dateKeyFromDate(effectiveTime);
    
    const count = Math.max(0, newCount);
    const prevMaxQuestionsInDay = Math.max(0, ...Object.values(history).map((v) => Number(v)));
    const brokeDayRecordViaHistory = count > prevMaxQuestionsInDay;

    const diff = count - (history[dateKey] || 0);
    const newTotal = Math.max(0, totalQuestions + diff);
    setTotalQuestions(newTotal);

    const updatedHistory = { ...history, [dateKey]: count };
    historyRef.current = updatedHistory;
    setHistory(updatedHistory);
    localStorage.setItem('history', JSON.stringify(updatedHistory));

    // If we're updating today, also update the main dailyQuestions state
    if (dateKey === todayStr) {
      setDailyQuestions(count);
    }
    
    checkMilestones(dateKey === todayStr ? count : dailyQuestions, newTotal, updatedHistory);

    if (brokeDayRecordViaHistory) {
      const modalDayKey = dateKeyFromDate(effectiveTime);
      if (typeof window === 'undefined' || localStorage.getItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY) !== modalDayKey) {
        localStorage.setItem(RECORD_DAY_MODAL_LAST_SHOWN_KEY, modalDayKey);
        setRecordDayModalCount(count);
        setShowRecordDayModal(true);
        triggerFireworks();
        if (!isMuted) {
          const audio = new Audio(URL_FIREWORKS);
          audio.volume = 0.7;
          audio.play().catch((err) => console.error('Audio play failed:', err));
        }
      }
    }
    
    // Update selected date state to reflect change in modal
    if (selectedHistoryDate && selectedHistoryDate.dateKey === dateKey) {
      setSelectedHistoryDate(prev => prev ? { ...prev, count } : null);
    }
  };

  const triggerFireworks = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Firework bursts at random positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  /** After closing the history day modal, show achievements that were queued while it was open. */
  useEffect(() => {
    if (selectedHistoryDate) return;
    if (showAchievementCelebration || selectedAchievement) return;
    if (queuedAchievements.length === 0) return;
    const filteredQueue = achievementIdsForCelebration(queuedAchievements);
    if (filteredQueue.length === 0) {
      setQueuedAchievements([]);
      return;
    }
    const [next, ...rest] = filteredQueue;
    setQueuedAchievements(rest);
    setSelectedAchievement(next);
    setShowAchievementCelebration(true);
    triggerFireworks();
    if (!isMuted) {
      celebrationLoopAudioRef.current?.pause();
      const music = new Audio(URL_DANCE_MUSIC);
      celebrationLoopAudioRef.current = music;
      music.loop = true;
      music.volume = 0.5;
      music.play().catch((err) => console.error('Achievement music failed:', err));
      setLevelMusic(music);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush queue when history modal closes or queue gains items while closed
  }, [selectedHistoryDate, queuedAchievements, showAchievementCelebration, selectedAchievement]);

  const celebratePracticeTestAchievements = (nextPracticeTests: number) => {
    const newlyAchieved = ACHIEVEMENTS.filter(
      (a) =>
        PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS[a.id] !== undefined &&
        getAchievementStatus(a, totalQuestions, history, effectiveTime, nextPracticeTests, bonusPoints) &&
        !lastAchievedIds.includes(a.id)
    );
    if (newlyAchieved.length === 0) return;
    const toCelebrate = achievementIdsForCelebration(newlyAchieved);
    const [first, ...rest] = toCelebrate;
    const deferAchievementModal =
      selectedAchievement || showAchievementCelebration || selectedHistoryDate;
    if (toCelebrate.length > 0) {
      if (deferAchievementModal) {
        setQueuedAchievements((prev) => {
          const existing = new Set(prev.map((a) => a.id));
          const additions = toCelebrate.filter((a) => !existing.has(a.id));
          return [...prev, ...additions];
        });
      } else {
        setSelectedAchievement(first);
        setShowAchievementCelebration(true);
        if (rest.length > 0) {
          setQueuedAchievements((prev) => {
            const existing = new Set(prev.map((a) => a.id));
            const additions = rest.filter((a) => !existing.has(a.id));
            return [...prev, ...additions];
          });
        }
      }
    }
    setLastAchievedIds((prev) => {
      const next = [...prev, ...newlyAchieved.map((b) => b.id)];
      localStorage.setItem('lastAchievedIds', JSON.stringify(next));
      return next;
    });
    if (!selectedHistoryDate && toCelebrate.length > 0) {
      triggerFireworks();
      if (!isMuted) {
        celebrationLoopAudioRef.current?.pause();
        const music = new Audio(URL_DANCE_MUSIC);
        celebrationLoopAudioRef.current = music;
        music.loop = true;
        music.volume = 0.5;
        music.play().catch((err) => console.error('Achievement music failed:', err));
        setLevelMusic(music);
      }
    }
  };

  useEffect(() => {
    if (!selectedHistoryDate) {
      setAdminHistoryPracticeScoreDraft('');
      setAdminHistoryPracticeQuestionsDraft('');
      setAdminHistoryPracticePercentDraft('');
      return;
    }
    const dk = selectedHistoryDate.dateKey;
    const scoreV = practiceTestScores[dk];
    setAdminHistoryPracticeScoreDraft(scoreV !== undefined ? String(scoreV) : '');
    const qV = practiceTestQuestionCounts[dk];
    setAdminHistoryPracticeQuestionsDraft(qV !== undefined ? String(qV) : '');
    const pV = practiceTestPercents[dk];
    setAdminHistoryPracticePercentDraft(pV !== undefined ? String(pV) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset draft when viewing a different day
  }, [selectedHistoryDate?.dateKey]);

  const applyPracticeTestScoreForDate = (dateKey: string, raw: string) => {
    const trimmed = raw.trim();
    setPracticeTestScores((prev) => {
      const next = { ...prev };
      if (trimmed === '') {
        delete next[dateKey];
      } else {
        const num = parseFloat(trimmed);
        if (!Number.isNaN(num)) {
          next[dateKey] = num;
        }
      }
      return next;
    });
  };

  const applyPracticeTestQuestionsForDate = (dateKey: string, raw: string) => {
    const trimmed = raw.trim();
    setPracticeTestQuestionCounts((prev) => {
      const next = { ...prev };
      if (trimmed === '') {
        delete next[dateKey];
      } else {
        const num = parseInt(trimmed.replace(/,/g, ''), 10);
        if (!Number.isNaN(num) && num >= 0) {
          next[dateKey] = num;
        }
      }
      return next;
    });
  };

  const applyPracticeTestPercentForDate = (dateKey: string, raw: string) => {
    const trimmed = raw.trim();
    setPracticeTestPercents((prev) => {
      const next = { ...prev };
      if (trimmed === '') {
        delete next[dateKey];
      } else {
        const num = parseFloat(trimmed.replace(/,/g, ''));
        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
          next[dateKey] = num;
        }
      }
      return next;
    });
  };

  const syncPracticeTestCreditFromHistoryModalInputs = (
    dateKey: string,
    questionsRaw: string,
    percentRaw: string,
    beforeEdit?: { previousCreditBase?: number; previousPercent?: number }
  ) => {
    const newBaseQ = parsePracticeTestBaseQuestionsFromRaw(questionsRaw);
    const newPercent = parseOptionalPercentRaw(percentRaw);
    const newBonus = accuracyBonusPointsFor(newBaseQ, newPercent);

    setPracticeTestQuestionCredits((prevCredits) => {
      const oldBaseQ = beforeEdit?.previousCreditBase ?? prevCredits[dateKey] ?? 0;
      const prevPercent =
        beforeEdit?.previousPercent !== undefined
          ? beforeEdit.previousPercent
          : typeof practiceTestPercents[dateKey] === 'number'
            ? practiceTestPercents[dateKey]
            : undefined;
      const oldBonus = accuracyBonusPointsFor(oldBaseQ, prevPercent);

      if (newBaseQ === oldBaseQ && newBonus === oldBonus) return prevCredits;

      const prevDayCount = historyRef.current[dateKey] ?? 0;
      updateHistoryCount(dateKey, prevDayCount + (newBaseQ - oldBaseQ));

      const bonusDelta = newBonus - oldBonus;
      if (bonusDelta !== 0) {
        adjustBonusPointsForDay(dateKey, bonusDelta);
      }

      return { ...prevCredits, [dateKey]: newBaseQ };
    });
  };

  const handleHistoryPracticeTestCompletionChange = (dateKey: string, checked: boolean) => {
    const wasChecked = Boolean(practiceTestCompletionDates[dateKey]);
    if (checked === wasChecked) return;

    if (!checked) {
      const baseCredit = practiceTestQuestionCredits[dateKey] || 0;
      const pct = practiceTestPercents[dateKey];
      const bonusToRemove = pct !== undefined ? Math.round((baseCredit * pct) / 100) : 0;
      if (baseCredit > 0) {
        updateHistoryCount(dateKey, (history[dateKey] || 0) - baseCredit);
      }
      if (bonusToRemove > 0) {
        adjustBonusPointsForDay(dateKey, -bonusToRemove);
      }
    }

    setPracticeTestCompletionDates((prev) => {
      const next = { ...prev };
      if (checked) {
        next[dateKey] = true;
      } else {
        delete next[dateKey];
      }
      return next;
    });

    if (!checked) {
      setPracticeTestScores((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setPracticeTestQuestionCounts((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setPracticeTestPercents((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setAdminHistoryPracticeScoreDraft('');
      setAdminHistoryPracticeQuestionsDraft('');
      setAdminHistoryPracticePercentDraft('');
    }

    setPracticeTestQuestionCredits((prev) => {
      const next = { ...prev };
      if (checked) {
        if (next[dateKey] === undefined) next[dateKey] = 0;
      } else {
        delete next[dateKey];
      }
      return next;
    });

    setTotalPracticeTests((prev) => {
      const next = Math.max(0, prev + (checked ? 1 : -1));
      if (checked && next > prev) {
        celebratePracticeTestAchievements(next);
      }
      return next;
    });
  };

  const handlePracticeChartPress = useCallback((payload: PracticeTestChartPress) => {
    const dk = payload.dateKey;
    const qV = practiceTestQuestionCounts[dk];
    const pV = practiceTestPercents[dk];
    setPracticeScoreSpotlight({
      dateKey: dk,
      testNumber: payload.testNumber,
      draft: payload.score !== null ? String(payload.score) : '',
      draftQuestions: qV !== undefined ? String(qV) : '',
      draftPercent: pV !== undefined ? String(pV) : '',
      isLatest: payload.isLatest,
      hadScore: payload.score !== null,
    });
  }, [practiceTestQuestionCounts, practiceTestPercents]);

  const dismissPracticeScoreSpotlight = useCallback(() => setPracticeScoreSpotlight(null), []);

  const savePracticeScoreSpotlight = () => {
    if (!practiceScoreSpotlight) return;
    if (!isTestMode && practiceScoreSpotlight.hadScore) return;
    const dk = practiceScoreSpotlight.dateKey;
    const previousCreditBase = practiceTestQuestionCredits[dk];
    const previousPercent = practiceTestPercents[dk];
    applyPracticeTestScoreForDate(dk, practiceScoreSpotlight.draft.trim());
    applyPracticeTestQuestionsForDate(dk, practiceScoreSpotlight.draftQuestions.trim());
    applyPracticeTestPercentForDate(dk, practiceScoreSpotlight.draftPercent.trim());
    syncPracticeTestCreditFromHistoryModalInputs(
      dk,
      practiceScoreSpotlight.draftQuestions,
      practiceScoreSpotlight.draftPercent,
      { previousCreditBase, previousPercent }
    );
    setPracticeScoreSpotlight(null);
  };

  const submitPracticeTestEntry = () => {
    if (!practiceTestEntryIntent) return;
    const q = Math.max(0, Math.floor(Number(practiceTestEntryQuestions)) || 0);
    const scoreRaw = practiceTestEntryScore.trim();
    const percentRaw = practiceTestEntryPercent.trim();
    let parsedScore: number | undefined;
    let parsedPercent: number | undefined;
    if (scoreRaw !== '') {
      const p = parseFloat(scoreRaw);
      if (!Number.isNaN(p)) parsedScore = p;
    }
    if (percentRaw !== '') {
      const p = parseFloat(percentRaw);
      if (!Number.isNaN(p) && p >= 0 && p <= 100) parsedPercent = p;
      else return;
    }

    const prevScores = practiceTestScores;
    const prevCompletionDates = practiceTestCompletionDates;

    let previousScore: number | undefined;
    const priorDates = Object.keys(prevCompletionDates).filter((d) => d < todayKey).sort();
    for (let i = priorDates.length - 1; i >= 0; i--) {
      const v = prevScores[priorDates[i]];
      if (v !== undefined) {
        previousScore = v;
        break;
      }
    }
    if (previousScore === undefined && prevScores[todayKey] !== undefined) {
      previousScore = prevScores[todayKey];
    }

    let greatProgressQueued: GreatProgressPendingState | null = null;
    if (
      parsedScore !== undefined &&
      previousScore !== undefined &&
      parsedScore > previousScore
    ) {
      const deltaPoints = parsedScore - previousScore;
      const bp = Math.round(deltaPoints * 20);
      if (bp > 0) {
        greatProgressQueued = {
          id: Date.now() + Math.random(),
          bonusPoints: bp,
          deltaPoints,
          previousScore,
          newScore: parsedScore,
          highlightDateKey: todayKey,
        };
      }
    }

    const wasAlreadyCompletedForMission =
      practiceTestEntryIntent === 'completed' ? Boolean(practiceTestCompletionDates[todayKey]) : false;
    const willIncrementPracticeCount =
      practiceTestEntryIntent === 'adminPlus' ||
      (practiceTestEntryIntent === 'completed' && !wasAlreadyCompletedForMission);
    const practiceTestsAfterSubmit = totalPracticeTests + (willIncrementPracticeCount ? 1 : 0);

    setPracticeTestScores((prev) => {
      const next = { ...prev };
      if (parsedScore !== undefined) next[todayKey] = parsedScore;
      else delete next[todayKey];
      return next;
    });

    setPracticeTestQuestionCounts((prev) => ({ ...prev, [todayKey]: q }));

    setPracticeTestPercents((prev) => {
      const next = { ...prev };
      if (parsedPercent !== undefined) next[todayKey] = parsedPercent;
      else delete next[todayKey];
      return next;
    });

    const highestTier: LogWinTier | null =
      parsedPercent === undefined
        ? null
        : parsedPercent >= 100
          ? 100
          : parsedPercent >= 80
            ? 80
            : parsedPercent >= 70
              ? 70
              : parsedPercent >= 60
                ? 60
                : null;
    const accuracyBonusPoints =
      parsedPercent === undefined ? 0 : bonusPointsForLoggedAccuracy(q, parsedPercent);

    flushSync(() => {
      if (accuracyBonusPoints > 0) {
        adjustBonusPointsForDay(todayKey, accuracyBonusPoints);
      }
    });

    if (q > 0) {
      addQuestions(q, practiceTestsAfterSubmit);
    }
    setPracticeTestQuestionCredits((prev) => ({ ...prev, [todayKey]: q }));

    if (highestTier && q > 0) {
      const newDailyTotal = dailyQuestions + q;
      const questionsToReviewPractice =
        parsedPercent === undefined ? 0 : Math.max(0, q - Math.round((q * parsedPercent) / 100));
      setLogWinCelebrate({
        tier: highestTier,
        questionsCovered: q,
        percentCorrect: parsedPercent!,
        bonusPointsEarned: accuracyBonusPoints,
        newDailyTotal,
        questionsToReview: questionsToReviewPractice,
        context: 'practiceTest',
      });
      setPendingLogSetTier(highestTier);
    } else {
      setLogWinCelebrate(null);
      setPendingLogSetTier(null);
    }

    if (practiceTestEntryIntent === 'completed') {
      if (!wasAlreadyCompletedForMission) {
        setPracticeTestCompletionDates((prev) => ({ ...prev, [todayKey]: true }));
        setTotalPracticeTests((prev) => {
          const next = prev + 1;
          celebratePracticeTestAchievements(next);
          return next;
        });
      }
    } else {
      setTotalPracticeTests((prev) => {
        const next = prev + 1;
        celebratePracticeTestAchievements(next);
        return next;
      });
    }

    setShowPracticeTestEntryModal(false);
    setPracticeTestEntryIntent(null);
    setPracticeTestEntryQuestions('');
    setPracticeTestEntryScore('');
    setPracticeTestEntryPercent('');

    if (greatProgressQueued) {
      setGreatProgressPending(greatProgressQueued);
    }
  };

  const cancelPracticeTestEntry = () => {
    setShowPracticeTestEntryModal(false);
    setPracticeTestEntryIntent(null);
    setPracticeTestEntryQuestions('');
    setPracticeTestEntryScore('');
    setPracticeTestEntryPercent('');
  };

  const removeTodayPracticeTestRecord = () => {
    if (!practiceTestCompletionDates[todayKey]) return;
    const baseCredit = practiceTestQuestionCredits[todayKey] || 0;
    const pct = practiceTestPercents[todayKey];
    const bonusToRemove = pct !== undefined ? Math.round((baseCredit * pct) / 100) : 0;
    if (baseCredit > 0) {
      updateHistoryCount(todayKey, (history[todayKey] || 0) - baseCredit);
    }
    if (bonusToRemove > 0) {
      adjustBonusPointsForDay(todayKey, -bonusToRemove);
    }
    setPracticeTestCompletionDates((prev) => {
      const next = { ...prev };
      delete next[todayKey];
      return next;
    });
    setPracticeTestScores((prev) => {
      const next = { ...prev };
      delete next[todayKey];
      return next;
    });
    setPracticeTestQuestionCounts((prev) => {
      const next = { ...prev };
      delete next[todayKey];
      return next;
    });
    setPracticeTestPercents((prev) => {
      const next = { ...prev };
      delete next[todayKey];
      return next;
    });
    setPracticeTestQuestionCredits((prev) => {
      const next = { ...prev };
      delete next[todayKey];
      return next;
    });
    setTotalPracticeTests((prev) => Math.max(0, prev - 1));
  };

  const triggerExtremeCelebration = () => {
    setShowGoalModal(true);
    triggerFireworks();
  };

  const getMotivation = () => {
    if (dailyQuestions === 0) return "";
    return goalMessage || "Just keep swimming! You're doing great! ";
  };

  const getStreakFlameStyle = (streak: number): { className: string; style?: CSSProperties } => {
    if (streak <= 1) {
      return {
        className: 'w-6 h-6 shrink-0 text-orange-300 opacity-30',
        style: { transform: 'scale(0.9)' },
      };
    }

    if (streak === 2) {
      return {
        className: 'w-6 h-6 shrink-0 text-orange-300 opacity-70',
        style: { transform: 'scale(0.9)' },
      };
    }

    if (streak === 3) {
      return {
        className: 'w-6 h-6 shrink-0 text-orange-300 opacity-80',
        style: {
          transform: 'scale(1)',
          filter: 'drop-shadow(0 0 8px rgba(253,186,116,1)) drop-shadow(0 0 8px rgba(253,186,116,0.85))',
        },
      };
    }

    if (streak === 4) {
      return {
        className: 'w-6 h-6 shrink-0 text-orange-300 opacity-90',
        style: {
          transform: 'scale(1.1)',
          filter: 'drop-shadow(0 0 12px rgba(253,186,116,0.85)) drop-shadow(0 0 28px rgba(253,186,116,0.75))',
        },
      };
    }

    return {
      className: 'w-6 h-6 shrink-0 text-orange-200 opacity-100',
      style: {
        transform: 'scale(1.3)',
        filter: 'drop-shadow(0 0 8px rgba(253,186,116,0.85)) drop-shadow(0 0 8px rgba(254,215,170,0.8))',
      },
    };
  };

  const getRecordIconStyle = (isNewRecordToday: boolean): { className: string; style?: CSSProperties } => {
    if (!isNewRecordToday) {
      return { className: 'w-6 h-6 text-white opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]' };
    }

    return {
      className: 'w-6 h-6 shrink-0 text-white opacity-100',
      style: {
        filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.55)) drop-shadow(0 0 18px rgba(255,255,255,0.35))',
      },
    };
  };

  const simulateStreak = (days: number) => {
    const newHistory = { ...history };
    const today = new Date();

    // Add 10 questions for the past `days` days, ending TODAY
    let addedQuestions = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = dateKeyFromDate(d);
      const current = newHistory[dateKey] || 0;
      newHistory[dateKey] = current + 10;
      addedQuestions += 10;
    }
    
    setHistory(newHistory);
    localStorage.setItem('history', JSON.stringify(newHistory));
    
    // Also update total questions to reflect this
    const newTotal = totalQuestions + addedQuestions;
    setTotalQuestions(newTotal);
    localStorage.setItem('totalQuestions', newTotal.toString());

    // Check for achievements with the new history
    const newlyAchieved = ACHIEVEMENTS.filter(
      (a) =>
        getAchievementStatus(a, newTotal, newHistory, today, totalPracticeTests, bonusPoints) &&
        !lastAchievedIds.includes(a.id)
    );
    const toCelebrate = achievementIdsForCelebration(newlyAchieved);
    if (newlyAchieved.length > 0) {
      const [first, ...rest] = toCelebrate;
      const deferAchievementModal =
        selectedAchievement || showAchievementCelebration || selectedHistoryDate;
      if (toCelebrate.length > 0) {
        if (deferAchievementModal) {
          setQueuedAchievements((prev) => {
            const existing = new Set(prev.map((a) => a.id));
            const additions = toCelebrate.filter((a) => !existing.has(a.id));
            return [...prev, ...additions];
          });
        } else {
          setSelectedAchievement(first);
          setShowAchievementCelebration(true);
          if (rest.length > 0) {
            setQueuedAchievements((prev) => {
              const existing = new Set(prev.map((a) => a.id));
              const additions = rest.filter((a) => !existing.has(a.id));
              return [...prev, ...additions];
            });
          }
        }
      }
      setLastAchievedIds(prev => {
        const next = [...prev, ...newlyAchieved.map(a => a.id)];
        localStorage.setItem('lastAchievedIds', JSON.stringify(next));
        return next;
      });
      if (!selectedHistoryDate && toCelebrate.length > 0) {
        triggerFireworks();

        if (!isMuted) {
          celebrationLoopAudioRef.current?.pause();
          const music = new Audio(URL_DANCE_MUSIC);
          celebrationLoopAudioRef.current = music;
          music.loop = true;
          music.volume = 0.5;
          music.play().catch(err => console.error("Achievement music failed:", err));
          setLevelMusic(music);
        }
      }
    }
  };

  if (isFeedbackSummaryView) {
    return <FeedbackSummaryAdminView authResolved={authResolved} firebaseUser={firebaseUser} />;
  }

  const primaryModalEnterAction = useMemo<(() => void) | null>(() => {
    if (showAchievementCelebration && selectedAchievement) {
      return dismissAchievementView;
    }
    if (showGreatProgressModal && greatProgressSnapshot) {
      return () => {
        stopAllCelebrationMusic();
        setShowGreatProgressModal(false);
        setGreatProgressSnapshot(null);
      };
    }
    if (showLogWinCelebrateModal && logWinCelebrate) {
      return () => {
        stopAllCelebrationMusic();
        setShowLogWinCelebrateModal(false);
        setLogWinCelebrate(null);
      };
    }
    if (showReviewCompleteModal) {
      return () => {
        stopAllCelebrationMusic();
        setShowReviewCompleteModal(false);
      };
    }
    if (showPracticeTestEntryModal) {
      return submitPracticeTestEntry;
    }
    if (showLogSetModal) {
      return confirmLogSet;
    }
    if (showLogReviewModal) {
      return confirmLogReview;
    }
    if (practiceScoreSpotlight) {
      return !isTestMode && practiceScoreSpotlight.hadScore
        ? dismissPracticeScoreSpotlight
        : savePracticeScoreSpotlight;
    }
    if (showRestorePreLoginDataModal) {
      return handleRestorePreLoginData;
    }
    if (showGoalModal) {
      return () => {
        stopAllCelebrationMusic();
        setShowGoalModal(false);
      };
    }
    if (showRecordDayModal) {
      return () => {
        stopAllCelebrationMusic();
        setShowRecordDayModal(false);
      };
    }
    return null;
  }, [
    showAchievementCelebration,
    selectedAchievement,
    dismissAchievementView,
    showGreatProgressModal,
    greatProgressSnapshot,
    showLogWinCelebrateModal,
    logWinCelebrate,
    showReviewCompleteModal,
    showPracticeTestEntryModal,
    submitPracticeTestEntry,
    showLogSetModal,
    confirmLogSet,
    showLogReviewModal,
    confirmLogReview,
    practiceScoreSpotlight,
    isTestMode,
    dismissPracticeScoreSpotlight,
    savePracticeScoreSpotlight,
    showRestorePreLoginDataModal,
    handleRestorePreLoginData,
    showGoalModal,
    showRecordDayModal,
    stopAllCelebrationMusic,
  ]);

  useEffect(() => {
    if (!primaryModalEnterAction) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        if (target.closest('textarea,[contenteditable=""],[contenteditable="true"],[contenteditable]')) return;
      }
      event.preventDefault();
      primaryModalEnterAction();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [primaryModalEnterAction]);

  return (
    <div className={`min-h-screen flex flex-col ${
      isSleepMode 
        ? 'bg-gradient-to-b from-[#195190] via-[#112B59] to-[#051933] sleep-mode' 
        : isWarningMode 
          ? 'bg-[linear-gradient(180deg,#2a0a0a_0%,#100606_16%,#050505_32%,#060608_74%,#050818_100%)] warning-mode' 
          : 'bg-[linear-gradient(180deg,#A8DFFF_0%,#2DA3DA_15%,#18415F_100%)] font-sans'
    } text-white overflow-x-hidden relative transition-colors duration-1000`}>
      {!isWarningMode && (
        <motion.img
          aria-hidden
          src={`${import.meta.env.BASE_URL}assets/${isSleepMode ? 'graphic_oceantopnight.png' : 'graphic_oceantop.png'}`}
          alt=""
          className="absolute top-0 left-0 w-screen h-auto max-w-none object-contain object-top select-none pointer-events-none z-[5]"
          animate={{ y: [0, -6, 0, 6, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* --- Background Elements --- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {!isWarningMode && !isSleepMode && (
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.42] mix-blend-soft-light"
            style={{
              backgroundImage: [
                'radial-gradient(ellipse 130% 50% at 50% -5%, rgba(255,255,255,0.28), transparent 55%)',
                'radial-gradient(ellipse 70% 45% at 12% 25%, rgba(255,255,255,0.12), transparent 50%)',
                'radial-gradient(ellipse 60% 40% at 88% 30%, rgba(255,255,255,0.1), transparent 48%)',
              ].join(', '),
            }}
          />
        )}
        {!isWarningMode &&
          [...Array(isSleepMode ? BUBBLE_COUNT_SLEEP : 40)].map((_, i) => (
            <Bubble
              key={`bubble-${i}`}
              sleepMode={isSleepMode}
              staggerIndex={i}
              bubbleCount={isSleepMode ? BUBBLE_COUNT_SLEEP : 40}
            />
          ))}
        {isWarningMode && !isSleepMode && [...Array(20)].map((_, i) => (
          <div key={`warning-${i}`} className="absolute rounded-full bg-red-900/20 animate-pulse" style={{ width: 10 + Math.random() * 50, height: 10 + Math.random() * 50, left: Math.random() * 100 + '%', top: Math.random() * 100 + '%' }} />
        ))}
      </div>

      {/* Fish scroll with page (not viewport-fixed); still behind UI via z-0 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Barracuda" : "Sardine"} delay={0} y="20%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Great White Shark" : "Barracuda"} delay={5} y="40%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Barracuda" : "Flying Fish"} delay={10} y="15%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Great White Shark" : "Krill"} delay={15} y="85%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic="Blue Whale" delay={20} y="60%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Barracuda" : "Seahorse"} delay={25} y="30%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Great White Shark" : "Sardine"} delay={7} y="70%" />
        <SeaCreature sleepMode={isSleepMode} warningMode={isWarningMode} graphic={isWarningMode ? "Barracuda" : "Flying Fish"} delay={12} y="50%" />
      </div>

      {/* --- Header --- */}
      <header className={`relative z-20 shrink-0 w-full px-6 py-4 flex justify-between items-center ${isWarningMode ? 'text-red-400' : 'text-[#118AC0]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2 px-1 sm:px-4 py-1 sm:py-2">
            <Anchor className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="font-black text-xs sm:text-lg uppercase tracking-[0.2em] header-text">Step 2 It Up!</span>
          </div>
          {isTestMode && (
            <div className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg border border-red-400 self-start sm:self-auto ml-1 sm:ml-0">
              Admin Mode On
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className={`font-black text-xs sm:text-lg tracking-wider ${isWarningMode ? 'header-time-warning' : ''}`}
          >
            {effectiveTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            })} ET
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setReportSubmitError(null);
                setReportCategory('bug');
                setReportDescription('');
                setShowReportFeedbackModal(true);
              }}
              className={`question-count-clay-btn p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-all ${isWarningMode ? 'text-red-400' : 'text-[#118AC0]'}`}
              title="Report feedback"
            >
              <Flag className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className={`question-count-clay-btn p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-all ${isWarningMode ? 'text-red-400' : 'text-[#118AC0]'}`}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 min-[600px]:grid-cols-[1fr_1fr] gap-8 items-start">
        
        {/* Left Column: Progress & Actions */}
        <div className="flex flex-col gap-8">
          {/* Question Tracker — uses `.section-panel-ocean-frost` (see index.css) */}
          <motion.section {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 flex flex-col items-center text-center gap-6">
            {(isWarningMode || isSleepMode) && (
              <div
                className={`section-panel-ocean-frost-overlay animate-pulse ${isSleepMode ? 'section-panel-ocean-frost-glow-sleep' : 'section-panel-ocean-frost-glow-warning'}`}
              />
            )}
            <div className="w-full">
              <motion.div
                key={dailyQuestions}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-1 sm:p-2 flex flex-col items-center text-center"
              >
                <span className={`${isSleepMode ? 'text-6xl md:text-7xl text-blue-200/80' : isWarningMode ? 'text-6xl md:text-7xl text-white/80' : 'text-7xl md:text-8xl text-yellow-300'} font-black drop-shadow-[0_15px_35px_rgba(0,0,0,0.5)] leading-none`}>
                  {dailyQuestions}
                </span>
                <span className="text-lg sm:text-xl font-bold opacity-90 mt-3 tracking-wide">Questions Done Today</span>
                {bonusPointsEarnedToday > 0 && (
                  <span className="mt-2 block text-sm sm:text-base font-semibold text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                    Plus{' '}
                    <motion.span
                      animate={
                        isBpPulseActive
                          ? {
                              scale: [1, 1.28, 1],
                              textShadow: [
                                '0 1px 2px rgba(0,0,0,0.35)',
                                '0 0 14px rgba(196,181,253,0.95), 0 0 24px rgba(168,85,247,0.75)',
                                '0 1px 2px rgba(0,0,0,0.35)',
                              ],
                            }
                          : { scale: 1, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }
                      }
                      transition={{ duration: 0.78, ease: 'easeInOut' }}
                      className="inline-block font-semibold text-purple-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                    >
                      {displayBonusPointsEarnedToday} BP
                    </motion.span>{' '}
                    earned!
                  </span>
                )}
                <div className={`w-full ${bonusPointsEarnedToday > 0 ? 'mt-4' : 'mt-3'}`}>
                  <QuestionButtons onUpdate={addQuestions} isTestMode={isTestMode} isWarningMode={isWarningMode} isSleepMode={isSleepMode} />
                </div>
                <button
                  type="button"
                  onClick={openLogSetModal}
                  className={`question-count-clay-btn mt-3 rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
                    isSleepMode
                      ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                      : isWarningMode
                        ? 'bg-red-950/80 text-white hover:bg-red-900'
                        : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-900 hover:brightness-105'
                  }`}
                >
                  Log Set
                </button>
                <div className="w-full space-y-2 mt-4">
                  <div className="h-12 w-full bg-black/30 rounded-full overflow-hidden border-2 border-white/30 p-1.5 shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (dailyQuestions / Math.max(1, dailyGoalQuestions)) * 100)}%` }}
                      className={`h-full rounded-full ${isSleepMode ? 'bg-gradient-to-r from-blue-900 to-slate-900 shadow-[0_0_20px_rgba(96,165,250,0.6)]' : isWarningMode ? 'bg-gradient-to-r from-red-900 to-black shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 shadow-[0_0_20px_rgba(34,211,238,0.6)]'}`}
                    />
                  </div>
                  <div className="text-center text-xs sm:text-sm font-black uppercase tracking-[0.3em] opacity-80">
                    Daily Goal: {dailyGoalQuestions}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Action Buttons removed */}

            {/* Motivation */}
            {!isWarningMode && !isSleepMode && getMotivation() && (
              <div className="text-3xl font-medium text-yellow-100 drop-shadow-md text-center px-6 flex items-center justify-center min-h-[4rem]">
                {getMotivation()}
              </div>
            )}
          </motion.section>

          {(displayQuestionsToReview > 0 || isReviewCountdownActive || reviewZeroTransitionPhase !== null) && (
            <motion.section
              {...mainSectionLoadProps}
              className="section-panel-ocean-frost relative overflow-hidden rounded-[3rem] p-6 flex min-[600px]:hidden w-full flex-col items-center justify-center text-center gap-4"
            >
              {isWarningMode && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[3rem] bg-red-600/38"
                />
              )}
              <div className="relative z-10 flex flex-col items-center text-center gap-3">
                {reviewZeroTransitionPhase === null && (
                  <p
                    className={`text-6xl font-black tabular-nums leading-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] ${
                      isWarningMode ? 'text-white/80' : 'text-[#FFAB91]'
                    }`}
                  >
                    {displayQuestionsToReview}
                  </p>
                )}
                {reviewZeroTransitionPhase !== null && (
                  <motion.p
                    key="review-zero-mobile"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className={`text-6xl font-black tabular-nums leading-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] ${
                      isWarningMode ? 'text-white/80' : 'text-[#FFAB91]'
                    }`}
                  >
                    0
                  </motion.p>
                )}
                <span className="text-lg sm:text-xl font-bold opacity-90 tracking-wide text-white">
                  Questions to Review
                </span>
              </div>
              <div className="relative z-10 w-full">
                <QuestionButtons
                  onUpdate={adjustQuestionsToReviewFromButtons}
                  isTestMode={isTestMode}
                  isWarningMode={isWarningMode}
                  isSleepMode={isSleepMode}
                  compact={true}
                  reviewLayout={true}
                  reviewCount={questionsToReviewToday}
                />
              </div>
              <button
                type="button"
                onClick={openLogReviewModal}
                className={`relative z-10 question-count-clay-btn rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] whitespace-nowrap ${
                  isSleepMode
                    ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                    : isWarningMode
                      ? 'bg-red-950/80 text-white hover:bg-red-900'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-900 hover:brightness-105'
                }`}
              >
                Log Review
              </button>
            </motion.section>
          )}

          {(isWarningMode || isSleepMode) && (
            <motion.section {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 flex flex-col items-center text-center gap-6 min-[600px]:hidden">
              <div
                className={`section-panel-ocean-frost-overlay animate-pulse ${isSleepMode ? 'section-panel-ocean-frost-glow-sleep' : 'section-panel-ocean-frost-glow-warning'}`}
              />
              <img 
                src={isSleepMode ? graphicAsset('sleepingsalmon') : graphicAsset('anglerfishangry')} 
                alt={isSleepMode ? "Sleeping Salmon" : "Anglerfish"} 
                className="w-full h-auto max-h-[400px] object-contain relative z-10"
                decoding="async"
                fetchPriority="high"
              />
              <p className={`${isSleepMode ? 'text-blue-300' : 'text-red-500'} font-black text-2xl italic relative z-10`}>
                {isSleepMode ? "It's time to rest..." : (goalMessage || "The abyss is watching.")}
              </p>
            </motion.section>
          )}

          {/* Practice Test Reminder (Mobile, Incomplete = Above Level) */}
          {!isPracticeTestMissionCompleteToday && (
            <motion.div {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 flex flex-col sm:flex-row items-center gap-6 font-black text-lg uppercase transition-all duration-500 min-[600px]:hidden">
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-[3rem] ${
                  isPracticeTestMissionCompleteToday && isWarningMode
                    ? 'bg-white/45'
                    : isPracticeTestMissionCompleteToday
                      ? 'bg-green-500/35'
                      : isWarningMode
                        ? 'bg-red-600/38'
                        : 'bg-yellow-400/35'
                }`}
              />
              <div className={`relative z-10 flex flex-col sm:flex-row items-center gap-6 w-full ${
                isPracticeTestMissionCompleteToday && isWarningMode
                  ? 'text-black'
                  : isPracticeTestMissionCompleteToday
                    ? 'text-white'
                    : isWarningMode
                      ? 'text-white'
                      : 'text-black'
              }`}>
              <div className={`${
                isPracticeTestMissionCompleteToday
                  ? isWarningMode
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-green-500'
                  : 'bg-black text-white'
              } p-3 rounded-2xl shadow-lg transition-colors`}>
                {isPracticeTestMissionCompleteToday ? <Trophy className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
              </div>
              <div className="flex flex-col flex-1 text-center sm:text-left">
                <span className="text-xs opacity-60 tracking-widest">
                  {isPracticeTestMissionCompleteToday ? 'Practice Test Complete' : 'Weekly Mission'}
                </span>
                <span className={isPracticeTestMissionCompleteToday ? 'text-base' : ''}>
                  {isPracticeTestMissionCompleteToday ? 'Mission Accomplished' : '1 Practice Test!'}
                </span>
                {isPracticeTestMissionCompleteToday && (
                  <span className="text-[10px] opacity-80 mt-1 normal-case font-bold">Resets at midnight so you can complete it again tomorrow.</span>
                )}
              </div>
              <div className="w-full sm:w-auto flex flex-row flex-wrap gap-2 items-center justify-center sm:justify-end">
                {!isPracticeTestMissionCompleteToday && (
                  <button 
                    type="button"
                    onClick={() => {
                      const wasAlreadyCompleted = Boolean(practiceTestCompletionDates[todayKey]);
                      if (wasAlreadyCompleted) return;
                      setPracticeTestEntryIntent('completed');
                      setPracticeTestEntryQuestions('');
                      setPracticeTestEntryScore('');
                      setPracticeTestEntryPercent('');
                      setShowPracticeTestEntryModal(true);
                    }}
                    className="w-full sm:w-auto min-w-[8rem] bg-black text-white px-6 py-3 rounded-xl text-xs hover:bg-gray-800 active:scale-95 transition-all shadow-md"
                  >
                    Completed
                  </button>
                )}
                {isTestMode && isPracticeTestMissionCompleteToday && (
                  <button
                    type="button"
                    onClick={removeTodayPracticeTestRecord}
                    className="w-full sm:w-auto min-w-[8rem] bg-red-600 text-white px-6 py-3 rounded-xl text-xs hover:bg-red-700 active:scale-95 transition-all shadow-md"
                  >
                    Remove
                  </button>
                )}
              </div>
              </div>
            </motion.div>
          )}

          {/* Level Section (Mobile Reorder) */}
          <motion.div {...mainSectionLoadProps} className="min-[600px]:hidden">
            <LevelSection
              currentLevel={currentLevel}
              currentLevelIndex={currentLevelIndex}
              displayVariant={displayVariant}
              isWarningMode={isWarningMode}
              nextLevel={nextLevel}
              xpToNext={xpToNext}
              unlockedVariantsCount={unlockedVariants.length}
              setShowImageViewer={setShowImageViewer}
              setShowVariantModal={setShowVariantModal}
              setShowLevelMap={setShowLevelMap}
            />
          </motion.div>

          {/* Practice Test Reminder (Mobile, Complete = Below Level) */}
          {isPracticeTestMissionCompleteToday && (
            <motion.div {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 flex flex-col sm:flex-row items-center gap-6 font-black text-lg uppercase transition-all duration-500 min-[600px]:hidden">
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-[3rem] ${
                isPracticeTestMissionCompleteToday && isWarningMode
                  ? 'bg-white/45'
                  : isPracticeTestMissionCompleteToday
                    ? 'bg-green-500/35'
                    : isWarningMode
                      ? 'bg-red-600/38'
                      : 'bg-yellow-400/35'
              }`}
            />
            <div className={`relative z-10 flex flex-col sm:flex-row items-center gap-6 w-full ${
              isPracticeTestMissionCompleteToday && isWarningMode
                ? 'text-black'
                : isPracticeTestMissionCompleteToday
                  ? 'text-white'
                  : isWarningMode
                    ? 'text-white'
                    : 'text-black'
            }`}>
            <div className={`${
              isPracticeTestMissionCompleteToday
                ? isWarningMode
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-green-500'
                : 'bg-black text-white'
            } p-3 rounded-2xl shadow-lg transition-colors`}>
              {isPracticeTestMissionCompleteToday ? <Trophy className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
            </div>
            <div className="flex flex-col flex-1 text-center sm:text-left">
              <span className="text-xs opacity-60 tracking-widest">
                {isPracticeTestMissionCompleteToday ? 'Practice Test Complete' : 'Weekly Mission'}
              </span>
              <span className={isPracticeTestMissionCompleteToday ? 'text-base' : ''}>
                {isPracticeTestMissionCompleteToday ? 'Mission Accomplished' : '1 Practice Test!'}
              </span>
              {isPracticeTestMissionCompleteToday && (
                <span className="text-[10px] opacity-80 mt-1 normal-case font-bold">Resets at midnight so you can complete it again tomorrow.</span>
              )}
            </div>
            <div className="w-full sm:w-auto flex flex-row flex-wrap gap-2 items-center justify-center sm:justify-end">
              {!isPracticeTestMissionCompleteToday && (
                <button 
                  type="button"
                  onClick={() => {
                    const wasAlreadyCompleted = Boolean(practiceTestCompletionDates[todayKey]);
                    if (wasAlreadyCompleted) return;
                    setPracticeTestEntryIntent('completed');
                    setPracticeTestEntryQuestions('');
                    setPracticeTestEntryScore('');
                    setPracticeTestEntryPercent('');
                    setShowPracticeTestEntryModal(true);
                  }}
                  className="w-full sm:w-auto min-w-[8rem] bg-black text-white px-6 py-3 rounded-xl text-xs hover:bg-gray-800 active:scale-95 transition-all shadow-md"
                >
                  Completed
                </button>
              )}
              {isTestMode && isPracticeTestMissionCompleteToday && (
                <button
                  type="button"
                  onClick={removeTodayPracticeTestRecord}
                  className="w-full sm:w-auto min-w-[8rem] bg-red-600 text-white px-6 py-3 rounded-xl text-xs hover:bg-red-700 active:scale-95 transition-all shadow-md"
                >
                  Remove
                </button>
              )}
            </div>
            </div>
            </motion.div>
          )}

          {/* Footer Stats */}
          <motion.section {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 space-y-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center">My Stats</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <BookOpen className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-yellow-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>{Object.values(history).reduce((a: number, b: number) => a + b, 0)}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white mt-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Total Questions
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <Zap className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-purple-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-purple-300'}`}>{bonusPoints}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Bonus Points
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <Star className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-teal-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-teal-300'}`}>{totalExperiencePoints}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Total XP
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <Check className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-cyan-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-cyan-300'}`}>
                    {totalQuestionsReviewed}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Questions Reviewed
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <Calendar
                    className={`w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-[#FF8A65]'}`}
                  />
                  <span
                    className={`text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] ${isWarningMode ? 'text-white/80' : 'text-[#FFAB91]'}`}
                  >
                    {daysUntilExam}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Days Till Step 2
                </span>
              </div>
              
              {/* New Row */}
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  {(() => {
                    const streak = calculateCurrentStreak(history, effectiveTime);
                    const flameStyle = getStreakFlameStyle(streak);
                    const streakGlowFilter =
                      !isSleepMode && !isWarningMode && streak >= 3 ? flameStyle.style?.filter : undefined;
                    const streakVariant = streakFlameVariantFromCount(streak);
                    const streakNumberStyle: CSSProperties | undefined =
                      !isSleepMode && !isWarningMode
                        ? {
                            ...(streakGlowFilter ? { filter: streakGlowFilter } : {}),
                            color: streakStatNumberColorFromVariant(streakVariant),
                          }
                        : streakGlowFilter
                          ? { filter: streakGlowFilter }
                          : undefined;
                    const streakTextColorClass = isWarningMode
                      ? 'text-white/80'
                      : isSleepMode
                        ? 'text-orange-300'
                        : '';
                    return (
                      <>
                        <Flame
                          className={isSleepMode ? 'w-6 h-6 shrink-0 text-slate-400' : flameStyle.className}
                          style={isSleepMode ? undefined : flameStyle.style}
                        />
                        <span
                          className={`text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] ${streakTextColorClass}`}
                          style={streakNumberStyle}
                        >
                          {streak}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Current Streak
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <ClipboardCheck
                    className={`w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-emerald-300'}`}
                  />
                  <span
                    className={`text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] ${isWarningMode ? 'text-white/80' : 'text-emerald-300'}`}
                  >
                    {totalPracticeTests}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Practice Tests
                </span>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <TrendingUp
                    className={`w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-sky-300'}`}
                  />
                  <span
                    className={`text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] ${isWarningMode ? 'text-white/80' : 'text-sky-300'}`}
                  >
                    {(() => {
                      const historyWithToday = { ...history, [todayKey]: dailyQuestions };
                      const last3ByDate = Object.entries(historyWithToday)
                        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                        .slice(-3)
                        .map(([, count]) => Number(count));
                      return last3ByDate.length
                        ? (last3ByDate.reduce((sum, count) => sum + count, 0) / last3ByDate.length).toFixed(1)
                        : 0;
                    })()}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Avg Qs (Last 3 Days)
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  {(() => {
                    const todayStr = dateKeyFromDate(effectiveTime);
                    const todayCount = history[todayStr] || 0;
                    const maxOnOtherDays = Math.max(
                      0,
                      ...Object.entries(history)
                        .filter(([key]) => key !== todayStr)
                        .map(([, value]) => Number(value))
                    );
                    const isNewRecordToday = todayCount > maxOnOtherDays;
                    const recordIconStyle = getRecordIconStyle(isNewRecordToday);

                    return (
                      <Award
                        className={isSleepMode ? 'w-6 h-6 text-slate-400' : recordIconStyle.className}
                        style={isSleepMode ? undefined : recordIconStyle.style}
                      />
                    );
                  })()}
                  {(() => {
                    const todayStr = dateKeyFromDate(effectiveTime);
                    const todayCount = history[todayStr] || 0;
                    const maxOnOtherDays = Math.max(
                      0,
                      ...Object.entries(history)
                        .filter(([key]) => key !== todayStr)
                        .map(([, value]) => Number(value))
                    );
                    const isNewRecordToday = todayCount > maxOnOtherDays;
                    return (
                      <span
                        className={`text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] ${isWarningMode ? 'text-white/80' : 'text-white'}`}
                        style={
                          !isSleepMode && !isWarningMode && isNewRecordToday
                            ? { filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' }
                            : undefined
                        }
                      >
                        {Math.max(...(Object.values(history) as number[]), 0)}
                      </span>
                    );
                  })()}
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] mt-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  Record Qs in Day
                </span>
              </div>
            </div>

            <div className="border-t border-white/20 pt-6 space-y-4">
              <h3 className="text-center text-lg font-black uppercase tracking-[0.2em] text-white drop-shadow-md">
                Practice Test Scores
              </h3>
              <PracticeTestScoresChart
                series={practiceTestChartSeries}
                salmonGlow={practiceChartSalmonGlow}
                onPointPress={handlePracticeChartPress}
              />
            </div>
          </motion.section>
          <motion.div {...mainSectionLoadProps} className="min-[600px]:hidden w-full">
            <AchievementsSection 
              totalQuestions={totalQuestions} 
              bonusPoints={bonusPoints}
              lastAchievedIds={lastAchievedIds}
              totalPracticeTests={totalPracticeTests}
              history={history}
              effectiveTime={effectiveTime}
              setSelectedAchievement={setSelectedAchievement} 
              className="min-[600px]:hidden" 
            />
          </motion.div>

          {/* Achievements (desktop 2-column: bottom of left column) */}
          <motion.div {...mainSectionLoadProps} className="hidden min-[600px]:block w-full">
            <AchievementsSection 
              totalQuestions={totalQuestions} 
              bonusPoints={bonusPoints}
              lastAchievedIds={lastAchievedIds}
              totalPracticeTests={totalPracticeTests}
              history={history}
              effectiveTime={effectiveTime}
              setSelectedAchievement={setSelectedAchievement} 
              className="hidden min-[600px]:flex" 
            />
          </motion.div>
        </div>

        {/* Right Column: Level & Stats */}
        <div className="flex flex-col gap-8">
          {(isWarningMode || isSleepMode) && (
            <motion.section {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 hidden min-[600px]:flex w-full flex-col items-center text-center gap-6 font-serious">
              <div
                className={`section-panel-ocean-frost-overlay animate-pulse ${isSleepMode ? 'section-panel-ocean-frost-glow-sleep' : 'section-panel-ocean-frost-glow-warning'}`}
              />
              <img 
                src={isSleepMode ? graphicAsset('sleepingsalmon') : graphicAsset('anglerfishangry')} 
                alt={isSleepMode ? "Sleeping Salmon" : "Anglerfish"} 
                className="w-full h-auto max-h-[400px] object-contain relative z-10"
                decoding="async"
                fetchPriority="high"
              />
              <p className={`${isSleepMode ? 'text-blue-300' : 'text-red-500'} font-black text-2xl italic relative z-10`}>
                {isSleepMode ? "It's time to rest..." : (goalMessage || "The abyss is watching.")}
              </p>
            </motion.section>
          )}

          {(displayQuestionsToReview > 0 || isReviewCountdownActive || reviewZeroTransitionPhase !== null) && (
            <motion.section
              {...mainSectionLoadProps}
              className="section-panel-ocean-frost relative overflow-hidden rounded-[3rem] p-6 hidden min-[600px]:flex w-full flex-col items-center justify-center text-center gap-4"
            >
              {isWarningMode && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[3rem] bg-red-600/38"
                />
              )}
              <div className="relative z-10 flex flex-col items-center text-center gap-3">
                {reviewZeroTransitionPhase === null && (
                  <p
                    className={`text-6xl font-black tabular-nums leading-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] ${
                      isWarningMode ? 'text-white/80' : 'text-[#FFAB91]'
                    }`}
                  >
                    {displayQuestionsToReview}
                  </p>
                )}
                {reviewZeroTransitionPhase !== null && (
                  <motion.p
                    key="review-zero"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className={`text-6xl font-black tabular-nums leading-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] ${
                      isWarningMode ? 'text-white/80' : 'text-[#FFAB91]'
                    }`}
                  >
                    0
                  </motion.p>
                )}
                <span className="text-lg sm:text-xl font-bold opacity-90 tracking-wide text-white">
                  Questions to Review
                </span>
              </div>
              <div className="relative z-10 w-full">
                <QuestionButtons
                  onUpdate={adjustQuestionsToReviewFromButtons}
                  isTestMode={isTestMode}
                  isWarningMode={isWarningMode}
                  isSleepMode={isSleepMode}
                  compact={true}
                  reviewLayout={true}
                  reviewCount={questionsToReviewToday}
                />
              </div>
              <button
                type="button"
                onClick={openLogReviewModal}
                className={`relative z-10 question-count-clay-btn rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] whitespace-nowrap ${
                  isSleepMode
                    ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                    : isWarningMode
                      ? 'bg-red-950/80 text-white hover:bg-red-900'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-900 hover:brightness-105'
                }`}
              >
                Log Review
              </button>
            </motion.section>
          )}

          {/* Practice Test Reminder (Desktop, Incomplete = Above Level) */}
          {!isPracticeTestMissionCompleteToday && (
            <motion.div {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 hidden min-[600px]:flex flex-col sm:flex-row items-center gap-6 font-black text-lg uppercase transition-all duration-500">
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-[3rem] ${
                  isPracticeTestMissionCompleteToday && isWarningMode
                    ? 'bg-white/45'
                    : isPracticeTestMissionCompleteToday
                      ? 'bg-green-500/35'
                      : isWarningMode
                        ? 'bg-red-600/38'
                        : 'bg-yellow-400/35'
                }`}
              />
              <div className={`relative z-10 flex flex-col sm:flex-row items-center gap-6 w-full ${
                isPracticeTestMissionCompleteToday && isWarningMode
                  ? 'text-black'
                  : isPracticeTestMissionCompleteToday
                    ? 'text-white'
                    : isWarningMode
                      ? 'text-white'
                      : 'text-black'
              }`}>
              <div className={`${
                isPracticeTestMissionCompleteToday
                  ? isWarningMode
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-green-500'
                  : 'bg-black text-white'
              } p-3 rounded-2xl shadow-lg transition-colors`}>
                {isPracticeTestMissionCompleteToday ? <Trophy className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
              </div>
              <div className="flex flex-col flex-1 text-center sm:text-left">
                <span className="text-xs opacity-60 tracking-widest">
                  {isPracticeTestMissionCompleteToday ? 'Practice Test Complete' : 'Weekly Mission'}
                </span>
                <span className={isPracticeTestMissionCompleteToday ? 'text-base' : ''}>
                  {isPracticeTestMissionCompleteToday ? 'Mission Accomplished' : '1 Practice Test!'}
                </span>
                {isPracticeTestMissionCompleteToday && (
                  <span className="text-[10px] opacity-80 mt-1 normal-case font-bold">Resets at midnight so you can complete it again tomorrow.</span>
                )}
              </div>
              <div className="w-full sm:w-auto flex flex-row flex-wrap gap-2 items-center justify-center sm:justify-end">
                {!isPracticeTestMissionCompleteToday && (
                  <button 
                    type="button"
                    onClick={() => {
                      const wasAlreadyCompleted = Boolean(practiceTestCompletionDates[todayKey]);
                      if (wasAlreadyCompleted) return;
                      setPracticeTestEntryIntent('completed');
                      setPracticeTestEntryQuestions('');
                      setPracticeTestEntryScore('');
                      setPracticeTestEntryPercent('');
                      setShowPracticeTestEntryModal(true);
                    }}
                    className="w-full sm:w-auto min-w-[8rem] bg-black text-white px-6 py-3 rounded-xl text-xs hover:bg-gray-800 active:scale-95 transition-all shadow-md"
                  >
                    Completed
                  </button>
                )}
                {isTestMode && isPracticeTestMissionCompleteToday && (
                  <button
                    type="button"
                    onClick={removeTodayPracticeTestRecord}
                    className="w-full sm:w-auto min-w-[8rem] bg-red-600 text-white px-6 py-3 rounded-xl text-xs hover:bg-red-700 active:scale-95 transition-all shadow-md"
                  >
                    Remove
                  </button>
                )}
              </div>
              </div>
            </motion.div>
          )}

          {/* Level Section */}
          <motion.div {...mainSectionLoadProps} className="hidden min-[600px]:block">
            <LevelSection
              currentLevel={currentLevel}
              currentLevelIndex={currentLevelIndex}
              displayVariant={displayVariant}
              isWarningMode={isWarningMode}
              nextLevel={nextLevel}
              xpToNext={xpToNext}
              unlockedVariantsCount={unlockedVariants.length}
              setShowImageViewer={setShowImageViewer}
              setShowVariantModal={setShowVariantModal}
              setShowLevelMap={setShowLevelMap}
            />
          </motion.div>

          {/* Practice Test Reminder (Desktop, Complete = Below Level) */}
          {isPracticeTestMissionCompleteToday && (
            <motion.div {...mainSectionLoadProps} className="section-panel-ocean-frost p-6 hidden min-[600px]:flex flex-col sm:flex-row items-center gap-6 font-black text-lg uppercase transition-all duration-500">
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-[3rem] ${
                isPracticeTestMissionCompleteToday && isWarningMode
                  ? 'bg-white/45'
                  : isPracticeTestMissionCompleteToday
                    ? 'bg-green-500/35'
                    : isWarningMode
                      ? 'bg-red-600/38'
                      : 'bg-yellow-400/35'
              }`}
            />
            <div className={`relative z-10 flex flex-col sm:flex-row items-center gap-6 w-full ${
              isPracticeTestMissionCompleteToday && isWarningMode
                ? 'text-black'
                : isPracticeTestMissionCompleteToday
                  ? 'text-white'
                  : isWarningMode
                    ? 'text-white'
                    : 'text-black'
            }`}>
            <div className={`${
              isPracticeTestMissionCompleteToday
                ? isWarningMode
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-green-500'
                : 'bg-black text-white'
            } p-3 rounded-2xl shadow-lg transition-colors`}>
              {isPracticeTestMissionCompleteToday ? <Trophy className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
            </div>
            <div className="flex flex-col flex-1 text-center sm:text-left">
              <span className="text-xs opacity-60 tracking-widest">
                {isPracticeTestMissionCompleteToday ? 'Practice Test Complete' : 'Weekly Mission'}
              </span>
              <span className={isPracticeTestMissionCompleteToday ? 'text-base' : ''}>
                {isPracticeTestMissionCompleteToday ? 'Mission Accomplished' : '1 Practice Test!'}
              </span>
              {isPracticeTestMissionCompleteToday && (
                <span className="text-[10px] opacity-80 mt-1 normal-case font-bold">Resets at midnight so you can complete it again tomorrow.</span>
              )}
            </div>
            <div className="w-full sm:w-auto flex flex-row flex-wrap gap-2 items-center justify-center sm:justify-end">
              {!isPracticeTestMissionCompleteToday && (
                <button 
                  type="button"
                  onClick={() => {
                    const wasAlreadyCompleted = Boolean(practiceTestCompletionDates[todayKey]);
                    if (wasAlreadyCompleted) return;
                    setPracticeTestEntryIntent('completed');
                    setPracticeTestEntryQuestions('');
                    setPracticeTestEntryScore('');
                    setPracticeTestEntryPercent('');
                    setShowPracticeTestEntryModal(true);
                  }}
                  className="w-full sm:w-auto min-w-[8rem] bg-black text-white px-6 py-3 rounded-xl text-xs hover:bg-gray-800 active:scale-95 transition-all shadow-md"
                >
                  Completed
                </button>
              )}
              {isTestMode && isPracticeTestMissionCompleteToday && (
                <button
                  type="button"
                  onClick={removeTodayPracticeTestRecord}
                  className="w-full sm:w-auto min-w-[8rem] bg-red-600 text-white px-6 py-3 rounded-xl text-xs hover:bg-red-700 active:scale-95 transition-all shadow-md"
                >
                  Remove
                </button>
              )}
            </div>
            </div>
            </motion.div>
          )}

          {/* History — bottom of right column (2-column + single-column stack) */}
          <motion.section
            {...mainSectionLoadProps}
            className="section-panel-ocean-frost overflow-visible p-6 flex flex-col items-center gap-6"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-yellow-300" />
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">History</h2>
            </div>

            <div className="w-full flex flex-col gap-8">{historyCalendarMonths}</div>
          </motion.section>
        </div>

      </main>

      {/* Sea floor — end of page (scroll to see) */}
      <div
        className="relative z-10 w-full shrink-0 overflow-hidden pointer-events-none"
      >
        <img
          aria-hidden
          src={`${import.meta.env.BASE_URL}assets/${
            isWarningMode
              ? 'graphic_oceanfloornight_red.png'
              : isSleepMode
                ? 'graphic_oceanfloornight.png'
                : 'graphic_oceanfloor.png'
          }`}
          alt=""
          className={`block w-full h-auto max-w-none object-contain object-bottom select-none pointer-events-none ${
            isWarningMode ? 'opacity-50' : isSleepMode ? 'opacity-70' : 'opacity-[0.85]'
          }`}
          style={
            isWarningMode
              ? {
                  filter:
                    'drop-shadow(0 0 8px rgba(248, 113, 113, 0.62)) drop-shadow(0 0 18px rgba(220, 38, 38, 0.48))',
                }
              : undefined
          }
        />
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {/* Practice test completion: questions & score (before achievement celebration) */}
        {showPracticeTestEntryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className={`bg-white rounded-[2rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-4 border-cyan-400 shadow-2xl text-left`}
            >
              <div className={`${modalBodyScrollClass} p-6 sm:p-8`} data-modal-scroll="true">
              <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                Log practice test
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-6">
                Add how many questions were on the test and your score. You can also optionally log percent correct.
              </p>
              <div className="space-y-4 mb-8">
                <div>
                  <label htmlFor="practice-test-q" className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Questions included in the test
                  </label>
                  <input
                    ref={practiceTestEntryFirstInputRef}
                    id="practice-test-q"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={practiceTestEntryQuestions}
                    onChange={(e) => setPracticeTestEntryQuestions(e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label htmlFor="practice-test-score" className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Final score
                  </label>
                  <input
                    id="practice-test-score"
                    type="text"
                    inputMode="decimal"
                    value={practiceTestEntryScore}
                    onChange={(e) => setPracticeTestEntryScore(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label htmlFor="practice-test-percent" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    <span>% Correct</span>
                    <span className="normal-case tracking-normal text-[10px] text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="practice-test-percent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    inputMode="decimal"
                    value={practiceTestEntryPercent}
                    onChange={(e) => setPracticeTestEntryPercent(e.target.value)}
                    placeholder="e.g. 72"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={cancelPracticeTestEntry}
                  className="question-count-clay-btn flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPracticeTestEntry}
                  className="question-count-clay-btn flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white hover:bg-cyan-500 transition-all active:scale-[0.98]"
                >
                  Continue
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showGreatProgressModal && greatProgressSnapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className={`bg-white rounded-[2rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-4 border-emerald-400 shadow-2xl text-left`}
            >
              <div className={`${modalBodyScrollClass} p-6 sm:p-8`} data-modal-scroll="true">
              <h3 className="text-2xl font-black uppercase tracking-tight text-emerald-950 mb-2 text-center">
                Great Progress!
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-4 text-center">
                Your practice test score beat your previous best logged score. Here is your full trend; the latest score is highlighted.
              </p>

              <div className="mb-6 rounded-2xl border-2 border-gray-100 bg-gray-50 p-4">
                <h4 className="text-center text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-3">
                  Practice Test Scores
                </h4>
                <PracticeTestScoresChart
                  series={practiceTestChartSeries}
                  highlightDateKey={greatProgressSnapshot.highlightDateKey}
                  salmonGlow
                  className="[&_svg]:max-h-[300px]"
                />
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600">
                        <th className="px-3 py-2 text-left">Test #</th>
                        <th className="px-3 py-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {practiceTestChartSeries.map((row) => {
                        const hi = row.dateKey === greatProgressSnapshot.highlightDateKey;
                        return (
                          <tr
                            key={row.dateKey}
                            className={
                              hi
                                ? 'bg-emerald-100 font-black text-emerald-950'
                                : 'bg-white text-gray-800'
                            }
                          >
                            <td className="px-3 py-2 border-t border-gray-100">{row.testNumber}</td>
                            <td className="px-3 py-2 text-right border-t border-gray-100">
                              {row.score !== null ? row.score : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl bg-violet-50 border-2 border-violet-200 px-4 py-4 mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 mb-2">
                  Bonus points
                </p>
                <p className="text-base font-bold text-violet-950 leading-snug">
                  +{greatProgressSnapshot.bonusPoints} bonus points earned ({greatProgressSnapshot.deltaPoints}{' '}
                  point{greatProgressSnapshot.deltaPoints === 1 ? '' : 's'} improvement × 20). Score went from{' '}
                  {greatProgressSnapshot.previousScore} to {greatProgressSnapshot.newScore}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopAllCelebrationMusic();
                  setShowGreatProgressModal(false);
                  setGreatProgressSnapshot(null);
                }}
                className="question-count-clay-btn w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 transition-all active:scale-[0.98]"
              >
                Awesome!
              </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {practiceScoreSpotlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[93] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/95 backdrop-blur-md"
            onClick={dismissPracticeScoreSpotlight}
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-[2rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-4 border-cyan-400 shadow-2xl text-left`}
            >
              <div className={`${modalBodyScrollClass} p-6 sm:p-8`} data-modal-scroll="true">
              {practiceScoreSpotlight.isLatest ? (
                <>
                  <div className="flex justify-center mb-4">
                    <img
                      src={graphicAsset('surfingsalmon')}
                      alt=""
                      className="w-40 h-40 object-contain drop-shadow-lg"
                    />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-blue-950 mb-2 text-center">
                    Keep riding that wave!
                  </h3>
                  <p className="text-xs font-black uppercase tracking-widest text-cyan-600 text-center mb-1">
                    Latest test (#{practiceScoreSpotlight.testNumber})
                  </p>
                  {!isTestMode && practiceScoreSpotlight.hadScore ? (
                    <p className="text-sm text-gray-600 font-medium mb-6 text-center">
                      Here is the score you logged for your latest practice test.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 font-medium mb-6 text-center">
                      {isTestMode
                        ? 'Every practice test builds momentum — log or update your score below anytime.'
                        : 'Every practice test builds momentum — log your score below when you are ready.'}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                    {!practiceScoreSpotlight.hadScore
                      ? 'Add practice test score'
                      : isTestMode
                        ? 'Edit practice test score'
                        : 'Practice test score'}
                  </h3>
                  <p className="text-sm text-gray-600 font-medium mb-6">
                    Test #{practiceScoreSpotlight.testNumber}
                  </p>
                </>
              )}

              {!isTestMode && practiceScoreSpotlight.hadScore ? (
                <>
                  <div
                    className={`mb-6 space-y-5 text-blue-950 ${practiceScoreSpotlight.isLatest ? 'text-center' : ''}`}
                  >
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                        # Questions
                      </span>
                      <span className="block font-black text-3xl tabular-nums tracking-tight">
                        {practiceScoreSpotlight.draftQuestions.trim() !== ''
                          ? practiceScoreSpotlight.draftQuestions
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                        Score
                      </span>
                      <span className="block font-black text-3xl tabular-nums tracking-tight">
                        {practiceScoreSpotlight.draft}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                        % Correct
                      </span>
                      <span className="block font-black text-3xl tabular-nums tracking-tight">
                        {practiceScoreSpotlight.draftPercent.trim() !== ''
                          ? `${practiceScoreSpotlight.draftPercent.trim()}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissPracticeScoreSpotlight}
                    className="question-count-clay-btn w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white hover:bg-cyan-500 transition-all active:scale-[0.98]"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <label
                    htmlFor="practice-score-spotlight-questions"
                    className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1"
                  >
                    # Questions
                  </label>
                  <input
                    id="practice-score-spotlight-questions"
                    type="text"
                    inputMode="numeric"
                    value={practiceScoreSpotlight.draftQuestions}
                    onChange={(e) =>
                      setPracticeScoreSpotlight((prev) =>
                        prev ? { ...prev, draftQuestions: e.target.value } : prev
                      )
                    }
                    placeholder="—"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400 mb-4"
                  />

                  <label
                    htmlFor="practice-score-spotlight-input"
                    className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1"
                  >
                    Score
                  </label>
                  <input
                    id="practice-score-spotlight-input"
                    type="text"
                    inputMode="decimal"
                    value={practiceScoreSpotlight.draft}
                    onChange={(e) =>
                      setPracticeScoreSpotlight((prev) =>
                        prev ? { ...prev, draft: e.target.value } : prev
                      )
                    }
                    placeholder="e.g. 228"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400 mb-4"
                  />

                  <label
                    htmlFor="practice-score-spotlight-percent"
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1"
                  >
                    <span>% Correct</span>
                    <span className="normal-case tracking-normal text-[10px] text-gray-400 font-bold">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="practice-score-spotlight-percent"
                    type="text"
                    inputMode="decimal"
                    value={practiceScoreSpotlight.draftPercent}
                    onChange={(e) =>
                      setPracticeScoreSpotlight((prev) =>
                        prev ? { ...prev, draftPercent: e.target.value } : prev
                      )
                    }
                    placeholder="—"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400 mb-6"
                  />

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={dismissPracticeScoreSpotlight}
                      className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={savePracticeScoreSpotlight}
                      className="question-count-clay-btn flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white hover:bg-cyan-500 transition-all active:scale-[0.98]"
                    >
                      Save
                    </button>
                  </div>
                </>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Log Set entry */}
        {showLogSetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[91] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className={`bg-white rounded-[2rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-4 border-cyan-400 shadow-2xl text-left`}
            >
              <div className={`${modalBodyScrollClass} p-6 sm:p-8`} data-modal-scroll="true">
              <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                Log Set
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-6">
                Enter the size of the set and your percent correct.
              </p>
              <div className="mb-4">
                <label htmlFor="log-win-q" className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                  Number of questions
                </label>
                <input
                  ref={logSetFirstInputRef}
                  id="log-win-q"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={logSetQuestionDraft}
                  onChange={(e) => setLogSetQuestionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    confirmLogSet();
                  }}
                  placeholder="e.g. 40"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="mb-8">
                <label htmlFor="log-win-percent" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                  <span>% Correct</span>
                  <span className="normal-case tracking-normal text-[10px] text-gray-400">(optional)</span>
                </label>
                <input
                  id="log-win-percent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  inputMode="decimal"
                  value={logSetPercentDraft}
                  onChange={(e) => setLogSetPercentDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    confirmLogSet();
                  }}
                  placeholder="e.g. 72"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={cancelLogSetModal}
                  className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogSet}
                  disabled={
                    !Number.isFinite(parseInt(logSetQuestionDraft.replace(/,/g, ''), 10)) ||
                    parseInt(logSetQuestionDraft.replace(/,/g, ''), 10) <= 0 ||
                    (logSetPercentDraft.trim() !== '' &&
                      (!Number.isFinite(parseFloat(logSetPercentDraft.replace(/,/g, ''))) ||
                        parseFloat(logSetPercentDraft.replace(/,/g, '')) < 0 ||
                        parseFloat(logSetPercentDraft.replace(/,/g, '')) > 100))
                  }
                  className="question-count-clay-btn flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white hover:bg-cyan-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  Confirm
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Log Review entry */}
        {showLogReviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[91] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className={`bg-white rounded-[2rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-4 border-cyan-400 shadow-2xl text-left`}
            >
              <div className={`${modalBodyScrollClass} p-6 sm:p-8`} data-modal-scroll="true">
                <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                  Log Review
                </h3>
                <p className="text-sm text-gray-600 font-medium mb-6">
                  Enter how many review questions you completed.
                </p>
                <div className="mb-8">
                  <label htmlFor="log-review-q" className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Questions Reviewed
                  </label>
                  <input
                    ref={logReviewFirstInputRef}
                    id="log-review-q"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={logReviewQuestionDraft}
                    onChange={(e) => setLogReviewQuestionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      confirmLogReview();
                    }}
                    placeholder="e.g. 20"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={cancelLogReviewModal}
                    className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmLogReview}
                    disabled={
                      !Number.isFinite(parseInt(logReviewQuestionDraft.replace(/,/g, ''), 10)) ||
                      parseInt(logReviewQuestionDraft.replace(/,/g, ''), 10) <= 0
                    }
                    className="question-count-clay-btn flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white hover:bg-cyan-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReviewCompleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[92] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className={`bg-white rounded-[3rem] ${modalPanelSizeClass} ${modalShellLayoutClass} text-center border-8 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.35)] relative`}
            >
              <div className={`${modalBodyScrollClass}`} data-modal-scroll="true">
                <div className="w-full h-[220px] md:h-[350px] shrink-0 bg-emerald-50 overflow-hidden">
                  <motion.img
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={graphicAsset('salmonthumbsup')}
                    alt="Salmon thumbs up"
                    className="block h-full w-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-8 pt-6 relative z-10 space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase tracking-tight text-emerald-700">
                      You reviewed all incorrect questions!
                    </h3>
                    <p className="text-sm text-gray-600 font-bold">
                      Salmon says your mistake list just got absolutely filleted.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stopAllCelebrationMusic();
                      setShowReviewCompleteModal(false);
                    }}
                    className="question-count-clay-btn w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-xl active:scale-95 transition-all"
                  >
                    Nice!
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Log Set: tier celebration */}
        {showLogWinCelebrateModal && logWinCelebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[92] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className={`bg-white rounded-[3rem] ${modalPanelSizeClass} ${modalShellLayoutClass} text-center border-8 relative ${
                logWinCelebrate.tier === 100
                  ? 'border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.35)]'
                  : 'border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.35)]'
              }`}
            >
              <div className={`${modalBodyScrollClass}`} data-modal-scroll="true">
                {logWinCelebrate.tier !== 'effort' && (
                  <div
                    className={`w-full h-[220px] md:h-[350px] shrink-0 overflow-hidden ${
                      logWinCelebrate.tier === 100 ? 'bg-sky-50' : 'bg-cyan-50'
                    }`}
                  >
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={
                        logWinCelebrate.tier === 100
                          ? graphicAsset('vacationsalmon')
                          : logWinCelebrate.tier === 80
                            ? graphicAsset('rockstarsalmon')
                            : logWinCelebrate.tier === 70
                              ? graphicAsset('scholarsalmon')
                              : graphicAsset('doublethumbsupsalmon')
                      }
                      alt=""
                      className="block h-full w-full object-cover object-center"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="p-8 pt-6 relative z-10 space-y-5">
                {logWinCelebrate.tier === 100 && (
                  <h2 className="text-amber-600 text-3xl sm:text-4xl font-black uppercase leading-none">
                    Easy peasy lemon squeezy!
                  </h2>
                )}
                {logWinCelebrate.tier === 80 && (
                  <h2 className="text-fuchsia-600 text-3xl sm:text-4xl font-black uppercase leading-none">
                    You&apos;re a rockstar!
                  </h2>
                )}
                {logWinCelebrate.tier === 'effort' && (
                  <h2 className="text-cyan-700 text-3xl sm:text-4xl font-black uppercase leading-none">
                    Good Effort!
                  </h2>
                )}
                <div className="space-y-2">
                  <p
                    className={`font-bold text-base leading-snug ${
                      logWinCelebrate.tier === 100 ? 'text-amber-900' : 'text-cyan-800'
                    }`}
                  >
                    {logWinCelebrate.tier === 60 &&
                      'Double Thumbs Up Salmon is beaming. You cleared 60%+ on this set!'}
                    {logWinCelebrate.tier === 70 &&
                      'Scholar Salmon tips their mortarboard. You cleared 70%+ on this set!'}
                    {logWinCelebrate.tier === 80 &&
                      'Rockstar Salmon is shouting encore. You cleared 80%+ on this set!'}
                    {logWinCelebrate.tier === 100 &&
                      'Vacation Salmon just filed the paperwork to make you Fish of the Year. Wrong answers called in sick today.'}
                    {logWinCelebrate.tier === 'effort' &&
                      'You logged your set and kept momentum going. Keep practicing and you will keep improving.'}
                  </p>
                </div>
                <div
                  className={`p-4 rounded-2xl border-2 space-y-2 text-left ${
                    logWinCelebrate.tier === 100
                      ? 'bg-amber-50 border-amber-100'
                      : 'bg-cyan-50 border-cyan-100'
                  }`}
                >
                  <div
                    className={`flex justify-between gap-4 text-sm font-bold ${
                      logWinCelebrate.tier === 100 ? 'text-amber-950' : 'text-cyan-950'
                    }`}
                  >
                    <span>
                      {logWinCelebrate.context === 'practiceTest' ? 'Practice test logged' : 'Set logged'}
                    </span>
                    <span className="font-black tabular-nums">{logWinCelebrate.questionsCovered} Q</span>
                  </div>
                  <div
                    className={`flex justify-between gap-4 text-sm font-bold ${
                      logWinCelebrate.tier === 100 ? 'text-amber-950' : 'text-cyan-950'
                    }`}
                  >
                    <span>Accuracy entered</span>
                    <span className="font-black tabular-nums">{logWinCelebrate.percentCorrect}%</span>
                  </div>
                  <div
                    className={`flex justify-between gap-4 text-sm font-bold ${
                      logWinCelebrate.tier === 100 ? 'text-amber-950' : 'text-cyan-950'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>Bonus Points</span>
                      <span
                        className={`text-[11px] font-medium ${
                          logWinCelebrate.tier === 100 ? 'text-amber-700' : 'text-cyan-700'
                        }`}
                      >
                        {logWinCelebrate.tier === 100 ? (
                          <>
                            {'# logged x % correct '}
                            <span className="font-bold">x 3</span>
                          </>
                        ) : (
                          '# logged x % correct'
                        )}
                      </span>
                    </div>
                    <span className="font-black tabular-nums text-purple-700">{logWinCelebrate.bonusPointsEarned}</span>
                  </div>
                  <div
                    className={`flex justify-between gap-4 text-sm font-bold pt-2 border-t ${
                      logWinCelebrate.tier === 100
                        ? 'text-amber-950 border-amber-200'
                        : 'text-cyan-950 border-cyan-200'
                    }`}
                  >
                    <span>Total XP Logged</span>
                    <span className="font-black tabular-nums text-teal-600">
                      {logWinCelebrate.questionsCovered + logWinCelebrate.bonusPointsEarned}
                    </span>
                  </div>
                </div>
                {logWinCelebrate.questionsToReview > 0 && (
                  <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100 text-left">
                    <div className="flex justify-between gap-4 text-sm font-bold text-red-900">
                      <span>Questions to Review</span>
                      <span className="font-black tabular-nums">{logWinCelebrate.questionsToReview}</span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    stopAllCelebrationMusic();
                    setShowLogWinCelebrateModal(false);
                    setLogWinCelebrate(null);
                  }}
                  className={`question-count-clay-btn w-full text-white py-4 rounded-2xl font-black text-xl active:scale-95 transition-all ${
                    logWinCelebrate.tier === 100
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-cyan-600 hover:bg-cyan-700'
                  }`}
                >
                  Awesome!
                </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* History Detail Modal */}
        {selectedHistoryDate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#001a2c]/90 backdrop-blur-md p-4 sm:p-6"
            data-modal-scroll="true"
          >
            <div className="flex min-h-full items-center justify-center">
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className={`bg-white rounded-[3rem] w-full max-w-lg sm:max-w-xl lg:max-w-4xl xl:max-w-5xl max-h-[min(90dvh,900px)] text-center border-8 shadow-2xl relative flex flex-col min-h-0 overflow-hidden ${
                selectedHistoryDate.count >= dailyGoalQuestions ? 'border-green-400' : 'border-gray-300'
              }`}
            >
              <div className="flex flex-col min-h-0 flex-1 max-h-[inherit]">
                <div className="flex shrink-0 items-center justify-between gap-4 p-6 sm:p-8 min-w-0">
                  <h2 className={`text-left text-lg sm:text-xl font-black uppercase tracking-tight break-words flex-1 min-w-0 ${
                    selectedHistoryDate.count >= dailyGoalQuestions ? 'text-green-900' : 'text-gray-900'
                  }`}>
                    {selectedHistoryDate.date}
                  </h2>
                  <button 
                    onClick={() => setSelectedHistoryDate(null)}
                    className="shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-6 pb-4 custom-scrollbar" data-modal-scroll="true">
                  {selectedHistoryDate.count >= dailyGoalQuestions && !selectedHistoryDate.isExamDay && (
                    <div className="w-full max-w-full">
                      <img 
                        src={graphicAsset('salmonthumbsup')} 
                        alt="Salmon Thumbs Up" 
                        className="w-full max-h-[min(38vh,320px)] object-contain"
                      />
                    </div>
                  )}

                  {selectedHistoryDate.isExamDay ? (
                    <div className={`mt-2 p-6 sm:p-8 rounded-[2rem] border-4 bg-yellow-50 border-yellow-100 min-w-0 max-w-full`}>
                    <div className="space-y-2">
                      <div className="flex justify-center mb-2">
                        <Star className="w-16 h-16 text-yellow-500 fill-yellow-500 animate-spin-slow" />
                      </div>
                      <div className="text-4xl font-black text-yellow-700 uppercase">Exam Day!</div>
                      <p className="text-yellow-600 font-bold">The big day has arrived. You've got this!</p>
                    </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 pt-2 pb-2 min-w-0 max-w-full">
                      <div className={`text-6xl font-black ${
                        selectedHistoryDate.count >= dailyGoalQuestions ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {selectedHistoryDate.count}
                      </div>
                      <div className={`${
                        selectedHistoryDate.count >= dailyGoalQuestions ? 'text-green-400' : 'text-gray-400'
                      } text-sm font-black uppercase tracking-widest`}>
                        Questions Completed
                      </div>
                      {(() => {
                        const dk = selectedHistoryDate.dateKey;
                        const bpDay = Math.max(0, Number(bonusPointsHistory[dk] ?? 0) || 0);
                        if (bpDay <= 0) return null;
                        return (
                          <span className="mt-2 block text-sm font-semibold text-gray-600">
                            Plus{' '}
                            <span className="font-semibold text-purple-600">{bpDay} BP</span> earned!
                          </span>
                        );
                      })()}

                      {isTestMode && (
                        <div className="w-full max-w-full min-w-0 mt-1 px-0.5">
                          <QuestionButtons onUpdate={(amount) => updateHistoryCount(selectedHistoryDate.dateKey, selectedHistoryDate.count + amount)} isTestMode={isTestMode} isWarningMode={isWarningMode} isSleepMode={isSleepMode} isHistoryModal={true} />
                        </div>
                      )}

                      <div className="w-full max-w-full min-w-0 mt-2 p-4 rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-white text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
                          <span className="font-black uppercase text-xs tracking-widest text-cyan-950">
                            {practiceTestCompletionDates[selectedHistoryDate.dateKey]
                              ? 'Practice Test Completed'
                              : 'Practice Test'}
                          </span>
                        </div>

                        {isTestMode && (
                          <div className="mt-4 flex justify-center">
                            {practiceTestCompletionDates[selectedHistoryDate.dateKey] ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleHistoryPracticeTestCompletionChange(selectedHistoryDate.dateKey, false)
                                }
                                className="px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white border-2 border-red-700 hover:bg-red-500 hover:border-red-600 transition-all active:scale-[0.98]"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleHistoryPracticeTestCompletionChange(selectedHistoryDate.dateKey, true)
                                }
                                className="px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest bg-cyan-600 text-white hover:bg-cyan-500 transition-all active:scale-[0.98]"
                              >
                                Completed
                              </button>
                            )}
                          </div>
                        )}

                        {practiceTestCompletionDates[selectedHistoryDate.dateKey] && (
                          <div className="mt-4 pt-4 border-t border-cyan-200 text-left grid grid-cols-2 gap-3">
                            <div className="space-y-1 min-w-0">
                              <span className="block text-[10px] font-black uppercase tracking-widest text-cyan-800/80">
                                Questions Completed
                              </span>
                              {isTestMode ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={adminHistoryPracticeQuestionsDraft}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAdminHistoryPracticeQuestionsDraft(val);
                                    applyPracticeTestQuestionsForDate(selectedHistoryDate.dateKey, val);
                                    syncPracticeTestCreditFromHistoryModalInputs(
                                      selectedHistoryDate.dateKey,
                                      val,
                                      adminHistoryPracticePercentDraft
                                    );
                                  }}
                                  placeholder="—"
                                  className="w-full bg-white border-2 border-cyan-100 rounded-xl px-4 py-2.5 font-black text-gray-900 focus:outline-none focus:border-cyan-400"
                                />
                              ) : (
                                <p className="text-sm font-black text-gray-900 tabular-nums">
                                  {practiceTestQuestionCounts[selectedHistoryDate.dateKey] !== undefined
                                    ? practiceTestQuestionCounts[selectedHistoryDate.dateKey]
                                    : '—'}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="block text-[10px] font-black uppercase tracking-widest text-cyan-800/80">
                                Practice Test Score
                              </span>
                              {isTestMode ? (
                                <input
                                  id="admin-practice-test-score"
                                  type="text"
                                  inputMode="decimal"
                                  value={adminHistoryPracticeScoreDraft}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAdminHistoryPracticeScoreDraft(val);
                                    applyPracticeTestScoreForDate(selectedHistoryDate.dateKey, val);
                                  }}
                                  placeholder="—"
                                  className="w-full bg-white border-2 border-cyan-100 rounded-xl px-4 py-2.5 font-black text-gray-900 focus:outline-none focus:border-cyan-400"
                                />
                              ) : (
                                <p className="text-sm font-black text-gray-900 tabular-nums">
                                  {practiceTestScores[selectedHistoryDate.dateKey] !== undefined
                                    ? practiceTestScores[selectedHistoryDate.dateKey]
                                    : '—'}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="block text-[10px] font-black uppercase tracking-widest text-cyan-800/80">
                                % Correct
                              </span>
                              {isTestMode ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={adminHistoryPracticePercentDraft}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAdminHistoryPracticePercentDraft(val);
                                    applyPracticeTestPercentForDate(selectedHistoryDate.dateKey, val);
                                    syncPracticeTestCreditFromHistoryModalInputs(
                                      selectedHistoryDate.dateKey,
                                      adminHistoryPracticeQuestionsDraft,
                                      val
                                    );
                                  }}
                                  placeholder="—"
                                  className="w-full bg-white border-2 border-cyan-100 rounded-xl px-4 py-2.5 font-black text-gray-900 focus:outline-none focus:border-cyan-400"
                                />
                              ) : (
                                <p className="text-sm font-black text-gray-900 tabular-nums">
                                  {practiceTestPercents[selectedHistoryDate.dateKey] !== undefined
                                    ? `${practiceTestPercents[selectedHistoryDate.dateKey]}%`
                                    : '—'}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="block text-[10px] font-black uppercase tracking-widest text-cyan-800/80">
                                Bonus Points
                              </span>
                              <p className="text-sm font-black text-gray-900 tabular-nums">
                                {practiceTestPercents[selectedHistoryDate.dateKey] !== undefined
                                  ? accuracyBonusPointsFor(
                                      practiceTestQuestionCounts[selectedHistoryDate.dateKey] ??
                                        practiceTestQuestionCredits[selectedHistoryDate.dateKey] ??
                                        0,
                                      practiceTestPercents[selectedHistoryDate.dateKey]
                                    )
                                  : '—'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => setSelectedHistoryDate(null)}
                  className={`question-count-clay-btn shrink-0 w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-all ${
                    selectedHistoryDate.isExamDay 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                      : selectedHistoryDate.count >= dailyGoalQuestions
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  {selectedHistoryDate.isExamDay ? "LET'S GO!" : "AWESOME"}
                </button>
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}

        {/* Level Map Modal */}
        {showLevelMap && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[#001a2c]/95 backdrop-blur-xl overflow-y-auto p-4 sm:p-6"
            data-modal-scroll="true"
          >
            <div className="w-[92vw] sm:w-[86vw] lg:w-[78vw] max-w-3xl mx-auto py-8 sm:py-12">
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black text-white uppercase tracking-widest">Level Map</h2>
                <button 
                  onClick={() => setShowLevelMap(false)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
              
              <div className="flex flex-col gap-8">
                {LEVELS.map((level, index) => {
                  const isReached = totalExperiencePoints >= level.min;
                  const isCurrent = index === currentLevelIndex;
                  const showImage = isReached || isTestMode;
                  
                  return (
                    <div 
                      key={level.name} 
                      className={`flex items-center gap-6 p-6 rounded-3xl border-4 transition-all duration-500 ${
                        isCurrent 
                          ? 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.4)] scale-[1.02]' 
                          : isReached 
                            ? 'bg-white/10 border-white/20' 
                            : 'bg-black/20 border-white/5'
                      }`}
                    >
                      <div className={`w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden ${isReached ? 'bg-white/5' : 'bg-black/20'}`}>
                        {showImage ? (
                          <img 
                            src={graphicAsset(level.graphic)} 
                            alt={level.name} 
                            className="w-full h-full object-cover object-center"
                          />
                        ) : (
                          <div className="text-4xl opacity-30">{level.emoji}</div>
                        )}
                      </div>
                      <div className="flex-1 relative">
                        {isCurrent && (
                          <div className="absolute -top-4 -right-2 bg-fuchsia-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                            Current Level
                          </div>
                        )}
                        <div className={`${isCurrent ? 'text-fuchsia-300' : 'text-cyan-300'} font-black text-sm uppercase tracking-widest`}>Level {index + 1}</div>
                        <div className="text-2xl font-black text-white uppercase">{level.name}</div>
                        <div className="text-white/60 font-medium">{level.min} XP Required</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Post-logout local restore option */}
        {showRestorePreLoginDataModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 24 }}
              className={`bg-white rounded-[2rem] sm:rounded-[3rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-8 border-cyan-400 shadow-[0_0_50px_rgba(0,0,0,0.35)] relative`}
            >
              <div className={`${modalBodyScrollClass} p-6 sm:p-8 space-y-5`} data-modal-scroll="true">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-sans text-blue-900 text-2xl sm:text-3xl font-extrabold leading-tight">
                      Restore your local data?
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleKeepSignedOutData}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <p className="font-sans text-gray-700 text-base sm:text-lg leading-relaxed">
                  Before you signed in, you had data saved locally in this browser. Do you want to restore that local
                  data now?
                </p>

                <div className="flex flex-col gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleRestorePreLoginData}
                    className="question-count-clay-btn font-sans w-full bg-cyan-600 border-2 border-cyan-800 text-white py-4 px-4 sm:px-5 rounded-2xl font-bold text-base sm:text-lg tracking-normal leading-snug hover:bg-cyan-700 transition-all text-left"
                  >
                    Yes, restore pre-login local data
                  </button>
                  <button
                    type="button"
                    onClick={handleKeepSignedOutData}
                    className="question-count-clay-btn font-sans w-full bg-white border-2 border-gray-300 py-4 px-4 sm:px-5 rounded-2xl font-bold text-base sm:text-lg tracking-normal hover:bg-gray-50 transition-all text-left text-gray-800"
                  >
                    Keep current data
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <SettingsModal
            onRequestClose={() => setShowSettingsModal(false)}
            examDateKey={examDateKey}
            setExamDateKey={setExamDateKey}
            editingExamDate={editingExamDate}
            setEditingExamDate={setEditingExamDate}
            dailyGoalQuestions={dailyGoalQuestions}
            setDailyGoalQuestions={setDailyGoalQuestions}
            editingDailyGoal={editingDailyGoal}
            setEditingDailyGoal={setEditingDailyGoal}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            isTestMode={isTestMode}
            setIsTestMode={setIsTestMode}
            exitAdminMode={exitAdminMode}
            showTestCodeInput={showTestCodeInput}
            setShowTestCodeInput={setShowTestCodeInput}
            testCodeInput={testCodeInput}
            setTestCodeInput={setTestCodeInput}
            adminCodeInputRef={adminCodeInputRef}
            effectiveTime={effectiveTime}
            setSimulatedTime={setSimulatedTime}
            simulateStreak={simulateStreak}
            isWarningMode={isWarningMode}
            setIsWarningMode={setIsWarningMode}
            adminSleepModeForceOn={adminSleepModeForceOn}
            setAdminSleepModeForceOn={setAdminSleepModeForceOn}
            openFeedbackSummaryTab={openFeedbackSummaryTab}
            isConfirmingClear={isConfirmingClear}
            setIsConfirmingClear={setIsConfirmingClear}
            clearAllData={clearAllData}
            authResolved={authResolved}
            firebaseUser={firebaseUser}
            handleSignOut={handleSignOut}
            authActionPending={authActionPending}
            handleContinueWithGoogleClick={handleContinueWithGoogleClick}
          />
        )}

        {/* Report feedback */}
        {showReportFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className={`bg-white rounded-[3rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-8 border-blue-400 shadow-[0_0_50px_rgba(0,0,0,0.3)] relative`}
            >
              <div className={`${modalBodyScrollClass} p-8 space-y-6 custom-scrollbar`} data-modal-scroll="true">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-blue-900 text-2xl sm:text-3xl font-black uppercase">Report Feedback</h2>
                  <button
                    type="button"
                    onClick={() => setShowReportFeedbackModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form
                  className="space-y-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!firebaseUser) {
                      setReportSubmitError('Sign in with Google to submit feedback.');
                      return;
                    }
                    const trimmed = reportDescription.trim();
                    if (!trimmed) {
                      setReportSubmitError('Please enter a description.');
                      return;
                    }
                    setReportSubmitPending(true);
                    setReportSubmitError(null);
                    const submitStarted = performance.now();
                    let submitErr: unknown = null;
                    try {
                      await submitFeedbackReport(db, firebaseUser.uid, reportCategory, trimmed);
                    } catch (err) {
                      submitErr = err;
                    }
                    const remaining = MIN_SPINNER_MS - (performance.now() - submitStarted);
                    if (remaining > 0) {
                      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
                    }
                    if (submitErr != null) {
                      setReportSubmitError(
                        submitErr instanceof Error ? submitErr.message : 'Something went wrong.',
                      );
                    } else {
                      setReportDescription('');
                      setReportCategory('bug');
                      setShowReportFeedbackModal(false);
                      if (feedbackSuccessToastTimeoutRef.current) {
                        clearTimeout(feedbackSuccessToastTimeoutRef.current);
                      }
                      setShowFeedbackSuccessToast(true);
                      feedbackSuccessToastTimeoutRef.current = setTimeout(() => {
                        setShowFeedbackSuccessToast(false);
                        feedbackSuccessToastTimeoutRef.current = null;
                      }, 4000);
                    }
                    setReportSubmitPending(false);
                  }}
                >
                  <div className="space-y-2">
                    <label htmlFor="report-category" className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="report-category"
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value as FeedbackReportCategory)}
                      className="w-full bg-white border-2 border-blue-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-blue-400"
                    >
                      <option value="bug">Bug</option>
                      <option value="request">Request</option>
                      <option value="feedback">Feedback</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="report-description" className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="report-description"
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      rows={5}
                      maxLength={8000}
                      placeholder="What happened or what would you like to see?"
                      className="w-full resize-y min-h-[120px] bg-white border-2 border-blue-200 rounded-xl px-4 py-3 font-sans text-blue-950 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {!firebaseUser && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-bold text-amber-700">
                        Sign in with Google to submit — your report is tied to your account.
                      </p>
                      <button
                        type="button"
                        onClick={handleContinueWithGoogleClick}
                        disabled={authActionPending}
                        className="question-count-clay-btn flex items-center justify-center gap-2 w-full bg-white border-2 border-gray-200 text-gray-800 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        <LogIn className="w-4 h-4 shrink-0" />
                        {authActionPending ? 'Opening Google…' : 'Log In with Google'}
                      </button>
                    </div>
                  )}

                  {reportSubmitError && (
                    <p className="text-sm font-bold text-red-600">{reportSubmitError}</p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowReportFeedbackModal(false)}
                      className="question-count-clay-btn flex-1 bg-white border-2 border-gray-300 text-gray-800 py-4 rounded-2xl font-black text-base hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      aria-busy={reportSubmitPending}
                      disabled={
                        reportSubmitPending ||
                        !firebaseUser ||
                        reportDescription.trim().length === 0
                      }
                      className="question-count-clay-btn inline-flex flex-1 items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-base transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {reportSubmitPending ? (
                        <>
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                          <span>Sending…</span>
                        </>
                      ) : (
                        'Submit'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Goal Reached Modal */}
        {showGoalModal && (
          <GoalReachedModal
            goalMessage={goalMessage}
            dailyQuestions={dailyQuestions}
            onDismiss={() => {
              stopAllCelebrationMusic();
              setShowGoalModal(false);
            }}
          />
        )}

        {/* New record: questions in a single day */}
        {showRecordDayModal && (
          <RecordDayModal
            recordDayModalCount={recordDayModalCount}
            onDismiss={() => {
              stopAllCelebrationMusic();
              setShowRecordDayModal(false);
            }}
          />
        )}

        {/* Variant Modal */}
        {showVariantModal && (
          <VariantPickerModal
            displayVariant={displayVariant}
            unlockedVariants={unlockedVariants}
            onSelectVariant={(variant) => {
              setSelectedVariants((prev) => ({ ...prev, [currentLevel.graphic]: variant }));
              setShowVariantModal(false);
            }}
            onClose={() => setShowVariantModal(false)}
          />
        )}

        {/* Full Screen Image Viewer */}
        {showImageViewer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <button 
              onClick={() => setShowImageViewer(false)}
              className="fixed top-6 right-6 z-[110] p-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-full h-full flex items-center justify-center overflow-hidden"
            >
              <motion.img 
                src={graphicAsset(displayVariant)}
                alt={currentLevel.name}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.1}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain',
                  touchAction: 'none' 
                }}
                className="rounded-2xl shadow-2xl"
                whileTap={{ scale: 1.5 }} // Simple tap-to-zoom for desktop, pinch works via touchAction: none + browser defaults or motion scale
              />
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Pinch to zoom - Drag to move</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Styles for Silly Fonts */}
      <style>{`
        body, .font-sans {
          font-family: 'Bubblegum Sans', cursive;
        }
        
        h1, h2, h3, .font-black {
          font-family: 'Bungee', cursive;
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        .text-11xl {
          font-size: 10rem;
        }
        @media (min-width: 768px) {
          .text-11xl {
            font-size: 14rem;
          }
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #005a8d;
        }
        ::-webkit-scrollbar-thumb {
          background: #00bfff;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #1e90ff;
        }
      `}</style>
      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissAchievementView}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative ${modalPanelSizeClass} min-h-0 flex flex-col section-panel-ocean-frost-base border-4 shadow-[0_0_50px_rgba(250,204,21,0.3)] overflow-hidden ${
                showAchievementCelebration 
                  ? 'border-fuchsia-500 shadow-[0_0_70px_rgba(217,70,239,0.5)]' 
                  : getAchievementStatus(selectedAchievement, totalQuestions, history, effectiveTime, totalPracticeTests, bonusPoints, lastAchievedIds) 
                    ? 'border-yellow-400/50' 
                    : 'border-white/20'
              }`}
            >
              {showAchievementCelebration && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-500/20 to-transparent animate-pulse" />
                </div>
              )}
              <button 
                onClick={dismissAchievementView}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-all z-30 shadow-xl"
              >
                <X className="w-6 h-6" />
              </button>

              <div className={`${modalBodyScrollClass} custom-scrollbar`} data-modal-scroll="true">
                {getAchievementStatus(selectedAchievement, totalQuestions, history, effectiveTime, totalPracticeTests, bonusPoints, lastAchievedIds) ? (
                  <>
                    <div className="w-full h-[220px] md:h-[350px] bg-white/5 flex items-center justify-center overflow-hidden border-b border-white/10 relative">
                      {showAchievementCelebration && (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                          className="absolute w-[150%] h-[150%] bg-[conic-gradient(from_0deg,transparent,rgba(217,70,239,0.3),transparent)]"
                        />
                      )}
                      <img 
                        src={graphicAsset(selectedAchievement.image)} 
                        alt={selectedAchievement.title}
                        className="w-full h-full object-cover object-center drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] relative z-10"
                      />
                    </div>

                    <div className="p-8 flex flex-col items-center text-center gap-6 relative z-10">
                      {showAchievementCelebration && (
                        <div className="space-y-2">
                          <span className="text-fuchsia-400 font-black uppercase tracking-[0.3em] text-sm animate-bounce block">New Achievement Unlocked!</span>
                        </div>
                      )}
                      <div className="space-y-4">
                        <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none ${showAchievementCelebration ? 'text-fuchsia-300' : 'text-yellow-300'}`}>
                          {selectedAchievement.title}
                        </h2>
                        <div className="space-y-2">
                          <p className="text-xl md:text-2xl font-bold text-white">
                            {selectedAchievement.achievementDescription}
                          </p>
                          <p className="text-base md:text-lg font-medium text-white/60 italic max-w-md mx-auto">
                            {selectedAchievement.extraSillyDescription}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 p-6 bg-white/5 rounded-3xl border border-white/10 w-full">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Requirement</div>
                        <div className="text-sm font-bold text-white/80">{selectedAchievement.requirementDescription}</div>
                      </div>

                      {showAchievementCelebration && (
                        <button 
                          onClick={dismissAchievementView}
                          className="mt-4 w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest"
                        >
                          Keep Swimming!
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-12 flex flex-col items-center text-center gap-8">
                    <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border-4 border-dashed border-white/20">
                      <Trophy className="w-12 h-12 text-white/20" />
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-3xl font-black text-white/40 uppercase tracking-widest">Locked Achievement</h2>
                      <div className="p-8 bg-white/5 rounded-[2rem] border-2 border-white/10">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">How to Unlock</div>
                        <div className="text-xl font-bold text-white">{selectedAchievement.requirementDescription}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {waitingForCloudOnboarding && (
        <div className="fixed inset-0 z-[117] flex flex-col items-center justify-center gap-4 bg-[#001a2c]/95 backdrop-blur-md px-6">
          <Anchor className="w-10 h-10 text-cyan-300 animate-pulse" aria-hidden />
          <p className="text-white font-black uppercase tracking-widest text-sm text-center">Loading…</p>
        </div>
      )}

      {showOnboarding && !waitingForCloudOnboarding && (
        <OnboardingScreen
          examDateKey={onboardingExamDraft}
          dailyGoalQuestions={onboardingDailyGoalDraft}
          onExamDateChange={setOnboardingExamDraft}
          onDailyGoalChange={setOnboardingDailyGoalDraft}
          onContinue={handleOnboardingContinue}
          showOptionalGoogleLogin={authResolved && !firebaseUser}
          onLogInWithGoogle={handleContinueWithGoogleClick}
          authActionPending={authActionPending}
        />
      )}

      <AnimatePresence>
        {showFeedbackSuccessToast && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed bottom-6 sm:bottom-8 left-1/2 z-[120] w-[min(92vw,22rem)] -translate-x-1/2 pointer-events-none"
          >
            <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-400/90 bg-emerald-600 px-5 py-3.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <Check className="h-6 w-6 shrink-0 text-emerald-100" strokeWidth={2.5} aria-hidden />
              <span className="font-black text-sm uppercase tracking-wide leading-snug">Thanks — your feedback was sent.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
