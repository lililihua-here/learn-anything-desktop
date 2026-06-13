import { create } from "zustand";

interface QuizState {
  isActive: boolean;
  quizType: "choice" | "short_answer" | "code" | null;
  questions: unknown[];
  currentIndex: number;
  answers: string[];
  results: Array<{ correct: boolean; feedback?: string }>;

  startQuiz: (type: string, questions: unknown[]) => void;
  submitAnswer: (answer: string) => void;
  nextQuestion: () => void;
  finishQuiz: () => void;
  resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  isActive: false,
  quizType: null,
  questions: [],
  currentIndex: 0,
  answers: [],
  results: [],

  startQuiz: (type, questions) =>
    set({ isActive: true, quizType: type as QuizState["quizType"], questions, currentIndex: 0, answers: [], results: [] }),

  submitAnswer: (answer) =>
    set((s) => {
      const q = s.questions[s.currentIndex] as Record<string, unknown>;
      const correctIndex = (q.correct_index as number) ?? -1;
      const isCorrect = correctIndex >= 0 ? parseInt(answer) === correctIndex : false;
      return {
        answers: [...s.answers, answer],
        results: [...s.results, {
          correct: isCorrect,
          feedback: isCorrect ? "✅ 回答正确！" : "❌ 再想想",
        }],
      };
    }),

  nextQuestion: () =>
    set((s) => {
      const next = s.currentIndex + 1;
      if (next >= s.questions.length) return { isActive: false };
      return { currentIndex: next };
    }),

  finishQuiz: () => set({ isActive: false }),
  resetQuiz: () => set({ isActive: false, quizType: null, questions: [], currentIndex: 0, answers: [], results: [] }),
}));
