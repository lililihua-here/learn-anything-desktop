import { create } from "zustand";
import type { CardItem, CardStatus } from "../types/cards";
import { syncCardQueue } from "../lib/tauri";

interface CardState {
  queue: CardItem[];
  undoStack: Array<{ card: CardItem; previousStatus: CardStatus }>;
  toastMessage: string | null;
  sessionId: string | null;
  pendingFlush: boolean;
  debounceTimer: ReturnType<typeof setTimeout> | null;

  setSessionId: (id: string) => void;
  addCard: (card: Omit<CardItem, "id" | "status" | "deferCount">) => void;
  swipeRight: (cardId: string) => void;
  swipeLeft: (cardId: string) => void;
  markMastered: (cardId: string) => void;
  undo: () => void;
  clearToast: () => void;
  flushQueue: () => Promise<void>;
}

const generateId = () => crypto.randomUUID();

function scheduleFlush(get: () => CardState) {
  const state = get();
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  const timer = setTimeout(() => get().flushQueue(), 500);
  get().debounceTimer = timer;
}

export const useCardStore = create<CardState>((set, get) => ({
  queue: [],
  undoStack: [],
  toastMessage: null,
  sessionId: null,
  pendingFlush: false,
  debounceTimer: null,

  setSessionId: (id) => set({ sessionId: id }),

  addCard: (card) =>
    set((s) => ({
      queue: [...s.queue, { ...card, id: generateId(), status: "active", deferCount: 0 }],
    })),

  swipeRight: (cardId) =>
    set((s) => {
      const idx = s.queue.findIndex((c) => c.id === cardId);
      if (idx === -1) return s;
      const card = s.queue[idx];
      const newQueue = [...s.queue];
      newQueue.splice(idx, 1);
      scheduleFlush(get);
      return {
        queue: newQueue,
        undoStack: [{ card: { ...card }, previousStatus: card.status }],
        toastMessage: `正在学习「${card.name}」`,
        pendingFlush: true,
      };
    }),

  swipeLeft: (cardId) =>
    set((s) => {
      const idx = s.queue.findIndex((c) => c.id === cardId);
      if (idx === -1) return s;
      const card = s.queue[idx];
      const newQueue = [...s.queue];
      newQueue.splice(idx, 1);

      if (card.deferCount >= 1) {
        scheduleFlush(get);
        return {
          queue: newQueue,
          undoStack: [{ card: { ...card }, previousStatus: card.status }],
          toastMessage: `已彻底跳过「${card.name}」`,
          pendingFlush: true,
        };
      }

      const deferredCard: CardItem = { ...card, status: "deferred", deferCount: 1 };
      scheduleFlush(get);
      return {
        queue: [...newQueue, deferredCard],
        undoStack: [{ card: { ...card }, previousStatus: card.status }],
        toastMessage: `「${card.name}」已暂缓，稍后再次出现 (3秒内可撤销)`,
        pendingFlush: true,
      };
    }),

  markMastered: (cardId) =>
    set((s) => {
      const idx = s.queue.findIndex((c) => c.id === cardId);
      if (idx === -1) return s;
      const card = s.queue[idx];
      const newQueue = [...s.queue];
      newQueue.splice(idx, 1);
      scheduleFlush(get);
      return {
        queue: newQueue,
        undoStack: [{ card: { ...card }, previousStatus: card.status }],
        toastMessage: `「${card.name}」已标记为已掌握`,
        pendingFlush: true,
      };
    }),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return { ...s, toastMessage: null };
      const last = s.undoStack[s.undoStack.length - 1];
      const restored = { ...last.card, status: last.previousStatus, deferCount: last.card.deferCount };
      scheduleFlush(get);
      return {
        queue: [...s.queue, restored],
        undoStack: s.undoStack.slice(0, -1),
        toastMessage: "已撤销",
        pendingFlush: true,
      };
    }),

  clearToast: () => set({ toastMessage: null }),

  flushQueue: async () => {
    const { sessionId, queue } = get();
    if (!sessionId || queue.length === 0) return;
    try {
      await syncCardQueue(sessionId, queue.map((c, i) => ({
        card_id: c.id,
        concept_id: c.slug,
        position: i,
        status: c.status,
        defer_count: c.deferCount,
      })));
      set({ pendingFlush: false });
    } catch {
      // silent fail, will retry on next flush
    }
  },
}));
