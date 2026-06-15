import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MindMap from "../components/mindmap/MindMap";
import MaterialsLibrary from "../components/project/MaterialsLibrary";
import {
  getConceptTree,
  listenKnowledgeMapUpdates,
  type TreeNode,
} from "../lib/tauri";

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

  useEffect(() => {
    if (topic) {
      void fetchTree(topic);
    }
  }, [topic, fetchTree]);

  useEffect(() => {
    if (!topic) return;

    let dispose: (() => void) | undefined;
    listenKnowledgeMapUpdates((payload) => {
      if (payload.topic_slug === topic) {
        void fetchTree(topic);
      }
    }).then((unlisten) => {
      dispose = unlisten;
    });

    return () => {
      dispose?.();
    };
  }, [topic, fetchTree]);

  const handleNodeClick = useCallback(
    (slug: string) => {
      navigate(`/learn/${encodeURIComponent(slug)}`);
    },
    [navigate],
  );

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="flex shrink-0 items-center gap-4 border-b bg-white px-6 py-4">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-indigo-500 transition-colors hover:text-indigo-600"
        >
          返回首页
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {tree ? tree.name : topic}
        </h1>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          Knowledge Map
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setMaterialsOpen((prev) => !prev)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            materialsOpen
              ? "bg-indigo-500 text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          学习资料
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 p-4">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-red-500">{error}</p>
              <button
                onClick={() => void fetchTree(topic)}
                className="rounded bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-600"
              >
                重试
              </button>
            </div>
          )}

          {!loading && !error && tree && (
            <MindMap data={tree} onNodeClick={handleNodeClick} />
          )}

          {!loading && !error && !tree && (
            <div className="flex h-full items-center justify-center text-gray-500">
              当前主题还没有可展示的知识图谱。
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
