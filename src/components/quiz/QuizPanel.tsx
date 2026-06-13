import { useQuizStore } from "../../stores/quizStore";
import ChoiceQuestion from "./ChoiceQuestion";
import ShortAnswer from "./ShortAnswer";

export default function QuizPanel() {
  const { isActive, quizType, questions, currentIndex, submitAnswer, nextQuestion, results } = useQuizStore();
  if (!isActive || questions.length === 0) return null;

  const q = questions[currentIndex] as Record<string, unknown>;
  const result = results[currentIndex];

  return (
    <div className="border-t bg-white p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs text-gray-400">Q {currentIndex + 1}/{questions.length}</span>
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
        <ChoiceQuestion question={q.question as string} options={q.options as string[]}
          correctIndex={q.correct_index as number} onAnswer={(i) => submitAnswer(String(i))}
          feedback={result?.feedback} />
      )}
      {quizType === "short_answer" && (
        <ShortAnswer question={q.question as string} onSubmit={submitAnswer} feedback={result?.feedback} />
      )}
      {result && currentIndex < questions.length - 1 && (
        <button onClick={nextQuestion} className="mt-3 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
          Next →
        </button>
      )}
    </div>
  );
}
