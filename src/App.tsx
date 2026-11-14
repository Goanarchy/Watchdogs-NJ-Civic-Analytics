import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { ReportErrorBoundary } from "./components/ReportErrorBoundary";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { LanguageProvider, useI18n } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { AboutPage } from "./pages/AboutPage";
import { CommitteePage } from "./pages/CommitteePage";
import { DashboardPage } from "./pages/DashboardPage";
import { DistrictPage } from "./pages/DistrictPage";
import { FederalDistrictPage } from "./pages/FederalDistrictPage";
import { FederalElectionsPage } from "./pages/FederalElectionsPage";
import { FindRepresentativePage } from "./pages/FindRepresentativePage";
import { HomePage } from "./pages/HomePage";
import { LegislatorPage } from "./pages/LegislatorPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReportPage } from "./pages/ReportPage";
import { TopicPage } from "./pages/TopicPage";
import { VoteTrackerPage } from "./pages/VoteTrackerPage";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}

function AppShell() {
  const { t } = useI18n();

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          // HashRouter also uses the URL hash, so focus directly instead of
          // navigating to "#main".
          event.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}
      >
        {t("a11y.skipToContent")}
      </a>
      <ScrollToTop />
      <SiteHeader />
      <div className="site-content" id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/legislador/:id" element={<LegislatorPage />} />
          <Route
            path="/legislador/:id/reporte"
            element={
              <ReportErrorBoundary>
                <ReportPage />
              </ReportErrorBoundary>
            }
          />
          <Route
            path="/legislador/:id/report"
            element={
              <ReportErrorBoundary>
                <ReportPage />
              </ReportErrorBoundary>
            }
          />
          <Route path="/district/:district" element={<DistrictPage />} />
          <Route path="/committee/:name" element={<CommitteePage />} />
          <Route path="/buscar-representante" element={<FindRepresentativePage />} />
          <Route path="/find-representative" element={<FindRepresentativePage />} />
          <Route path="/super-tools" element={<DashboardPage />} />
          <Route path="/super-tools/federal" element={<FederalElectionsPage />} />
          <Route path="/super-tools/federal/:district" element={<FederalDistrictPage />} />
          <Route path="/super-tools/topics/:slug" element={<TopicPage />} />
          <Route path="/super-tools/por-quien-voto" element={<VoteTrackerPage />} />
          <Route path="/super-tools/por-quien-voto/:profileKey" element={<VoteTrackerPage />} />
          <Route path="/acerca" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      <SiteFooter />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <HashRouter>
          <AppShell />
        </HashRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
