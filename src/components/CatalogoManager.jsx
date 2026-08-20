import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import RegistrosTabla from "./RegistrosTabla";
import ConfirmModal from "./ConfirmModal";

/**
 * Gestor CRUD genérico para un catálogo. No decide reglas de negocio
 * (eso vive en el backend); solo arma el formulario y la tabla a partir
 * de la configuración de columnas que le pasa cada pantalla.
 *
 * campos: [{ key, label, type ('text'|'number'), idField (true si es la
 *            PK, no editable al actualizar), required }]
 */
export default function CatalogoManager({ titulo, apiResource, campos, idField, filtroPor }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [editando, setEditando] = useState(null); // id del item en edición, o null
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [itemAEliminar, setItemAEliminar] = useState(null);

  const cargar = useCallback(async ({ signal } = {}) => {
    try {
      const data = await apiResource.listar(token, { signal });
      setItems(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [apiResource, token]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  function limpiarForm() {
    setForm({});
    setEditando(null);
  }

  function cargarParaEditar(item) {
    setForm(item);
    setEditando(item[idField]);
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      if (editando !== null) {
        const { [idField]: _omitido, ...datos } = form;
        await apiResource.actualizar(token, editando, datos);
      } else {
        await apiResource.crear(token, form);
      }
      limpiarForm();
      await cargar();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function manejarEliminar() {
    const item = itemAEliminar;
    setItemAEliminar(null);
    setError(null);
    try {
      await apiResource.eliminar(token, item[idField]);
      await cargar();
    } catch (err) {
      setError(err.detail);
    }
  }

  const opcionesFiltro = filtroPor
    ? [...new Set(items.map((item) => item[filtroPor]))].sort()
    : [];
  const itemsFiltrados = filtroPor && filtro ? items.filter((item) => item[filtroPor] === filtro) : items;

  return (
    <div>
      <div className="card__header">
        <h3 className="card__title">{titulo}</h3>
        <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
          {filtroPor && (
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todos</option>
              {opcionesFiltro.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          )}
          {editando !== null && (
            <button className="btn btn--ghost" onClick={limpiarForm}>
              Cancelar edición
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <form onSubmit={manejarSubmit} style={{ marginBottom: "var(--spacing-6)" }}>
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
                disabled={campo.key === idField && editando !== null}
                required={campo.required !== false}
              />
            </div>
          ))}
          <div className="field field--full">
            <button type="submit" className="btn btn--primary" disabled={cargando}>
              {editando !== null ? "Guardar cambios" : `Crear ${titulo.toLowerCase()}`}
            </button>
          </div>
        </div>
      </form>

      <RegistrosTabla
        columnas={[
          ...campos.map((c) => ({ key: c.key, label: c.label })),
          {
            key: "_acciones",
            label: "",
            render: (item) => (
              <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
                <button className="btn btn--ghost" onClick={() => cargarParaEditar(item)}>
                  Editar
                </button>
                <button className="btn btn--danger" onClick={() => setItemAEliminar(item)}>
                  Eliminar
                </button>
              </div>
            ),
          },
        ]}
        filas={itemsFiltrados}
        vacio={`Sin registros en ${titulo.toLowerCase()} todavía.`}
      />

      <ConfirmModal
        open={itemAEliminar !== null}
        mensaje={`¿Eliminar este registro de ${titulo.toLowerCase()}?`}
        onConfirmar={manejarEliminar}
        onCancelar={() => setItemAEliminar(null)}
      />
    </div>
  );
}
