import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";
import { generateKnowledgeMap, type KnowledgeMapOutput } from "../lib/tauri";

type TopicType = "programming" | "non_programming";
type Depth = "overview" | "systematic" | "deep";

const TOPIC_TYPE_OPTIONS: { value: TopicType; label: string }[] = [
  { value: "programming", label: "编程 Programming" },
  { value: "non_programming", label: "非编程 Non-Programming" },
];

const DEPTH_OPTIONS: { value: Depth; label: string; desc: string }[] = [
  { value: "overview", label: "入门概览 Overview", desc: "4个知识域，每个域4个核心概念" },
  { value: "systematic", label: "系统学习 Systematic", desc: "7个知识域，每个域8个核心概念" },
  { value: "deep", label: "深度精通 Deep", desc: "10个知识域，每个域12个核心概念" },
];

export default function TopicDetailPage() {
  const { topic } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.model);
  const locale = useSettingsStore((s) => s.locale);

  const [topicType, setTopicType] = useState<TopicType>("programming");
  const [depth, setDepth] = useState<Depth>("overview");
  const [projectFolder, setProjectFolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicNameFromSlug = (slug: string): string => {
    // Try to find the topic name from the slug if it was passed as a display name
    // The TopicsPage navigates with encodeURIComponent(slug) which could be a display name
    return decodeURIComponent(slug);
  };

  const topicName = topic ? topicNameFromSlug(topic) : "";

  const handleGenerate = async () => {
    if (!topic) return;

    setLoading(true);
    setError(null);

    try {
      // Derive a consistent kebab-case slug from the topic name for DB storage
      const slug = topicName
        .toLowerCase()
        .replace(/[^\w一-鿿]+/g, "-")
        .replace(/^-|-$/g, "");

      const result: KnowledgeMapOutput = await generateKnowledgeMap({
        provider,
        model,
        topicName: topicName,
        topicSlug: slug,
        topicType,
        depth,
      });

      navigate(`/topics/${encodeURIComponent(topic!)}/preview`, {
        state: { knowledgeMap: result },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
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
          projectLabel: "项目文件夹（可选）",
          projectPlaceholder: "选择本地项目路径...",
          generateBtn: "生成知识图谱",
          generating: "正在生成...",
          back: "← 返回主题列表",
        }
      : {
          title: "Generate Knowledge Map",
          typeLabel: "Learning Type",
          depthLabel: "Learning Depth",
          projectLabel: "Project Folder (optional)",
          projectPlaceholder: "Select local project path...",
          generateBtn: "Generate Knowledge Map",
          generating: "Generating...",
          back: "← Back to Topics",
        };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate("/topics")}
          className="mb-6 text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
        >
          {copy.back}
        </button>

        <h1 className="text-2xl font-bold text-gray-900">
          {topicName || "未知主题"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{copy.title}</p>

        <div className="mt-8 space-y-6">
          {/* Step A: Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          {/* Step B: Depth Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          {/* Step C: Project folder (programming only) */}
          {topicType === "programming" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {copy.projectLabel}
              </label>
              <input
                type="text"
                value={projectFolder}
                onChange={(e) => setProjectFolder(e.target.value)}
                placeholder={copy.projectPlaceholder}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Step D: Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !topic}
            className={`w-full rounded-xl py-3 text-sm font-medium text-white transition-all ${
              loading || !topic
                ? "bg-indigo-300 cursor-not-allowed"
                : "bg-indigo-500 hover:bg-indigo-600 shadow-sm"
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {copy.generating}
              </span>
            ) : (
              copy.generateBtn
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
