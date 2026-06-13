interface Props { question: string; options: string[]; correctIndex: number; onAnswer: (i: number) => void; feedback?: string; }
export default function ChoiceQuestion({ question, options, onAnswer, feedback }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">{question}</h3>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button key={i} onClick={() => onAnswer(i)} disabled={!!feedback}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-60 text-sm">
            <span className="text-indigo-400 font-medium mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
          </button>
        ))}
      </div>
      {feedback && <p className={`text-sm ${feedback.startsWith("✅") ? "text-green-500" : "text-red-400"}`}>{feedback}</p>}
    </div>
  );
}
