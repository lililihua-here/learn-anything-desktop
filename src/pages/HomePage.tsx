import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";
import { useLocale } from "../i18n/useLocale";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const L = useLocale();

  const tags: string[] = [
    "What is an API?",
    "Python basics",
    "Closures",
    "How HTTP works",
    "Git basics",
  ];

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
          {tags.map((tag) => (
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
            placeholder={L.homepage.searchPlaceholder}
            className="h-14 w-full rounded-2xl border border-gray-200 px-6 text-lg shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
          <button
            onClick={() => handleSearch(query)}
            className="absolute right-2 top-2 flex h-10 min-w-12 items-center justify-center rounded-xl bg-indigo-500 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            {L.homepage.submit}
          </button>
        </div>
        {!hasCompletedOnboarding && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {L.homepage.onboarding}
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
            {L.homepage.browseTopics}
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
            {L.homepage.learnFromProject}
          </a>
        </p>
        <p className="mt-2 text-center text-sm text-gray-400">{L.homepage.hint}</p>
      </div>
    </div>
  );
}
