import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Locale = "en" | "zh-CN";

interface SettingsState {
  apiKey: string;
  isKeyConfigured: boolean;
  hasCompletedOnboarding: boolean;
  provider: string;
  model: string;
  locale: Locale;
  theme: "light" | "dark";

  setApiKey: (key: string) => void;
  setConfigured: (v: boolean) => void;
  completeOnboarding: () => void;
  setProvider: (p: string) => void;
  setModel: (m: string) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (t: "light" | "dark") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      isKeyConfigured: false,
      hasCompletedOnboarding: false,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      locale: "zh-CN",
      theme: "light",

      setApiKey: (key) => set({ apiKey: key }),
      setConfigured: (v) => set({ isKeyConfigured: v }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setProvider: (p) => set({ provider: p }),
      setModel: (m) => set({ model: m }),
      setLocale: (locale) => set({ locale }),
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: "learn-anything-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        provider: state.provider,
        model: state.model,
        locale: state.locale,
        theme: state.theme,
      }),
    },
  ),
);
