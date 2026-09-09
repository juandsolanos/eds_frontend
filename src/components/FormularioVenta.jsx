import { useState, useMemo } from "react";
import { formatMoney } from "../utils/format";
import InputMiles from "./InputMiles";
import Select from "./Select";

export default function FormularioVenta({ productos, onRegistrar, cargando }) {
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");

  const tipos = useMemo(
    () => [...new Set(productos.map((p) => p.tipo))].sort(),
    [productos]
  );

  const productosFiltrados = tipoFiltro
    ? productos.filter((p) => p.tipo === tipoFiltro)
    : productos;

  const productoSeleccionado = productos.find((p) => p.codigo === codigo);
  const valorEstimado = productoSeleccionado && cantidad
    ? formatMoney(productoSeleccionado.precio_unitario * Number(cantidad))
    : null;

  function limpiar() {
    setCodigo("");
    setCantidad("");
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    const ok = await onRegistrar({ codigo, cantidad: Number(cantidad) });
    if (ok) limpiar();
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tipo_filtro">Filtrar por tipo</label>
          <Select
            id="tipo_filtro"
            value={tipoFiltro}
            onChange={(v) => {
              setTipoFiltro(v);
              setCodigo(""); // el producto elegido puede ya no estar visible con el nuevo filtro
            }}
            placeholder="Todos los tipos"
            options={tipos.map((t) => ({ value: t, label: t }))}
          />
        </div>
        <div className="field">
          <label htmlFor="producto">Producto</label>
          <Select
            id="producto"
            value={codigo}
            onChange={setCodigo}
            options={productosFiltrados.map((p) => ({ value: p.codigo, label: p.nombre }))}
            required
          />
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

        <div className="field field--full">
          <button type="submit" className="btn btn--primary" disabled={cargando}>
            {cargando ? "Registrando..." : "Registrar venta"}
          </button>
        </div>
      </div>
    </form>
  );
}
