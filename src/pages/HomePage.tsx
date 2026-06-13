import { useState } from "react";
import { useNavigate } from "react-router-dom";

const EXAMPLE_TAGS = [
  "什么是 API?",
  "学 Python 基础",
  "理解闭包",
  "HTTP 原理",
  "Git 入门",
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (concept: string) => {
    if (concept.trim()) {
      navigate(`/learn/${encodeURIComponent(concept.trim())}`);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-xl">
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {EXAMPLE_TAGS.map((tag) => (
            <button key={tag} onClick={() => handleSearch(tag)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-500 transition-colors shadow-sm">
              {tag}
            </button>
          ))}
        </div>
        <div className="relative">
          <input type="text" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            placeholder="What do you want to learn?"
            className="w-full h-14 px-6 text-lg rounded-2xl border border-gray-200 shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            autoFocus />
          <button onClick={() => handleSearch(query)}
            className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors">
            🔍
          </button>
        </div>
        <p className="text-center text-gray-400 text-sm mt-4">
          Try entering a technical term you've heard but don't fully understand
        </p>
      </div>
    </div>
  );
}
