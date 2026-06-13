import { useState } from "react";

// ---- Types ----

export interface MaterialSource {
  id: string;
  name: string;
  type: "local-file" | "local-folder" | "url" | "github-repo";
  path: string;
  addedAt: string;
}

type InputMode = "none" | "folder" | "file" | "url" | "github";

// ---- Component ----

interface MaterialsLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
}

export default function MaterialsLibrary({
  isOpen,
  onClose,
  projectPath,
}: MaterialsLibraryProps) {
  const [sources, setSources] = useState<MaterialSource[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("none");
  const [inputValue, setInputValue] = useState("");
  const [consentPending, setConsentPending] = useState<string | null>(null); // source id waiting for consent

  const addSource = (name: string, type: MaterialSource["type"], inputPath: string) => {
    const newSource: MaterialSource = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      type,
      path: inputPath,
      addedAt: new Date().toISOString(),
    };
    setSources((prev) => [...prev, newSource]);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddLocal = (mode: "folder" | "file") => {
    setInputMode(mode);
    setInputValue("");
  };

  const handleAddUrl = () => {
    setInputMode("url");
    setInputValue("");
  };

  const handleAddGitHub = () => {
    setInputMode("github");
    setInputValue("");
  };

  const handleConfirmInput = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (inputMode === "folder") {
      addSource(trimmed.split(/[/\\]/).pop() ?? trimmed, "local-folder", trimmed);
    } else if (inputMode === "file") {
      addSource(trimmed.split(/[/\\]/).pop() ?? trimmed, "local-file", trimmed);
    } else if (inputMode === "url") {
      addSource(trimmed, "url", trimmed);
    } else if (inputMode === "github") {
      addSource(trimmed, "github-repo", trimmed);
    }

    setInputMode("none");
    setInputValue("");
  };

  const handleCancelInput = () => {
    setInputMode("none");
    setInputValue("");
    setConsentPending(null);
  };

  const handleConsentAnalyze = (sourceId: string) => {
    setConsentPending(sourceId);
  };

  const handleConfirmAnalyze = () => {
    // Navigate to project analysis with the source
    // For URL/GitHub sources, the consent gate confirms the user wants to fetch
    if (consentPending) {
      const source = sources.find((s) => s.id === consentPending);
      if (source) {
        // In a full implementation, this would trigger a fetch + analysis
        // For now, set the project path and let the parent know
        setConsentPending(null);
      }
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Materials</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close materials"
        >
          ✕
        </button>
      </div>

      {/* Project context */}
      {projectPath && (
        <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">Project: {projectPath}</p>
        </div>
      )}

      {/* Add buttons */}
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={() => handleAddLocal("folder")} label="Add Folder" icon="📁" />
          <ActionButton onClick={() => handleAddLocal("file")} label="Add File" icon="📄" />
          <ActionButton onClick={handleAddUrl} label="Add URL" icon="🔗" />
          <ActionButton onClick={handleAddGitHub} label="GitHub Repo" icon="🐙" />
        </div>
        {projectPath && (
          <button
            onClick={() => addSource(projectPath.split(/[/\\]/).pop() ?? projectPath, "local-folder", projectPath)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            ↻ Replace Project
          </button>
        )}
      </div>

      {/* Input area (shown when a mode is active) */}
      {inputMode !== "none" && (
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>
              {inputMode === "folder"
                ? "📁 Folder path:"
                : inputMode === "file"
                  ? "📄 File path:"
                  : inputMode === "url"
                    ? "🔗 URL:"
                    : "🐙 GitHub repo URL:"}
            </span>
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirmInput()}
            placeholder={
              inputMode === "folder"
                ? "/path/to/folder"
                : inputMode === "file"
                  ? "/path/to/file.ext"
                  : inputMode === "url"
                    ? "https://..."
                    : "https://github.com/owner/repo"
            }
            autoFocus
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirmInput}
              disabled={!inputValue.trim()}
              className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={handleCancelInput}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Consent gate */}
      {consentPending !== null && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/30">
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
            This will fetch and analyze content from the link. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmAnalyze}
              className="flex-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600"
            >
              Analyze
            </button>
            <button
              onClick={handleCancelInput}
              className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sources list */}
      <div className="flex-1 overflow-y-auto p-4">
        {sources.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No materials added yet.
            <br />
            Add files, folders, URLs, or repos above.
          </div>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li
                key={source.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                      {source.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">
                      {source.path}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSource(source.id)}
                    className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${source.name}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {TYPE_LABELS[source.type]}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(source.addedAt)}
                  </span>
                </div>
                {(source.type === "url" || source.type === "github-repo") && (
                  <div className="mt-2">
                    <button
                      onClick={() => handleConsentAnalyze(source.id)}
                      className="w-full rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                    >
                      Analyze this {source.type === "url" ? "link" : "repo"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Helpers ----

const TYPE_LABELS: Record<MaterialSource["type"], string> = {
  "local-file": "File",
  "local-folder": "Folder",
  url: "URL",
  "github-repo": "GitHub",
};

function ActionButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300 dark:hover:border-primary dark:hover:text-primary"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
