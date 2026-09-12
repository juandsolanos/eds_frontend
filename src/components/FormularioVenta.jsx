import { useState, useMemo, useEffect } from "react";
import { formatMoney } from "../utils/format";
import InputMiles from "./InputMiles";

export default function FormularioVenta({
  productos,
  onRegistrar,
  cargando,
  inicial = null,
  onActualizar = null,
  onCancelarEditar = null,
}) {
  const esEdicion = Boolean(inicial);
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");

  const tipos = useMemo(() => [...new Set(productos.map((p) => p.tipo))].sort(), [productos]);

  const productosFiltrados = tipoFiltro ? productos.filter((p) => p.tipo === tipoFiltro) : productos;

  const productoSeleccionado = productos.find((p) => p.codigo === codigo);
  const valorEstimado =
    productoSeleccionado && cantidad
      ? formatMoney(productoSeleccionado.precio_unitario * Number(cantidad))
      : null;

  useEffect(() => {
    if (inicial) {
      setTipoFiltro("");
      setCodigo(inicial.codigo);
      setCantidad(String(inicial.cantidad));
    } else {
      setCodigo("");
      setCantidad("");
    }
  }, [inicial]);

  function limpiar() {
    setCodigo("");
    setCantidad("");
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    const datos = { codigo, cantidad: Number(cantidad) };
    if (esEdicion) {
      const ok = await onActualizar({ ...datos, isla: inicial.isla });
      if (ok) onCancelarEditar?.();
      return;
    }
    const ok = await onRegistrar(datos);
    if (ok) limpiar();
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tipo_filtro">Filtrar por tipo</label>
          <select
            id="tipo_filtro"
            value={tipoFiltro}
            onChange={(e) => {
              setTipoFiltro(e.target.value);
              setCodigo(""); // el producto elegido puede ya no estar visible con el nuevo filtro
            }}
          >
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="producto">Producto</label>
          <select
            id="producto"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
          >
            <option value="">Selecciona...</option>
            {productosFiltrados.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="cantidad">Cantidad</label>
          <InputMiles
            id="cantidad"
            min="1"
            value={cantidad}
            onChange={setCantidad}
            required
          />
        </div>

        {valorEstimado && (
          <div className="field">
            <label>Valor total estimado</label>
            <div className="readout">{valorEstimado}</div>
          </div>
        )}

        <div className="field field--full modal__acciones">
          {esEdicion && (
            <button type="button" className="btn btn--ghost" onClick={onCancelarEditar} disabled={cargando}>
              Cancelar edición
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={cargando}>
            {esEdicion
              ? cargando
                ? "Guardando..."
                : "Guardar cambios"
              : cargando
                ? "Registrando..."
                : "Registrar venta"}
          </button>
        </div>
      </div>
    </form>
  );
}