import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MindMap from "../components/mindmap/MindMap";
import MaterialsLibrary from "../components/project/MaterialsLibrary";
import { getConceptTree, type TreeNode } from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";

export default function MindMapPage() {
  const { topic = "" } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);

  const fetchTree = useCallback(async (slug: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConceptTree(slug);
      setTree(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    if (topic) {
      fetchTree(topic);
    }
  }, [topic, fetchTree]);

  // Subscribe to knowledge-map-updated event
  useEffect(() => {
    const unlisten = listen<TreeNode>("knowledge-map-updated", (_event) => {
      if (topic) {
        fetchTree(topic);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [topic, fetchTree]);

  const handleNodeClick = useCallback(
    (slug: string) => {
      navigate(`/learn/${slug}`);
    },
    [navigate],
  );

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-lg font-semibold">
          {tree ? tree.name : topic}
        </h1>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
          Knowledge Map
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setMaterialsOpen((prev) => !prev)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            materialsOpen
              ? "bg-primary text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          📁 Materials
        </button>
      </header>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
      <main className="flex-1 p-4 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => fetchTree(topic)}
              className="px-4 py-2 rounded bg-primary text-white text-sm hover:bg-primary-light transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && tree && (
          <MindMap data={tree} onNodeClick={handleNodeClick} />
        )}

        {!loading && !error && !tree && (
          <div className="flex items-center justify-center h-full text-gray-500">
            No data available for this topic.
          </div>
        )}
      </main>

      <MaterialsLibrary
        isOpen={materialsOpen}
        onClose={() => setMaterialsOpen(false)}
      />
      </div>
    </div>
  );
}
