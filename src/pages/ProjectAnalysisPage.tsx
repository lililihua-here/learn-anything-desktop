import { type DragEvent, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  analyzeProject,
  persistKnowledgeMap,
  scanProjectFiles,
  type CodeUnderstandingMap,
  type KnowledgeMapOutput,
  type ScanResult,
} from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { generateSlug } from "../utils/slug";

type Phase =
  | "idle"
  | "scanning"
  | "scan-complete"
  | "analyzing"
  | "analysis-complete"
  | "error";

type AnalysisRound = "round1" | "round2" | "round3" | "done";

const ROUND_LABELS: Record<AnalysisRound, string> = {
  round1: "第 1 轮：识别技术栈和入口文件",
  round2: "第 2 轮：深入核心源码",
  round3: "第 3 轮：补充剩余模块和缺口",
  done: "分析完成",
};

const CATEGORY_COLORS: Record<string, string> = {
  architecture: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  pattern: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  module: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  dependency: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200",
  "error-handling": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  state: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200",
  communication: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200",
  data: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200",
  auth: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
  testing: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200",
  integration: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-200",
  utility: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200",
  config: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200",
  gap: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  "test-coverage": "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200",
};

function estimateCost(tokenCount: number): string {
  const inputPricePerMtok = 3.0;
  const tokensM = tokenCount / 1_000_000;
  if (tokensM < 0.01) return "< $0.01";
  return `~ $${(tokensM * inputPricePerMtok).toFixed(2)}`;
}

function buildKnowledgeMapFromProject(
  analysis: CodeUnderstandingMap,
): KnowledgeMapOutput {
  const grouped = new Map<
    string,
    KnowledgeMapOutput["domains"][number]
  >();

  analysis.concepts_found.forEach((concept, index) => {
    const domainSlug = generateSlug(concept.category || "project-concepts");
    const domainName = concept.category || "Project Concepts";
    if (!grouped.has(domainSlug)) {
      grouped.set(domainSlug, {
        name: domainName,
        slug: domainSlug,
        concepts: [],
      });
    }

    grouped.get(domainSlug)?.concepts.push({
      name: concept.name,
      slug: generateSlug(`${concept.category}-${concept.name}-${index}`),
      description:
        concept.files.length > 0
          ? `来自 ${concept.files[0]} 的项目概念`
          : "从项目结构中提炼的概念",
      prerequisites: [],
      difficulty: "intermediate",
      estimated_minutes: 15,
    });
  });

  return {
    topic_name: analysis.project_name,
    topic_slug: generateSlug(analysis.project_name),
    topic_type: "programming",
    depth: "project",
    domains: Array.from(grouped.values()),
  };
}

export default function ProjectAnalysisPage() {
  const navigate = useNavigate();
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.model);
  const [path, setPath] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CodeUnderstandingMap | null>(null);
  const [analysisRound, setAnalysisRound] = useState<AnalysisRound>("round1");
  const [error, setError] = useState<string | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);

  const projectKnowledgeMap = useMemo(
    () => (analysisResult ? buildKnowledgeMapFromProject(analysisResult) : null),
    [analysisResult],
  );

  const handleScan = useCallback(async () => {
    const trimmed = path.trim();
    if (!trimmed) return;

    try {
      setPhase("scanning");
      setError(null);
      setAnalysisResult(null);
      setScanResult(null);

      const result = await scanProjectFiles(trimmed);
      setScanResult(result);
      setPhase("scan-complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [path]);

  const handleAnalyze = useCallback(async () => {
    const trimmed = path.trim();
    if (!trimmed || !scanResult) return;

    try {
      setPhase("analyzing");
      setError(null);
      setAnalysisResult(null);
      setAnalysisRound("round1");

      const round2Timer = setTimeout(() => setAnalysisRound("round2"), 1500);
      const round3Timer = setTimeout(() => setAnalysisRound("round3"), 3000);

      const result = await analyzeProject(provider, model, trimmed);
      clearTimeout(round2Timer);
      clearTimeout(round3Timer);
      setAnalysisRound("done");
      setAnalysisResult(result);
      setPhase("analysis-complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [model, path, provider, scanResult]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const first = files[0];
      setPath((first as { path?: string }).path ?? first.name ?? "");
    }
  }, []);

  const handleLearnFromProject = useCallback(async () => {
    if (!projectKnowledgeMap) return;

    try {
      setSavingRoute(true);
      setError(null);
      await persistKnowledgeMap(projectKnowledgeMap);
      navigate(`/topics/${encodeURIComponent(projectKnowledgeMap.topic_name)}/preview`, {
        state: { knowledgeMap: projectKnowledgeMap },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingRoute(false);
    }
  }, [navigate, projectKnowledgeMap]);

  const handleReset = useCallback(() => {
    setPhase("idle");
    setScanResult(null);
    setAnalysisResult(null);
    setError(null);
    setAnalysisRound("round1");
    setSavingRoute(false);
  }, []);

  const renderIdle = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
          项目分析
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          先扫描项目，再在预算内做三轮 AI 分析，最后把提炼出的概念送进学习路径。
        </p>

        <div
          className={`mb-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            path.trim()
              ? "border-indigo-400 bg-indigo-50/60"
              : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-gray-600 dark:bg-gray-800"
          }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            拖入项目文件夹，或者直接输入本地路径
          </p>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleScan()}
            placeholder="例如 D:\Projects\my-app"
            className="h-12 w-full max-w-md rounded-xl border border-gray-200 px-4 text-sm shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <button
          onClick={() => void handleScan()}
          disabled={!path.trim()}
          className="w-full rounded-xl bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          扫描项目
        </button>
      </div>
    </div>
  );

  const renderScanning = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-gray-500 dark:text-gray-400">正在扫描项目文件...</p>
        <p className="mt-1 max-w-md truncate font-mono text-xs text-gray-400 dark:text-gray-500">
          {path}
        </p>
      </div>
    </div>
  );

  const renderScanComplete = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-800 dark:text-gray-100">扫描结果</h2>

        {scanResult && (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <StatCard label="总文件数" value={scanResult.total_files.toLocaleString()} />
            <StatCard label="参与分析" value={scanResult.included_files.length.toLocaleString()} />
            <StatCard label="已跳过" value={scanResult.skipped_files.length.toLocaleString()} />
            <StatCard label="预估 Tokens" value={scanResult.estimated_tokens.toLocaleString()} />
          </div>
        )}

        {scanResult && (
          <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">预估费用：</span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {estimateCost(scanResult.estimated_tokens)}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            返回
          </button>
          <button
            onClick={() => void handleAnalyze()}
            className="flex-1 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            开始分析
          </button>
        </div>
      </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-200">
          {ROUND_LABELS[analysisRound]}
        </p>
        <div className="mx-auto flex max-w-xs gap-2">
          <StepBubble active={analysisRound === "round1"} done={analysisRound !== "round1"} label="R1" />
          <StepBubble active={analysisRound === "round2"} done={analysisRound === "round3" || analysisRound === "done"} label="R2" />
          <StepBubble active={analysisRound === "round3"} done={analysisRound === "done"} label="R3" />
        </div>
      </div>
    </div>
  );

  const renderAnalysisComplete = () => (
    <div className="mx-auto max-w-3xl p-8">
      <h2 className="mb-6 text-xl font-bold text-gray-800 dark:text-gray-100">
        分析结果：{analysisResult?.project_name ?? "Untitled"}
      </h2>

      {analysisResult && analysisResult.tech_stack.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">技术栈</h3>
          <div className="flex flex-wrap gap-2">
            {analysisResult.tech_stack.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysisResult && analysisResult.concepts_found.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
            提炼出的概念 ({analysisResult.concepts_found.length})
          </h3>
          <div className="space-y-3">
            {analysisResult.concepts_found.map((concept) => (
              <div
                key={`${concept.category}-${concept.name}`}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {concept.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[concept.category] ??
                      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {concept.category}
                  </span>
                </div>
                {concept.files.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {concept.files.map((file) => (
                      <code
                        key={file}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        {file}
                      </code>
                    ))}
                  </div>
                )}
                {concept.line_refs.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {concept.line_refs.map((ref) => (
                      <span
                        key={ref}
                        className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-mono text-blue-600 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="flex-1 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          分析其他项目
        </button>
        <button
          onClick={() => void handleLearnFromProject()}
          disabled={!projectKnowledgeMap || savingRoute}
          className="flex-1 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {savingRoute ? "正在生成学习路径..." : "把结果送入学习路径"}
        </button>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <h2 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">分析失败</h2>
        <p className="mb-6 break-all text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={handleReset}
          className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
        >
          重试
        </button>
      </div>
    </div>
  );

  switch (phase) {
    case "idle":
      return renderIdle();
    case "scanning":
      return renderScanning();
    case "scan-complete":
      return renderScanComplete();
    case "analyzing":
      return renderAnalyzing();
    case "analysis-complete":
      return renderAnalysisComplete();
    case "error":
      return renderError();
    default:
      return renderIdle();
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function StepBubble({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  let cls = "h-1.5 flex-1 rounded-full transition-colors ";
  if (done) cls += "bg-green-500";
  else if (active) cls += "bg-indigo-500 animate-pulse";
  else cls += "bg-gray-200 dark:bg-gray-600";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cls} />
      <span
        className={`text-xs ${
          done
            ? "text-green-600 dark:text-green-400"
            : active
              ? "text-indigo-500"
              : "text-gray-400 dark:text-gray-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
