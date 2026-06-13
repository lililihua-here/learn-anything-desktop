import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const locale = useSettingsStore((s) => s.locale);

  const copy =
    locale === "zh-CN"
      ? {
          tags: ["什么是 API？", "Python 基础", "闭包", "HTTP 原理", "Git 入门"],
          placeholder: "你想学什么？",
          submit: "开始",
          onboarding: "开始第一次学习前，请先在设置中选择 AI provider。",
          hint: "输入一个你听过但还没真正理解的技术概念",
        }
      : {
          tags: ["What is an API?", "Python basics", "Closures", "How HTTP works", "Git basics"],
          placeholder: "What do you want to learn?",
          submit: "Go",
          onboarding: "Choose your AI provider in Settings before starting the first learning session.",
          hint: "Try entering a technical term you've heard but don't fully understand",
        };

  const handleSearch = (concept: string) => {
    const trimmed = concept.trim();
    if (!trimmed) return;

    const next = `/learn/${encodeURIComponent(trimmed)}`;
    navigate(
      hasCompletedOnboarding
        ? next
        : `/settings?next=${encodeURIComponent(next)}`,
    );
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {copy.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleSearch(tag)}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-500"
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            placeholder={copy.placeholder}
            className="h-14 w-full rounded-2xl border border-gray-200 px-6 text-lg shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
          <button
            onClick={() => handleSearch(query)}
            className="absolute right-2 top-2 flex h-10 min-w-12 items-center justify-center rounded-xl bg-indigo-500 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            {copy.submit}
          </button>
        </div>
        {!hasCompletedOnboarding && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {copy.onboarding}
          </div>
        )}
        <p className="mt-4 text-center text-sm text-gray-400">
          <a
            href="/topics"
            onClick={(e) => {
              e.preventDefault();
              navigate("/topics");
            }}
            className="text-indigo-500 hover:text-indigo-600 hover:underline"
          >
            或浏览热门主题 →
          </a>
        </p>
        <p className="mt-2 text-center text-sm text-gray-400">
          <a
            href="/projects"
            onClick={(e) => {
              e.preventDefault();
              navigate("/projects");
            }}
            className="text-indigo-500 hover:text-indigo-600 hover:underline"
          >
            📁 Learn from a Project
          </a>
        </p>
        <p className="mt-2 text-center text-sm text-gray-400">{copy.hint}</p>
      </div>
    </div>
  );
}
