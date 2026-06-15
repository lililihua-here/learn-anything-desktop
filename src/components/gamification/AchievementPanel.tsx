import React from "react";
import { useGamificationStore } from "../../stores/gamificationStore";

const ACHIEVEMENT_META: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  first_learn: {
    name: "First Steps",
    description: "Complete your first day of learning",
    icon: "🎓",
  },
  streak_3: {
    name: "Getting Warm",
    description: "Maintain a 3-day learning streak",
    icon: "🔥",
  },
  streak_7: {
    name: "On Fire",
    description: "Maintain a 7-day learning streak",
    icon: "💪",
  },
  streak_30: {
    name: "Unstoppable",
    description: "Maintain a 30-day learning streak",
    icon: "🏆",
  },
  total_10: {
    name: "Dedicated Learner",
    description: "Learn for 10 total days",
    icon: "📚",
  },
  total_50: {
    name: "Knowledge Seeker",
    description: "Learn for 50 total days",
    icon: "🧠",
  },
};

interface AchievementCardProps {
  id: string;
  earned: boolean;
  earnedAt?: string | null;
}

function AchievementCard({ id, earned, earnedAt }: AchievementCardProps) {
  const meta = ACHIEVEMENT_META[id];
  if (!meta) return null;

  return (
    <div
      className={`rounded-xl border p-4 text-center transition-colors ${
        earned
          ? "border-green-200 bg-green-50"
          : "border-gray-200 bg-gray-50 opacity-50"
      }`}
    >
      <div className="mb-2 text-2xl">{meta.icon}</div>
      <div
        className={`text-sm font-semibold ${
          earned ? "text-green-700" : "text-gray-400"
        }`}
      >
        {meta.name}
      </div>
      <div className="mt-1 text-xs text-gray-400">{meta.description}</div>
      {earned && earnedAt ? (
        <div className="mt-2 text-xs text-green-500">
          Unlocked {new Date(earnedAt).toLocaleDateString()}
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-300">Locked</div>
      )}
    </div>
  );
}

export default function AchievementPanel() {
  const achievements = useGamificationStore((s) => s.achievements);
  const loadStreak = useGamificationStore((s) => s.loadStreak);

  // Ensure data is loaded
  React.useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  const displayAchievements = Object.keys(ACHIEVEMENT_META).map((key) => {
    const existing = achievements.find((a) => a.id === key);
    return {
      id: key,
      earned: !!existing?.earned_at,
      earnedAt: existing?.earned_at ?? null,
    };
  });

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-gray-700">
        Achievements
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {displayAchievements.map((a) => (
          <AchievementCard
            key={a.id}
            id={a.id}
            earned={a.earned}
            earnedAt={a.earnedAt}
          />
        ))}
      </div>
    </div>
  );
}


