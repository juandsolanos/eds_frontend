export default function TurnoStatus({ turno, onAbrir, onCerrar, islas, isla, setIsla, cargando }) {
  if (turno) {
    return (
      <div className="pump-display">
        <span className="pump-display__indicator pump-display__indicator--activo" />
        <div className="pump-display__body">
          <div className="pump-display__label">Turno activo</div>
          <div className="pump-display__value mono">{turno.id}</div>
        </div>
        <button className="btn btn--danger" onClick={onCerrar} disabled={cargando}>
          {cargando ? "Cerrando..." : "Cerrar turno"}
        </button>
      </div>
    );
  }

  return (
    <div className="pump-display">
      <span className="pump-display__indicator pump-display__indicator--inactivo" />
      <div className="pump-display__body">
        <div className="pump-display__label">Sin turno activo</div>
        <div className="pump-display__value pump-display__value--muted">
          Selecciona una isla para abrir turno
        </div>
      </div>
      <select value={isla} onChange={(e) => setIsla(e.target.value)} style={{ minWidth: 100 }}>
        <option value="">Isla...</option>
        {islas.map((i) => (
          <option key={i.id} value={i.id}>
            Isla {i.id}
          </option>
        ))}
      </select>
      <button className="btn btn--primary" onClick={onAbrir} disabled={!isla || cargando}>
        {cargando ? "Abriendo..." : "Abrir turno"}
      </button>
    </div>
  );
}
