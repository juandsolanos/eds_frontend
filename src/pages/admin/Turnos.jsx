import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";

const ESTADO_COLORS = {
  creado: "#f59e0b",
  en_espera: "#3b82f6",
  abierto: "#10b981",
  cerrado: "#6b7280",
};

export default function Turnos() {
  const { token } = useAuth();

  const [turnos, setTurnos] = useState([]);
  const [islas, setIslas] = useState([]);
  const [operarios, setOperarios] = useState([]);

  const [isla, setIsla] = useState("");
  const [inicioIdeal, setInicioIdeal] = useState("");
  const [finalIdeal, setFinalIdeal] = useState("");
  const [responsable, setResponsable] = useState("");

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const cargarTurnos = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.listarTurnos(token, undefined, { signal });
      setTurnos(data);
    } catch {
      setTurnos([]);
    }
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    cargarTurnos({ signal });
    api.listarIslas(token, { signal }).then(setIslas).catch(() => setIslas([]));
    api.operarios.listar(token, { signal }).then(setOperarios).catch(() => setOperarios([]));
    return () => ctrl.abort();
  }, [token, cargarTurnos]);

  function mostrarError(err) {
    setMensaje({ tipo: "error", texto: err.detail || "Ocurrió un error inesperado." });
  }

  function mostrarExito(texto) {
    setMensaje({ tipo: "success", texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  function limpiarFormulario() {
    setIsla("");
    setInicioIdeal("");
    setFinalIdeal("");
    setResponsable("");
  }

  async function handleCrearTurno(e) {
    e.preventDefault();
    setCargando(true);
    try {
      const datos = {
        isla: Number(isla),
        inicio_ideal: new Date(inicioIdeal).toISOString(),
        final_ideal: new Date(finalIdeal).toISOString(),
        responsable: responsable || null,
      };
      await api.crearTurno(token, datos);
      mostrarExito("Turno creado exitosamente.");
      limpiarFormulario();
      await cargarTurnos();
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargando(false);
    }
  }

  async function handleAsignarResponsable(turnoId, nuevoResponsable) {
    try {
      await api.asignarResponsable(token, turnoId, nuevoResponsable || null);
      mostrarExito("Responsable actualizado.");
      await cargarTurnos();
    } catch (err) {
      mostrarError(err);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: "var(--spacing-6)" }}>Gestión de turnos</h2>

      {mensaje && (
        <div className={`alert alert--${mensaje.tipo === "error" ? "error" : "success"}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="card" style={{ marginBottom: "var(--spacing-6)" }}>
        <h3 style={{ marginBottom: "var(--spacing-4)" }}>Crear turno</h3>
        <form onSubmit={handleCrearTurno} style={{ display: "flex", gap: "var(--spacing-4)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Isla *</label>
            <select value={isla} onChange={(e) => setIsla(e.target.value)} required style={{ minWidth: 120 }}>
              <option value="">Seleccionar...</option>
              {islas.map((i) => (
                <option key={i.id} value={i.id}>Isla {i.id}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Inicio ideal *</label>
            <input
              type="datetime-local"
              value={inicioIdeal}
              onChange={(e) => setInicioIdeal(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Final ideal *</label>
            <input
              type="datetime-local"
              value={finalIdeal}
              onChange={(e) => setFinalIdeal(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Responsable</label>
            <select value={responsable} onChange={(e) => setResponsable(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Sin asignar</option>
              {operarios.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre || o.id}</option>
              ))}
            </select>
          </div>

          <button className="btn btn--primary" type="submit" disabled={cargando}>
            {cargando ? "Creando..." : "Crear turno"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: "var(--spacing-4)" }}>Turnos existentes</h3>
        <RegistrosTabla
          columnas={[
            { key: "id", label: "ID", mono: true },
            { key: "isla", label: "Isla" },
            { key: "inicio_ideal", label: "Inicio ideal", render: (f) => new Date(f.inicio_ideal).toLocaleString() },
            { key: "final_ideal", label: "Final ideal", render: (f) => new Date(f.final_ideal).toLocaleString() },
            { key: "responsable", label: "Responsable", render: (f) => f.responsable || "Sin asignar" },
            {
              key: "estado",
              label: "Estado",
              render: (f) => (
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: ESTADO_COLORS[f.estado] || "#6b7280",
                }}>
                  {f.estado}
                </span>
              ),
            },
          ]}
          filas={turnos}
          vacio="No hay turnos registrados."
        />
      </div>
    </div>
  );
}
