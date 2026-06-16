import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { generateKnowledgeMap, type KnowledgeMapOutput } from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { useLocale } from "../i18n/useLocale";
import { generateSlug } from "../utils/slug";

type TopicType = "programming" | "non_programming";
type Depth = "overview" | "systematic" | "deep";

export default function TopicDetailPage() {
  const { topic } = useParams<{ topic: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.model);
  const locale = useSettingsStore((s) => s.locale);
  const L = useLocale();

  const topicTypeOptions: { value: TopicType; label: string }[] =
    locale === "zh-CN"
      ? [
          { value: "programming", label: "编程类" },
          { value: "non_programming", label: "非编程类" },
        ]
      : [
          { value: "programming", label: "Programming" },
          { value: "non_programming", label: "Non-programming" },
        ];

  const depthOptions: { value: Depth; label: string; desc: string }[] =
    locale === "zh-CN"
      ? [
          { value: "overview", label: "入门概览", desc: "4 个知识域，每个知识域 4 个核心概念" },
          { value: "systematic", label: "系统学习", desc: "7 个知识域，每个知识域 8 个核心概念" },
          { value: "deep", label: "深度精进", desc: "10 个知识域，每个知识域 12 个核心概念" },
        ]
      : [
          { value: "overview", label: "Overview", desc: "4 domains with 4 core concepts each" },
          { value: "systematic", label: "Systematic", desc: "7 domains with 8 core concepts each" },
          { value: "deep", label: "Deep", desc: "10 domains with 12 core concepts each" },
        ];

  const [topicType, setTopicType] = useState<TopicType>("programming");
  const [depth, setDepth] = useState<Depth>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicName =
    (location.state as { topicName?: string } | null)?.topicName ??
    (topic ? decodeURIComponent(topic) : "");

  const handleGenerate = async () => {
    if (!topicName) return;

    setLoading(true);
    setError(null);

    try {
      const result: KnowledgeMapOutput = await generateKnowledgeMap({
        provider,
        model,
        topicName,
        topicSlug: generateSlug(topicName),
        topicType,
        depth,
      });

      navigate(`/topics/${encodeURIComponent(topicName)}/preview`, {
        state: { knowledgeMap: result },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate("/topics")}
          className="mb-6 text-sm text-indigo-500 transition-colors hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          {L.topicDetail.back}
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {topicName || L.topicDetail.unknown}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{L.topicDetail.title}</p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {L.topicDetail.typeLabel}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {topicTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTopicType(opt.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                    topicType === opt.value
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/10 dark:text-indigo-200"
                      : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-indigo-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {L.topicDetail.depthLabel}
            </label>
            <div className="space-y-2">
              {depthOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDepth(opt.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                    depth === opt.value
                      ? "border-indigo-400 bg-indigo-50 shadow-sm dark:bg-indigo-500/10"
                      : "border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-400"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      depth === opt.value
                        ? "text-indigo-700 dark:text-indigo-200"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {topicType === "programming" && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-300">{L.topicDetail.projectHint}</p>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="mt-3 text-sm font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                {L.topicDetail.projectAction}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !topicName}
            className={`w-full rounded-xl py-3 text-sm font-medium text-white transition-all ${
              loading || !topicName
                ? "cursor-not-allowed bg-indigo-300"
                : "bg-indigo-500 shadow-sm hover:bg-indigo-600"
            }`}
          >
            {loading ? L.topicDetail.generating : L.topicDetail.generateBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
