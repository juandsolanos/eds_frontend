import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";
import { formatMoney } from "../../utils/format";

const formularioInicial = {
  tipo_producto: "granel",
  codigo: "",
  nombre: "",
  precio: "",
  fecha_desde: "",
  crear_producto: false,
  unidad: "galones",
  tipo_unidad: "general",
};

export default function Precios() {
  const { token } = useAuth();
  const [precios, setPrecios] = useState([]);
  const [form, setForm] = useState(formularioInicial);
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [cargando, setCargando] = useState(false);
  const archivoRef = useRef(null);

  const cargar = useCallback(
    async ({ signal } = {}) => {
      try {
        const datos = await api.precios.listar(
          token,
          {
            tipo_producto: filtroTipo || undefined,
            codigo: filtroCodigo || undefined,
          },
          { signal }
        );
        setPrecios(datos);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.detail);
      }
    },
    [token, filtroTipo, filtroCodigo]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  function actualizarCampo(key, valor) {
    setForm((prev) => ({ ...prev, [key]: valor }));
  }

  async function manejarDefinir(evento) {
    evento.preventDefault();
    setError(null);
    setExito(null);
    if (!form.codigo.trim() || form.precio === "") {
      setError("Código y precio son obligatorios.");
      return;
    }
    setCargando(true);
    try {
      const datos = {
        tipo_producto: form.tipo_producto,
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim() || undefined,
        precio: Number(form.precio),
        fecha_desde: form.fecha_desde || null,
        crear_producto: Boolean(form.crear_producto),
        unidad: form.unidad,
        tipo_unidad: form.tipo_unidad,
      };
      const resultado = await api.precios.definir(token, datos);
      const recalculados = Object.entries(resultado.recalculados || {})
        .filter(([, cantidad]) => cantidad > 0)
        .map(([clave, cantidad]) => `${clave}: ${cantidad}`)
        .join(", ");
      setExito(
        `Precio guardado y movimientos recalculados${recalculados ? ` (${recalculados}).` : "."}`
      );
      setForm(formularioInicial);
      await cargar();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function manejarImportar(evento) {
    evento.preventDefault();
    const seleccionado = archivo || archivoRef.current?.files?.[0];
    if (!seleccionado) {
      setError("Selecciona un archivo Excel (.xlsx).");
      return;
    }
    setError(null);
    setExito(null);
    setCargando(true);
    try {
      const resultado = await api.precios.importarExcel(token, seleccionado);
      setExito(
        `Importación completada: ${resultado.procesadas} filas (${resultado.granel} granel, ${resultado.unidad} unidad).`
      );
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = "";
      await cargar();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function manejarPlantilla() {
    setError(null);
    setExito(null);
    try {
      await api.precios.descargarPlantilla(token);
      setExito("Plantilla descargada.");
    } catch (err) {
      setError(err.detail);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Precios con fecha efectiva</h3>
          <button className="btn" onClick={manejarPlantilla} disabled={cargando}>
            Descargar plantilla
          </button>
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          El precio se aplica desde la fecha indicada. Se recalculan lecturas y ventas desde esa
          fecha. Los días cerrados o con validaciones fijadas bloquean el cambio.
        </p>
        {error && <div className="alert alert--error" role="alert">{error}</div>}
        {exito && <div className="alert alert--success" role="status">{exito}</div>}

        <form className="form-grid" onSubmit={manejarDefinir}>
          <div className="field">
            <label htmlFor="tipo_producto">Tipo de producto</label>
            <select
              id="tipo_producto"
              value={form.tipo_producto}
              onChange={(e) => actualizarCampo("tipo_producto", e.target.value)}
            >
              <option value="granel">Granel</option>
              <option value="unidad">Unidad</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="codigo">Código</label>
            <input
              id="codigo"
              value={form.codigo}
              onChange={(e) => actualizarCampo("codigo", e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="nombre">Nombre (solo si el código es nuevo)</label>
            <input
              id="nombre"
              value={form.nombre}
              onChange={(e) => actualizarCampo("nombre", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="precio">Precio</label>
            <input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              value={form.precio}
              onChange={(e) => actualizarCampo("precio", e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="fecha_desde">Fecha efectiva</label>
            <input
              id="fecha_desde"
              type="date"
              value={form.fecha_desde}
              onChange={(e) => actualizarCampo("fecha_desde", e.target.value)}
            />
          </div>
          {form.tipo_producto === "granel" ? (
            <div className="field">
              <label htmlFor="unidad">Unidad (solo si el código es nuevo)</label>
              <select
                id="unidad"
                value={form.unidad}
                onChange={(e) => actualizarCampo("unidad", e.target.value)}
              >
                <option value="galones">Galones</option>
                <option value="litros">Litros</option>
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="tipo_unidad">Tipo (solo si el código es nuevo)</label>
              <input
                id="tipo_unidad"
                value={form.tipo_unidad}
                onChange={(e) => actualizarCampo("tipo_unidad", e.target.value)}
              />
            </div>
          )}
          <div className="field field--full">
            <label className="checkbox" htmlFor="crear_producto">
              <input
                id="crear_producto"
                type="checkbox"
                checked={form.crear_producto}
                onChange={(e) => actualizarCampo("crear_producto", e.target.checked)}
              />
              Crear el producto si el código no existe
            </label>
          </div>
          <div className="field field--full">
            <button className="btn btn--primary" type="submit" disabled={cargando}>
              {cargando ? "Guardando..." : "Guardar precio"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Importar precios desde Excel</h3>
        </div>
        <form onSubmit={manejarImportar} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            style={{ maxWidth: 260 }}
          />
          <button className="btn btn--primary" type="submit" disabled={cargando || !archivo}>
            Importar Excel
          </button>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Hojas "granel" y "unidad": CODIGO, PRECIO, FECHA_EFECTIVA.
          </span>
        </form>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Vigencias registradas</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="granel">Granel</option>
              <option value="unidad">Unidad</option>
            </select>
            <input
              placeholder="Filtrar por código..."
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
              style={{ maxWidth: 220 }}
            />
          </div>
        </div>
        <RegistrosTabla
          columnas={[
            { key: "codigo", label: "Código", mono: true },
            { key: "nombre_producto", label: "Producto" },
            { key: "tipo_producto", label: "Tipo" },
            { key: "fecha_desde", label: "Vigente desde" },
            {
              key: "precio",
              label: "Precio",
              render: (p) => formatMoney(p.precio),
            },
            { key: "creado_por", label: "Registrado por", mono: true },
          ]}
          filas={precios}
          vacio="No hay vigencias registradas con estos filtros."
        />
      </div>
    </div>
  );
}
