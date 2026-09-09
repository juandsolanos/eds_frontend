import { useState, useEffect } from "react";
import InputMiles from "./InputMiles";
import Select from "./Select";

export default function FormularioTransaccion({ tipos, clientes, mostrarCliente = true, onRegistrar, cargando }) {
  const [tipo, setTipo] = useState(tipos.length > 0 ? tipos[0].id : "");
  const [valor, setValor] = useState("");
  const [clienteId, setClienteId] = useState("");

  const clientesFiltrados = mostrarCliente
    ? (clientes || []).filter((c) => (c.creditos || []).includes(tipo))
    : [];

  useEffect(() => {
    if (!mostrarCliente) return;
    const sigueHabilitado = clientesFiltrados.some((c) => String(c.id) === String(clienteId));
    if (clienteId && !sigueHabilitado) setClienteId("");
  }, [tipo, mostrarCliente, clientesFiltrados, clienteId]);

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
          <Select
            id="tipo"
            value={tipo}
            onChange={setTipo}
            options={tipos.map((t) => ({ value: String(t.id), label: t.nombre }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="valor">Valor</label>
          <InputMiles
            id="valor"
            step="0.01"
            min="0"
            value={valor}
            onChange={setValor}
            required
          />
        </div>

        {mostrarCliente && (
          <div className="field field--full">
            <label htmlFor="cliente">Cliente (opcional)</label>
            <Select
              id="cliente"
              value={clienteId}
              onChange={setClienteId}
              placeholder="Sin cliente asociado"
              options={clientesFiltrados.map((c) => ({
                value: c.id,
                label: `${c.nombre} (${c.tipo})`,
              }))}
            />
            {clientesFiltrados.length === 0 && (
              <small>No hay clientes con este tipo de crédito habilitado.</small>
            )}
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
