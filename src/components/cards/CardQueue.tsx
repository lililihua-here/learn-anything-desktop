import { useEffect } from "react";
import { useCardStore } from "../../stores/cardStore";
import { useChatStore } from "../../stores/chatStore";
import CardItem from "./CardItem";

export default function CardQueue() {
  const queue = useCardStore((s) => s.queue);
  const swipeRight = useCardStore((s) => s.swipeRight);
  const swipeLeft = useCardStore((s) => s.swipeLeft);
  const markMastered = useCardStore((s) => s.markMastered);
  const undo = useCardStore((s) => s.undo);
  const toast = useCardStore((s) => s.toastMessage);
  const clearToast = useCardStore((s) => s.clearToast);
  const suggestions = useChatStore((s) => s.suggestions);

  useEffect(() => {
    if (suggestions.length > 0) {
      suggestions.forEach((s) => {
        useCardStore.getState().addCard({ name: s.name, slug: s.slug, summary: s.reason });
      });
    }
  }, [suggestions]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(clearToast, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">
          {queue.length > 0 ? `Cards · ${queue.length} remaining` : "Cards"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {queue.length > 0 ? queue.map((card) => (
          <CardItem key={card.id} card={card}
            onSwipeRight={() => swipeRight(card.id)}
            onSwipeLeft={() => swipeLeft(card.id)}
            onMastered={() => markMastered(card.id)} />
        )) : (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p>📭</p><p className="mt-2">Queue empty</p>
            <p className="text-xs mt-1">Cards appear as AI explains concepts</p>
          </div>
        )}
      </div>
      {toast && (
        <div className="px-4 py-2 border-t bg-gray-50 flex justify-between items-center text-sm">
          <span className="text-gray-600">{toast}</span>
          <button onClick={undo} className="text-indigo-500 font-medium">Undo</button>
        </div>
      )}
    </div>
  );
}
