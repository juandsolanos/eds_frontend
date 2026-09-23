import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import RegistrosTabla from "./RegistrosTabla";
import CambioPasswordModal from "./CambioPasswordModal";

/**
 * Gestor de una entidad (operarios o administradores) que además gestiona
 * el Usuario del sistema asociado a cada entidad:
 *
 * - Creación/edición de la entidad (sin eliminar; los registros se
 *   conservan para trazabilidad).
 * - Si la entidad no tiene usuario -> formulario para crearlo.
 * - Si ya tiene -> activar/desactivar, cambiar rol (solo admins) y
 *   resetear contraseña.
 *
 * rol es UN único por usuario (responsabilidades separadas): un operario
 * siempre rol 'operario'; un administrador puede ser 'administrador' o
 * 'superadministrador' (editable aquí vía rolesPermitidosUsuario).
 */
export default function EntidadConUsuariosManager({
  titulo,
  apiResource,
  campos,
  idField,
  tipoUsuario, // 'operario' | 'administrador'
  rolesPermitidosUsuario, // ej. ['operario'] o ['administrador','superadministrador']
}) {
  const { token } = useAuth();
  const columnaUsuario = tipoUsuario === "operario" ? "operario_id" : "administrador_id";

  const [entidades, setEntidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({});
  const [editandoEntidadId, setEditandoEntidadId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const [entidadUsuario, setEntidadUsuario] = useState(null);
  const [formUsuario, setFormUsuario] = useState({});
  const [errorUsuario, setErrorUsuario] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(false);

  const [usuarioPassword, setUsuarioPassword] = useState(null);

  const cargarEntidades = useCallback(async ({ signal } = {}) => {
    const data = await apiResource.listar(token, { signal });
    setEntidades(data);
  }, [apiResource, token]);

  const cargarUsuarios = useCallback(async ({ signal } = {}) => {
    const data = await api.listarUsuarios(token, { signal });
    setUsuarios(data);
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargarEntidades({ signal: ctrl.signal }).catch((err) => {
      if (err.name !== "AbortError") setError(err.detail);
    });
    cargarUsuarios({ signal: ctrl.signal }).catch((err) => {
      if (err.name !== "AbortError") setError(err.detail);
    });
    return () => ctrl.abort();
  }, [cargarEntidades, cargarUsuarios]);

  // ----------------------------------------------------------------
  // Formulario de la ENTIDAD
  // ----------------------------------------------------------------
  function limpiarForm() {
    setForm({});
    setEditandoEntidadId(null);
    setError(null);
  }

  function cargarParaEditar(item) {
    setForm({ ...item });
    setEditandoEntidadId(item[idField]);
    setError(null);
  }

  async function manejarSubmitEntidad(e) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      if (editandoEntidadId !== null) {
        const { [idField]: _omitido, ...datos } = form;
        await apiResource.actualizar(token, editandoEntidadId, datos);
      } else {
        await apiResource.crear(token, form);
      }
      limpiarForm();
      await cargarEntidades();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  // ----------------------------------------------------------------
  // Usuario de la entidad (modal)
  // ----------------------------------------------------------------
  function abrirUsuario(entidad) {
    setEntidadUsuario(entidad);
    setFormUsuario({ username: "", password: "", rol: rolesPermitidosUsuario[0] });
    setErrorUsuario(null);
  }

  const usuarioDe = (entidad) =>
    entidad
      ? usuarios.find((u) => u[columnaUsuario] === String(entidad[idField]))
      : null;

  async function manejarCrearUsuario(e) {
    e.preventDefault();
    setCargandoUsuario(true);
    setErrorUsuario(null);
    try {
      await api.crearUsuario(token, {
        username: formUsuario.username,
        password: formUsuario.password,
        rol: formUsuario.rol || rolesPermitidosUsuario[0],
        ...(tipoUsuario === "operario"
          ? { operario_id: entidadUsuario[idField] }
          : { administrador_id: entidadUsuario[idField] }),
      });
      await cargarUsuarios();
      setFormUsuario({ username: "", password: "", rol: rolesPermitidosUsuario[0] });
    } catch (err) {
      setErrorUsuario(err.detail);
    } finally {
      setCargandoUsuario(false);
    }
  }

  async function manejarActivarUsuario(usuario) {
    setErrorUsuario(null);
    try {
      await api.actualizarUsuario(token, usuario.id, { activo: !usuario.activo });
      await cargarUsuarios();
    } catch (err) {
      setErrorUsuario(err.detail);
    }
  }

  async function manejarCambiarRol(usuario, nuevoRol) {
    setErrorUsuario(null);
    try {
      await api.actualizarUsuario(token, usuario.id, { rol: nuevoRol });
      await cargarUsuarios();
    } catch (err) {
      setErrorUsuario(err.detail);
    }
  }

  const usuarioVisible = usuarioDe(entidadUsuario);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div>
      <div className="card__header">
        <h3 className="card__title">{titulo}</h3>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <form onSubmit={manejarSubmitEntidad} style={{ marginBottom: "var(--spacing-6)" }}>
        <div className="form-grid">
          {campos.map((campo) => (
            <div className="field" key={campo.key}>
              <label htmlFor={campo.key}>{campo.label}</label>
              <input
                id={campo.key}
                type={campo.type === "number" ? "number" : "text"}
                step={campo.type === "number" ? "0.01" : undefined}
                value={form[campo.key] ?? ""}
                onChange={(e) => setForm({ ...form, [campo.key]: e.target.value })}
                disabled={campo.key === idField && editandoEntidadId !== null}
                required={campo.required !== false}
              />
            </div>
          ))}
          <div className="field field--full">
            {editandoEntidadId !== null && (
              <button type="button" className="btn btn--ghost" onClick={limpiarForm}>
                Cancelar edición
              </button>
            )}
            <button type="submit" className="btn btn--primary" disabled={cargando}>
              {editandoEntidadId !== null ? "Guardar cambios" : `Crear ${titulo.toLowerCase()}`}
            </button>
          </div>
        </div>
      </form>

      <RegistrosTabla
        columnas={[
          ...campos.map((c) => ({ key: c.key, label: c.label })),
          {
            key: "_usuario",
            label: "Usuario",
            render: (item) => {
              const usuario = usuarioDe(item);
              if (!usuario) {
                return (
                  <button className="btn btn--ghost" onClick={() => abrirUsuario(item)}>
                    Crear usuario
                  </button>
                );
              }
              return (
                <button className="btn btn--ghost" onClick={() => abrirUsuario(item)}>
                  {usuario.username}
                  <span className={usuario.activo ? "badge badge--ok" : "badge badge--off"}>
                    {usuario.activo ? "activo" : "inactivo"}
                  </span>
                </button>
              );
            },
          },
          {
            key: "_acciones",
            label: "",
            render: (item) => (
              <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
                <button className="btn btn--ghost" onClick={() => cargarParaEditar(item)}>
                  Editar
                </button>
              </div>
            ),
          },
        ]}
        filas={entidades}
        vacio={`Sin registros en ${titulo.toLowerCase()} todavía.`}
      />

      {/* Modal: usuario de la entidad */}
      {entidadUsuario !== null && (
        <div className="modal-overlay" onClick={() => setEntidadUsuario(null)}>
          <div className="modal modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">
                Usuario de {entidadUsuario[idField]} · {entidadUsuario.nombre}
              </h3>
              <button className="modal__close" onClick={() => setEntidadUsuario(null)} aria-label="Cerrar">
                ×
              </button>
            </div>

            {errorUsuario && <div className="alert alert--error">{errorUsuario}</div>}

            {!usuarioVisible ? (
              <form onSubmit={manejarCrearUsuario}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="usuario-username">Username</label>
                    <input
                      id="usuario-username"
                      type="text"
                      minLength={3}
                      required
                      value={formUsuario.username}
                      onChange={(e) =>
                        setFormUsuario({ ...formUsuario, username: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="usuario-password">Contraseña inicial</label>
                    <input
                      id="usuario-password"
                      type="password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={formUsuario.password}
                      onChange={(e) =>
                        setFormUsuario({ ...formUsuario, password: e.target.value })
                      }
                    />
                  </div>
                  {rolesPermitidosUsuario.length > 1 && (
                    <div className="field">
                      <label htmlFor="usuario-rol">Rol</label>
                      <select
                        id="usuario-rol"
                        value={formUsuario.rol}
                        onChange={(e) =>
                          setFormUsuario({ ...formUsuario, rol: e.target.value })
                        }
                      >
                        {rolesPermitidosUsuario.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="field field--full">
                    <button type="submit" className="btn btn--primary" disabled={cargandoUsuario}>
                      {cargandoUsuario ? "Creando..." : "Crear usuario"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
                <div className="form-grid">
                  <div className="field">
                    <label>Username</label>
                    <div className="mono">{usuarioVisible.username}</div>
                  </div>
                  <div className="field">
                    <label>Rol</label>
                    <div className="mono">{usuarioVisible.rol}</div>
                  </div>
                  <div className="field">
                    <label>Estado</label>
                    <div>
                      <span className={usuarioVisible.activo ? "badge badge--ok" : "badge badge--off"}>
                        {usuarioVisible.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-2)" }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => manejarActivarUsuario(usuarioVisible)}
                  >
                    {usuarioVisible.activo ? "Desactivar" : "Activar"}
                  </button>

                  {tipoUsuario === "administrador" && (
                    <select
                      key={usuarioVisible.id}
                      style={{ maxWidth: 220 }}
                      defaultValue={usuarioVisible.rol}
                      onChange={(e) => {
                        if (e.target.value !== usuarioVisible.rol) {
                          manejarCambiarRol(usuarioVisible, e.target.value);
                        }
                      }}
                    >
                      {rolesPermitidosUsuario.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setUsuarioPassword(usuarioVisible)}
                  >
                    Cambiar contraseña
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CambioPasswordModal
        open={usuarioPassword !== null}
        titulo={`Nueva contraseña para ${usuarioPassword?.username ?? ""}`}
        requiereActual={false}
        onCerrar={() => setUsuarioPassword(null)}
        onGuardar={async (_actual, nueva) => {
          await api.resetearPassword(token, usuarioPassword.id, nueva);
          await cargarUsuarios();
        }}
      />
    </div>
  );
}