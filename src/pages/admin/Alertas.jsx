import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
};

const ESTADO_COLOR = {
  pendiente: "#f97316",
  en_proceso: "#3b82f6",
  resuelta: "#10b981",
};

export default function Alertas() {
  const { token, usuario } = useAuth();
  const esSuperadmin = usuario.rol === "superadministrador";

  const [alertas, setAlertas] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const [atendiendo, setAtendiendo] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("en_proceso");
  const [comentarios, setComentarios] = useState("");

  const [nuevoTipo, setNuevoTipo] = useState("");
  const [verRoles, setVerRoles] = useState("operario,administrador,superadministrador");
  const [atenderRoles, setAtenderRoles] = useState("superadministrador");

  const cargar = useCallback(async ({ signal } = {}) => {
    setCargando(true);
    setError(null);
    try {
      const [a, p] = await Promise.all([
        api.listarAlertas(token, { signal }),
        api.listarPermisosAlertas(token, { signal }),
      ]);
      setAlertas(a);
      setPermisos(p);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail || "No se pudieron cargar las alertas.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  async function manejarAtender(alerta) {
    try {
      await api.atenderAlerta(token, alerta.id, nuevoEstado, comentarios);
      setAtendiendo(null);
      setComentarios("");
      setNuevoEstado("en_proceso");
      await cargar();
    } catch (err) {
      setError(err.detail || "No se pudo atender la alerta.");
    }
  }

  async function manejarGuardarPermiso() {
    const tipo = nuevoTipo.trim();
    if (!tipo) return;
    try {
      setError(null);
      await api.guardarPermisoAlerta(token, tipo, {
        roles_pueden_ver: verRoles.split(",").map((s) => s.trim()).filter(Boolean),
        roles_pueden_atender: atenderRoles.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setNuevoTipo("");
      await cargar();
    } catch (err) {
      setError(err.detail || "No se pudo guardar la configuración.");
    }
  }

  const puedeAtender = (alerta) => {
    if (esSuperadmin) return true;
    const permiso = permisos.find((p) => p.tipo === alerta.tipo);
    return Boolean(permiso && permiso.roles_pueden_atender.includes("administrador"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      <div className="header-section">
        <h2>Alertas</h2>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Listado de alertas</h3>
          {cargando && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Cargando...</span>}
        </div>

        {alertas.length === 0 ? (
          <div className="empty-state">No hay alertas registradas.</div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Origen</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span
                      style={{
                        color: ESTADO_COLOR[a.estado] || "#6b7280",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ESTADO_LABEL[a.estado] || a.estado}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{a.origen_tipo}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{a.tipo}</td>
                  <td>
                    {a.descripcion}
                    {a.entidades && a.entidades.length > 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>
                        {JSON.stringify(a.entidades)}
                      </div>
                    )}
                    {a.comentarios && (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic", marginTop: 4 }}>
                        Comentario: {a.comentarios}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(a.tiempo).toLocaleString()}</td>
                  <td>
                    {puedeAtender(a) ? (
                      atendiendo === a.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <select
                            value={nuevoEstado}
                            onChange={(e) => setNuevoEstado(e.target.value)}
                            style={{ minWidth: 140 }}
                          >
                            <option value="en_proceso">En proceso</option>
                            <option value="resuelta">Resuelta</option>
                          </select>
                          <input
                            placeholder="Comentario (opcional)"
                            value={comentarios}
                            onChange={(e) => setComentarios(e.target.value)}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn--primary" onClick={() => manejarAtender(a)}>
                              Guardar
                            </button>
                            <button className="btn" onClick={() => setAtendiendo(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn btn--primary" onClick={() => setAtendiendo(a.id)}>
                          Atender
                        </button>
                      )
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                        Sin permiso
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {esSuperadmin && (
        <div className="card">
          <h3 className="card__title" style={{ marginBottom: "var(--spacing-4)" }}>
            Permisos por tipo de alerta
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            {permisos.map((p) => (
              <div
                key={p.tipo}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--spacing-3)",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "var(--spacing-3)",
                }}
              >
                <div>
                  <strong>{p.tipo}</strong>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    Ven: {p.roles_pueden_ver.join(", ")} · Atienden: {p.roles_pueden_atender.join(", ")}
                  </div>
                  {p.descripcion && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{p.descripcion}</div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-2)" }}>
              <strong>Configurar tipo</strong>
              <input
                placeholder="Tipo de alerta (p. ej. stock_bajo)"
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value)}
              />
              <input
                placeholder="Roles que la ven (separados por coma)"
                value={verRoles}
                onChange={(e) => setVerRoles(e.target.value)}
              />
              <input
                placeholder="Roles que la atienden (separados por coma)"
                value={atenderRoles}
                onChange={(e) => setAtenderRoles(e.target.value)}
              />
              <button className="btn btn--primary" onClick={manejarGuardarPermiso}>
                Guardar configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
