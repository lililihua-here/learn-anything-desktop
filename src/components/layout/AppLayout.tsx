import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "../../stores/sessionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLocale } from "../../i18n/useLocale";
import StreakBadge from "../gamification/StreakBadge";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const history = useSessionStore((s) => s.history);
  const locale = useSettingsStore((s) => s.locale);
  const L = useLocale();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-80 transform bg-white shadow-xl transition-transform duration-300 dark:bg-gray-900 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{L.history.title}</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {L.common.close}
          </button>
        </div>
        <div className="h-full overflow-y-auto pb-20">
          {history.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 dark:text-gray-500">{L.history.empty}</div>
          ) : (
            history.map((session) => (
              <div
                key={session.id}
                className="cursor-pointer border-b px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                onClick={() => {
                  navigate(`/learn/${encodeURIComponent(session.conceptName)}`);
                  setSidebarOpen(false);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {session.conceptName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      session.status === "completed"
                        ? "bg-green-100 text-green-600"
                        : "bg-orange-100 text-orange-600"
                    }`}
                  >
                    {session.status === "completed"
                      ? L.history.completed
                      : L.history.interrupted}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(session.startedAt).toLocaleDateString(locale)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
          {location.pathname !== "/" && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {L.app.history}
            </button>
          )}
          <Link to="/" className="text-lg font-bold text-indigo-500">
            {L.app.title}
          </Link>
          <div className="flex-1" />
          <StreakBadge compact />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {L.app.home}
            </Link>
            <Link
              to="/topics"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {L.app.topics}
            </Link>
            <Link
              to="/concepts"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {L.app.concepts}
            </Link>
            <Link
              to="/cards"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {L.app.cards}
            </Link>
            <Link
              to="/settings"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {L.app.settings}
            </Link>
          </nav>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
