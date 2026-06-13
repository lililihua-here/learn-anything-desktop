import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
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

  const next = searchParams.get("next");
  const modelOptions = PROVIDER_MODELS[provider] ?? [];
  const copy =
    locale === "zh-CN"
      ? {
          title: "设置",
          subtitleDone: "更新你的学习偏好。",
          subtitleFirst: "开始第一次学习前，请先选择 provider。",
          onboarding: "首次启动必须先明确选择 provider。当前构建只完整支持 Anthropic。",
          apiKey: "API Key",
          apiHint: "当前构建从环境变量读取 provider 凭证。",
          provider: "Provider",
          providerHint: "前端会把所选 provider 显式传给 Rust 聊天链路。",
          model: "模型",
          language: "语言",
          theme: "主题",
          themeButton: theme === "light" ? "切换到深色模式" : "切换到浅色模式",
          continue: "继续",
          back: "返回首页",
          zh: "中文",
          en: "English",
        }
      : {
          title: "Settings",
          subtitleDone: "Update your learning preferences.",
          subtitleFirst: "Choose a provider before starting the first learning session.",
          onboarding: "First launch requires an explicit provider choice. The current build supports Anthropic end-to-end.",
          apiKey: "API Key",
          apiHint: "This build reads provider credentials from environment variables.",
          provider: "Provider",
          providerHint: "The selected provider is passed explicitly to the Rust chat pipeline.",
          model: "Model",
          language: "Language",
          theme: "Theme",
          themeButton: theme === "light" ? "Switch to dark mode" : "Switch to light mode",
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

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-medium">{copy.apiKey}</h2>
          <p className="text-sm text-gray-500">{copy.apiHint}</p>
          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
            {provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}
          </p>
        </div>

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
            <option value="anthropic">Anthropic</option>
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

        <Link to="/" className="block pb-4 text-sm text-gray-400 hover:text-gray-600">
          {copy.back}
        </Link>
      </div>
    </div>
  );
}
