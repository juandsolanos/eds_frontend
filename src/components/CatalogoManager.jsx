import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import RegistrosTabla from "./RegistrosTabla";
import ConfirmModal from "./ConfirmModal";
import { formatMoney } from "../utils/format";

/**
 * Gestor CRUD genérico para un catálogo. No decide reglas de negocio
 * (eso vive en el backend); solo arma el formulario y la tabla a partir
 * de la configuración de columnas que le pasa cada pantalla.
 *
 * campos: [{ key, label, type ('text'|'number'|'select'|'multiselect-credito'),
 *           idField (true si es la PK, no editable al actualizar), required }]
 */
export default function CatalogoManager({
  titulo,
  apiResource,
  campos,
  idField,
  filtroPor,
  formEnModal = false,
  permitirEliminar = true,
  onCambio,
}) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [editando, setEditando] = useState(null); // id del item en edición, o null
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [itemAEliminar, setItemAEliminar] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [opcionesCreditos, setOpcionesCreditos] = useState([]);
  const [opcionesIslas, setOpcionesIslas] = useState([]);

  const necesitaCreditos = campos.some((c) => c.type === "multiselect-credito");
  const necesitaIslas = campos.some((c) => c.type === "select-islas");

  const cargar = useCallback(async ({ signal } = {}) => {
    try {
      const data = await apiResource.listar(token, { signal });
      setItems(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [apiResource, token]);

  const cargarCreditos = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.tiposTransaccion.listar(token, { signal });
      setOpcionesCreditos(data.filter((t) => t.tipo === "credito"));
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [token]);

  const cargarIslas = useCallback(async ({ signal } = {}) => {
    try {
      setOpcionesIslas(await api.islas.listar(token, { signal }));
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    if (necesitaCreditos) cargarCreditos({ signal: ctrl.signal });
    if (necesitaIslas) cargarIslas({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar, cargarCreditos, cargarIslas, necesitaCreditos, necesitaIslas]);

  function limpiarForm() {
    setForm({});
    setEditando(null);
    setError(null);
  }

  function abrirModal() {
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    limpiarForm();
  }

  function abrirCrear() {
    limpiarForm();
    abrirModal();
  }

  function cargarParaEditar(item) {
    const formInicial = { ...item };
    campos.forEach((c) => {
      if (c.type === "multiselect-credito" && !Array.isArray(formInicial[c.key])) {
        formInicial[c.key] = formInicial[c.key] || [];
      }
    });
    setForm(formInicial);
    setEditando(item[idField]);
    setError(null);
    abrirModal();
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
      setModalAbierto(false);
      await cargar();
      onCambio?.();
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
      onCambio?.();
    } catch (err) {
      setError(err.detail);
    }
  }

  const opcionesFiltro = filtroPor
    ? [...new Set(items.map((item) => item[filtroPor]))].sort()
    : [];
  const itemsFiltrados = filtroPor && filtro ? items.filter((item) => item[filtroPor] === filtro) : items;

  function alternarMulti(campo, valor) {
    const actual = Array.isArray(form[campo.key]) ? form[campo.key] : [];
    const siguiente = actual.includes(valor)
      ? actual.filter((v) => v !== valor)
      : [...actual, valor];
    setForm({ ...form, [campo.key]: siguiente });
  }

  function renderCampo(campo) {
    if (campo.type === "select-islas") {
      return (
        <select
          id={campo.key}
          value={form[campo.key] ?? ""}
          onChange={(e) =>
            setForm({ ...form, [campo.key]: e.target.value ? Number(e.target.value) : null })
          }
          required={campo.required !== false}
        >
          <option value="">Selecciona...</option>
          {opcionesIslas.map((i) => (
            <option key={i.id} value={i.id}>
              Isla {i.id}
            </option>
          ))}
        </select>
      );
    }
    if (campo.type === "select") {
      return (
        <select
          id={campo.key}
          value={form[campo.key] ?? ""}
          onChange={(e) => setForm({ ...form, [campo.key]: e.target.value })}
          required={campo.required !== false}
        >
          <option value="">Selecciona...</option>
          {campo.opciones.map((op) =>
            typeof op === "string" ? (
              <option key={op} value={op}>
                {op}
              </option>
            ) : (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            )
          )}
        </select>
      );
    }
    if (campo.type === "multiselect-credito") {
      const seleccionados = Array.isArray(form[campo.key]) ? form[campo.key] : [];
      return (
        <div className="multiselect">
          {opcionesCreditos.map((t) => (
            <label key={t.id} className="multiselect__opcion">
              <input
                type="checkbox"
                checked={seleccionados.includes(t.id)}
                onChange={() => alternarMulti(campo, t.id)}
              />
              {t.nombre}
            </label>
          ))}
          {opcionesCreditos.length === 0 && <small>No hay tipos de crédito definidos.</small>}
        </div>
      );
    }
    return (
      <input
        id={campo.key}
        type={campo.type === "number" ? "number" : "text"}
        step={campo.type === "number" ? "0.01" : undefined}
        value={form[campo.key] ?? ""}
        onChange={(e) => setForm({ ...form, [campo.key]: e.target.value })}
        disabled={campo.key === idField && editando !== null}
        required={campo.required !== false}
      />
    );
  }

  return (
    <div>
      <div className="card__header">
        <h3 className="card__title">{titulo}</h3>
        <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
          {filtroPor && (
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="">Todos</option>
              {opcionesFiltro.map((valor) => (
                <option key={valor} value={String(valor)}>
                  {String(valor)}
                </option>
              ))}
            </select>
          )}
          {!formEnModal && editando !== null && (
            <button className="btn btn--ghost" onClick={limpiarForm}>
              Cancelar edición
            </button>
          )}
          {formEnModal && (
            <button className="btn btn--primary" onClick={abrirCrear}>
              + Crear {titulo.toLowerCase()}
            </button>
          )}
        </div>
      </div>

      {error && !formEnModal && <div className="alert alert--error">{error}</div>}

      {!formEnModal && (
        <form onSubmit={manejarSubmit} style={{ marginBottom: "var(--spacing-6)" }}>
          <div className="form-grid">
            {campos.map((campo) => (
              <div className="field" key={campo.key}>
                <label htmlFor={campo.key}>{campo.label}</label>
                {renderCampo(campo)}
              </div>
            ))}
            <div className="field field--full">
              <button type="submit" className="btn btn--primary" disabled={cargando}>
                {editando !== null ? "Guardar cambios" : `Crear ${titulo.toLowerCase()}`}
              </button>
            </div>
          </div>
        </form>
      )}

      <RegistrosTabla
        columnas={[
          ...campos.map((c) => ({
            key: c.key,
            label: c.label,
            mono: c.format === "money",
            render:
              c.format === "money"
                ? (item) => formatMoney(item[c.key])
                : c.type === "select"
                ? (item) => {
                    const op = c.opciones.find((o) => (o.value ?? o) === item[c.key]);
                    return op ? op.label ?? op : item[c.key];
                  }
                : c.type === "select-islas"
                ? (item) => (item[c.key] != null ? `Isla ${item[c.key]}` : "—")
                : c.type === "multiselect-credito"
                ? (item) => {
                    const valores = Array.isArray(item[c.key]) ? item[c.key] : [];
                    if (valores.length === 0) return "—";
                    return (
                      <div className="multiselect multiselect--chips">
                        {valores.map((v) => {
                          const t = opcionesCreditos.find((o) => o.id === v);
                          return <span key={v} className="chip">{t ? t.nombre : v}</span>;
                        })}
                      </div>
                    );
                  }
                : undefined,
          })),
          {
            key: "_acciones",
            label: "",
            render: (item) => (
              <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
                <button className="btn btn--ghost" onClick={() => cargarParaEditar(item)}>
                  Editar
                </button>
                {permitirEliminar && (
                  <button className="btn btn--danger" onClick={() => setItemAEliminar(item)}>
                    Eliminar
                  </button>
                )}
              </div>
            ),
          },
        ]}
        filas={itemsFiltrados}
        vacio={`Sin registros en ${titulo.toLowerCase()} todavía.`}
      />

      {formEnModal && modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">
                {editando !== null ? `Editar ${titulo.toLowerCase()}` : `Crear ${titulo.toLowerCase()}`}
              </h3>
              <button className="modal__close" onClick={cerrarModal} aria-label="Cerrar">
                ×
              </button>
            </div>

            {error && <div className="alert alert--error">{error}</div>}

            <form onSubmit={manejarSubmit}>
              <div className="form-grid">
                {campos.map((campo) => (
                  <div className="field" key={campo.key}>
                    <label htmlFor={campo.key}>{campo.label}</label>
                    {renderCampo(campo)}
                  </div>
                ))}
                <div className="field field--full">
                  <div className="modal__acciones">
                    <button type="button" className="btn btn--ghost" onClick={cerrarModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={cargando}>
                      {cargando ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {permitirEliminar && (
        <ConfirmModal
          open={itemAEliminar !== null}
          mensaje={`¿Eliminar este registro de ${titulo.toLowerCase()}?`}
          onConfirmar={manejarEliminar}
          onCancelar={() => setItemAEliminar(null)}
        />
      )}
    </div>
  );
}
