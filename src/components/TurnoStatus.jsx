import { TURNO_ESTADO_LABELS, TURNO_ESTADO_COLORS } from "../utils/estados";

export default function TurnoStatus({ turno, turnosDisponibles, onAbrir, onCerrar, onVerResumen, onSolicitarAbrir, cargando, bloquearAbrir = false, mensajeBloqueo = "" }) {
  if (turno) {
    const esAbierto = turno.estado === "abierto";
    const esEnEspera = turno.estado === "en_espera";
    const esEnRevision = turno.estado === "en_revision";

    return (
      <div className="pump-display">
        <span
          className="pump-display__indicator"
          style={{
            background: TURNO_ESTADO_COLORS[turno.estado] || "var(--text-muted)",
            animation: esAbierto ? "pulse 2s infinite" : undefined,
          }}
        />
        <div className="pump-display__body">
          <div className="pump-display__label">
            Turno {TURNO_ESTADO_LABELS[turno.estado] || turno.estado}
          </div>
          <div className="pump-display__value mono">{turno.id}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Isla {turno.isla}
          </div>
        </div>
        {esAbierto && (
          <>
            <button className="btn btn--ghost" onClick={onVerResumen} disabled={cargando}>
              Ver resumen
            </button>
            <button className="btn btn--danger" onClick={onCerrar} disabled={cargando}>
              {cargando ? "Cerrando..." : "Cerrar turno"}
            </button>
          </>
        )}
        {esEnEspera && (
          <>
            <button
              className="btn btn--primary"
              onClick={onSolicitarAbrir}
              disabled={cargando || bloquearAbrir}
              title={bloquearAbrir ? mensajeBloqueo : undefined}
            >
              {cargando ? "Abriendo..." : "Abrir turno"}
            </button>
            {bloquearAbrir && (
              <div style={{ fontSize: "0.8rem", color: "var(--warning)", maxWidth: 320, textAlign: "right" }}>
                {mensajeBloqueo}
              </div>
            )}
          </>
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
