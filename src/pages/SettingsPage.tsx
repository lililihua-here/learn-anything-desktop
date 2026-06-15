import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import {
  storeApiKey,
  getApiKeys,
  deleteApiKey,
  validateApiKey,
  type ApiKeyStatus,
} from "../lib/tauri";

const ALL_PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Qwen" },
  { value: "glm", label: "GLM" },
] as const;

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "o4-mini", label: "o4 Mini" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ],
  qwen: [
    { value: "qwen-max", label: "Qwen Max" },
    { value: "qwen-plus", label: "Qwen Plus" },
    { value: "qwen-turbo", label: "Qwen Turbo" },
  ],
  glm: [
    { value: "glm-4-plus", label: "GLM-4 Plus" },
    { value: "glm-4-flash", label: "GLM-4 Flash" },
  ],
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    hasCompletedOnboarding,
    provider,
    setProvider,
    model,
    setModel,
    locale,
    setLocale,
    theme,
    setTheme,
    completeOnboarding,
  } = useSettingsStore();

  // ── Per-provider API key state ──────────────────────────────────────────
  const [keyStatuses, setKeyStatuses] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [validationMsg, setValidationMsg] = useState<Record<string, string>>({});
  const [showAllProviders, setShowAllProviders] = useState(false);

  const fetchKeyStatuses = useCallback(async () => {
    try {
      const list: ApiKeyStatus[] = await getApiKeys();
      const map: Record<string, boolean> = {};
      for (const item of list) {
        map[item.provider] = item.configured;
      }
      setKeyStatuses(map);
    } catch {
      // Backend may not be available during dev; silently ignore
    }
  }, []);

  useEffect(() => {
    fetchKeyStatuses();
  }, [fetchKeyStatuses]);

  const next = searchParams.get("next");
  const modelOptions = PROVIDER_MODELS[provider] ?? [];
  const copy =
    locale === "zh-CN"
      ? {
          title: "设置",
          subtitleDone: "更新你的学习偏好。",
          subtitleFirst: "开始第一次学习前，请先选择 provider。",
          onboarding:
            "V1 首次启动必须先明确选择 provider。当前构建完整支持 Anthropic。",
          apiKeyMgmt: "API 密钥管理",
          apiKeyHint:
            "为每个 provider 配置 API 密钥。密钥安全存储在本地，仅用于 API 请求。",
          activeProviderKey: "当前 provider 密钥",
          keyConfigured: "已配置",
          keyNotConfigured: "未配置",
          keyInputPlaceholder: "输入 API 密钥...",
          validate: "验证",
          validating: "验证中...",
          keyValid: "密钥有效",
          keyInvalid: "密钥无效",
          keyError: "验证失败",
          save: "保存密钥",
          saving: "保存中...",
          delete: "删除",
          deleting: "删除中...",
          manageAllProviders: "管理所有 provider 密钥",
          hideProviders: "收起",
          provider: "Provider",
          providerHint:
            "前端会把所选 provider 显式传给 Rust 聊天和 V2 分析链路。",
          model: "模型",
          language: "语言",
          theme: "主题",
          themeButton:
            theme === "light" ? "切换到深色模式" : "切换到浅色模式",
          continue: "继续",
          back: "返回首页",
          zh: "中文",
          en: "English",
        }
      : {
          title: "Settings",
          subtitleDone: "Update your learning preferences.",
          subtitleFirst:
            "Choose a provider before starting the first learning session.",
          onboarding:
            "First launch requires an explicit provider choice. The current build supports Anthropic end-to-end.",
          apiKeyMgmt: "API Key Management",
          apiKeyHint:
            "Configure API keys for each provider. Keys are stored locally and used only for API requests.",
          activeProviderKey: "Active Provider Key",
          keyConfigured: "Configured",
          keyNotConfigured: "Not configured",
          keyInputPlaceholder: "Enter API key...",
          validate: "Validate",
          validating: "Validating...",
          keyValid: "Key is valid",
          keyInvalid: "Key is invalid",
          keyError: "Validation error",
          save: "Save Key",
          saving: "Saving...",
          delete: "Delete",
          deleting: "Deleting...",
          manageAllProviders: "Manage all provider keys",
          hideProviders: "Collapse",
          provider: "Provider",
          providerHint:
            "The selected provider is passed explicitly to the Rust chat and V2 analysis pipeline.",
          model: "Model",
          language: "Language",
          theme: "Theme",
          themeButton:
            theme === "light" ? "Switch to dark mode" : "Switch to light mode",
          continue: "Continue",
          back: "Back to Home",
          zh: "Chinese",
          en: "English",
        };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const nextModel = (PROVIDER_MODELS[value] ?? [])[0]?.value;
    if (nextModel) {
      setModel(nextModel);
    }
  };

  const handleCompleteSetup = () => {
    completeOnboarding();
    navigate(next || "/");
  };

  // ── API key actions ────────────────────────────────────────────────────

  const handleSaveKey = async (p: string) => {
    const key = keyInputs[p]?.trim();
    if (!key) return;
    setSaving((prev) => ({ ...prev, [p]: true }));
    try {
      await storeApiKey(p, key);
      setKeyStatuses((prev) => ({ ...prev, [p]: true }));
      setValidationMsg((prev) => ({ ...prev, [p]: "" }));
      // Clear input after successful save
      setKeyInputs((prev) => ({ ...prev, [p]: "" }));
    } catch (e) {
      setValidationMsg((prev) => ({
        ...prev,
        [p]: String(e),
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [p]: false }));
    }
  };

  const handleValidateKey = async (p: string) => {
    const key = keyInputs[p]?.trim();
    if (!key) return;
    setValidating((prev) => ({ ...prev, [p]: true }));
    setValidationMsg((prev) => ({ ...prev, [p]: "" }));
    try {
      const valid = await validateApiKey(p, key);
      setValidationMsg((prev) => ({
        ...prev,
        [p]: valid ? copy.keyValid : copy.keyInvalid,
      }));
    } catch (e) {
      setValidationMsg((prev) => ({
        ...prev,
        [p]: `${copy.keyError}: ${String(e)}`,
      }));
    } finally {
      setValidating((prev) => ({ ...prev, [p]: false }));
    }
  };

  const handleDeleteKey = async (p: string) => {
    setDeleting((prev) => ({ ...prev, [p]: true }));
    try {
      await deleteApiKey(p);
      setKeyStatuses((prev) => ({ ...prev, [p]: false }));
      setValidationMsg((prev) => ({ ...prev, [p]: "" }));
      setKeyInputs((prev) => ({ ...prev, [p]: "" }));
    } catch (e) {
      setValidationMsg((prev) => ({
        ...prev,
        [p]: String(e),
      }));
    } finally {
      setDeleting((prev) => ({ ...prev, [p]: false }));
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderProviderKeyRow = (p: string, label: string) => {
    const configured = keyStatuses[p] ?? false;
    const inputVal = keyInputs[p] ?? "";
    const isValidating = validating[p] ?? false;
    const isSaving = saving[p] ?? false;
    const isDeleting = deleting[p] ?? false;
    const msg = validationMsg[p] ?? "";

    const isActive = p === provider;

    return (
      <div
        key={p}
        className={`rounded-xl border p-3 ${
          isActive ? "border-indigo-200 bg-indigo-50/50" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{label}</span>
            {isActive && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                {locale === "zh-CN" ? "当前" : "active"}
              </span>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              configured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {configured ? copy.keyConfigured : copy.keyNotConfigured}
          </span>
        </div>

        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={inputVal}
            onChange={(e) =>
              setKeyInputs((prev) => ({ ...prev, [p]: e.target.value }))
            }
            placeholder={copy.keyInputPlaceholder}
            className="h-9 flex-1 rounded-xl border border-gray-200 px-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSaveKey(p)}
            disabled={isSaving || !inputVal.trim()}
            className="h-8 rounded-xl bg-indigo-500 px-3 text-xs text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? copy.saving : copy.save}
          </button>
          <button
            onClick={() => handleValidateKey(p)}
            disabled={isValidating || !inputVal.trim()}
            className="h-8 rounded-xl border border-gray-200 px-3 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isValidating ? copy.validating : copy.validate}
          </button>
          {configured && (
            <button
              onClick={() => handleDeleteKey(p)}
              disabled={isDeleting}
              className="h-8 rounded-xl border border-red-200 px-3 text-xs text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? copy.deleting : copy.delete}
            </button>
          )}
        </div>

        {msg && (
          <p
            className={`mt-1.5 text-xs ${
              msg === copy.keyValid
                ? "text-emerald-600"
                : msg === copy.keyInvalid
                  ? "text-amber-600"
                  : "text-red-500"
            }`}
          >
            {msg}
          </p>
        )}
      </div>
    );
  };

  const otherProviders = ALL_PROVIDERS.filter((p) => p.value !== provider);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div>
          <h1 className="text-xl font-bold">{copy.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {hasCompletedOnboarding ? copy.subtitleDone : copy.subtitleFirst}
          </p>
        </div>

        {!hasCompletedOnboarding && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {copy.onboarding}
          </div>
        )}

        {/* Provider & Model */}
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <div>
            <h2 className="font-medium">{copy.provider}</h2>
            <p className="mt-1 text-sm text-gray-500">{copy.providerHint}</p>
          </div>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"
          >
            {ALL_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <div>
            <h2 className="font-medium">{copy.model}</h2>
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* API Key Management */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-medium">{copy.apiKeyMgmt}</h2>
          <p className="mt-1 text-sm text-gray-500">{copy.apiKeyHint}</p>

          <div className="mt-3 space-y-3">
            {/* Active provider key row */}
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">
                {copy.activeProviderKey}
              </p>
              {renderProviderKeyRow(
                provider,
                ALL_PROVIDERS.find((p) => p.value === provider)?.label ??
                  provider,
              )}
            </div>

            {/* Toggle for other providers */}
            {otherProviders.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAllProviders((v) => !v)}
                  className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  <span
                    className={`inline-block transition-transform ${
                      showAllProviders ? "rotate-90" : ""
                    }`}
                  >
                    &#9654;
                  </span>
                  {showAllProviders
                    ? copy.hideProviders
                    : copy.manageAllProviders}
                </button>

                {showAllProviders && (
                  <div className="mt-2 space-y-2">
                    {otherProviders.map((p) =>
                      renderProviderKeyRow(p.value, p.label),
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Language */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-medium">{copy.language}</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setLocale("zh-CN")}
              className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                locale === "zh-CN"
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {copy.zh}
            </button>
            <button
              onClick={() => setLocale("en")}
              className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                locale === "en"
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {copy.en}
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-medium">{copy.theme}</h2>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {copy.themeButton}
          </button>
        </div>

        {!hasCompletedOnboarding && (
          <button
            onClick={handleCompleteSetup}
            className="h-10 rounded-xl bg-indigo-500 px-4 text-sm text-white transition-colors hover:bg-indigo-600"
          >
            {copy.continue}
          </button>
        )}

        <Link
          to="/"
          className="block pb-4 text-sm text-gray-400 hover:text-gray-600"
        >
          {copy.back}
        </Link>
      </div>
    </div>
  );
}
