import { useNavigate } from "react-router-dom";
import { useCardStore } from "../../stores/cardStore";

export default function CardLibrary() {
  const queue = useCardStore((s) => s.queue);
  const navigate = useNavigate();
  const archived = queue.filter((c) => c.status === "mastered");

  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-4">📚 Card Library</h2>
      {archived.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <p className="text-3xl mb-2">🗂️</p>
          <p>No cards yet</p>
          <p className="text-xs mt-1">Cards are archived here after you master them</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {archived.map((card) => (
            <button key={card.id} onClick={() => navigate(`/learn/${encodeURIComponent(card.name)}`)}
              className="bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all">
              <h4 className="font-medium text-gray-800 text-sm">{card.name}</h4>
              <p className="text-xs text-gray-400 mt-1">{card.summary}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
