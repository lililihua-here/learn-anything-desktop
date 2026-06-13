import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { KnowledgeMapOutput } from "../lib/tauri";

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
  isCustom: boolean;
  selected: boolean;
}

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
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
  const knowledgeMap = location.state?.knowledgeMap as
    | KnowledgeMapOutput
    | undefined;

  const [concepts, setConcepts] = useState<LocalConcept[]>(() => {
    if (!knowledgeMap) return [];
    return knowledgeMap.domains.flatMap((domain) =>
      domain.concepts.map((concept) => ({
        id: `${domain.slug}-${concept.slug}`,
        domainSlug: domain.slug,
        domainName: domain.name,
        name: concept.name,
        slug: concept.slug,
        description: concept.description,
        difficulty: normalizeDifficulty(concept.difficulty),
        estimatedMinutes: concept.estimated_minutes,
        isCustom: false,
        selected: true,
      })),
    );
  });

  const [addFormVisible, setAddFormVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>("intermediate");
  const [newMinutes, setNewMinutes] = useState(15);

  const selectedConcepts = concepts.filter((c) => c.selected);
  const totalMinutes = selectedConcepts.reduce(
    (sum, c) => sum + c.estimatedMinutes,
    0,
  );

  const groupedByDomain = concepts.reduce<
    Record<string, { domainName: string; concepts: LocalConcept[] }>
  >((acc, c) => {
    if (!acc[c.domainSlug]) {
      acc[c.domainSlug] = { domainName: c.domainName, concepts: [] };
    }
    acc[c.domainSlug].concepts.push(c);
    return acc;
  }, {});

  const toggleSelect = (id: string) => {
    setConcepts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
    );
  };

  const removeConcept = (id: string) => {
    setConcepts((prev) => prev.filter((c) => c.id !== id));
  };

  const addCustomConcept = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id = nextId();
    const slug = trimmed
      .toLowerCase()
      .replace(/[^\w一-鿿]+/g, "-")
      .replace(/^-|-$/g, "");
    const newConcept: LocalConcept = {
      id,
      domainSlug: "custom",
      domainName: "Custom",
      name: trimmed,
      slug,
      description: newDescription.trim() || "Custom added concept",
      difficulty: newDifficulty,
      estimatedMinutes: newMinutes,
      isCustom: true,
      selected: true,
    };
    setConcepts((prev) => [...prev, newConcept]);
    setNewName("");
    setNewDescription("");
    setNewDifficulty("intermediate");
    setNewMinutes(15);
    setAddFormVisible(false);
  };

  // ---- Empty state: no knowledge map data ----
  if (!knowledgeMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">
            No route data
          </h2>
          <p className="text-sm text-gray-400">
            Please generate a knowledge map first.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ---- Main view ----
  return (
    <div className="flex h-full">
      {/* ===== Left: Concept list ===== */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {knowledgeMap.topic_name}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Route preview — toggle or remove concepts to adjust your learning
              path
            </p>
          </div>
          <button
            onClick={() =>
              navigate(
                `/topics/${encodeURIComponent(knowledgeMap.topic_name)}`,
              )
            }
            className="shrink-0 text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
          >
            Back to topic
          </button>
        </div>

        {/* Domain groups */}
        {Object.entries(groupedByDomain).map(([domainSlug, domain]) => (
          <div key={domainSlug} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              {domain.domainName}
            </h2>
            <div className="space-y-2">
              {domain.concepts.map((concept, idx) => (
                <button
                  key={concept.id}
                  onClick={() => toggleSelect(concept.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                    concept.selected
                      ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
                      : "border-gray-200 bg-white opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Sequence number */}
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        concept.selected
                          ? "bg-indigo-500 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    {/* Concept info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            concept.selected
                              ? "text-gray-900"
                              : "text-gray-500"
                          }`}
                        >
                          {concept.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            DIFFICULTY_COLORS[concept.difficulty]
                          }`}
                        >
                          {DIFFICULTY_LABELS[concept.difficulty]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400 truncate">
                        {concept.description}
                      </p>
                      <p className="mt-1 text-xs text-gray-300">
                        ~{concept.estimatedMinutes} min
                      </p>
                    </div>

                    {/* Delete button — only on selected concepts */}
                    {concept.selected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeConcept(concept.id);
                        }}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Remove concept"
                      >
                        &#x2715;
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* ---- Add concept form ---- */}
        <div className="mt-2 pb-8">
          {addFormVisible ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Concept name"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                autoFocus
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <div className="flex gap-2">
                <select
                  value={newDifficulty}
                  onChange={(e) =>
                    setNewDifficulty(e.target.value as Difficulty)
                  }
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <input
                  type="number"
                  value={newMinutes}
                  onChange={(e) =>
                    setNewMinutes(Math.max(1, Number(e.target.value) || 0))
                  }
                  min={1}
                  placeholder="Minutes"
                  className="h-10 w-24 rounded-lg border border-gray-200 px-3 text-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addCustomConcept}
                  disabled={!newName.trim()}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                    newName.trim()
                      ? "bg-indigo-500 hover:bg-indigo-600"
                      : "bg-indigo-300 cursor-not-allowed"
                  }`}
                >
                  Add
                </button>
                <button
                  onClick={() => setAddFormVisible(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddFormVisible(true)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
            >
              + Add custom concept
            </button>
          )}
        </div>
      </div>

      {/* ===== Right: Sidebar ===== */}
      <div className="w-72 shrink-0 border-l border-gray-100 bg-gray-50/50 p-6 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-700">Route Summary</h3>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-400">Selected concepts</p>
            <p className="text-2xl font-bold text-gray-900">
              {selectedConcepts.length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-400">Estimated total time</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalMinutes} min
            </p>
          </div>
        </div>

        <div className="mt-6 flex-1 overflow-hidden">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Learning path
          </h4>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {selectedConcepts.slice(0, 20).map((concept, idx) => (
              <div
                key={concept.id}
                className="flex items-center gap-2 text-xs text-gray-600"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-600">
                  {idx + 1}
                </span>
                <span className="truncate">{concept.name}</span>
              </div>
            ))}
            {selectedConcepts.length > 20 && (
              <p className="text-xs text-gray-400 pt-1">
                ...and {selectedConcepts.length - 20} more
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() =>
            navigate(`/mindmap/${encodeURIComponent(knowledgeMap.topic_name)}`)
          }
          disabled={selectedConcepts.length === 0}
          className={`mt-4 w-full rounded-xl py-3 text-sm font-medium text-white transition-all ${
            selectedConcepts.length > 0
              ? "bg-indigo-500 hover:bg-indigo-600 shadow-sm"
              : "bg-indigo-300 cursor-not-allowed"
          }`}
        >
          Start Learning
        </button>
      </div>
    </div>
  );
}
