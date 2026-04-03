export function calculateDayStreak(
  completedAtValues: Array<string | null | undefined>,
): number {
  const uniqueDays = new Set(
    completedAtValues
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).toISOString().split("T")[0]),
  );

  const today = new Date().toISOString().split("T")[0];
  let streak = 0;
  const checkDate = new Date();

  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0];

    if (uniqueDays.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    if (dateStr === today) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    break;
  }

  return streak;
}
