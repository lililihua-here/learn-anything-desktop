import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Locale = "en" | "zh-CN";

interface SettingsState {
  apiKey: string;
  isKeyConfigured: boolean;
  hasCompletedOnboarding: boolean;
  onboardingResolved: boolean;
  hasConfiguredProvider: boolean;
  provider: string;
  model: string;
  locale: Locale;
  theme: "light" | "dark";

  setApiKey: (key: string) => void;
  setConfigured: (v: boolean) => void;
  completeOnboarding: () => void;
  setOnboardingCompleted: (v: boolean) => void;
  setOnboardingResolved: (v: boolean) => void;
  setHasConfiguredProvider: (v: boolean) => void;
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
      onboardingResolved: false,
      hasConfiguredProvider: false,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      locale: "zh-CN",
      theme: "light",

      setApiKey: (key) => set({ apiKey: key }),
      setConfigured: (v) => set({ isKeyConfigured: v }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setOnboardingCompleted: (v) => set({ hasCompletedOnboarding: v }),
      setOnboardingResolved: (v) => set({ onboardingResolved: v }),
      setHasConfiguredProvider: (v) => set({ hasConfiguredProvider: v }),
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
