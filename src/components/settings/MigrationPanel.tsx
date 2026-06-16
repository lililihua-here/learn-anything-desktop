import { useCallback, useEffect, useState } from "react";
import {
  exportState,
  getAppSettings,
  importStateBytes,
} from "../../lib/tauri";
import { useLocale } from "../../i18n/useLocale";
import { showToast } from "../common/Toast";

export default function MigrationPanel() {
  const L = useLocale();
  const copy = L.migration;
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const settings = await getAppSettings();
        const lastExport = settings.find((item) => item.key === "last_export_at")?.value ?? null;
        if (!cancelled) {
          setLastExportAt(lastExport);
        }
      } catch {
        if (!cancelled) {
          setLastExportAt(null);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (value: string | null) => {
    if (!value) return copy.never;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const filePath = await exportState("zip");
      const now = new Date().toISOString();
      setLastExportAt(now);
      showToast({
        message: `${copy.exportSuccess}: ${filePath}`,
        type: "success",
      });
    } catch (error) {
      showToast({
        message: `${copy.exportError}: ${String(error)}`,
        type: "error",
      });
    } finally {
      setExporting(false);
    }
  }, [copy]);

  const handleImport = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!window.confirm(copy.confirmImport)) return;

      setImporting(true);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const summary = await importStateBytes(bytes);
        showToast({
          message: `${copy.importSuccess}: ${summary}`,
          type: "success",
        });
      } catch (error) {
        showToast({
          message: `${copy.importError}: ${String(error)}`,
          type: "error",
        });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }, [copy]);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="font-medium text-gray-900 dark:text-gray-100">{copy.title}</h2>

      <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {copy.exportTitle}
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{copy.exportDesc}</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="h-8 rounded-xl bg-indigo-500 px-4 text-xs text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? copy.exporting : copy.exportBtn}
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {copy.lastExport}: {formatDate(lastExportAt)}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {copy.importTitle}
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{copy.importDesc}</p>
        <div className="mt-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="h-8 rounded-xl border border-gray-200 px-4 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {importing ? copy.importing : copy.importBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
