import { useState } from "react";
import { submitQuizAnswers } from "../../lib/tauri";
import { useChatStore } from "../../stores/chatStore";
import { useQuizStore } from "../../stores/quizStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useLocale } from "../../i18n/useLocale";
import ChoiceQuestion from "./ChoiceQuestion";
import ShortAnswer from "./ShortAnswer";

interface QuizQuestion {
  question: string;
  options?: string[];
  correct_index?: number;
  expected_keywords?: string[];
  min_matches?: number;
}

function evaluateChoiceAnswer(
  question: QuizQuestion,
  answerIndex: number,
  L: ReturnType<typeof useLocale>,
) {
  const correct = answerIndex === question.correct_index;
  return {
    correct,
    feedback: correct
      ? `✅ ${L.quiz.feedbackCorrect}`
      : `❌ ${L.quiz.feedbackIncorrect}`,
  };
}

function evaluateShortAnswer(
  question: QuizQuestion,
  answer: string,
  L: ReturnType<typeof useLocale>,
) {
  const normalizedAnswer = answer.trim().toLowerCase();
  const keywords = (question.expected_keywords || [])
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedAnswer) {
    return { correct: false, feedback: `❌ ${L.quiz.feedbackEmpty}` };
  }

  if (keywords.length === 0) {
    return { correct: true, feedback: `✅ ${L.quiz.feedbackSubmitted}` };
  }

  const matches = keywords.filter((keyword) => normalizedAnswer.includes(keyword));
  const minMatches = question.min_matches ?? keywords.length;
  const correct = matches.length >= minMatches;

  return {
    correct,
    feedback: correct
      ? `✅ ${L.quiz.feedbackKeywordsMatch.replace("{count}", String(matches.length))}`
      : `❌ ${L.quiz.feedbackKeywordsPartial.replace("{matches}", String(matches.length)).replace("{min}", String(minMatches))}`,
  };
}

export default function QuizPanel() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const sessionId = useSessionStore((s) => s.currentSession?.id);
  const conceptSlug = useChatStore((s) => s.conceptSlug);
  const L = useLocale();
  const {
    isActive,
    quizType,
    questions,
    currentIndex,
    answers,
    submitAnswer,
    nextQuestion,
    markSubmitted,
    finishQuiz,
    results,
  } = useQuizStore();
  if (!isActive || questions.length === 0) return null;

  const q = questions[currentIndex] as QuizQuestion;
  const result = results[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const canSubmitQuiz = answers.length === questions.length && results.length === questions.length;

  const handleChoiceAnswer = (answerIndex: number) => {
    if (result) return;
    submitAnswer(String(answerIndex), evaluateChoiceAnswer(q, answerIndex, L));
  };

  const handleShortAnswerSubmit = (answer: string) => {
    if (result) return;
    submitAnswer(answer, evaluateShortAnswer(q, answer, L));
  };

  const handleSubmitQuiz = async () => {
    if (!sessionId || !conceptSlug || !canSubmitQuiz) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await submitQuizAnswers(
        sessionId,
        conceptSlug,
        questions.map((question, index) => ({
          question_index: index,
          quiz_json: JSON.stringify(question),
          user_answer: answers[index] || "",
          result: results[index]?.correct ? "correct" : "incorrect",
          score: results[index]?.correct ? 1 : 0,
        })),
      );
      markSubmitted();
      finishQuiz();
    } catch (error) {
      setSubmitError(String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-t bg-white p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs text-gray-400">
          {L.quiz.question} {currentIndex + 1}{L.quiz.of}{questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${
              i < currentIndex ? (results[i]?.correct ? "bg-green-400" : "bg-red-400") :
              i === currentIndex ? "bg-indigo-400" : "bg-gray-200"
            }`} />
          ))}
        </div>
      </div>
      {quizType === "choice" && (
        <ChoiceQuestion key={currentIndex} question={q.question} options={q.options || []}
          correctIndex={q.correct_index as number} onAnswer={handleChoiceAnswer}
          feedback={result?.feedback} />
      )}
      {quizType === "short_answer" && (
        <ShortAnswer key={currentIndex} question={q.question} onSubmit={handleShortAnswerSubmit} feedback={result?.feedback} />
      )}
      {result && currentIndex < questions.length - 1 && (
        <button onClick={nextQuestion} className="mt-3 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
          {L.quiz.next}
        </button>
      )}
      {result && isLastQuestion && (
        <button
          onClick={handleSubmitQuiz}
          disabled={isSubmitting || !canSubmitQuiz}
          className="mt-3 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600 disabled:opacity-40"
        >
          {isSubmitting ? L.quiz.submitting : L.quiz.submitQuiz}
        </button>
      )}
      {submitError && <p className="mt-2 text-sm text-red-500">{submitError}</p>}
    </div>
  );
}
