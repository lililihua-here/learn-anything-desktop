import { create } from "zustand";

export interface SessionInfo {
  id: string;
  conceptName: string;
  conceptSlug: string;
  status: "active" | "completed" | "interrupted";
  startedAt: string;
  endedAt?: string;
}

interface SessionState {
  currentSession: SessionInfo | null;
  history: SessionInfo[];

  startSession: (id: string, conceptName: string, conceptSlug: string) => void;
  completeSession: () => void;
  interruptSession: () => void;
  setHistory: (list: SessionInfo[]) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  history: [],

  startSession: (id, conceptName, conceptSlug) => {
    set({
      currentSession: {
        id, conceptName, conceptSlug,
        status: "active",
        startedAt: new Date().toISOString(),
      },
    });
  },

  completeSession: () =>
    set((s) => {
      if (!s.currentSession) return s;
      const completed = { ...s.currentSession, status: "completed" as const, endedAt: new Date().toISOString() };
      return { currentSession: null, history: [completed, ...s.history] };
    }),

  interruptSession: () =>
    set((s) => {
      if (!s.currentSession) return s;
      const interrupted = { ...s.currentSession, status: "interrupted" as const, endedAt: new Date().toISOString() };
      return { currentSession: null, history: [interrupted, ...s.history] };
    }),

  setHistory: (list) => set({ history: list }),
}));
