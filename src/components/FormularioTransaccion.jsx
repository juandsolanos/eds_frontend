import { useState } from "react";

export default function FormularioTransaccion({ tipos, clientes, mostrarCliente = true, onRegistrar, cargando }) {
  const [tipo, setTipo] = useState(tipos.length > 0 ? tipos[0].id : "");
  const [valor, setValor] = useState("");
  const [clienteId, setClienteId] = useState("");

  function limpiar() {
    setValor("");
    setClienteId("");
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    const ok = await onRegistrar({
      tipo,
      valor: Number(valor),
      cliente_id: mostrarCliente && clienteId ? Number(clienteId) : null,
    });
    if (ok) limpiar();
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} required>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="valor">Valor</label>
          <input
            id="valor"
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
        </div>

        {mostrarCliente && (
          <div className="field field--full">
            <label htmlFor="cliente">Cliente (opcional)</label>
            <select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Sin cliente asociado</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field field--full">
          <button type="submit" className="btn btn--primary" disabled={cargando}>
            {cargando ? "Registrando..." : "Registrar"}
          </button>
        </div>
      </div>
    </form>
  );
}
