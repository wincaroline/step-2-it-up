import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  ChevronUp, 
  Zap, 
  Anchor, 
  Star,
  Volume2,
  VolumeX,
  Settings,
  Trash2,
  Calendar,
  X,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  Award,
  Flame,
} from 'lucide-react';

import { LEVELS, LEVEL_VARIANTS, ACHIEVEMENTS, SILLY_STATEMENTS, DAILY_GOAL, MILESTONE_1, EXAM_DATE, RECORD_DAY_MODAL_LAST_SHOWN_KEY } from './constants';
import { SeaweedGraphic, CoralGraphic } from './components/Graphics';
import { calculateCurrentStreak, getAchievementStatus, dateKeyFromDate, getHistoryColor, PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS, publicAsset, graphicAsset, collectAllGraphicAssetUrls, preloadGraphicUrls, buildPracticeTestChartSeries } from './utils';
import { Bubble, SeaCreature } from './components/OceanElements';
import { LevelSection } from './components/LevelSection';
import { AchievementsSection } from './components/AchievementsSection';
import { QuestionButtons } from './components/QuestionButtons';
import { PracticeTestScoresChart, type PracticeTestChartPress } from './components/PracticeTestScoresChart';
import { HARD_ASS_STATEMENTS } from './warningCopy';
import type { Level, Achievement } from './types';

type LogWinTier = 60 | 70 | 80;

type GreatProgressPendingState = {
  id: number;
  bonusQuestions: number;
  deltaPoints: number;
  previousScore: number;
  newScore: number;
  highlightDateKey: string;
};

export default function App() {
  // --- State ---
  const [dailyQuestions, setDailyQuestions] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('dailyQuestions') : null;
    return saved ? parseInt(saved) : 0;
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

  const [history, setHistory] = useState<Record<string, number>>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('history') : null;
    return saved ? JSON.parse(saved) : {};
  });

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
  const [showPracticeTestEntryModal, setShowPracticeTestEntryModal] = useState(false);
  const [showLogWinCountModal, setShowLogWinCountModal] = useState(false);
  const [logWinTier, setLogWinTier] = useState<LogWinTier | null>(null);
  const [logWinQuestionDraft, setLogWinQuestionDraft] = useState('');
  const [showLogWinCelebrateModal, setShowLogWinCelebrateModal] = useState(false);
  const [logWinCelebrate, setLogWinCelebrate] = useState<{
    bonusQuestions: number;
    tier: LogWinTier;
    questionsCovered: number;
    newDailyTotal: number;
  } | null>(null);
  const [practiceTestEntryIntent, setPracticeTestEntryIntent] = useState<'completed' | 'adminPlus' | null>(null);
  const [practiceTestEntryQuestions, setPracticeTestEntryQuestions] = useState('');
  const [practiceTestEntryScore, setPracticeTestEntryScore] = useState('');
  const [greatProgressPending, setGreatProgressPending] = useState<GreatProgressPendingState | null>(null);
  const [showGreatProgressModal, setShowGreatProgressModal] = useState(false);
  const [greatProgressSnapshot, setGreatProgressSnapshot] = useState<Omit<GreatProgressPendingState, 'id'> | null>(null);
  const greatProgressBonusAppliedIds = useRef<Set<number>>(new Set());
  const [practiceScoreSpotlight, setPracticeScoreSpotlight] = useState<{
    dateKey: string;
    testNumber: number;
    draft: string;
    isLatest: boolean;
    hadScore: boolean;
  } | null>(null);
  const [adminHistoryPracticeScoreDraft, setAdminHistoryPracticeScoreDraft] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showAchievementCelebration, setShowAchievementCelebration] = useState(false);
  const [lastAchievedIds, setLastAchievedIds] = useState<string[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lastAchievedIds') : null;
    return saved ? JSON.parse(saved) : [];
  });
  const [levelMusic, setLevelMusic] = useState<HTMLAudioElement | null>(null);
  const [simulatedTime, setSimulatedTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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
  const isPracticeTestMissionCompleteToday = Boolean(practiceTestCompletionDates[todayKey]);

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

  const checkMilestones = (
    newDaily: number,
    newTotal: number,
    newHistory: Record<string, number> = history,
    practiceTestsForAchievementCheck?: number
  ) => {
    const practiceTestsUsed = practiceTestsForAchievementCheck ?? totalPracticeTests;
    // 1. Check for level up
    let newLevelIndex = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (newTotal >= LEVELS[i].min) {
        newLevelIndex = i;
        break;
      }
    }

    if (newLevelIndex > lastLevel) {
      const level = LEVELS[newLevelIndex];
      const levelUpMsg = isWarningMode 
        ? `You've grown into a ${level.name}, but you're still just prey.` 
        : SILLY_STATEMENTS[level.name]?.levelUp || `You've reached level ${level.name}!`;
      setGoalMessage(levelUpMsg);
      
      setLastLevel(newLevelIndex);
      localStorage.setItem('lastLevel', newLevelIndex.toString());
    }

    // 2. Check for achievements (merge today's count so streak math sees the value from this click)
    const todayStr = dateKeyFromDate(effectiveTime);
    const historyForAchievements = { ...newHistory, [todayStr]: newDaily };
    const newlyAchieved = ACHIEVEMENTS.filter(
      (a) =>
        getAchievementStatus(a, newTotal, historyForAchievements, effectiveTime, practiceTestsUsed) &&
        !lastAchievedIds.includes(a.id)
    );
    if (newlyAchieved.length > 0) {
      const latest = newlyAchieved[newlyAchieved.length - 1];
      setSelectedAchievement(latest);
      setShowAchievementCelebration(true);
      setLastAchievedIds(prev => {
        const next = [...prev, ...newlyAchieved.map(a => a.id)];
        localStorage.setItem('lastAchievedIds', JSON.stringify(next));
        return next;
      });
      triggerFireworks();

      if (!isMuted) {
        const music = new Audio(publicAsset('assets/dancemusic.mp3'));
        music.loop = true;
        music.volume = 0.5;
        music.play().catch(err => console.error("Achievement music failed:", err));
        setLevelMusic(music);
      }
    }
  };

  const isSleepMode = useMemo(() => {
    const hours = effectiveTime.getHours();
    return hours >= 0 && hours < 4;
  }, [effectiveTime]);

  useEffect(() => {
    const checkWarningMode = () => {
      const hours = effectiveTime.getHours();
      
      // After 6pm, if questions <= 80, turn ON. If > 80, turn OFF.
      if (hours >= 18) {
        if (dailyQuestions <= 80) {
          setIsWarningMode(true);
        } else {
          setIsWarningMode(false);
        }
      }
    };
    checkWarningMode();
  }, [dailyQuestions, effectiveTime]);

  useEffect(() => {
    localStorage.setItem('isWarningMode', isWarningMode.toString());
  }, [isWarningMode]);

  useEffect(() => {
    localStorage.setItem('selectedVariants', JSON.stringify(selectedVariants));
  }, [selectedVariants]);

  // --- Derived State ---
  const currentLevelIndex = useMemo(() => {
    let index = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalQuestions >= LEVELS[i].min) {
        index = i;
        break;
      }
    }
    return index;
  }, [totalQuestions]);

  const currentLevel = LEVELS[currentLevelIndex];
  const nextLevel = LEVELS[currentLevelIndex + 1];
  const questionsToNext = nextLevel ? nextLevel.min - totalQuestions : 0;

  const currentLevelVariants = LEVEL_VARIANTS[currentLevel.graphic] || [currentLevel.graphic];
  const unlockedVariants = currentLevelVariants.filter(variant => {
    if (variant === currentLevel.graphic) return true;
    const achievement = ACHIEVEMENTS.find(a => a.image === variant);
    return achievement ? getAchievementStatus(achievement, totalQuestions, history, effectiveTime, totalPracticeTests) : false;
  });

  const defaultVariant = unlockedVariants[unlockedVariants.length - 1];
  const displayVariant = (selectedVariants[currentLevel.graphic] && unlockedVariants.includes(selectedVariants[currentLevel.graphic])) 
    ? selectedVariants[currentLevel.graphic] 
    : defaultVariant;


  const daysUntilExam = Math.ceil((EXAM_DATE.getTime() - effectiveTime.getTime()) / (1000 * 60 * 60 * 24));

  // --- Effects ---
  useEffect(() => {
    // Warm the HTTP cache for every graphic used in levels, achievements, variants, and modals
    // so first open (e.g. Log a Win celebration) does not wait on a cold network fetch.
    preloadGraphicUrls(collectAllGraphicAssetUrls());
  }, []);

  useEffect(() => {
    localStorage.setItem('dailyQuestions', dailyQuestions.toString());
  }, [dailyQuestions]);

  useEffect(() => {
    localStorage.setItem('totalQuestions', totalQuestions.toString());
    
    // Update history for today (using local date string)
    const todayStr = dateKeyFromDate(effectiveTime);
    
    setHistory(prev => {
      const newHistory = { ...prev, [todayStr]: dailyQuestions };
      localStorage.setItem('history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, [totalQuestions, currentLevelIndex, lastLevel, isMuted, lastAchievedIds]);

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
    // Lock body scroll when any modal is open
    const isAnyModalOpen =
      showGoalModal ||
      showRecordDayModal ||
      showSettingsModal ||
      showImageViewer ||
      showPracticeTestEntryModal ||
      showLogWinCountModal ||
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
  }, [showGoalModal, showRecordDayModal, showSettingsModal, showImageViewer, showPracticeTestEntryModal, showLogWinCountModal, showLogWinCelebrateModal, showGreatProgressModal, practiceScoreSpotlight, selectedHistoryDate]);

  // --- Handlers ---
  const addQuestions = (amount: number, practiceTestsForAchievementCheck?: number) => {
    const newDaily = Math.max(0, dailyQuestions + amount);
    const diff = newDaily - dailyQuestions;
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
    const hitDailyGoal = newDaily >= DAILY_GOAL && dailyQuestions < DAILY_GOAL;
    
    // Play interaction sounds
    if (!isMuted && amount !== 0) {
      let soundPath = amount > 0 ? publicAsset('assets/bubble_up.mp3') : publicAsset('assets/bubble_down.mp3');
      
      // Special sound for reaching daily goal (180)
      if (hitDailyGoal && amount > 0) {
        soundPath = publicAsset('assets/fireworks.mp3');
      } else if (canShowRecordDayModal && amount > 0) {
        soundPath = publicAsset('assets/fireworks.mp3');
      }

      console.log(`Playing sound: ${soundPath}`);
      const audio = new Audio(soundPath);
      audio.volume = 0.7;
      audio.play().catch(err => console.error("Audio play failed:", err));
    }

    // Update Statement on +10
    if (amount > 0) {
      if (isWarningMode) {
        const randomMsg = HARD_ASS_STATEMENTS[Math.floor(Math.random() * HARD_ASS_STATEMENTS.length)];
        setGoalMessage(randomMsg);
      } else {
        const levelStats = SILLY_STATEMENTS[currentLevel.name];
        const category = newDaily >= MILESTONE_1 ? 'high' : 'moderate';
        const randomMsg = levelStats[category][Math.floor(Math.random() * 10)];
        setGoalMessage(randomMsg);
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
    checkMilestones(newDaily, newTotal, history, practiceTestsForAchievementCheck);
  };

  useEffect(() => {
    if (!greatProgressPending) return;
    if (showAchievementCelebration) return;
    if (greatProgressBonusAppliedIds.current.has(greatProgressPending.id)) return;
    greatProgressBonusAppliedIds.current.add(greatProgressPending.id);

    const p = greatProgressPending;
    setGreatProgressPending(null);
    addQuestions(p.bonusQuestions);
    setGreatProgressSnapshot({
      bonusQuestions: p.bonusQuestions,
      deltaPoints: p.deltaPoints,
      previousScore: p.previousScore,
      newScore: p.newScore,
      highlightDateKey: p.highlightDateKey,
    });
    setShowGreatProgressModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only when achievement UI clears after practice-test submit
  }, [greatProgressPending, selectedAchievement, showAchievementCelebration]);

  const dismissAchievementView = () => {
    setSelectedAchievement(null);
    setShowAchievementCelebration(false);
    if (levelMusic) {
      levelMusic.pause();
      setLevelMusic(null);
    }
  };

  const openLogWinTier = (tier: LogWinTier) => {
    setLogWinTier(tier);
    setLogWinQuestionDraft('');
    setShowLogWinCountModal(true);
  };

  const cancelLogWinCountModal = () => {
    setShowLogWinCountModal(false);
    setLogWinTier(null);
    setLogWinQuestionDraft('');
  };

  const confirmLogWin = () => {
    if (!logWinTier) return;
    const n = parseInt(logWinQuestionDraft.replace(/,/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    const bonusQuestions = Math.round((logWinTier / 100) * n);
    if (bonusQuestions <= 0) return;

    const newDailyTotal = dailyQuestions + bonusQuestions;
    addQuestions(bonusQuestions);
    setLogWinCelebrate({
      bonusQuestions,
      tier: logWinTier,
      questionsCovered: n,
      newDailyTotal,
    });
    setShowLogWinCountModal(false);
    setLogWinTier(null);
    setLogWinQuestionDraft('');
    triggerModerateCelebration();
    setShowLogWinCelebrateModal(true);
  };

  const triggerModerateCelebration = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00BFFF', '#1E90FF', '#ADD8E6']
    });
  };

  const clearAllData = () => {
    setDailyQuestions(0);
    setTotalQuestions(0);
    setLastLevel(0);
    setPracticeTestCompletionDates({});
    setPracticeTestScores({});
    setTotalPracticeTests(0);
    setGreatProgressPending(null);
    setShowGreatProgressModal(false);
    setGreatProgressSnapshot(null);
    greatProgressBonusAppliedIds.current.clear();
    setPracticeScoreSpotlight(null);
    setHistory({});
    setLastAchievedIds(['plankton']);
    setIsTestMode(false);
    setIsWarningMode(false);

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
          const audio = new Audio(publicAsset('assets/fireworks.mp3'));
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

  const celebratePracticeTestAchievements = (nextPracticeTests: number) => {
    const newlyAchieved = ACHIEVEMENTS.filter(
      (a) =>
        PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS[a.id] !== undefined &&
        getAchievementStatus(a, totalQuestions, history, effectiveTime, nextPracticeTests) &&
        !lastAchievedIds.includes(a.id)
    );
    if (newlyAchieved.length === 0) return;
    const latest = newlyAchieved[newlyAchieved.length - 1];
    setSelectedAchievement(latest);
    setShowAchievementCelebration(true);
    setLastAchievedIds((prev) => {
      const next = [...prev, ...newlyAchieved.map((b) => b.id)];
      localStorage.setItem('lastAchievedIds', JSON.stringify(next));
      return next;
    });
    triggerFireworks();
    if (!isMuted) {
      const music = new Audio(publicAsset('assets/dancemusic.mp3'));
      music.loop = true;
      music.volume = 0.5;
      music.play().catch((err) => console.error('Achievement music failed:', err));
      setLevelMusic(music);
    }
  };

  useEffect(() => {
    if (!selectedHistoryDate) {
      setAdminHistoryPracticeScoreDraft('');
      return;
    }
    const v = practiceTestScores[selectedHistoryDate.dateKey];
    setAdminHistoryPracticeScoreDraft(v !== undefined ? String(v) : '');
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

  const handlePracticeChartPress = useCallback((payload: PracticeTestChartPress) => {
    setPracticeScoreSpotlight({
      dateKey: payload.dateKey,
      testNumber: payload.testNumber,
      draft: payload.score !== null ? String(payload.score) : '',
      isLatest: payload.isLatest,
      hadScore: payload.score !== null,
    });
  }, []);

  const dismissPracticeScoreSpotlight = useCallback(() => setPracticeScoreSpotlight(null), []);

  const savePracticeScoreSpotlight = () => {
    if (!practiceScoreSpotlight) return;
    applyPracticeTestScoreForDate(practiceScoreSpotlight.dateKey, practiceScoreSpotlight.draft.trim());
    setPracticeScoreSpotlight(null);
  };

  const submitPracticeTestEntry = () => {
    if (!practiceTestEntryIntent) return;
    const q = Math.max(0, Math.floor(Number(practiceTestEntryQuestions)) || 0);
    const scoreRaw = practiceTestEntryScore.trim();
    let parsedScore: number | undefined;
    if (scoreRaw !== '') {
      const p = parseFloat(scoreRaw);
      if (!Number.isNaN(p)) parsedScore = p;
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
      const bonusQuestions = Math.round(deltaPoints * 20);
      if (bonusQuestions > 0) {
        greatProgressQueued = {
          id: Date.now() + Math.random(),
          bonusQuestions,
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

    if (q > 0) {
      addQuestions(q, practiceTestsAfterSubmit);
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

    if (greatProgressQueued) {
      setGreatProgressPending(greatProgressQueued);
    }
  };

  const cancelPracticeTestEntry = () => {
    setShowPracticeTestEntryModal(false);
    setPracticeTestEntryIntent(null);
    setPracticeTestEntryQuestions('');
    setPracticeTestEntryScore('');
  };

  const removeTodayPracticeTestRecord = () => {
    if (!practiceTestCompletionDates[todayKey]) return;
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

  const getStreakFlameStyle = (streak: number): { className: string; style?: React.CSSProperties } => {
    if (streak <= 1) {
      return {
        className: 'w-6 h-6 shrink-0 text-yellow-300 opacity-30',
        style: { transform: 'scale(0.9)' },
      };
    }

    if (streak === 2) {
      return {
        className: 'w-6 h-6 shrink-0 text-yellow-300 opacity-70',
        style: { transform: 'scale(0.9)' },
      };
    }

    if (streak === 3) {
      return {
        className: 'w-6 h-6 shrink-0 text-yellow-300 opacity-80',
        style: {
          transform: 'scale(1)',
          filter: 'drop-shadow(0 0 8px rgba(249,115,22,1)) drop-shadow(0 0 8px rgba(249,115,22,0.8))',
        },
      };
    }

    if (streak === 4) {
      return {
        className: 'w-6 h-6 shrink-0 text-yellow-300 opacity-90',
        style: {
          transform: 'scale(1.1)',
          filter: 'drop-shadow(0 0 12px rgba(249,115,22,0.8)) drop-shadow(0 0 28px rgba(249,115,22,0.8))',
        },
      };
    }

    return {
      className: 'w-6 h-6 shrink-0 text-white opacity-100',
      style: {
        transform: 'scale(1.3)',
        filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.7)) drop-shadow(0 0 8px rgba(251,146,60,0.7))',
      },
    };
  };

  const getRecordIconStyle = (isNewRecordToday: boolean): { className: string; style?: React.CSSProperties } => {
    if (!isNewRecordToday) {
      return { className: 'w-6 h-6 text-zinc-300 opacity-70' };
    }

    return {
      className: 'w-6 h-6 shrink-0 text-white opacity-100',
      style: {
        filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.7)) drop-shadow(0 0 18px rgba(250,204,21,0.7))',
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
    const newlyAchieved = ACHIEVEMENTS.filter(a => getAchievementStatus(a, newTotal, newHistory, today, totalPracticeTests) && !lastAchievedIds.includes(a.id));
    if (newlyAchieved.length > 0) {
      const latest = newlyAchieved[newlyAchieved.length - 1];
      setSelectedAchievement(latest);
      setShowAchievementCelebration(true);
      setLastAchievedIds(prev => {
        const next = [...prev, ...newlyAchieved.map(a => a.id)];
        localStorage.setItem('lastAchievedIds', JSON.stringify(next));
        return next;
      });
      triggerFireworks();

      if (!isMuted) {
        const music = new Audio(publicAsset('assets/dancemusic.mp3'));
        music.loop = true;
        music.volume = 0.5;
        music.play().catch(err => console.error("Achievement music failed:", err));
        setLevelMusic(music);
      }
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${
      isSleepMode 
        ? 'bg-gradient-to-b from-[#1a2a3a] via-[#101820] to-[#080c10] sleep-mode' 
        : isWarningMode 
          ? 'bg-[linear-gradient(180deg,#2a0a0a_0%,#100606_16%,#050505_32%,#060608_74%,#050818_100%)] warning-mode' 
          : 'bg-[linear-gradient(180deg,#AADFDF_0px,#96D4D4_120px,#7ec9e0_240px,#2a7eb8_22%,#154a78_52%,#0c2048_78%,#050818_100%)] font-sans'
    } text-white overflow-x-hidden relative transition-colors duration-1000`}>
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
                'repeating-linear-gradient(178deg, transparent 0px, transparent 42px, rgba(255,255,255,0.05) 42px, rgba(255,255,255,0.05) 43px)',
                'repeating-linear-gradient(182deg, transparent 0px, transparent 58px, rgba(0,28,64,0.08) 58px, rgba(0,28,64,0.08) 59px)',
                'repeating-linear-gradient(95deg, transparent 0px, transparent 120px, rgba(255,255,255,0.025) 120px, rgba(255,255,255,0.025) 122px)',
              ].join(', '),
            }}
          />
        )}
        {!isWarningMode && !isSleepMode && [...Array(40)].map((_, i) => (
          <Bubble key={`bubble-${i}`} delay={i * 0.3} size={4 + Math.random() * 20} />
        ))}
        {isSleepMode && [...Array(20)].map((_, i) => (
          <div key={`sleep-${i}`} className="absolute rounded-full bg-blue-400/10 animate-pulse" style={{ width: 10 + Math.random() * 50, height: 10 + Math.random() * 50, left: Math.random() * 100 + '%', top: Math.random() * 100 + '%' }} />
        ))}
        {isWarningMode && !isSleepMode && [...Array(20)].map((_, i) => (
          <div key={`warning-${i}`} className="absolute rounded-full bg-red-900/20 animate-pulse" style={{ width: 10 + Math.random() * 50, height: 10 + Math.random() * 50, left: Math.random() * 100 + '%', top: Math.random() * 100 + '%' }} />
        ))}
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Barracuda" : "Sardine"} delay={0} y="20%" />
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Great White Shark" : "Barracuda"} delay={5} y="40%" />
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Barracuda" : "Flying Fish"} delay={10} y="15%" />
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Great White Shark" : "Krill"} delay={15} y="85%" />
        <SeaCreature graphic={isSleepMode ? "Blue Whale" : isWarningMode ? "Blue Whale" : "Blue Whale"} delay={20} y="60%" />
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Barracuda" : "Seahorse"} delay={25} y="30%" />
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Great White Shark" : "Sardine"} delay={7} y="70%" />
        <SeaCreature graphic={isSleepMode ? "Sea Snail" : isWarningMode ? "Barracuda" : "Flying Fish"} delay={12} y="50%" />
      </div>

      {/* --- Header --- */}
      <header className="relative z-20 shrink-0 w-full px-6 py-4 flex justify-between items-center bg-white/5 backdrop-blur-md border-b border-white/10 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2 px-1 sm:px-4 py-1 sm:py-2">
            <Anchor className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-black text-xs uppercase tracking-[0.2em] header-text">Step 2 It Up!</span>
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
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/30 transition-all active:scale-95 shadow-lg text-white"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/30 transition-all active:scale-95 shadow-lg text-white"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Progress & Actions */}
        <div className="flex flex-col gap-8">
          {/* Question Tracker — uses `.section-panel-ocean-frost` (see index.css) */}
          <section className="section-panel-ocean-frost p-6 flex flex-col items-center text-center gap-6">
            {(isWarningMode || isSleepMode) && (
              <div
                className={`section-panel-ocean-frost-overlay animate-pulse ${isSleepMode ? 'section-panel-ocean-frost-glow-sleep' : 'section-panel-ocean-frost-glow-warning'}`}
              />
            )}
            <motion.div 
              key={dailyQuestions}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <span className={`${isSleepMode ? 'text-6xl md:text-8xl text-blue-200/80' : isWarningMode ? 'text-6xl md:text-8xl text-white/80' : 'text-7xl md:text-9xl text-yellow-300'} font-black drop-shadow-[0_15px_35px_rgba(0,0,0,0.5)] leading-none`}>
                  {dailyQuestions}
                </span>
              <span className="text-2xl font-bold opacity-90 mt-4 tracking-wide">Questions Done Today</span>
              <div className="w-full mt-2">
                <QuestionButtons onUpdate={addQuestions} isTestMode={isTestMode} isWarningMode={isWarningMode} isSleepMode={isSleepMode} />
              </div>
            </motion.div>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="h-12 w-full bg-black/30 rounded-full overflow-hidden border-2 border-white/30 p-1.5 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (dailyQuestions / DAILY_GOAL) * 100)}%` }}
                  className={`h-full rounded-full ${isSleepMode ? 'bg-gradient-to-r from-blue-900 to-slate-900 shadow-[0_0_20px_rgba(96,165,250,0.6)]' : isWarningMode ? 'bg-gradient-to-r from-red-900 to-black shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 shadow-[0_0_20px_rgba(34,211,238,0.6)]'}`}
                />
              </div>
              <div className="text-center text-sm font-black uppercase tracking-[0.3em] opacity-80">
                Daily Goal: {DAILY_GOAL}
              </div>
            </div>

            {/* Action Buttons removed */}

            {/* Motivation */}
            {!isWarningMode && getMotivation() && (
              <div className="text-3xl font-medium text-yellow-100 drop-shadow-md text-center px-6 flex items-center justify-center min-h-[4rem]">
                {getMotivation()}
              </div>
            )}
          </section>

          {(isWarningMode || isSleepMode) && (
            <section className="section-panel-ocean-frost p-6 flex flex-col items-center text-center gap-6 lg:hidden">
              <div
                className={`section-panel-ocean-frost-overlay animate-pulse ${isSleepMode ? 'section-panel-ocean-frost-glow-sleep' : 'section-panel-ocean-frost-glow-warning'}`}
              />
              <img 
                src={isSleepMode ? graphicAsset('sleepingsalmon') : graphicAsset('anglerfishangry')} 
                alt={isSleepMode ? "Sleeping Salmon" : "Anglerfish"} 
                className="w-full h-auto max-h-[400px] object-contain relative z-10" 
              />
              <p className={`${isSleepMode ? 'text-blue-300' : 'text-red-500'} font-black text-2xl italic relative z-10`}>
                {isSleepMode ? "It's time to rest..." : (goalMessage || "The abyss is watching.")}
              </p>
            </section>
          )}

          {/* Level Section (Mobile Reorder) */}
          <div className="lg:hidden">
            <LevelSection
              currentLevel={currentLevel}
              currentLevelIndex={currentLevelIndex}
              displayVariant={displayVariant}
              isWarningMode={isWarningMode}
              nextLevel={nextLevel}
              questionsToNext={questionsToNext}
              unlockedVariantsCount={unlockedVariants.length}
              setShowImageViewer={setShowImageViewer}
              setShowVariantModal={setShowVariantModal}
              setShowLevelMap={setShowLevelMap}
            />
          </div>

          {/* Practice Test Reminder */}
          <div className="section-panel-ocean-frost p-6 flex flex-col sm:flex-row items-center gap-6 font-black text-lg uppercase transition-all duration-500">
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
          </div>

          {/* Log a Win */}
          <section className="section-panel-ocean-frost p-6 flex flex-col gap-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center">Log a Win</h2>
            <p className="text-center text-white/80 font-bold text-sm max-w-md mx-auto">
              Tap your accuracy tier, then enter how many questions that block covered. We will add bonus questions to today&apos;s total based on your tier.
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full min-w-0">
              <button
                type="button"
                onClick={() => openLogWinTier(60)}
                className={`w-full min-w-0 py-4 sm:py-5 px-2 sm:px-4 rounded-2xl font-black text-[10px] sm:text-base md:text-xl uppercase tracking-tight sm:tracking-wide border-4 shadow-lg transition-all active:scale-[0.98] leading-tight ${
                  isSleepMode
                    ? 'bg-slate-700/80 border-slate-500 text-white hover:bg-slate-600'
                    : isWarningMode
                      ? 'bg-red-950/80 border-red-600 text-white hover:bg-red-900'
                      : 'bg-gradient-to-r from-amber-400 to-orange-400 border-amber-200 text-slate-900 hover:brightness-105'
                }`}
              >
                &gt; 60% Correct
              </button>
              <button
                type="button"
                onClick={() => openLogWinTier(70)}
                className={`w-full min-w-0 py-4 sm:py-5 px-2 sm:px-4 rounded-2xl font-black text-[10px] sm:text-base md:text-xl uppercase tracking-tight sm:tracking-wide border-4 shadow-lg transition-all active:scale-[0.98] leading-tight ${
                  isSleepMode
                    ? 'bg-slate-700/80 border-slate-500 text-white hover:bg-slate-600'
                    : isWarningMode
                      ? 'bg-red-950/80 border-red-600 text-white hover:bg-red-900'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 border-cyan-200 text-slate-900 hover:brightness-105'
                }`}
              >
                &gt; 70% Correct
              </button>
              <button
                type="button"
                onClick={() => openLogWinTier(80)}
                className={`w-full min-w-0 py-4 sm:py-5 px-2 sm:px-4 rounded-2xl font-black text-[10px] sm:text-base md:text-xl uppercase tracking-tight sm:tracking-wide border-4 shadow-lg transition-all active:scale-[0.98] leading-tight ${
                  isSleepMode
                    ? 'bg-slate-700/80 border-slate-500 text-white hover:bg-slate-600'
                    : isWarningMode
                      ? 'bg-red-950/80 border-red-600 text-white hover:bg-red-900'
                      : 'bg-gradient-to-r from-fuchsia-400 to-purple-500 border-fuchsia-200 text-white hover:brightness-105'
                }`}
              >
                &gt; 80% Correct
              </button>
            </div>
          </section>

          {/* Footer Stats */}
          <section className="section-panel-ocean-frost p-6 space-y-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center">My Stats</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <BookOpen className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-yellow-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>{Object.values(history).reduce((a: number, b: number) => a + b, 0)}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Total Questions</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <Calendar className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-yellow-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>{daysUntilExam}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Days Till Step 2</span>
              </div>
              
              {/* New Row */}
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  {(() => {
                    const streak = calculateCurrentStreak(history, new Date());
                    const flameStyle = getStreakFlameStyle(streak);
                    const streakTextStyle = streak >= 3 ? { filter: flameStyle.style?.filter } : undefined;
                    const streakTextColorClass = streak >= 5 ? 'text-white' : 'text-yellow-300';
                    return (
                      <>
                        <Flame className={flameStyle.className} style={flameStyle.style} />
                        <span
                          className={`text-4xl font-black drop-shadow-md ${streakTextColorClass}`}
                          style={streakTextStyle}
                        >
                          {streak}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Current Streak</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-yellow-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>{totalPracticeTests}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Practice Tests</span>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-yellow-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>
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
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Avg Questions (Last 3 Days)</span>
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

                    return <Award className={recordIconStyle.className} style={recordIconStyle.style} />;
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
                    const recordIconStyle = getRecordIconStyle(isNewRecordToday);
                    const recordTextColorClass = isNewRecordToday ? 'text-white' : 'text-yellow-300';
                    return (
                      <span
                        className={`text-4xl font-black drop-shadow-md ${recordTextColorClass}`}
                        style={recordIconStyle.style}
                      >
                        {Math.max(...(Object.values(history) as number[]), 0)}
                      </span>
                    );
                  })()}
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Record Questions In Day</span>
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
          </section>
          <AchievementsSection 
            totalQuestions={totalQuestions} 
            totalPracticeTests={totalPracticeTests}
            history={history}
            effectiveTime={effectiveTime}
            setSelectedAchievement={setSelectedAchievement} 
            className="hidden lg:flex" 
          />
        </div>

        {/* Right Column: Level & Stats */}
        <div className="flex flex-col gap-8">
          {(isWarningMode || isSleepMode) && (
            <section className="section-panel-ocean-frost p-6 hidden lg:flex w-full flex-col items-center text-center gap-6 font-serious">
              <div
                className={`section-panel-ocean-frost-overlay animate-pulse ${isSleepMode ? 'section-panel-ocean-frost-glow-sleep' : 'section-panel-ocean-frost-glow-warning'}`}
              />
              <img 
                src={isSleepMode ? graphicAsset('sleepingsalmon') : graphicAsset('anglerfishangry')} 
                alt={isSleepMode ? "Sleeping Salmon" : "Anglerfish"} 
                className="w-full h-auto max-h-[400px] object-contain relative z-10" 
              />
              <p className={`${isSleepMode ? 'text-blue-300' : 'text-red-500'} font-black text-2xl italic relative z-10`}>
                {isSleepMode ? "It's time to rest..." : (goalMessage || "The abyss is watching.")}
              </p>
            </section>
          )}

          {/* Level Section */}
          <div className="hidden lg:block">
            <LevelSection
              currentLevel={currentLevel}
              currentLevelIndex={currentLevelIndex}
              displayVariant={displayVariant}
              isWarningMode={isWarningMode}
              nextLevel={nextLevel}
              questionsToNext={questionsToNext}
              unlockedVariantsCount={unlockedVariants.length}
              setShowImageViewer={setShowImageViewer}
              setShowVariantModal={setShowVariantModal}
              setShowLevelMap={setShowLevelMap}
            />
          </div>

          {/* History Section */}
          <section className="section-panel-ocean-frost p-6 flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-yellow-300" />
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">History</h2>
            </div>

            <div className="w-full space-y-6">
              {(() => {
                const rows = [];
                const startDate = new Date(2026, 3, 5); // April 5, 2026 (Local Time)
                const todayStr = dateKeyFromDate(effectiveTime);

                let cumulativeTotal = 0;
                // Add up history before start date
                Object.keys(history).forEach(dateStr => {
                  const [y, m, d] = dateStr.split('-').map(Number);
                  const date = new Date(y, m - 1, d);
                  if (date < startDate) {
                    cumulativeTotal += history[dateStr];
                  }
                });

                for (let week = 0; week < 8; week++) {
                  const weekCells = [];
                  const weekStart = new Date(startDate);
                  weekStart.setDate(startDate.getDate() + (week * 7));
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekStart.getDate() + 6);

                  const weekLabel = `Week ${week + 1}: ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                  let levelsReachedThisWeek: Level[] = [];

                  for (let day = 0; day < 7; day++) {
                    const date = new Date(weekStart);
                    date.setDate(weekStart.getDate() + day);
                    const dateKey = dateKeyFromDate(date);
                    const count = history[dateKey] || 0;
                    const isToday = dateKey === todayStr;
                    const isFuture = date > effectiveTime;
                    const isExamDay = dateKey === '2026-05-30';
                    const isTrophyOnLightBackground = count > 45;

                    cumulativeTotal += count;

                    // Check for level ups this week
                    LEVELS.forEach(level => {
                      if (cumulativeTotal >= level.min && cumulativeTotal - count < level.min) {
                        levelsReachedThisWeek.push(level);
                      }
                    });

                    const dynamicColor = !isSleepMode && !isWarningMode && !isExamDay && !(isFuture && !isTestMode) ? getHistoryColor(count) : null;

                    weekCells.push(
                      <div 
                        key={dateKey}
                        onClick={() => setSelectedHistoryDate({ date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), count, dateKey, isExamDay })}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-black cursor-pointer transition-all hover:scale-110 active:scale-95 relative ${
                          isExamDay
                            ? 'bg-red-600 border-red-400 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                            : isFuture && !isTestMode
                              ? 'bg-white/5 border-white/5 text-white/20'
                              : dynamicColor
                                ? '' 
                                : isToday
                                  ? 'bg-white/20 border-white/60 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                  : count >= 180
                                    ? 'bg-green-500 border-green-400 text-white'
                                    : count >= 120
                                      ? 'bg-yellow-500 border-yellow-400 text-white'
                                      : count > 0
                                        ? 'bg-red-500 border-red-400 text-white'
                                        : 'bg-white/10 border-white/10 text-white/40'
                        }`}
                        style={dynamicColor ? {
                          backgroundColor: dynamicColor,
                          borderColor: isToday ? 'rgba(255, 255, 255, 0.8)' : dynamicColor,
                          color: count > 45 ? 'black' : 'white',
                          boxShadow: isToday ? '0 0 15px rgba(255, 255, 255, 0.3)' : 'none'
                        } : {}}
                      >
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

                  rows.push(
                    <div key={week} className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{weekLabel}</span>
                        {levelsReachedThisWeek.length > 0 && (
                          <div className="flex gap-1">
                            {levelsReachedThisWeek.map((l, idx) => (
                              <span key={`${l.name}-${idx}`} title={`Reached ${l.name}`} className="text-xs">{l.emoji}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {weekCells}
                      </div>
                    </div>
                  );
                }
                return rows;
              })()}
            </div>
          </section>

          <AchievementsSection 
            totalQuestions={totalQuestions} 
            totalPracticeTests={totalPracticeTests}
            history={history}
            effectiveTime={effectiveTime}
            setSelectedAchievement={setSelectedAchievement} 
            className="lg:hidden" 
          />
        </div>

      </main>

      {/* Sea floor — end of page (scroll to see) */}
      <div
        className={`relative z-10 w-full h-40 shrink-0 ${
          isSleepMode
            ? 'bg-gradient-to-t from-[#1a2a3a] to-black'
            : isWarningMode
              ? 'bg-gradient-to-t from-red-950 to-black'
              : 'bg-gradient-to-t from-[#7a654a] to-[#a68d71]'
        } flex items-end justify-around px-4 overflow-hidden pointer-events-none`}
      >
        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/sandpaper.png')] pointer-events-none" />
        <SeaweedGraphic className="w-8 h-32 mb-0 opacity-80" />
        <CoralGraphic className="w-12 h-12 mb-2 opacity-90" color={isSleepMode ? "#334155" : isWarningMode ? "#7f1d1d" : "#f87171"} />
        <div className="text-4xl mb-4 animate-bounce">{isSleepMode ? "" : isWarningMode ? "" : ""}</div>
        <SeaweedGraphic className="w-10 h-40 mb-0 opacity-70" />
        <div className="text-5xl mb-2">{isSleepMode ? "" : isWarningMode ? "" : ""}</div>
        <CoralGraphic className="w-16 h-16 mb-1 opacity-90" color={isSleepMode ? "#475569" : isWarningMode ? "#991b1b" : "#fb7185"} />
        <SeaweedGraphic className="w-6 h-24 mb-0 opacity-80" />
        <div className="text-4xl mb-6 animate-pulse">{isSleepMode ? "" : isWarningMode ? "" : ""}</div>
        <CoralGraphic className="w-10 h-10 mb-3 opacity-90" color={isSleepMode ? "#1e293b" : isWarningMode ? "#b91c1c" : "#f472b6"} />
        <SeaweedGraphic className="w-12 h-36 mb-0 opacity-60" />
        <div className="text-3xl mb-2">{isSleepMode ? "" : isWarningMode ? "" : ""}</div>
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {/* Practice test completion: questions & score (before achievement celebration) */}
        {showPracticeTestEntryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className="bg-white rounded-[2rem] max-w-sm w-full border-4 border-cyan-400 shadow-2xl p-8 text-left"
            >
              <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                Log practice test
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-6">
                Add how many questions were on the test and your score. Your daily question count will include the questions from this test.
              </p>
              <div className="space-y-4 mb-8">
                <div>
                  <label htmlFor="practice-test-q" className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Questions included in the test
                  </label>
                  <input
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
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={cancelPracticeTestEntry}
                  className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPracticeTestEntry}
                  className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white border-b-4 border-cyan-900 hover:bg-cyan-500 transition-all active:scale-[0.98]"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showGreatProgressModal && greatProgressSnapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className="bg-white rounded-[2rem] max-w-md w-full border-4 border-emerald-400 shadow-2xl p-8 text-left max-h-[90vh] overflow-y-auto"
            >
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

              <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 px-4 py-4 mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-2">
                  Bonus questions today
                </p>
                <p className="text-base font-bold text-emerald-950 leading-snug">
                  +{greatProgressSnapshot.bonusQuestions} questions added to your daily question count ({greatProgressSnapshot.deltaPoints}{' '}
                  point{greatProgressSnapshot.deltaPoints === 1 ? '' : 's'} improvement × 20). Score went from{' '}
                  {greatProgressSnapshot.previousScore} to {greatProgressSnapshot.newScore}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowGreatProgressModal(false);
                  setGreatProgressSnapshot(null);
                }}
                className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-emerald-600 text-white border-b-4 border-emerald-900 hover:bg-emerald-500 transition-all active:scale-[0.98]"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}

        {practiceScoreSpotlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[93] flex items-center justify-center p-6 bg-[#001a2c]/95 backdrop-blur-md"
            onClick={dismissPracticeScoreSpotlight}
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-[2rem] w-full border-4 border-cyan-400 shadow-2xl p-8 text-left max-h-[90vh] overflow-y-auto ${
                practiceScoreSpotlight.isLatest ? 'max-w-lg' : 'max-w-sm'
              }`}
            >
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
                  <p className="text-sm text-gray-600 font-medium mb-6 text-center">
                    Every practice test builds momentum — log or update your score below anytime.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                    {practiceScoreSpotlight.hadScore ? 'Edit practice test score' : 'Add practice test score'}
                  </h3>
                  <p className="text-sm text-gray-600 font-medium mb-6">
                    Test #{practiceScoreSpotlight.testNumber}
                  </p>
                </>
              )}

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
                  className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white border-b-4 border-cyan-900 hover:bg-cyan-500 transition-all active:scale-[0.98]"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Log a Win: question count */}
        {showLogWinCountModal && logWinTier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[91] flex items-center justify-center p-6 bg-[#001a2c]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className="bg-white rounded-[2rem] max-w-sm w-full border-4 border-cyan-400 shadow-2xl p-8 text-left"
            >
              <h3 className="text-xl font-black uppercase tracking-tight text-blue-950 mb-2">
                Questions at this accuracy
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-6">
                How many questions did your &gt; {logWinTier}% correct session cover?
              </p>
              <div className="mb-8">
                <label htmlFor="log-win-q" className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                  Number of questions
                </label>
                <input
                  id="log-win-q"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={logWinQuestionDraft}
                  onChange={(e) => setLogWinQuestionDraft(e.target.value)}
                  placeholder="e.g. 40"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-blue-950 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={cancelLogWinCountModal}
                  className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogWin}
                  disabled={
                    !Number.isFinite(parseInt(logWinQuestionDraft.replace(/,/g, ''), 10)) ||
                    parseInt(logWinQuestionDraft.replace(/,/g, ''), 10) <= 0
                  }
                  className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-600 text-white border-b-4 border-cyan-900 hover:bg-cyan-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Log a Win: celebration */}
        {showLogWinCelebrateModal && logWinCelebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[92] flex items-center justify-center p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className="bg-white rounded-[3rem] max-w-sm lg:max-w-md w-full text-center border-8 border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.35)] relative max-h-[85vh] overflow-y-auto overflow-x-hidden"
            >
              <div className="w-full max-h-[250px] h-[250px] overflow-hidden rounded-t-[2.2rem] bg-cyan-50">
                <motion.img
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={
                    logWinCelebrate.tier === 80
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
              <div className="p-8 pt-6 relative z-10 space-y-5">
                {logWinCelebrate.tier === 80 && (
                  <h2 className="text-fuchsia-600 text-3xl sm:text-4xl font-black uppercase leading-none">
                    You&apos;re a rockstar!
                  </h2>
                )}
                <div className="space-y-2">
                  <p className="text-cyan-800 font-bold text-base leading-snug">
                    {logWinCelebrate.tier === 60 &&
                      'Double Thumbs Up Salmon is beaming—you earned this accuracy and every bit of credit toward your streak.'}
                    {logWinCelebrate.tier === 70 &&
                      'Scholar Salmon tips their mortarboard: your discipline shows, and they could not be prouder of how you studied.'}
                    {logWinCelebrate.tier === 80 &&
                      'Rockstar Salmon is shouting encore—you crushed that block with style, and the reef is buzzing with pride.'}
                  </p>
                </div>
                <div className="bg-cyan-50 p-4 rounded-2xl border-2 border-cyan-100 space-y-2 text-left">
                  <div className="flex justify-between gap-4 text-sm font-bold text-cyan-950">
                    <span>Bonus questions ({logWinCelebrate.tier}% × {logWinCelebrate.questionsCovered} Q)</span>
                    <span className="font-black tabular-nums">+{logWinCelebrate.bonusQuestions}</span>
                  </div>
                  <p className="text-cyan-700 text-sm font-medium">
                    These {logWinCelebrate.bonusQuestions} bonus questions are added to your questions done today. You&apos;re now at{' '}
                    <span className="font-black text-cyan-900">{logWinCelebrate.newDailyTotal}</span> for the day.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogWinCelebrateModal(false);
                    setLogWinCelebrate(null);
                  }}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 border-cyan-900 active:scale-95 transition-all"
                >
                  Awesome!
                </button>
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
            className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#001a2c]/90 backdrop-blur-md"
          >
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className={`bg-white rounded-[3rem] w-full max-w-lg sm:max-w-xl lg:max-w-4xl xl:max-w-5xl max-h-[min(90dvh,900px)] text-center border-8 shadow-2xl relative flex flex-col min-h-0 overflow-hidden ${
                selectedHistoryDate.count >= DAILY_GOAL ? 'border-green-400' : 'border-gray-300'
              }`}
            >
              <div className="flex flex-col min-h-0 flex-1 max-h-[inherit]">
                <div className="flex shrink-0 items-center justify-between gap-4 p-6 sm:p-8 min-w-0">
                  <h2 className={`text-left text-lg sm:text-xl font-black uppercase tracking-tight break-words flex-1 min-w-0 ${
                    selectedHistoryDate.count >= DAILY_GOAL ? 'text-green-900' : 'text-gray-900'
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

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-6 pb-4 custom-scrollbar">
                  {selectedHistoryDate.count >= 180 && !selectedHistoryDate.isExamDay && (
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
                        selectedHistoryDate.count >= DAILY_GOAL ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {selectedHistoryDate.count}
                      </div>
                      <div className={`${
                        selectedHistoryDate.count >= DAILY_GOAL ? 'text-green-400' : 'text-gray-400'
                      } text-sm font-black uppercase tracking-widest`}>
                        Questions Completed
                      </div>

                      {isTestMode && (
                        <div className="w-full max-w-full min-w-0 mt-1 px-0.5">
                          <QuestionButtons onUpdate={(amount) => updateHistoryCount(selectedHistoryDate.dateKey, selectedHistoryDate.count + amount)} isTestMode={isTestMode} isWarningMode={isWarningMode} isSleepMode={isSleepMode} isHistoryModal={true} />
                        </div>
                      )}

                      {practiceTestCompletionDates[selectedHistoryDate.dateKey] && (
                        <div className="w-full max-w-full min-w-0 mt-2 p-4 rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-white text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
                            <span className="font-black uppercase text-xs tracking-widest text-cyan-950">
                              Practice Test Completed
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-gray-800">
                            {practiceTestScores[selectedHistoryDate.dateKey] !== undefined
                              ? `Score: ${practiceTestScores[selectedHistoryDate.dateKey]}`
                              : 'Score not captured.'}
                          </p>
                        </div>
                      )}
                      {isTestMode && !selectedHistoryDate.isExamDay && (
                        <div className="w-full mt-2 flex flex-col items-stretch gap-3">
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer select-none justify-center">
                            <input
                              type="checkbox"
                              checked={Boolean(practiceTestCompletionDates[selectedHistoryDate.dateKey])}
                              onChange={(e) => {
                                const { dateKey } = selectedHistoryDate;
                                const checked = e.target.checked;
                                const wasChecked = Boolean(practiceTestCompletionDates[dateKey]);
                                if (checked === wasChecked) return;

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
                                  setAdminHistoryPracticeScoreDraft('');
                                }

                                setTotalPracticeTests((prev) => {
                                  const next = Math.max(0, prev + (checked ? 1 : -1));
                                  if (checked && next > prev) {
                                    celebratePracticeTestAchievements(next);
                                  }
                                  return next;
                                });
                              }}
                              className="h-4 w-4"
                            />
                            Practice Test complete?
                          </label>
                          {practiceTestCompletionDates[selectedHistoryDate.dateKey] && (
                            <div className="w-full text-left space-y-1">
                              <label
                                htmlFor="admin-practice-test-score"
                                className="block text-[10px] font-black uppercase tracking-widest text-gray-500"
                              >
                                Practice test score
                              </label>
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
                                placeholder="Enter score"
                                className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 font-black text-gray-900 focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => setSelectedHistoryDate(null)}
                  className={`shrink-0 w-full py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 active:scale-95 transition-all ${
                    selectedHistoryDate.isExamDay 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-800' 
                      : selectedHistoryDate.count >= DAILY_GOAL
                        ? 'bg-green-600 hover:bg-green-700 text-white border-green-900'
                        : 'bg-gray-600 hover:bg-gray-700 text-white border-gray-900'
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
            className="fixed inset-0 z-[70] bg-[#001a2c]/95 backdrop-blur-xl overflow-y-auto p-6"
          >
            <div className="max-w-4xl mx-auto py-12">
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
                  const isReached = totalQuestions >= level.min;
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
                            className="w-full h-full object-cover"
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
                        <div className="text-white/60 font-medium">{level.min} Questions Required</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className="bg-white rounded-[3rem] max-w-sm lg:max-w-md w-full border-8 border-blue-400 shadow-[0_0_50px_rgba(0,0,0,0.3)] relative max-h-[85vh] overflow-y-auto overflow-x-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-blue-900 text-3xl font-black uppercase">Settings</h2>
                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">General</div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-red-500" />
                        <span className="font-black uppercase text-sm text-blue-900">Warning Mode</span>
                      </div>
                      <button 
                        onClick={() => setIsWarningMode(!isWarningMode)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isWarningMode ? 'bg-red-500' : 'bg-gray-300'}`}
                      >
                        <motion.div 
                          animate={{ x: isWarningMode ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <span className="font-black uppercase text-sm text-blue-900">Admin Mode</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (isTestMode) {
                            setIsTestMode(false);
                            setShowTestCodeInput(false);
                          } else {
                            setShowTestCodeInput(true);
                          }
                        }}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isTestMode ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <motion.div 
                          animate={{ x: isTestMode ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    {showTestCodeInput && !isTestMode && (
                      <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] font-black uppercase text-blue-400">Enter Admin Code</p>
                        <div className="flex gap-2">
                          <input 
                            type="password"
                            maxLength={4}
                            value={testCodeInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTestCodeInput(val);
                              if (val === "6782") {
                                setIsTestMode(true);
                                setShowTestCodeInput(false);
                                setTestCodeInput("");
                              }
                            }}
                            placeholder="****"
                            className="w-full min-w-0 bg-white border-2 border-blue-200 rounded-xl px-4 py-2 text-center font-black tracking-[0.5em] text-blue-900 focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                    )}

                    {isTestMode && (
                      <div className="flex flex-col gap-2 p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">
                        <div className="text-blue-900 font-black text-xs uppercase tracking-widest">Current Time (Simulated)</div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="time" 
                            className="flex-1 bg-white border-2 border-blue-200 rounded-xl px-4 py-2 font-black text-blue-900 focus:outline-none focus:border-blue-400"
                            value={`${String(effectiveTime.getHours()).padStart(2, '0')}:${String(effectiveTime.getMinutes()).padStart(2, '0')}`}
                            onChange={(e) => {
                              const [h, m] = e.target.value.split(':').map(Number);
                              const newTime = new Date(effectiveTime);
                              newTime.setHours(h, m);
                              setSimulatedTime(newTime);
                            }}
                          />
                          <button 
                            onClick={() => setSimulatedTime(null)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-blue-700 transition-all"
                          >
                            RESET
                          </button>
                        </div>
                      </div>
                    )}

                    {isTestMode && (
                      <div className="flex flex-col gap-2 p-4 bg-purple-50 rounded-2xl border-2 border-purple-100">
                        <div className="text-purple-900 font-black text-xs uppercase tracking-widest">Simulate Past Streaks</div>
                        <p className="text-xs text-purple-700 font-medium">Instantly adds 10 questions/day for the specified duration (ending today) and triggers the achievement!</p>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <button 
                            onClick={() => { simulateStreak(3); setShowSettingsModal(false); }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                          >
                            3 Days
                          </button>
                          <button 
                            onClick={() => { simulateStreak(5); setShowSettingsModal(false); }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                          >
                            5 Days
                          </button>
                          <button 
                            onClick={() => { simulateStreak(10); setShowSettingsModal(false); }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                          >
                            10 Days
                          </button>
                          <button 
                            onClick={() => { simulateStreak(20); setShowSettingsModal(false); }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                          >
                            20 Days
                          </button>
                          <button 
                            onClick={() => { simulateStreak(30); setShowSettingsModal(false); }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                          >
                            30 Days
                          </button>
                          <button 
                            onClick={() => { simulateStreak(40); setShowSettingsModal(false); }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                          >
                            40 Days
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Daily mission resets automatically via date-based completion */}

                  {isTestMode && (
                    <>
                      <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">Danger Zone</div>
                      
                      {!isConfirmingClear ? (
                        <button 
                          onClick={() => setIsConfirmingClear(true)}
                          className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border-2 border-red-100 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <Trash2 className="w-5 h-5" />
                            <span className="font-black uppercase text-sm">Clear All Data</span>
                          </div>
                          <ChevronUp className="w-4 h-4 rotate-90 opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-red-600 font-black uppercase text-center animate-pulse">Are you absolutely sure?</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={clearAllData}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black text-sm shadow-lg border-b-4 border-red-900 active:scale-95 transition-all"
                            >
                              YES, DELETE
                            </button>
                            <button 
                              onClick={() => setIsConfirmingClear(false)}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-black text-sm border-b-4 border-gray-300 active:scale-95 transition-all"
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-[10px] text-red-400 font-bold px-2 italic">
                        * This will reset your daily goal, total questions, and levels.
                      </p>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 border-blue-900 active:scale-95 transition-all"
                >
                  DONE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Goal Reached Modal */}
        {showGoalModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className="bg-white rounded-[3rem] max-w-sm lg:max-w-md w-full text-center border-8 border-cyan-400 shadow-[0_0_50px_#ff00ff,0_0_100px_#ff00ff] relative max-h-[85vh] overflow-y-auto overflow-x-hidden"
            >
              <div className="w-full h-64 bg-cyan-50 overflow-hidden rounded-t-[2.2rem]">
                <motion.img 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={graphicAsset('salmonthumbsup')} 
                  alt="Salmon Thumbs Up" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-8 pt-6 relative z-10 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-cyan-900 text-4xl font-black uppercase leading-none">Goal Reached!</h2>
                  <p className="text-cyan-600 font-bold text-lg leading-tight">{goalMessage}</p>
                </div>
                <div className="bg-cyan-50 p-4 rounded-2xl border-2 border-cyan-100">
                  <div className="text-cyan-900 font-black text-3xl">{dailyQuestions}</div>
                  <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Questions Done Today</div>
                </div>
                <button 
                  onClick={() => setShowGoalModal(false)}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 border-cyan-900 active:scale-95 transition-all"
                >
                  I'll Keep It Up!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* New record: questions in a single day */}
        {showRecordDayModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className="bg-white rounded-[3rem] max-w-sm lg:max-w-md w-full text-center border-8 border-cyan-400 shadow-[0_0_50px_#ff00ff,0_0_100px_#ff00ff] relative max-h-[85vh] overflow-y-auto overflow-x-hidden"
            >
              <div className="w-full h-64 bg-cyan-50 overflow-hidden rounded-t-[2.2rem]">
                <motion.img 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={graphicAsset('salmonthumbsup')} 
                  alt="Salmon Thumbs Up" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-8 pt-6 relative z-10 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-cyan-900 text-4xl font-black uppercase leading-none">New Record!</h2>
                  <p className="text-cyan-600 font-bold text-lg leading-tight">
                    That is your best single-day total yet. Keep riding the wave!
                  </p>
                </div>
                <div className="bg-cyan-50 p-4 rounded-2xl border-2 border-cyan-100">
                  <div className="text-cyan-900 font-black text-3xl">{recordDayModalCount}</div>
                  <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Record Questions In A Day</div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowRecordDayModal(false)}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 border-cyan-900 active:scale-95 transition-all"
                >
                  {"Let's Go!"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Variant Modal */}
        {showVariantModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className="bg-white rounded-[3rem] max-w-sm lg:max-w-md w-full text-center border-8 border-cyan-400 shadow-[0_0_50px_#00ffff,0_0_100px_#00ffff] relative max-h-[85vh] overflow-y-auto overflow-x-hidden p-8"
            >
              <h2 className="text-cyan-900 text-3xl font-black uppercase leading-none mb-6">Switch Version</h2>
              <div className="grid grid-cols-2 gap-4">
                {unlockedVariants.map(variant => (
                  <div 
                    key={variant}
                    onClick={() => {
                      setSelectedVariants(prev => ({ ...prev, [currentLevel.graphic]: variant }));
                      setShowVariantModal(false);
                    }}
                    className={`cursor-pointer rounded-2xl border-4 overflow-hidden transition-all hover:scale-105 ${displayVariant === variant ? 'border-cyan-500 shadow-lg' : 'border-gray-200 opacity-70'}`}
                  >
                    <img src={graphicAsset(variant)} alt={variant} className="w-full aspect-square object-cover" />
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowVariantModal(false)}
                className="mt-8 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 border-gray-400 active:scale-95 transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
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
        @import url('https://fonts.googleapis.com/css2?family=Bubblegum+Sans&family=Bungee&display=swap');
        
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
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
              className={`relative w-full max-w-2xl max-h-[90vh] section-panel-ocean-frost-base border-4 shadow-[0_0_50px_rgba(250,204,21,0.3)] overflow-hidden flex flex-col ${
                showAchievementCelebration 
                  ? 'border-fuchsia-500 shadow-[0_0_70px_rgba(217,70,239,0.5)]' 
                  : getAchievementStatus(selectedAchievement, totalQuestions, history, effectiveTime, totalPracticeTests) 
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

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {getAchievementStatus(selectedAchievement, totalQuestions, history, effectiveTime, totalPracticeTests) ? (
                  <>
                    <div className="w-full h-[35vh] md:h-[45vh] bg-white/5 flex items-center justify-center overflow-hidden border-b border-white/10 relative">
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
                        className="w-full h-full object-cover drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] relative z-10"
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
    </div>
  );
}
