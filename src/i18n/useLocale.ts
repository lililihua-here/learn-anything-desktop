import { useSettingsStore } from "../stores/settingsStore";
import en from "./locales/en";
import zhCN from "./locales/zh-CN";

const locales = { en, "zh-CN": zhCN };

export type Locale = typeof en;

export function useLocale(): Locale {
  const locale = useSettingsStore((s) => s.locale) || "en";
  return (locales as Record<string, Locale>)[locale] || en;
}
