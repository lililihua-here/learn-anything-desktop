import { useState } from "react";
import { useLocale } from "../../i18n/useLocale";

export interface MaterialSource {
  id: string;
  name: string;
  type: "local-file" | "local-folder" | "url" | "github-repo";
  path: string;
  addedAt: string;
}

type InputMode = "none" | "folder" | "file" | "url" | "github";

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
  const L = useLocale();

  const TYPE_LABELS: Record<MaterialSource["type"], string> = {
    "local-file": L.materials.addFile,
    "local-folder": L.materials.addFolder,
    url: L.materials.addUrl,
    "github-repo": L.materials.addGithub,
  };

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
    setSources((prev) => prev.filter((source) => source.id !== id));
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{L.materials.title}</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
          aria-label={L.materials.closeAriaLabel}
        >
          X
        </button>
      </div>

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {L.materials.warning}
      </div>

      {projectPath && (
        <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-700">
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">
            {L.materials.projectPrefix}
            {projectPath}
          </p>
        </div>
      )}

      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={() => setInputMode("folder")} label={L.materials.addFolder} />
          <ActionButton onClick={() => setInputMode("file")} label={L.materials.addFile} />
          <ActionButton onClick={() => setInputMode("url")} label={L.materials.addUrl} />
          <ActionButton onClick={() => setInputMode("github")} label={L.materials.addGithub} />
        </div>
      </div>

      {inputMode !== "none" && (
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {inputMode === "folder"
              ? L.materials.folderPath
              : inputMode === "file"
                ? L.materials.filePath
                : inputMode === "url"
                  ? L.materials.urlPath
                  : L.materials.githubPath}
          </p>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirmInput()}
            placeholder={
              inputMode === "folder"
                ? L.materials.folderPlaceholder
                : inputMode === "file"
                  ? L.materials.filePlaceholder
                  : inputMode === "url"
                    ? L.materials.urlPlaceholder
                    : L.materials.githubPlaceholder
            }
            autoFocus
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirmInput}
              disabled={!inputValue.trim()}
              className="flex-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {L.materials.add}
            </button>
            <button
              onClick={() => {
                setInputMode("none");
                setInputValue("");
              }}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {L.materials.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {sources.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {L.materials.emptyState}
            <br />
            {L.materials.emptyStateHint}
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
                    <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                      {source.path}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSource(source.id)}
                    className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:text-red-500"
                    aria-label={L.materials.removeAriaLabel.replace("{name}", source.name)}
                  >
                    X
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-400 hover:text-indigo-500 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
    >
      {label}
    </button>
  );
}
