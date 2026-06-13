import { useNavigate } from "react-router-dom";
import { useCardStore } from "../../stores/cardStore";
import { useSettingsStore } from "../../stores/settingsStore";

export default function CardLibrary() {
  const queue = useCardStore((s) => s.queue);
  const navigate = useNavigate();
  const locale = useSettingsStore((s) => s.locale);
  const archived = queue.filter((c) => c.status === "mastered");
  const copy =
    locale === "zh-CN"
      ? {
          title: "卡片库",
          emptyTitle: "还没有卡片",
          emptyHint: "掌握后的卡片会归档到这里",
        }
      : {
          title: "Card Library",
          emptyTitle: "No cards yet",
          emptyHint: "Cards are archived here after you master them",
        };

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-4 text-lg font-semibold">{copy.title}</h2>
      {archived.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">{copy.emptyTitle}</p>
          <p className="mt-1 text-xs">{copy.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {archived.map((card) => (
            <button
              key={card.id}
              onClick={() => navigate(`/learn/${encodeURIComponent(card.name)}`)}
              className="rounded-xl border border-gray-100 bg-white p-4 text-left transition-all hover:border-indigo-200 hover:shadow-sm"
            >
              <h4 className="text-sm font-medium text-gray-800">{card.name}</h4>
              <p className="mt-1 text-xs text-gray-400">{card.summary}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
