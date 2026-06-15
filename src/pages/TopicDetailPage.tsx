import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { generateKnowledgeMap, type KnowledgeMapOutput } from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { generateSlug } from "../utils/slug";

type TopicType = "programming" | "non_programming";
type Depth = "overview" | "systematic" | "deep";

const TOPIC_TYPE_OPTIONS: { value: TopicType; label: string }[] = [
  { value: "programming", label: "编程类 Programming" },
  { value: "non_programming", label: "非编程类 Non-programming" },
];

const DEPTH_OPTIONS: { value: Depth; label: string; desc: string }[] = [
  { value: "overview", label: "入门概览 Overview", desc: "4 个知识域，每个知识域 4 个核心概念" },
  { value: "systematic", label: "系统学习 Systematic", desc: "7 个知识域，每个知识域 8 个核心概念" },
  { value: "deep", label: "深度精进 Deep", desc: "10 个知识域，每个知识域 12 个核心概念" },
];

export default function TopicDetailPage() {
  const { topic } = useParams<{ topic: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.model);
  const locale = useSettingsStore((s) => s.locale);

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

  const copy =
    locale === "zh-CN"
      ? {
          title: "生成知识图谱",
          typeLabel: "学习类型",
          depthLabel: "学习深度",
          projectHint: "如果你想从真实代码项目中反推知识路线，请改走“项目分析”入口。",
          projectAction: "前往项目分析",
          generateBtn: "生成知识图谱",
          generating: "正在生成...",
          back: "返回主题列表",
          unknown: "未命名主题",
        }
      : {
          title: "Generate Knowledge Map",
          typeLabel: "Learning Type",
          depthLabel: "Learning Depth",
          projectHint: "If you want to learn from a real codebase, use the project analysis flow instead of topic generation.",
          projectAction: "Open Project Analysis",
          generateBtn: "Generate Knowledge Map",
          generating: "Generating...",
          back: "Back to Topics",
          unknown: "Untitled Topic",
        };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate("/topics")}
          className="mb-6 text-sm text-indigo-500 transition-colors hover:text-indigo-600"
        >
          {copy.back}
        </button>

        <h1 className="text-2xl font-bold text-gray-900">
          {topicName || copy.unknown}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{copy.title}</p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {copy.typeLabel}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TOPIC_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTopicType(opt.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                    topicType === opt.value
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {copy.depthLabel}
            </label>
            <div className="space-y-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDepth(opt.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                    depth === opt.value
                      ? "border-indigo-400 bg-indigo-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      depth === opt.value ? "text-indigo-700" : "text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {topicType === "programming" && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm text-gray-600">{copy.projectHint}</p>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="mt-3 text-sm font-medium text-indigo-500 hover:text-indigo-600"
              >
                {copy.projectAction}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
            {loading ? copy.generating : copy.generateBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
