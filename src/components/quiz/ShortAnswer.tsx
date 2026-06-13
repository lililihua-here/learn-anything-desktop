import { useState } from "react";
interface Props { question: string; onSubmit: (a: string) => void; feedback?: string; }
export default function ShortAnswer({ question, onSubmit, feedback }: Props) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">{question}</h3>
      <textarea value={value} onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer..."
        className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-indigo-400"
        disabled={!!feedback} />
      {!feedback && (
        <button onClick={() => onSubmit(value)} disabled={!value.trim()}
          className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600 disabled:opacity-40">
          Submit
        </button>
      )}
      {feedback && <p className={`text-sm ${feedback.startsWith("✅") ? "text-green-500" : "text-red-400"}`}>{feedback}</p>}
    </div>
  );
}
