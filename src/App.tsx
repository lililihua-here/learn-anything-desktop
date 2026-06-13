import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import CardLibrary from "./components/cards/CardLibrary";
import ConceptsPage from "./pages/ConceptsPage";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ToastContainer } from "./components/common/Toast";
import { useSettingsStore } from "./stores/settingsStore";
import { useEffect } from "react";

function AppInner() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.className = theme === "dark" ? "dark" : "";
  }, [theme]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn/:concept" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/cards" element={<CardLibrary />} />
          <Route path="/concepts" element={<ConceptsPage />} />
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
