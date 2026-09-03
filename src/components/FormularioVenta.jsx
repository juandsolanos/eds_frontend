import { useState, useMemo } from "react";
import { formatMoney } from "../utils/format";
import InputMiles from "./InputMiles";

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
          <select id="producto" value={codigo} onChange={(e) => setCodigo(e.target.value)} required>
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

        <div className="field field--full">
          <button type="submit" className="btn btn--primary" disabled={cargando}>
            {cargando ? "Registrando..." : "Registrar venta"}
          </button>
        </div>
      </div>
    </form>
  );
}
