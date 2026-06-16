import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLocale } from "../i18n/useLocale";
import { persistKnowledgeMap, type KnowledgeMapOutput } from "../lib/tauri";
import { generateSlug } from "../utils/slug";

type Difficulty = "beginner" | "intermediate" | "advanced";

interface LocalConcept {
  id: string;
  domainSlug: string;
  domainName: string;
  name: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  selected: boolean;
}

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  advanced: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

function normalizeDifficulty(raw: string): Difficulty {
  const lower = raw.toLowerCase();
  if (lower.includes("beginner") || lower.includes("easy")) return "beginner";
  if (lower.includes("advanced") || lower.includes("hard")) return "advanced";
  return "intermediate";
}

let conceptIdCounter = 0;
function nextId(): string {
  conceptIdCounter += 1;
  return `custom-${conceptIdCounter}-${Date.now()}`;
}

export default function RoutePreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const L = useLocale();
  const knowledgeMap = location.state?.knowledgeMap as KnowledgeMapOutput | undefined;

  const [concepts, setConcepts] = useState<LocalConcept[]>(() => {
    if (!knowledgeMap) return [];
    return knowledgeMap.domains.flatMap((domain) =>
      domain.concepts.map((concept, index) => ({
        id: `${domain.slug}-${concept.slug}-${index}`,
        domainSlug: domain.slug,
        domainName: domain.name,
        name: concept.name,
        slug: concept.slug,
        description: concept.description,
        difficulty: normalizeDifficulty(concept.difficulty),
        estimatedMinutes: concept.estimated_minutes,
        selected: true,
      })),
    );
  });
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>("intermediate");
  const [newMinutes, setNewMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const difficultyLabels: Record<Difficulty, string> = {
    beginner: L.routePreview.difficultyBeginner,
    intermediate: L.routePreview.difficultyIntermediate,
    advanced: L.routePreview.difficultyAdvanced,
  };

  const selectedConcepts = useMemo(
    () => concepts.filter((concept) => concept.selected),
    [concepts],
  );
  const totalMinutes = selectedConcepts.reduce((sum, concept) => sum + concept.estimatedMinutes, 0);

  const toggleSelect = (id: string) => {
    setConcepts((prev) =>
      prev.map((concept) =>
        concept.id === id ? { ...concept, selected: !concept.selected } : concept,
      ),
    );
  };

  const removeConcept = (id: string) => {
    setConcepts((prev) => prev.filter((concept) => concept.id !== id));
  };

  const moveConcept = (id: string, direction: -1 | 1) => {
    setConcepts((prev) => {
      const index = prev.findIndex((concept) => concept.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const addCustomConcept = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setConcepts((prev) => [
      ...prev,
      {
        id: nextId(),
        domainSlug: "custom",
        domainName: L.routePreview.customDomain,
        name: trimmed,
        slug: generateSlug(trimmed),
        description: newDescription.trim() || L.routePreview.customDefaultDescription,
        difficulty: newDifficulty,
        estimatedMinutes: newMinutes,
        selected: true,
      },
    ]);
    setNewName("");
    setNewDescription("");
    setNewDifficulty("intermediate");
    setNewMinutes(15);
  };

  const buildPersistedMap = (): KnowledgeMapOutput | null => {
    if (!knowledgeMap) return null;

    const orderedDomains = new Map<
      string,
      { name: string; slug: string; concepts: KnowledgeMapOutput["domains"][number]["concepts"] }
    >();

    selectedConcepts.forEach((concept) => {
      if (!orderedDomains.has(concept.domainSlug)) {
        orderedDomains.set(concept.domainSlug, {
          name: concept.domainName,
          slug: concept.domainSlug,
          concepts: [],
        });
      }

      orderedDomains.get(concept.domainSlug)?.concepts.push({
        name: concept.name,
        slug: concept.slug,
        description: concept.description,
        prerequisites: [],
        difficulty: concept.difficulty,
        estimated_minutes: concept.estimatedMinutes,
      });
    });

    return {
      ...knowledgeMap,
      domains: Array.from(orderedDomains.values()),
    };
  };

  const handleStartLearning = async () => {
    const persistedMap = buildPersistedMap();
    if (!persistedMap || selectedConcepts.length === 0) return;

    try {
      setSaving(true);
      setError(null);
      await persistKnowledgeMap(persistedMap);
      navigate(`/mindmap/${encodeURIComponent(persistedMap.topic_slug)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!knowledgeMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            {L.routePreview.emptyTitle}
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">{L.routePreview.emptyHint}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-indigo-500 transition-colors hover:text-indigo-600"
          >
            {L.routePreview.goBack}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-slate-950">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {knowledgeMap.topic_name}
            </h1>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{L.routePreview.intro}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 text-sm text-indigo-500 transition-colors hover:text-indigo-600"
          >
            {L.routePreview.backToTopic}
          </button>
        </div>

        <div className="space-y-3">
          {concepts.map((concept, index) => (
            <div
              key={concept.id}
              className={`rounded-xl border px-4 py-3 transition-all dark:border-gray-700 ${
                concept.selected
                  ? "border-indigo-200 bg-white shadow-sm dark:border-indigo-500/30 dark:bg-gray-900"
                  : "border-gray-200 bg-gray-50 opacity-70 dark:bg-gray-900/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleSelect(concept.id)}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    concept.selected
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {index + 1}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {concept.name}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      {concept.domainName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[concept.difficulty]}`}
                    >
                      {difficultyLabels[concept.difficulty]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {concept.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {L.routePreview.estimated.replace("{minutes}", String(concept.estimatedMinutes))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveConcept(concept.id, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {L.routePreview.moveUp}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveConcept(concept.id, 1)}
                    disabled={index === concepts.length - 1}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {L.routePreview.moveDown}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConcept(concept.id)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10"
                  >
                    {L.routePreview.remove}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {L.routePreview.customTitle}
          </h2>
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={L.routePreview.customName}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={L.routePreview.customDescription}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value as Difficulty)}
                className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="beginner">{L.routePreview.difficultyBeginner}</option>
                <option value="intermediate">{L.routePreview.difficultyIntermediate}</option>
                <option value="advanced">{L.routePreview.difficultyAdvanced}</option>
              </select>
              <input
                type="number"
                value={newMinutes}
                min={1}
                onChange={(e) => setNewMinutes(Math.max(1, Number(e.target.value) || 0))}
                className="h-10 w-28 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={addCustomConcept}
                disabled={!newName.trim()}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {L.routePreview.add}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-72 shrink-0 flex-col border-l border-gray-100 bg-gray-50/50 p-6 dark:border-gray-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {L.routePreview.summary}
        </h3>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs text-gray-400 dark:text-gray-500">{L.routePreview.selectedCount}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {selectedConcepts.length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs text-gray-400 dark:text-gray-500">{L.routePreview.totalDuration}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalMinutes} {L.routePreview.minutesLabel}
            </p>
          </div>
        </div>

        <div className="mt-6 flex-1 overflow-hidden">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {L.routePreview.orderTitle}
          </h4>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {selectedConcepts.map((concept, index) => (
              <div
                key={concept.id}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {index + 1}
                </span>
                <span className="truncate">{concept.name}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleStartLearning}
          disabled={selectedConcepts.length === 0 || saving}
          className={`mt-4 w-full rounded-xl py-3 text-sm font-medium text-white transition-all ${
            selectedConcepts.length > 0 && !saving
              ? "bg-indigo-500 shadow-sm hover:bg-indigo-600"
              : "cursor-not-allowed bg-indigo-300"
          }`}
        >
          {saving ? L.routePreview.saving : L.routePreview.saveAndOpen}
        </button>
      </div>
    </div>
  );
}
