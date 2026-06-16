import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useLocale } from "../i18n/useLocale";
import {
  deleteApiKey,
  getApiKeys,
  saveAppSetting,
  storeApiKey,
  validateApiKey,
  type ApiKeyStatus,
} from "../lib/tauri";
import { PROVIDER_MODELS, getDefaultModelForProvider } from "../lib/providerModels";
import MigrationPanel from "../components/settings/MigrationPanel";

const ALL_PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Qwen" },
] as const;

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const L = useLocale();
  const copy = L.settings;
  const {
    hasCompletedOnboarding,
    hasConfiguredProvider,
    provider,
    setProvider,
    model,
    setModel,
    locale,
    setLocale,
    theme,
    setTheme,
    completeOnboarding,
    setOnboardingCompleted,
    setHasConfiguredProvider,
  } = useSettingsStore();

  const [keyStatuses, setKeyStatuses] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [validationMsg, setValidationMsg] = useState<Record<string, string>>({});
  const [showAllProviders, setShowAllProviders] = useState(false);

  const next = searchParams.get("next");
  const needsOnboarding = !hasCompletedOnboarding || !hasConfiguredProvider;
  const modelOptions = PROVIDER_MODELS[provider] ?? [];
  const otherProviders = ALL_PROVIDERS.filter((item) => item.value !== provider);

  const persistSetting = useCallback(async (key: string, value: string) => {
    try {
      await saveAppSetting(key, value);
    } catch {
      // Keep UI responsive even if backend persistence is temporarily unavailable.
    }
  }, []);

  const fetchKeyStatuses = useCallback(async () => {
    try {
      const list: ApiKeyStatus[] = await getApiKeys();
      const map: Record<string, boolean> = {};
      for (const item of list) {
        map[item.provider] = item.configured;
      }
      setKeyStatuses(map);
      setHasConfiguredProvider(Object.values(map).some(Boolean));
    } catch {
      // Ignore during frontend-only development.
    }
  }, [setHasConfiguredProvider]);

  useEffect(() => {
    void fetchKeyStatuses();
  }, [fetchKeyStatuses]);

  const handleProviderChange = async (value: string) => {
    setProvider(value);
    await persistSetting("provider", value);

    const nextModel = getDefaultModelForProvider(value);
    if (nextModel) {
      setModel(nextModel);
      await persistSetting("model", nextModel);
    }
  };

  const handleModelChange = async (value: string) => {
    setModel(value);
    await persistSetting("model", value);
  };

  const handleLocaleChange = async (value: "en" | "zh-CN") => {
    setLocale(value);
    await persistSetting("locale", value);
  };

  const handleThemeChange = async (value: "light" | "dark") => {
    setTheme(value);
    await persistSetting("theme", value);
  };

  const handleCompleteSetup = () => {
    if (!hasConfiguredProvider) {
      return;
    }
    completeOnboarding();
    navigate(next || "/");
  };

  const handleSaveKey = async (selectedProvider: string) => {
    const key = keyInputs[selectedProvider]?.trim();
    if (!key) return;

    setSaving((prev) => ({ ...prev, [selectedProvider]: true }));
    try {
      await storeApiKey(selectedProvider, key);
      setKeyStatuses((prev) => ({ ...prev, [selectedProvider]: true }));
      setHasConfiguredProvider(true);
      setValidationMsg((prev) => ({ ...prev, [selectedProvider]: "" }));
      setKeyInputs((prev) => ({ ...prev, [selectedProvider]: "" }));
    } catch (error) {
      setValidationMsg((prev) => ({
        ...prev,
        [selectedProvider]: String(error),
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [selectedProvider]: false }));
    }
  };

  const handleValidateKey = async (selectedProvider: string) => {
    const key = keyInputs[selectedProvider]?.trim();
    if (!key) return;

    setValidating((prev) => ({ ...prev, [selectedProvider]: true }));
    setValidationMsg((prev) => ({ ...prev, [selectedProvider]: "" }));
    try {
      const valid = await validateApiKey(selectedProvider, key);
      setValidationMsg((prev) => ({
        ...prev,
        [selectedProvider]: valid ? copy.keyValid : copy.keyInvalid,
      }));
    } catch (error) {
      setValidationMsg((prev) => ({
        ...prev,
        [selectedProvider]: `${copy.keyError}: ${String(error)}`,
      }));
    } finally {
      setValidating((prev) => ({ ...prev, [selectedProvider]: false }));
    }
  };

  const handleDeleteKey = async (selectedProvider: string) => {
    setDeleting((prev) => ({ ...prev, [selectedProvider]: true }));
    try {
      await deleteApiKey(selectedProvider);
      setKeyStatuses((prev) => {
        const nextStatuses = { ...prev, [selectedProvider]: false };
        const hasAnyConfiguredProvider = Object.values(nextStatuses).some(Boolean);
        setHasConfiguredProvider(hasAnyConfiguredProvider);
        if (!hasAnyConfiguredProvider) {
          setOnboardingCompleted(false);
        }
        return nextStatuses;
      });
      setValidationMsg((prev) => ({ ...prev, [selectedProvider]: "" }));
      setKeyInputs((prev) => ({ ...prev, [selectedProvider]: "" }));
    } catch (error) {
      setValidationMsg((prev) => ({
        ...prev,
        [selectedProvider]: String(error),
      }));
    } finally {
      setDeleting((prev) => ({ ...prev, [selectedProvider]: false }));
    }
  };

  const renderProviderKeyRow = (selectedProvider: string, label: string) => {
    const configured = keyStatuses[selectedProvider] ?? false;
    const inputVal = keyInputs[selectedProvider] ?? "";
    const isValidating = validating[selectedProvider] ?? false;
    const isSaving = saving[selectedProvider] ?? false;
    const isDeleting = deleting[selectedProvider] ?? false;
    const msg = validationMsg[selectedProvider] ?? "";
    const isActive = selectedProvider === provider;

    return (
      <div
        key={selectedProvider}
        className={`rounded-xl border p-3 dark:border-gray-700 ${
          isActive
            ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
            : "bg-white dark:bg-gray-900"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {label}
            </span>
            {isActive && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                {copy.active}
              </span>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              configured
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {configured ? copy.keyConfigured : copy.keyNotConfigured}
          </span>
        </div>

        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={inputVal}
            onChange={(event) =>
              setKeyInputs((prev) => ({ ...prev, [selectedProvider]: event.target.value }))
            }
            placeholder={copy.keyInputPlaceholder}
            className="h-9 flex-1 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleSaveKey(selectedProvider)}
            disabled={isSaving || !inputVal.trim()}
            className="h-8 rounded-xl bg-indigo-500 px-3 text-xs text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? copy.saving : copy.save}
          </button>
          <button
            onClick={() => void handleValidateKey(selectedProvider)}
            disabled={isValidating || !inputVal.trim()}
            className="h-8 rounded-xl border border-gray-200 px-3 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {isValidating ? copy.validating : copy.validate}
          </button>
          {configured && (
            <button
              onClick={() => void handleDeleteKey(selectedProvider)}
              disabled={isDeleting}
              className="h-8 rounded-xl border border-red-200 px-3 text-xs text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:hover:bg-red-500/10"
            >
              {isDeleting ? copy.deleting : copy.delete}
            </button>
          )}
        </div>

        {msg && (
          <p
            className={`mt-1.5 text-xs ${
              msg === copy.keyValid
                ? "text-emerald-600 dark:text-emerald-300"
                : msg === copy.keyInvalid
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-red-500 dark:text-red-300"
            }`}
          >
            {msg}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{copy.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {needsOnboarding ? copy.subtitleFirst : copy.subtitleDone}
          </p>
        </div>

        {needsOnboarding && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {copy.onboarding}
          </div>
        )}

        <div className="space-y-3 rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div>
            <h2 className="font-medium text-gray-900 dark:text-gray-100">{copy.provider}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{copy.providerHint}</p>
          </div>

          <select
            value={provider}
            onChange={(event) => void handleProviderChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {ALL_PROVIDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div>
            <h2 className="font-medium text-gray-900 dark:text-gray-100">{copy.model}</h2>
          </div>

          <input
            list={`${provider}-model-options`}
            value={model}
            onChange={(event) => void handleModelChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <datalist id={`${provider}-model-options`}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
        </div>

        <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="font-medium text-gray-900 dark:text-gray-100">{copy.apiKeyMgmt}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{copy.apiKeyHint}</p>

          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {copy.activeProviderKey}
              </p>
              {renderProviderKeyRow(
                provider,
                ALL_PROVIDERS.find((item) => item.value === provider)?.label ?? provider,
              )}
            </div>

            {otherProviders.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAllProviders((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-indigo-500 transition-colors hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                  <span
                    className={`inline-block transition-transform ${showAllProviders ? "rotate-90" : ""}`}
                  >
                    &#9654;
                  </span>
                  {showAllProviders ? copy.hideProviders : copy.manageAllProviders}
                </button>

                {showAllProviders && (
                  <div className="mt-2 space-y-2">
                    {otherProviders.map((item) => renderProviderKeyRow(item.value, item.label))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <MigrationPanel />

        <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-gray-100">{copy.language}</h2>
          <div className="flex gap-3">
            <button
              onClick={() => void handleLocaleChange("zh-CN")}
              className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                locale === "zh-CN"
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {copy.chinese}
            </button>
            <button
              onClick={() => void handleLocaleChange("en")}
              className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                locale === "en"
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {copy.english}
            </button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-gray-100">{copy.theme}</h2>
          <div className="flex gap-3">
            <button
              onClick={() => void handleThemeChange("light")}
              className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                theme === "light"
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {copy.lightMode}
            </button>
            <button
              onClick={() => void handleThemeChange("dark")}
              className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                theme === "dark"
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {copy.darkMode}
            </button>
          </div>
        </div>

        {needsOnboarding && (
          <button
            onClick={handleCompleteSetup}
            disabled={!hasConfiguredProvider}
            className="h-10 rounded-xl bg-indigo-500 px-4 text-sm text-white transition-colors hover:bg-indigo-600"
          >
            {copy.continue}
          </button>
        )}

        <Link
          to="/"
          className="block pb-4 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          {copy.backHome}
        </Link>
      </div>
    </div>
  );
}
