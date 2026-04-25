export function resolveHydratedDailyQuestions(
  history: Record<string, number> | undefined,
  todayKey: string
): number {
  const raw = history?.[todayKey];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}
