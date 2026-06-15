import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Streak {
  id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_days_learned: number;
  updated_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned_at: string | null;
  created_at: string;
}

export type AchievementKey =
  | "first_learn"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "total_10"
  | "total_50";

const PREDEFINED_ACHIEVEMENTS: Array<{
  key: AchievementKey;
  name: string;
  description: string;
  icon: string;
  condition: (streak: Streak) => boolean;
}> = [
  {
    key: "first_learn",
    name: "First Steps",
    description: "Complete your first day of learning",
    icon: "🎓",
    condition: (s) => s.total_days_learned >= 1,
  },
  {
    key: "streak_3",
    name: "Getting Warm",
    description: "Maintain a 3-day learning streak",
    icon: "🔥",
    condition: (s) => s.current_streak >= 3 || s.longest_streak >= 3,
  },
  {
    key: "streak_7",
    name: "On Fire",
    description: "Maintain a 7-day learning streak",
    icon: "💪",
    condition: (s) => s.current_streak >= 7 || s.longest_streak >= 7,
  },
  {
    key: "streak_30",
    name: "Unstoppable",
    description: "Maintain a 30-day learning streak",
    icon: "🏆",
    condition: (s) => s.current_streak >= 30 || s.longest_streak >= 30,
  },
  {
    key: "total_10",
    name: "Dedicated Learner",
    description: "Learn for 10 total days",
    icon: "📚",
    condition: (s) => s.total_days_learned >= 10,
  },
  {
    key: "total_50",
    name: "Knowledge Seeker",
    description: "Learn for 50 total days",
    icon: "🧠",
    condition: (s) => s.total_days_learned >= 50,
  },
];

interface GamificationState {
  streak: Streak | null;
  achievements: Achievement[];
  isLoading: boolean;

  loadStreak: () => Promise<void>;
  recordActivity: () => Promise<void>;
  checkAchievements: () => void;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  streak: null,
  achievements: [],
  isLoading: false,

  loadStreak: async () => {
    set({ isLoading: true });
    try {
      const streak = await invoke<Streak | null>("cmd_get_streak");
      const achievements = await invoke<Achievement[]>("cmd_get_achievements");
      set({ streak, achievements, isLoading: false });
    } catch (err) {
      console.error("Failed to load gamification data:", err);
      set({ isLoading: false });
    }
  },

  recordActivity: async () => {
    try {
      const streak = await invoke<Streak>("cmd_record_activity");
      set({ streak });
      // Check achievements after recording activity
      get().checkAchievements();
    } catch (err) {
      console.error("Failed to record activity:", err);
    }
  },

  checkAchievements: () => {
    const { streak, achievements } = get();
    if (!streak) return;

    const updated = achievements.map((a) => ({ ...a }));
    let changed = false;

    for (const def of PREDEFINED_ACHIEVEMENTS) {
      if (!def.condition(streak)) continue;

      const existing = updated.find((a) => a.id === def.key);
      if (existing && !existing.earned_at) {
        existing.earned_at = new Date().toISOString();
        changed = true;
        // Persist the achievement award
        void invoke("cmd_award_achievement", { achievementId: def.key });
      }
    }

    if (changed) {
      set({ achievements: updated });
    }
  },
}));
