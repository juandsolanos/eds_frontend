import { useState } from "react";
import { formatMoney } from "../utils/format";

export default function FormularioVentaGranel({ productos, onRegistrar, cargando }) {
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");

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
          <label htmlFor="combustible">Combustible</label>
          <select id="combustible" value={codigo} onChange={(e) => setCodigo(e.target.value)} required>
            <option value="">Selecciona...</option>
            {productos.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cantidad_granel">Galones</label>
          <input
            id="cantidad_granel"
            type="number"
            step="0.01"
            min="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
        </div>

        {valorEstimado && (
          <div className="field field--full">
            <label>Valor total estimado</label>
            <div className="readout">{valorEstimado}</div>
          </div>
        )}

        <div className="field field--full">
          <button type="submit" className="btn btn--primary" disabled={cargando}>
            {cargando ? "Registrando..." : "Registrar venta de combustible"}
          </button>
        </div>
      </div>
    </form>
  );
}
