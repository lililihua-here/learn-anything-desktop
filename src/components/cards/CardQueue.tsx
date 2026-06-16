import { useEffect } from "react";
import { useLocale } from "../../i18n/useLocale";
import { useCardStore } from "../../stores/cardStore";
import CardItem from "./CardItem";

export default function CardQueue() {
  const queue = useCardStore((s) => s.queue);
  const swipeRight = useCardStore((s) => s.swipeRight);
  const swipeLeft = useCardStore((s) => s.swipeLeft);
  const markMastered = useCardStore((s) => s.markMastered);
  const undo = useCardStore((s) => s.undo);
  const toast = useCardStore((s) => s.toastMessage);
  const clearToast = useCardStore((s) => s.clearToast);
  const L = useLocale();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(clearToast, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  const title =
    queue.length > 0
      ? `${L.cards.queueTitle} · ${L.cards.queueRemaining.replace("{count}", String(queue.length))}`
      : L.cards.queueTitle;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {queue.length > 0 ? (
          queue.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onSwipeRight={() => swipeRight(card.id)}
              onSwipeLeft={() => swipeLeft(card.id)}
              onMastered={() => markMastered(card.id)}
            />
          ))
        ) : (
          <div className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
            <p>🗂️</p>
            <p className="mt-2">{L.cards.queueEmpty}</p>
            <p className="mt-1 text-xs">{L.cards.queueHint}</p>
          </div>
        )}
      </div>
      {toast && (
        <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
          <span className="text-gray-600 dark:text-gray-300">{toast}</span>
          <button onClick={undo} className="font-medium text-indigo-500 dark:text-indigo-300">
            {L.cards.undo}
          </button>
        </div>
      )}
    </div>
  );
}
