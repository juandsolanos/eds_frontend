const ESTADO_LABELS = {
  creado: "Creado",
  en_espera: "En espera",
  abierto: "Abierto",
  en_revision: "En revisión",
  cerrado: "Cerrado",
};

const ESTADO_COLORS = {
  creado: "#f59e0b",
  en_espera: "#3b82f6",
  abierto: "#10b981",
  en_revision: "#f97316",
  cerrado: "#6b7280",
};

export default function TurnoStatus({ turno, turnosDisponibles, onAbrir, onCerrar, onSolicitarAbrir, cargando }) {
  if (turno) {
    const esAbierto = turno.estado === "abierto";
    const esEnEspera = turno.estado === "en_espera";
    const esEnRevision = turno.estado === "en_revision";

    return (
      <div className="pump-display">
        <span
          className="pump-display__indicator"
          style={{
            background: ESTADO_COLORS[turno.estado] || "#6b7280",
            animation: esAbierto ? "pulse 2s infinite" : undefined,
          }}
        />
        <div className="pump-display__body">
          <div className="pump-display__label">
            Turno {ESTADO_LABELS[turno.estado] || turno.estado}
          </div>
          <div className="pump-display__value mono">{turno.id}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Isla {turno.isla}
          </div>
        </div>
        {esAbierto && (
          <button className="btn btn--danger" onClick={onCerrar} disabled={cargando}>
            {cargando ? "Cerrando..." : "Cerrar turno"}
          </button>
        )}
        {esEnEspera && (
          <button className="btn btn--primary" onClick={onSolicitarAbrir} disabled={cargando}>
            {cargando ? "Abriendo..." : "Abrir turno"}
          </button>
        )}
      </div>
    );
  }

  if (turnosDisponibles && turnosDisponibles.length > 0) {
    return (
      <div className="pump-display">
        <span className="pump-display__indicator pump-display__indicator--inactivo" />
        <div className="pump-display__body">
          <div className="pump-display__label">Turnos disponibles</div>
          <div className="pump-display__value pump-display__value--muted">
            Selecciona un turno para operar
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pump-display">
      <span className="pump-display__indicator pump-display__indicator--inactivo" />
      <div className="pump-display__body">
        <div className="pump-display__label">Sin turnos disponibles</div>
        <div className="pump-display__value pump-display__value--muted">
          No hay turnos asignados para ti
        </div>
      </div>
    </div>
  );
}
