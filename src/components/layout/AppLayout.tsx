import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "../../stores/sessionStore";
import { useSettingsStore } from "../../stores/settingsStore";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const history = useSessionStore((s) => s.history);
  const locale = useSettingsStore((s) => s.locale);

  const copy =
    locale === "zh-CN"
      ? {
          title: "随便学点",
          home: "首页",
          history: "历史",
          concepts: "概念",
          cards: "卡片",
          settings: "设置",
          historyTitle: "学习历史",
          noHistory: "还没有学习记录",
          completed: "已完成",
          interrupted: "已中断",
          close: "关闭",
        }
      : {
          title: "Learn Anything",
          home: "Home",
          history: "History",
          concepts: "Concepts",
          cards: "Cards",
          settings: "Settings",
          historyTitle: "Learning History",
          noHistory: "No learning history yet",
          completed: "completed",
          interrupted: "interrupted",
          close: "Close",
        };

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-80 transform bg-white shadow-xl transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{copy.historyTitle}</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            {copy.close}
          </button>
        </div>
        <div className="h-full overflow-y-auto pb-20">
          {history.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">{copy.noHistory}</div>
          ) : (
            history.map((session) => (
              <div
                key={session.id}
                className="cursor-pointer border-b px-4 py-3 hover:bg-gray-50"
                onClick={() => {
                  navigate(`/learn/${encodeURIComponent(session.conceptName)}`);
                  setSidebarOpen(false);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700">
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
                      ? copy.completed
                      : copy.interrupted}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(session.startedAt).toLocaleDateString(locale)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-white px-4 shrink-0">
          {location.pathname !== "/" && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {copy.history}
            </button>
          )}
          <Link to="/" className="text-lg font-bold text-indigo-500">
            {copy.title}
          </Link>
          <div className="flex-1" />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {copy.home}
            </Link>
            <Link
              to="/concepts"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {copy.concepts}
            </Link>
            <Link
              to="/topics"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              主题
            </Link>
            <Link
              to="/cards"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {copy.cards}
            </Link>
            <Link
              to="/settings"
              className="rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {copy.settings}
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
