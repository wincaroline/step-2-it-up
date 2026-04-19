
export interface Level {
  name: string;
  min: number;
  description: string;
  graphic: string;
  emoji: string;
}

export interface Achievement {
  id: string;
  title: string;
  image: string;
  achievementDescription: string;
  requirementDescription: string;
  extraSillyDescription: string;
  /** For XP-gated entries, this is total XP (questions + bonus). */
  isAchieved: (totalXp: number) => boolean;
}

export type StreakFlameVariant = 1 | 2 | 3 | 4 | 5;
