import { create } from "zustand";

interface SettingsState {
  apiKey: string;
  isKeyConfigured: boolean;
  provider: string;
  model: string;
  theme: "light" | "dark";

  setApiKey: (key: string) => void;
  setConfigured: (v: boolean) => void;
  setProvider: (p: string) => void;
  setModel: (m: string) => void;
  setTheme: (t: "light" | "dark") => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKey: "",
  isKeyConfigured: false,
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  theme: "light",

  setApiKey: (key) => set({ apiKey: key }),
  setConfigured: (v) => set({ isKeyConfigured: v }),
  setProvider: (p) => set({ provider: p }),
  setModel: (m) => set({ model: m }),
  setTheme: (t) => set({ theme: t }),
}));
