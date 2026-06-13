import { create } from "zustand";

interface QuizState {
  isActive: boolean;
  isSubmitted: boolean;
  quizType: "choice" | "short_answer" | "code" | null;
  questions: unknown[];
  currentIndex: number;
  answers: string[];
  results: Array<{ correct: boolean; feedback?: string }>;

  startQuiz: (type: string, questions: unknown[]) => void;
  submitAnswer: (answer: string, result: { correct: boolean; feedback?: string }) => void;
  nextQuestion: () => void;
  markSubmitted: () => void;
  finishQuiz: () => void;
  resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  isActive: false,
  isSubmitted: false,
  quizType: null,
  questions: [],
  currentIndex: 0,
  answers: [],
  results: [],

  startQuiz: (type, questions) =>
    set({
      isActive: true,
      isSubmitted: false,
      quizType: type as QuizState["quizType"],
      questions,
      currentIndex: 0,
      answers: [],
      results: [],
    }),

  submitAnswer: (answer, result) =>
    set((s) => {
      return {
        answers: [...s.answers, answer],
        results: [...s.results, result],
      };
    }),

  nextQuestion: () =>
    set((s) => {
      const next = s.currentIndex + 1;
      if (next >= s.questions.length) return s;
      return { currentIndex: next };
    }),

  markSubmitted: () => set({ isSubmitted: true }),
  finishQuiz: () => set({ isActive: false }),
  resetQuiz: () => set({
    isActive: false,
    isSubmitted: false,
    quizType: null,
    questions: [],
    currentIndex: 0,
    answers: [],
    results: [],
  }),
}));
