import { useEffect } from "react";
import { useGamificationStore } from "../../stores/gamificationStore";

interface StreakBadgeProps {
  compact?: boolean;
}

export default function StreakBadge({ compact = false }: StreakBadgeProps) {
  const streak = useGamificationStore((s) => s.streak);
  const loadStreak = useGamificationStore((s) => s.loadStreak);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  if (!streak) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400">
        <span>🔥</span>
        <span>No streak yet</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600">
        <span>🔥</span>
        <span>{streak.current_streak}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-1 text-orange-600">
        <span className="text-sm">🔥</span>
        <span className="font-semibold">{streak.current_streak}</span>
        <span className="text-orange-400">day streak</span>
      </div>
      <div className="h-4 w-px bg-orange-200" />
      <div className="flex items-center gap-1 text-orange-500">
        <span className="font-semibold">{streak.longest_streak}</span>
        <span>best</span>
      </div>
      <div className="h-4 w-px bg-orange-200" />
      <div className="flex items-center gap-1 text-orange-500">
        <span className="font-semibold">{streak.total_days_learned}</span>
        <span>total</span>
      </div>
    </div>
  );
}
