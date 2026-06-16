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
import MindMapPage from "./pages/MindMapPage";
import ProjectAnalysisPage from "./pages/ProjectAnalysisPage";
import ErrorBoundary from "./components/common/ErrorBoundary";
import OfflineBanner from "./components/common/OfflineBanner";
import { ToastContainer } from "./components/common/Toast";
import { useSettingsStore } from "./stores/settingsStore";
import { getApiKeys, getAppSettings } from "./lib/tauri";
import { useEffect } from "react";
import { getDefaultModelForProvider } from "./lib/providerModels";

function RequireOnboarding({ children }: { children: JSX.Element }) {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const onboardingResolved = useSettingsStore((s) => s.onboardingResolved);
  const location = useLocation();

  if (!onboardingResolved) {
    return <div className="h-screen bg-gray-50 dark:bg-slate-950" />;
  }

  if (!hasCompletedOnboarding) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/settings?next=${next}`} replace />;
  }

  return children;
}

function LearningRoute() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const onboardingResolved = useSettingsStore((s) => s.onboardingResolved);
  const location = useLocation();

  if (!onboardingResolved) {
    return <div className="h-screen bg-gray-50 dark:bg-slate-950" />;
  }

  if (!hasCompletedOnboarding) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/settings?next=${next}`} replace />;
  }

  return <ChatPage />;
}

function AppInner() {
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const setProvider = useSettingsStore((s) => s.setProvider);
  const setModel = useSettingsStore((s) => s.setModel);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted);
  const setOnboardingResolved = useSettingsStore((s) => s.setOnboardingResolved);
  const setHasConfiguredProvider = useSettingsStore((s) => s.setHasConfiguredProvider);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSettings() {
      try {
        const [settings, keyStatuses] = await Promise.all([
          getAppSettings(),
          getApiKeys(),
        ]);
        if (cancelled) return;

        let providerValue = useSettingsStore.getState().provider;
        let modelValue = "";

        for (const item of settings) {
          switch (item.key) {
            case "provider":
              providerValue = item.value;
              setProvider(item.value);
              break;
            case "model":
              modelValue = item.value;
              setModel(item.value);
              break;
            case "locale":
              if (item.value === "en" || item.value === "zh-CN") {
                setLocale(item.value);
              }
              break;
            case "theme":
              if (item.value === "light" || item.value === "dark") {
                setTheme(item.value);
              }
              break;
            default:
              break;
          }
        }

        if (!modelValue.trim()) {
          setModel(getDefaultModelForProvider(providerValue));
        }

        const hasAnyConfiguredProvider = keyStatuses.some((item) => item.configured);
        setHasConfiguredProvider(hasAnyConfiguredProvider);
        if (!hasAnyConfiguredProvider) {
          setOnboardingCompleted(false);
        }
      } catch {
        // Local storage state remains as the fallback if backend settings are unavailable.
      } finally {
        if (!cancelled) {
          setOnboardingResolved(true);
        }
      }
    }

    void hydrateSettings();
    return () => {
      cancelled = true;
    };
  }, [
    setHasConfiguredProvider,
    setLocale,
    setModel,
    setOnboardingCompleted,
    setOnboardingResolved,
    setProvider,
    setTheme,
  ]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = locale;
  }, [locale, theme]);

  return (
    <BrowserRouter>
      <OfflineBanner />
      <ToastContainer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={
              <RequireOnboarding>
                <HomePage />
              </RequireOnboarding>
            }
          />
          <Route path="/learn/:concept" element={<LearningRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/cards"
            element={
              <RequireOnboarding>
                <CardLibrary />
              </RequireOnboarding>
            }
          />
          <Route
            path="/concepts"
            element={
              <RequireOnboarding>
                <ConceptsPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/topics"
            element={
              <RequireOnboarding>
                <TopicsPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/topics/:topic"
            element={
              <RequireOnboarding>
                <TopicDetailPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/topics/:topic/preview"
            element={
              <RequireOnboarding>
                <RoutePreviewPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/mindmap/:topic"
            element={
              <RequireOnboarding>
                <MindMapPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireOnboarding>
                <ProjectAnalysisPage />
              </RequireOnboarding>
            }
          />
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
