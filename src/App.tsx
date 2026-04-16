import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Fish, 
  Waves, 
  Trophy, 
  ChevronUp, 
  ChevronDown, 
  Plus,
  Minus,
  Zap, 
  Anchor, 
  Shell, 
  Star,
  Music,
  Volume2,
  VolumeX,
  Settings,
  Trash2,
  Calendar,
  Smile,
  X,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  Award
} from 'lucide-react';

import { LEVELS, LEVEL_VARIANTS, ACHIEVEMENTS, SILLY_STATEMENTS, DAILY_GOAL, MILESTONE_1, EXAM_DATE, RECORD_DAY_MODAL_LAST_SHOWN_KEY } from './constants';
import { GraphicMap, StreakFlameGraphic, SeaweedGraphic, CoralGraphic } from './components/Graphics';
import type { StreakFlameVariant } from './types';
import { calculateCurrentStreak, streakFlameVariantFromCount, getAchievementStatus, dateKeyFromDate, PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS, publicAsset, graphicAsset } from './utils';
import { Bubble, SeaCreature } from './components/OceanElements';
import { LevelSection } from './components/LevelSection';
import { AchievementsSection } from './components/AchievementsSection';
import type { Level, Achievement } from './types';

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
  const [isWeeklyMissionComplete, setIsWeeklyMissionComplete] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('isWeeklyMissionComplete') : null;
    return saved === 'true';
  });
  const [totalPracticeTests, setTotalPracticeTests] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('totalPracticeTests') : null;
    return saved ? parseInt(saved, 10) : 0;
  });
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

  const checkMilestones = (newDaily: number, newTotal: number, newHistory: Record<string, number> = history) => {
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
    const todayStr = `${effectiveTime.getFullYear()}-${String(effectiveTime.getMonth() + 1).padStart(2, '0')}-${String(effectiveTime.getDate()).padStart(2, '0')}`;
    const historyForAchievements = { ...newHistory, [todayStr]: newDaily };
    const newlyAchieved = ACHIEVEMENTS.filter(a => getAchievementStatus(a, newTotal, historyForAchievements, effectiveTime, totalPracticeTests) && !lastAchievedIds.includes(a.id));
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

  const getHistoryColor = (count: number) => {
    if (count === 0) return 'rgb(255, 0, 0)';
    if (count >= 180) return 'rgb(0, 255, 0)';
    
    if (count <= 90) {
      const ratio = count / 90;
      const g = Math.round(255 * ratio);
      return `rgb(255, ${g}, 0)`;
    } else {
      const ratio = (count - 90) / 90;
      const r = Math.round(255 * (1 - ratio));
      return `rgb(${r}, 255, 0)`;
    }
  };

  const HARD_ASS_STATEMENTS = [
    "The abyss is calling, and you're not answering.",
    "Stop treading water and start swimming.",
    "Your lack of focus is a shipwreck in progress.",
    "The tide doesn't wait for the unprepared.",
    "You're sinking while everyone else is surfacing.",
    "Are you a predator or just plankton?",
    "The pressure is rising, and you're cracking.",
    "Stop drifting into failure.",
    "The ocean floor is full of people who gave up.",
    "Your excuses are just bubbles in the deep."
  ];

  const TOUGH_LOVE_DESCRIPTIONS: Record<string, string> = {
    "Plankton": "You're barely visible, and honestly, you're not doing much.",
    "Krill": "You're just whale food. Try harder.",
    "Sea Snail": "You're moving at a snail's pace. At this rate, the exam will be over before you finish.",
    "Sardine": "You're just another fish in the sea. Boring.",
    "Seahorse": "You're just horse-ing around. Get to work.",
    "Squid": "You're just squirting ink to hide your lack of progress.",
    "Pufferfish": "You're all puffed up with nothing to show for it.",
    "Flying Fish": "You're just jumping out of the water to avoid studying.",
    "Jellyfish": "You're just drifting along, hoping for a miracle.",
    "Barracuda": "You're just a glorified minnow with an attitude.",
    "Stingray": "You're just burying yourself in the sand to hide from your responsibilities.",
    "Dolphin": "You're just playing around while the exam gets closer.",
    "Orca": "You're supposed to be a killer, but you're just playing with your food.",
    "Great White Shark": "You're just a big fish in a small pond.",
    "Blue Whale": "You're just a big, lazy blob."
  };

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
    // Pre-load all level graphics and other key assets
    const imagesToPreload = [
      ...LEVELS.slice(0, 3).map(l => graphicAsset(l.graphic)),
      graphicAsset('salmonthumbsup')
    ];
    
    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('dailyQuestions', dailyQuestions.toString());
  }, [dailyQuestions]);

  useEffect(() => {
    localStorage.setItem('totalQuestions', totalQuestions.toString());
    
    // Update history for today (using local date string)
    const todayStr = `${effectiveTime.getFullYear()}-${String(effectiveTime.getMonth() + 1).padStart(2, '0')}-${String(effectiveTime.getDate()).padStart(2, '0')}`;
    
    setHistory(prev => {
      const newHistory = { ...prev, [todayStr]: dailyQuestions };
      localStorage.setItem('history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, [totalQuestions, currentLevelIndex, lastLevel, isMuted, lastAchievedIds]);

  useEffect(() => {
    // Automatic Weekly Reset (Sunday 12 AM)
    const checkWeeklyReset = () => {
      const now = new Date();
      const lastReset = localStorage.getItem('lastWeeklyReset');
      
      // Get the start of the current week (Sunday 12 AM)
      const currentWeekStart = new Date(now);
      currentWeekStart.setHours(0, 0, 0, 0);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      
      const lastResetTime = lastReset ? parseInt(lastReset) : 0;
      
      if (lastResetTime < currentWeekStart.getTime()) {
        console.log("New week detected! Resetting weekly mission...");
        setIsWeeklyMissionComplete(false);
        localStorage.setItem('lastWeeklyReset', currentWeekStart.getTime().toString());
      }
    };

    checkWeeklyReset();
    // Check every hour in case the app is left open
    const interval = setInterval(checkWeeklyReset, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('isTestMode', isTestMode.toString());
  }, [isTestMode]);

  useEffect(() => {
    localStorage.setItem('isWeeklyMissionComplete', isWeeklyMissionComplete.toString());
    localStorage.setItem('totalPracticeTests', totalPracticeTests.toString());
  }, [isWeeklyMissionComplete, totalPracticeTests]);

  useEffect(() => {
    // Lock body scroll when any modal is open
    const isAnyModalOpen = showGoalModal || showRecordDayModal || showSettingsModal || showImageViewer;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showGoalModal, showRecordDayModal, showSettingsModal, showImageViewer]);

  // --- Handlers ---
  const addQuestions = (amount: number) => {
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
    checkMilestones(newDaily, newTotal);
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
    setIsWeeklyMissionComplete(false);
    setTotalPracticeTests(0);
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
    const todayStr = `${effectiveTime.getFullYear()}-${String(effectiveTime.getMonth() + 1).padStart(2, '0')}-${String(effectiveTime.getDate()).padStart(2, '0')}`;
    
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

  const triggerExtremeCelebration = () => {
    setShowGoalModal(true);
    triggerFireworks();
  };

  const getMotivation = () => {
    if (dailyQuestions === 0) return "";
    return goalMessage || "Just keep swimming! You're doing great! ";
  };

  const simulateStreak = (days: number) => {
    const newHistory = { ...history };
    const today = new Date();
    const getDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Add 10 questions for the past `days` days, ending TODAY
    let addedQuestions = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = getDateKey(d);
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

  const QuestionButtons = ({ onUpdate, isTestMode, isWarningMode, isSleepMode, isHistoryModal = false }: { onUpdate: (amount: number) => void, isTestMode: boolean, isWarningMode: boolean, isSleepMode: boolean, isHistoryModal?: boolean }) => {
    const getButtonClass = (amount: number) => {
      const base = "font-black text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 rounded-xl";
      const padding = isHistoryModal ? "px-3 py-3" : "flex-1 py-3";
      
      if (amount < 0) {
        if (isSleepMode) return `${base} ${padding} bg-gray-800 border-gray-950 text-white hover:bg-gray-700`;
        if (isWarningMode) return `${base} ${padding} bg-red-900 border-red-950 text-red-100 hover:bg-red-800`;
        return `${base} ${padding} bg-gray-400 border-gray-500 text-white hover:bg-gray-500`;
      }
      // Positive
      if (isSleepMode) return `${base} ${padding} bg-blue-900 border-blue-950 text-blue-100 hover:bg-blue-800`;
      if (isWarningMode) return `${base} ${padding} bg-white border-gray-200 text-gray-900 hover:bg-gray-100`;
      return `${base} ${padding} bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600`;
    };

    const getOpacity = (amount: number) => {
      if (amount === 1) return "bg-opacity-60";
      if (amount === 10) return "bg-opacity-80";
      return "bg-opacity-100";
    };

    return (
      <div className={`flex w-full gap-1.5 ${isHistoryModal ? 'justify-center' : ''}`}>
        {isTestMode && (
          <button onClick={() => onUpdate(-100)} className={`${getButtonClass(-100)}`}>-100</button>
        )}
        <button onClick={() => onUpdate(-10)} className={`${getButtonClass(-10)}`}>-10</button>
        <button onClick={() => onUpdate(-1)} className={`${getButtonClass(-1)}`}>-1</button>
        <button onClick={() => onUpdate(1)} className={`${getButtonClass(1)} ${getOpacity(1)}`}>+1</button>
        <button onClick={() => onUpdate(10)} className={`${getButtonClass(10)} ${getOpacity(10)}`}>+10</button>
        {isTestMode && (
          <button onClick={() => onUpdate(100)} className={`${getButtonClass(100)} ${getOpacity(100)}`}>+100</button>
        )}
      </div>
    );
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
              Test Mode On
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
          {/* Question Tracker Section */}
          <section className={`w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 shadow-2xl flex flex-col items-center text-center gap-6 transition-all duration-500 relative overflow-hidden ${
            isSleepMode ? 'border-blue-400/40' : isWarningMode ? 'border-transparent' : 'border-white/40'
          }`}>
            {(isWarningMode || isSleepMode) && (
              <div className={`absolute inset-0 rounded-[3rem] border-4 pointer-events-none ${isSleepMode ? 'border-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.4)] animate-pulse' : 'border-red-400 shadow-[0_0_18px_rgba(252,165,165,0.95),0_0_42px_rgba(248,113,113,0.85),0_0_72px_rgba(220,38,38,0.65),0_0_110px_rgba(127,29,29,0.45)] animate-pulse'}`} />
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
            <section className="relative w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 border-transparent shadow-2xl flex flex-col items-center text-center gap-6 transition-all duration-500 relative overflow-hidden lg:hidden">
              <div className={`absolute inset-0 rounded-[3rem] border-4 pointer-events-none ${isSleepMode ? 'border-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.4)] animate-pulse' : 'border-red-400 shadow-[0_0_18px_rgba(252,165,165,0.95),0_0_42px_rgba(248,113,113,0.85),0_0_72px_rgba(220,38,38,0.65),0_0_110px_rgba(127,29,29,0.45)] animate-pulse'}`} />
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

          {/* Footer Stats */}
          <section className="w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 border-white/40 shadow-2xl space-y-6">
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
                    return (
                      <>
                        <StreakFlameGraphic
                          variant={streakFlameVariantFromCount(streak)}
                          className={`w-6 h-6 shrink-0 ${isSleepMode ? 'opacity-45 saturate-[0.55]' : isWarningMode ? 'opacity-90 brightness-95 contrast-110' : ''}`}
                        />
                        <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>{streak}</span>
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
                      const values = Object.values(history) as number[];
                      const last3 = values.slice(-3);
                      return last3.length ? (last3.reduce((a: number, b: number) => a + b, 0) / last3.length).toFixed(1) : 0;
                    })()}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Avg Questions (Last 3 Days)</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <Award className={`w-6 h-6 ${isSleepMode ? 'text-slate-400' : isWarningMode ? 'text-red-500' : 'text-yellow-300'}`} />
                  <span className={`text-4xl font-black drop-shadow-md ${isWarningMode ? 'text-white/80' : 'text-yellow-300'}`}>{Math.max(...(Object.values(history) as number[]), 0)}</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/90 mt-2">Record Questions In Day</span>
              </div>
            </div>
          </section>

          {/* Practice Test Reminder */}
          <div className={`w-full p-6 rounded-[3rem] border-4 shadow-2xl flex flex-col sm:flex-row items-center gap-6 font-black text-lg uppercase transition-all duration-500 ${
            isWeeklyMissionComplete && isWarningMode
              ? 'bg-white/80 backdrop-blur-xl text-black border-white/80'
              : isWeeklyMissionComplete
                ? 'bg-green-500/80 backdrop-blur-xl text-white border-white/40'
                : isWarningMode
                  ? 'bg-red-600/80 backdrop-blur-xl text-white border-red-500/60'
                  : 'bg-yellow-400/80 backdrop-blur-xl text-black border-white/40'
          }`}>
            <div className={`${
              isWeeklyMissionComplete
                ? isWarningMode
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-green-500'
                : 'bg-black text-white'
            } p-3 rounded-2xl shadow-lg transition-colors`}>
              {isWeeklyMissionComplete ? <Trophy className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
            </div>
            <div className="flex flex-col flex-1 text-center sm:text-left">
              <span className="text-xs opacity-60 tracking-widest">
                {isWeeklyMissionComplete ? 'Mission Accomplished' : 'Weekly Mission'}
              </span>
              <span className={isWeeklyMissionComplete ? 'text-base' : ''}>
                {isWeeklyMissionComplete ? 'Weekly Mission Complete' : '1 Practice Test!'}
              </span>
              {isWeeklyMissionComplete && (
                <span className="text-[10px] opacity-80 mt-1 normal-case font-bold">1 practice test out of the way!</span>
              )}
            </div>
            <div className="w-full sm:w-auto flex flex-row flex-wrap gap-2 items-center justify-center sm:justify-end">
              {isTestMode && (
                <>
                  <button
                    type="button"
                    aria-label="Decrease practice test count"
                    onClick={() => setTotalPracticeTests((prev) => Math.max(0, prev - 1))}
                    className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-black/10 text-current border-2 border-current/20 hover:bg-black/20 active:scale-95 transition-all"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Increase practice test count"
                    onClick={() => {
                      const next = totalPracticeTests + 1;
                      setTotalPracticeTests(next);
                      celebratePracticeTestAchievements(next);
                    }}
                    className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-black/10 text-current border-2 border-current/20 hover:bg-black/20 active:scale-95 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </>
              )}
              {!isWeeklyMissionComplete && (
                <button 
                  type="button"
                  onClick={() => {
                    setIsWeeklyMissionComplete(true);
                    const next = totalPracticeTests + 1;
                    setTotalPracticeTests(next);
                    celebratePracticeTestAchievements(next);
                  }}
                  className="w-full sm:w-auto min-w-[8rem] bg-black text-white px-6 py-3 rounded-xl text-xs hover:bg-gray-800 active:scale-95 transition-all shadow-md"
                >
                  Completed
                </button>
              )}
            </div>
          </div>
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
            <section className="relative hidden lg:flex w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 border-transparent shadow-2xl flex-col items-center text-center gap-6 transition-all duration-500 relative overflow-hidden font-serious">
              <div className={`absolute inset-0 rounded-[3rem] border-4 pointer-events-none ${isSleepMode ? 'border-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.4)] animate-pulse' : 'border-red-400 shadow-[0_0_18px_rgba(252,165,165,0.95),0_0_42px_rgba(248,113,113,0.85),0_0_72px_rgba(220,38,38,0.65),0_0_110px_rgba(127,29,29,0.45)] animate-pulse'}`} />
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
          <section className="w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 border-white/40 shadow-2xl flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-yellow-300" />
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">History</h2>
            </div>

            <div className="w-full space-y-6">
              {(() => {
                const rows = [];
                const startDate = new Date(2026, 3, 5); // April 5, 2026 (Local Time)
                const todayStr = `${effectiveTime.getFullYear()}-${String(effectiveTime.getMonth() + 1).padStart(2, '0')}-${String(effectiveTime.getDate()).padStart(2, '0')}`;

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
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const count = history[dateKey] || 0;
                    const isToday = dateKey === todayStr;
                    const isFuture = date > effectiveTime;
                    const isExamDay = dateKey === '2026-05-30';

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
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-[10px] font-black cursor-pointer transition-all hover:scale-110 active:scale-95 relative ${
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
                        {isExamDay ? 'EXAM' : count > 0 ? count : ''}
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
        {/* History Detail Modal */}
        {selectedHistoryDate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[#001a2c]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className={`bg-white rounded-[3rem] max-w-sm lg:max-w-md w-full text-center border-8 shadow-2xl relative overflow-hidden ${
                selectedHistoryDate.count >= DAILY_GOAL ? 'border-green-400' : 'border-gray-300'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between p-8">
                  <h2 className={`text-xl font-black uppercase tracking-tight ${
                    selectedHistoryDate.count >= DAILY_GOAL ? 'text-green-900' : 'text-gray-900'
                  }`}>
                    {selectedHistoryDate.date}
                  </h2>
                  <button 
                    onClick={() => setSelectedHistoryDate(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {selectedHistoryDate.count >= 180 && !selectedHistoryDate.isExamDay && (
                  <div className="w-full">
                    <img 
                      src={graphicAsset('salmonthumbsup')} 
                      alt="Salmon Thumbs Up" 
                      className="w-full object-contain"
                    />
                  </div>
                )}

                <div className={`${
                  selectedHistoryDate.isExamDay 
                    ? 'bg-yellow-50 border-yellow-100' 
                    : selectedHistoryDate.count >= DAILY_GOAL 
                      ? 'bg-green-50 border-green-100' 
                      : 'bg-gray-50 border-gray-100'
                } p-8 rounded-[2rem] border-4 mx-8 mb-8`}>
                  {selectedHistoryDate.isExamDay ? (
                    <div className="space-y-2">
                      <div className="flex justify-center mb-2">
                        <Star className="w-16 h-16 text-yellow-500 fill-yellow-500 animate-spin-slow" />
                      </div>
                      <div className="text-4xl font-black text-yellow-700 uppercase">Exam Day!</div>
                      <p className="text-yellow-600 font-bold">The big day has arrived. You've got this!</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
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
                        <div className="mt-4">
                          <QuestionButtons onUpdate={(amount) => updateHistoryCount(selectedHistoryDate.dateKey, selectedHistoryDate.count + amount)} isTestMode={isTestMode} isWarningMode={isWarningMode} isSleepMode={isSleepMode} isHistoryModal={true} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedHistoryDate(null)}
                  className={`w-full py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 active:scale-95 transition-all ${
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
                              if (val === "5138") {
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

                  {/* Weekly Mission reset removed */}

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
              onClick={() => {
                setSelectedAchievement(null);
                setShowAchievementCelebration(false);
                if (levelMusic) {
                  levelMusic.pause();
                  setLevelMusic(null);
                }
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-2xl max-h-[90vh] bg-white/10 backdrop-blur-2xl rounded-[3rem] border-4 shadow-[0_0_50px_rgba(250,204,21,0.3)] overflow-hidden flex flex-col ${
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
                onClick={() => {
                  setSelectedAchievement(null);
                  setShowAchievementCelebration(false);
                  if (levelMusic) {
                    levelMusic.pause();
                    setLevelMusic(null);
                  }
                }}
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
                          onClick={() => {
                            setSelectedAchievement(null);
                            setShowAchievementCelebration(false);
                            if (levelMusic) {
                              levelMusic.pause();
                              setLevelMusic(null);
                            }
                          }}
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
