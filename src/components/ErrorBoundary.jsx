import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de render:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--spacing-6)",
          }}
        >
          <div className="card" style={{ maxWidth: 440 }}>
            <div className="card__header">
              <h3 className="card__title">Algo salió mal</h3>
            </div>
            <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
              Ocurrió un error inesperado en la interfaz. Recarga la página para continuar.
            </p>
            <div className="modal__acciones">
              <button className="btn btn--primary" onClick={() => window.location.reload()}>
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}