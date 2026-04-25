import { describe, expect, it } from 'vitest';
import { resolveHydratedDailyQuestions } from './dailyProgress';

describe('resolveHydratedDailyQuestions', () => {
  it('returns 0 when today has no history entry', () => {
    const history = { '2026-04-24': 37 };
    expect(resolveHydratedDailyQuestions(history, '2026-04-25')).toBe(0);
  });

  it('returns todays history count when present', () => {
    const history = { '2026-04-24': 37, '2026-04-25': 12 };
    expect(resolveHydratedDailyQuestions(history, '2026-04-25')).toBe(12);
  });

  it('clamps negative values to zero', () => {
    const history = { '2026-04-25': -4 };
    expect(resolveHydratedDailyQuestions(history, '2026-04-25')).toBe(0);
  });
});
