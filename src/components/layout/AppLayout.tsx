import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "../../stores/sessionStore";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const history = useSessionStore((s) => s.history);

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed left-0 top-0 z-50 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">Learning History</h2>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="overflow-y-auto h-full pb-20">
          {history.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">No learning history yet</div>
          ) : (
            history.map((session) => (
              <div key={session.id} className="px-4 py-3 border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => { navigate(`/learn/${encodeURIComponent(session.conceptName)}`); setSidebarOpen(false); }}>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-700">{session.conceptName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    session.status === "completed" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                  }`}>
                    {session.status === "completed" ? "completed" : "interrupted"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(session.startedAt).toLocaleDateString("zh-CN")}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-white flex items-center px-4 gap-4 shrink-0">
          {location.pathname !== "/" && (
            <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700 text-lg">☰</button>
          )}
          <Link to="/" className="font-bold text-indigo-500 text-lg">Learn Anything</Link>
          <div className="flex-1" />
          <Link to="/concepts" className="text-gray-400 hover:text-gray-600 text-sm">📋</Link>
          <Link to="/cards" className="text-gray-400 hover:text-gray-600 text-sm">📚</Link>
          <Link to="/settings" className="text-gray-400 hover:text-gray-600 text-sm">⚙</Link>
        </header>
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
