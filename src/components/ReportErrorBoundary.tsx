import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Los informes se generan con datos de varias fuentes. Si algo inesperado
 * ocurre, este límite evita una pantalla en blanco y ofrece una salida clara.
 */
export class ReportErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Se registra para diagnóstico; nunca se muestra un stack al usuario.
    console.error("Report rendering error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="page narrow-page report-page">
        <div className="empty-state" role="alert">
          <p className="eyebrow eyebrow-dark">Watchdogs Media</p>
          <h1>Report unavailable</h1>
          <p>
            The report could not be generated in this browser. You can reload
            the page or return to the profile; your data is safe. / No se pudo
            generar el informe. Recarga la página o vuelve al perfil.
          </p>
          <div className="profile-actions">
            <button
              type="button"
              className="button button-dark"
              onClick={() => window.location.reload()}
            >
              Reload / Recargar
            </button>
            <a className="button button-outline" href="#/">
              Directory / Directorio
            </a>
          </div>
        </div>
      </main>
    );
  }
}
