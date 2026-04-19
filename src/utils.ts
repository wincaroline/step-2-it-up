
import { ACHIEVEMENTS, DAILY_GOAL, LEVELS, LEVEL_VARIANTS } from './constants';
import { StreakFlameVariant, Achievement } from './types';

/** XP threshold for a main level badge whose `image` matches a row in {@link LEVELS}. */
function mainLevelXpThreshold(achievement: Achievement): number | null {
  const row = LEVELS.find((l) => l.graphic === achievement.image);
  return row != null && row.min > 0 ? row.min : null;
}

/** URL for a file in `public/` (respects Vite `base`, e.g. GitHub Pages project subpath). */
export function publicAsset(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${normalized}`;
}

export function graphicAsset(name: string): string {
  return publicAsset(`assets/graphic_${name}.webp`);
}

/** Every graphic slug referenced by levels, variants, achievements, plus UI extras — for cache warming. */
export function collectAllGraphicAssetUrls(): string[] {
  const names = new Set<string>();

  LEVELS.forEach((l) => names.add(l.graphic));
  Object.values(LEVEL_VARIANTS).forEach((variants) => variants.forEach((v) => names.add(v)));
  ACHIEVEMENTS.forEach((a) => names.add(a.image));

  const extras = [
    'salmonthumbsup',
    'sleepingsalmon',
    'anglerfishangry',
    'scholarsalmon',
    'rockstarsalmon',
    'doublethumbsupsalmon',
    'surfingsalmon',
  ];
  extras.forEach((n) => names.add(n));

  return [...names].map((name) => graphicAsset(name));
}

/** Load images into the HTTP cache early so modals and level art appear without waiting on first paint. */
export function preloadGraphicUrls(urls: string[]): void {
  urls.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}


export function dateKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format local calendar `YYYY-MM-DD` for display (matches Settings / History labels). */
export function formatExamDateLabel(key: string): string {
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return key;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Tailwind `emerald-500` — matches Question count +10 / +100 buttons. */
const HISTORY_GOAL_RGB = { r: 16, g: 185, b: 129 } as const;
/** Muted anchors for red → amber → goal green (Tailwind `red-800`, `amber-600`). */
const HISTORY_LOW_RGB = { r: 153, g: 27, b: 27 } as const;
const HISTORY_MID_RGB = { r: 217, g: 119, b: 6 } as const;

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function rgbString(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }, t: number): string {
  const r = lerpChannel(c1.r, c2.r, t);
  const g = lerpChannel(c1.g, c2.g, t);
  const b = lerpChannel(c1.b, c2.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getHistoryColor(count: number, dailyGoal: number = DAILY_GOAL): string {
  const goal = dailyGoal > 0 ? dailyGoal : DAILY_GOAL;
  const halfGoal = goal / 2;
  if (count === 0) {
    return `rgb(${HISTORY_LOW_RGB.r}, ${HISTORY_LOW_RGB.g}, ${HISTORY_LOW_RGB.b})`;
  }
  if (count >= goal) {
    return `rgb(${HISTORY_GOAL_RGB.r}, ${HISTORY_GOAL_RGB.g}, ${HISTORY_GOAL_RGB.b})`;
  }

  if (count <= halfGoal) {
    const ratio = halfGoal > 0 ? count / halfGoal : 1;
    return rgbString(HISTORY_LOW_RGB, HISTORY_MID_RGB, ratio);
  }
  const ratio = halfGoal > 0 ? (count - halfGoal) / halfGoal : 1;
  return rgbString(HISTORY_MID_RGB, HISTORY_GOAL_RGB, ratio);
}

export function calculateCurrentStreak(history: Record<string, number>, referenceDate: Date = new Date()): number {
  let streak = 0;
  let currentDate = new Date(referenceDate);

  while (true) {
    const dateStr = dateKeyFromDate(currentDate);
    if (history[dateStr] && history[dateStr] >= 10) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function streakFlameVariantFromCount(streak: number): StreakFlameVariant {
  return Math.min(5, Math.max(1, streak)) as StreakFlameVariant;
}

/** Tailwind `orange-300` — matches streak stat number + flame base in My Stats. */
const STREAK_STAT_ORANGE_RGB = { r: 253, g: 186, b: 116 } as const;

/** Current Streak digit color: lerps toward white as variant 1→5 so the number stays readable under stronger glow. */
export function streakStatNumberColorFromVariant(variant: StreakFlameVariant): string {
  const t = (variant - 1) / 4;
  return rgbString(STREAK_STAT_ORANGE_RGB, { r: 255, g: 255, b: 255 }, t);
}

export type PracticeTestScorePoint = { dateKey: string; testNumber: number; score: number };

/** Every completed practice test, with score or null if not logged yet. */
export type PracticeTestChartEntry = { dateKey: string; testNumber: number; score: number | null };

export function buildPracticeTestChartSeries(
  completionDates: Record<string, true>,
  scores: Record<string, number>
): PracticeTestChartEntry[] {
  const sorted = Object.keys(completionDates).sort();
  return sorted.map((dateKey, index) => {
    const raw = scores[dateKey];
    const score =
      raw !== undefined && typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;
    return { dateKey, testNumber: index + 1, score };
  });
}

/** Entries that include a numeric score (for trend tables, bonuses, etc.). */
export function buildPracticeTestScoreSeries(
  completionDates: Record<string, true>,
  scores: Record<string, number>
): PracticeTestScorePoint[] {
  return buildPracticeTestChartSeries(completionDates, scores)
    .filter((e) => e.score !== null)
    .map((e) => ({ dateKey: e.dateKey, testNumber: e.testNumber, score: e.score as number }));
}

export const PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS: Record<string, number> = {
  sunkenpocketwatch: 1,
  glowdarkcompass: 2,
  admiralsepaulets: 3,
  obsidiananchor: 4,
  prismoftheabyss: 5,
  tridentofthetideturner: 6,
  livingcoralcrown: 7,
};

export function getAchievementStatus(
  achievement: Achievement,
  totalQuestions: number,
  history: Record<string, number>,
  referenceDate: Date | undefined,
  totalPracticeTests: number,
  /** Accuracy / practice bonuses — counts toward main level-tier badges (same XP as the level ladder). */
  bonusPoints: number = 0,
  /** When set (e.g. `lastAchievedIds`), IDs already stored stay unlocked for display after threshold tweaks. Omit when detecting *new* unlocks. */
  persistedUnlockedIds?: readonly string[]
): boolean {
  if (persistedUnlockedIds?.includes(achievement.id)) return true;
  const practiceThreshold = PRACTICE_TEST_ACHIEVEMENT_THRESHOLDS[achievement.id];
  if (practiceThreshold !== undefined) return totalPracticeTests >= practiceThreshold;
  if (['steadyswimmer', 'highfivefin', 'tenacioustraveler', 'torrenttamer', 'silverspawner', 'streamsovereign'].includes(achievement.id)) {
    const streak = calculateCurrentStreak(history, referenceDate);
    if (achievement.id === 'steadyswimmer') return streak >= 3;
    if (achievement.id === 'highfivefin') return streak >= 5;
    if (achievement.id === 'tenacioustraveler') return streak >= 10;
    if (achievement.id === 'torrenttamer') return streak >= 20;
    if (achievement.id === 'silverspawner') return streak >= 30;
    if (achievement.id === 'streamsovereign') return streak >= 40;
  }
  const levelMin = mainLevelXpThreshold(achievement);
  if (levelMin !== null) {
    return totalQuestions + Math.max(0, bonusPoints) >= levelMin;
  }
  const totalXp = totalQuestions + Math.max(0, bonusPoints);
  return achievement.isAchieved(totalXp);
}
