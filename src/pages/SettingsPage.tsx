import { Link } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";

export default function SettingsPage() {
  const { isKeyConfigured, provider, setProvider, model, setModel, theme, setTheme } = useSettingsStore();

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-medium mb-2">API Key</h2>
        <p className="text-sm text-gray-400 mb-3">{isKeyConfigured ? "✅ Configured" : "⚠️ Not configured"}</p>
        <button className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600">Reconfigure</button>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-medium">Provider</h2>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm">
          <option value="anthropic">Anthropic</option>
        </select>
        <h2 className="font-medium mt-3">Model</h2>
        <select value={model} onChange={(e) => setModel(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm">
          <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Faster)</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-medium mb-2">Theme</h2>
        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
          {theme === "light" ? "🌙 Dark" : "☀️ Light"} (Current: {theme})
        </button>
      </div>

      <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to Home</Link>
    </div>
  );
}
