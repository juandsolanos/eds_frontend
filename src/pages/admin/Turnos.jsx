import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

const ESTADO_COLORS = {
  creado: "#f59e0b",
  en_espera: "#3b82f6",
  abierto: "#10b981",
  en_revision: "#f97316",
  cerrado: "#6b7280",
};

const ESTADOS_VALIDOS = ["creado", "en_espera", "abierto", "en_revision", "cerrado"];

const btnBase = {
  padding: "4px 10px",
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 600,
};

export default function Turnos() {
  const { token, usuario } = useAuth();
  const esSuperadmin = usuario.rol === "superadministrador";

  const [turnos, setTurnos] = useState([]);
  const [islas, setIslas] = useState([]);
  const [operarios, setOperarios] = useState([]);

  // Formulario de creación
  const [isla, setIsla] = useState("");
  const [inicioIdeal, setInicioIdeal] = useState("");
  const [finalIdeal, setFinalIdeal] = useState("");
  const [responsable, setResponsable] = useState("");

  // Modal de editar campos
  const [editando, setEditando] = useState(null);
  const [editIsla, setEditIsla] = useState("");
  const [editInicio, setEditInicio] = useState("");
  const [editFinal, setEditFinal] = useState("");

  // Modal de cambiar responsable
  const [responsableTarget, setResponsableTarget] = useState(null);
  const [nuevoResponsable, setNuevoResponsable] = useState("");

  // Modal de cambiar estado
  const [estadoTarget, setEstadoTarget] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

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

  function textoError(err) {
    const detalle = err?.detail ?? err?.message ?? err;
    if (typeof detalle === "string") return detalle;
    if (Array.isArray(detalle)) return detalle.map((d) => textoError(d)).join(". ");
    if (detalle && typeof detalle === "object") {
      if (typeof detalle.detail === "string") return detalle.detail;
      const msg = detalle.msg || detalle.message;
      if (typeof msg === "string") return msg;
      try {
        return JSON.stringify(detalle);
      } catch {
        return "Ocurrió un error inesperado.";
      }
    }
    return "Ocurrió un error inesperado.";
  }

  function mostrarError(err) {
    setMensaje({ tipo: "error", texto: textoError(err) });
  }

  function mostrarExito(texto) {
    setMensaje({ tipo: "success", texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  function limpiarFormularioCreacion() {
    setIsla("");
    setInicioIdeal("");
    setFinalIdeal("");
    setResponsable("");
  }

  // --- Crear turno ---
  async function handleCrearTurno(e) {
    e.preventDefault();
    if (isla === "" || String(isla) === "0") {
      mostrarError({ detail: "Debes seleccionar una isla." });
      return;
    }
    if (!inicioIdeal || !finalIdeal) {
      mostrarError({ detail: "Debes indicar el inicio y el final ideales del turno." });
      return;
    }
    const inicio = new Date(inicioIdeal);
    const fin = new Date(finalIdeal);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      mostrarError({ detail: "Las fechas indicadas no son válidas." });
      return;
    }
    if (inicio >= fin) {
      mostrarError({ detail: "El inicio ideal debe ser anterior al final ideal." });
      return;
    }
    setCargando(true);
    try {
      const datos = {
        isla: Number(isla),
        inicio_ideal: inicio.toISOString(),
        final_ideal: fin.toISOString(),
        responsable: responsable || null,
      };
      await api.crearTurno(token, datos);
      mostrarExito("Turno creado exitosamente.");
      limpiarFormularioCreacion();
      await cargarTurnos();
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargando(false);
    }
  }

  // --- Editar campos del turno ---
  function abrirEditar(turno) {
    setEditando(turno);
    setEditIsla(turno.isla);
    setEditInicio(toLocalDatetime(turno.inicio_ideal));
    setEditFinal(toLocalDatetime(turno.final_ideal));
  }

  async function handleEditarCampos(e) {
    e.preventDefault();
    const inicio = new Date(editInicio);
    const fin = new Date(editFinal);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      mostrarError({ detail: "Las fechas indicadas no son válidas." });
      return;
    }
    if (inicio >= fin) {
      mostrarError({ detail: "El inicio ideal debe ser anterior al final ideal." });
      return;
    }
    setCargando(true);
    try {
      const datos = {
        isla: Number(editIsla),
        inicio_ideal: inicio.toISOString(),
        final_ideal: fin.toISOString(),
      };
      await api.actualizarTurno(token, editando.id, datos);
      mostrarExito("Turno actualizado.");
      setEditando(null);
      await cargarTurnos();
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargando(false);
    }
  }

  // --- Cambiar responsable ---
  function abrirResponsable(turno) {
    setResponsableTarget(turno);
    setNuevoResponsable(turno.responsable || "");
  }

  async function handleAsignarResponsable(e) {
    e.preventDefault();
    setCargando(true);
    try {
      await api.asignarResponsable(token, responsableTarget.id, nuevoResponsable || null);
      mostrarExito("Responsable actualizado.");
      setResponsableTarget(null);
      await cargarTurnos();
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargando(false);
    }
  }

  // --- Cambiar estado ---
  function abrirEstado(turno) {
    setEstadoTarget(turno);
    setNuevoEstado(turno.estado);
  }

  async function handleCambiarEstado(e) {
    e.preventDefault();
    setCargando(true);
    try {
      await api.cambiarEstadoTurno(token, estadoTarget.id, nuevoEstado);
      mostrarExito("Estado actualizado.");
      setEstadoTarget(null);
      await cargarTurnos();
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargando(false);
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

      {esSuperadmin && (
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
      )}

      <div className="card">
        <h3 style={{ marginBottom: "var(--spacing-4)" }}>Turnos existentes</h3>
        {turnos.length === 0 ? (
          <div className="empty-state">No hay turnos registrados.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Isla</th>
                <th>Inicio ideal</th>
                <th>Final ideal</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.id}</td>
                  <td>{t.isla}</td>
                  <td>{new Date(t.inicio_ideal).toLocaleString()}</td>
                  <td>{new Date(t.final_ideal).toLocaleString()}</td>
                  <td>{t.responsable || "Sin asignar"}</td>
                  <td>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#fff",
                      background: ESTADO_COLORS[t.estado] || "#6b7280",
                    }}>
                      {t.estado}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {esSuperadmin && t.estado !== "cerrado" && (
                      <button style={btnBase} onClick={() => abrirEditar(t)}>
                        Editar
                      </button>
                    )}
                    {t.estado !== "cerrado" && (
                      <button style={btnBase} onClick={() => abrirResponsable(t)}>
                        Responsable
                      </button>
                    )}
                    <button style={btnBase} onClick={() => abrirEstado(t)}>
                      Estado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal editar campos */}
      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <h3 style={{ marginBottom: "var(--spacing-4)" }}>Editar turno {editando.id}</h3>
          <form onSubmit={handleEditarCampos} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Isla</label>
              <select value={editIsla} onChange={(e) => setEditIsla(e.target.value)} required style={{ minWidth: 120 }}>
                {islas.map((i) => (
                  <option key={i.id} value={i.id}>Isla {i.id}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Inicio ideal</label>
              <input type="datetime-local" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Final ideal</label>
              <input type="datetime-local" value={editFinal} onChange={(e) => setEditFinal(e.target.value)} required />
            </div>
            <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
              <button type="button" style={btnBase} onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn--primary" type="submit" disabled={cargando}>
                {cargando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal cambiar responsable */}
      {responsableTarget && (
        <Modal onClose={() => setResponsableTarget(null)}>
          <h3 style={{ marginBottom: "var(--spacing-4)" }}>Cambiar responsable - {responsableTarget.id}</h3>
          <form onSubmit={handleAsignarResponsable} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Operario</label>
              <select value={nuevoResponsable} onChange={(e) => setNuevoResponsable(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">Sin asignar</option>
                {operarios.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre || o.id}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
              <button type="button" style={btnBase} onClick={() => setResponsableTarget(null)}>Cancelar</button>
              <button className="btn btn--primary" type="submit" disabled={cargando}>
                {cargando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal cambiar estado */}
      {estadoTarget && (
        <Modal onClose={() => setEstadoTarget(null)}>
          <h3 style={{ marginBottom: "var(--spacing-4)" }}>Cambiar estado - {estadoTarget.id}</h3>
          <form onSubmit={handleCambiarEstado} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Estado</label>
              <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} style={{ minWidth: 200 }}>
                {ESTADOS_VALIDOS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
              <button type="button" style={btnBase} onClick={() => setEstadoTarget(null)}>Cancelar</button>
              <button className="btn btn--primary" type="submit" disabled={cargando}>
                {cargando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ minWidth: 360, maxWidth: 480, width: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}

function toLocalDatetime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
