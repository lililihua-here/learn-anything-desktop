import { create } from "zustand";
import type { Message, CardData, SuggestOption } from "../types/chat";

interface ChatState {
  conceptName: string;
  conceptSlug: string;
  messages: Message[];
  cards: CardData[];
  suggestions: SuggestOption[];
  quizData: null | { quiz_type: string; questions: unknown[] };
  isStreaming: boolean;
  isError: boolean;
  errorMessage: string;

  setConcept: (name: string, slug: string) => void;
  addMessage: (msg: Message) => void;
  appendToLastMessage: (text: string) => void;
  setStreaming: (v: boolean) => void;
  addCard: (card: CardData) => void;
  setSuggestions: (opts: SuggestOption[]) => void;
  setQuizData: (data: unknown) => void;
  setError: (msg: string) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conceptName: "",
  conceptSlug: "",
  messages: [],
  cards: [],
  suggestions: [],
  quizData: null,
  isStreaming: false,
  isError: false,
  errorMessage: "",

  setConcept: (name, slug) => set({ conceptName: name, conceptSlug: slug }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLastMessage: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + text,
        };
      }
      return { messages: msgs };
    }),
  setStreaming: (v) => set({ isStreaming: v }),
  addCard: (card) => set((s) => ({ cards: [...s.cards, card] })),
  setSuggestions: (opts) => set({ suggestions: opts }),
  setQuizData: (data) => set({ quizData: data as ChatState["quizData"] }),
  setError: (msg) => set({ isError: true, errorMessage: msg, isStreaming: false }),
  clearError: () => set({ isError: false, errorMessage: "" }),
}));
