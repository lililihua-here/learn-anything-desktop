import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import CardLibrary from "./components/cards/CardLibrary";
import ConceptsPage from "./pages/ConceptsPage";
import TopicsPage from "./pages/TopicsPage";
import TopicDetailPage from "./pages/TopicDetailPage";
import RoutePreviewPage from "./pages/RoutePreviewPage";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ToastContainer } from "./components/common/Toast";
import { useSettingsStore } from "./stores/settingsStore";
import { useEffect } from "react";

function LearningRoute() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const location = useLocation();

  if (!hasCompletedOnboarding) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/settings?next=${next}`} replace />;
  }

  return <ChatPage />;
}

function AppInner() {
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = locale;
  }, [locale, theme]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn/:concept" element={<LearningRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/cards" element={<CardLibrary />} />
          <Route path="/concepts" element={<ConceptsPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/:topic" element={<TopicDetailPage />} />
          <Route path="/topics/:topic/preview" element={<RoutePreviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
