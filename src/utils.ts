
import { StreakFlameVariant, Achievement } from './types';

/** URL for a file in `public/` (respects Vite `base`, e.g. GitHub Pages project subpath). */
export function publicAsset(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${normalized}`;
}

export function dateKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function calculateCurrentStreak(history: Record<string, number>, referenceDate: Date = new Date()): number {
  const getDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  let streak = 0;
  let currentDate = new Date(referenceDate);
  
  while (true) {
    const dateStr = getDateKey(currentDate);
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
  totalPracticeTests: number
): boolean {
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
  return achievement.isAchieved(totalQuestions);
}
