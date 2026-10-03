import { useState, useEffect, useMemo } from "react";
import InputMiles from "./InputMiles";
import { formatMoney } from "../utils/format";

export default function FormularioTransaccion({
  tipos,
  clientes,
  mostrarCliente = true,
  onRegistrar,
  cargando,
  inicial = null,
  onActualizar = null,
  onCancelarEditar = null,
}) {
  const esEdicion = Boolean(inicial);
  const [tipo, setTipo] = useState(tipos.length > 0 ? tipos[0].id : "");
  const [valor, setValor] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [comentarios, setComentarios] = useState("");

  // `inicial` es un objeto que el padre reconstruye en cada render: usarlo
  // como dependencia reiniciaba el formulario continuamente. Trabajamos con
  // primitivos para que los efectos solo corran cuando cambia el registro.
  const tipoInicial = inicial?.tipo ?? null;
  const valorInicial = inicial?.valor ?? null;
  const clienteIdInicial = inicial?.cliente_id ?? null;
  const tipoPorDefecto = tipos.length > 0 ? tipos[0].id : "";

  const clientesFiltrados = useMemo(() => {
    if (!mostrarCliente) return [];
    return (clientes || []).filter(
      (c) =>
        (c.creditos || []).includes(tipo) ||
        (clienteIdInicial != null && String(c.id) === String(clienteIdInicial))
    );
  }, [mostrarCliente, clientes, tipo, clienteIdInicial]);

  const esMinorista = tipo === "minorista";
  const clienteSel = clientesFiltrados.find((c) => String(c.id) === String(clienteId)) || null;

  // Al editar una transacción minorista del mismo cliente, su valor ya está
  // incluido en el balance: lo descontamos para calcular el disponible real.
  const valorIncluido =
    esEdicion && tipoInicial === "minorista" && clienteIdInicial != null && String(clienteIdInicial) === String(clienteId)
      ? Number(valorInicial)
      : 0;
  const balanceBase = clienteSel ? Number(clienteSel.balance) - valorIncluido : 0;
  const disponible = clienteSel ? Number(clienteSel.deuda_permitida) - balanceBase : 0;
  const excedeLimite =
    esMinorista && clienteSel && Number(valor) > 0 && Number(valor) > disponible;
  const faltaCliente = esMinorista && !clienteId;

  useEffect(() => {
    if (esEdicion) {
      setTipo(String(tipoInicial));
      setValor(String(valorInicial));
      setClienteId(clienteIdInicial != null ? String(clienteIdInicial) : "");
    } else {
      setTipo(tipoPorDefecto);
      setValor("");
      setClienteId("");
    }
    setComentarios("");
  }, [esEdicion, tipoInicial, valorInicial, clienteIdInicial, tipoPorDefecto]);

  useEffect(() => {
    if (!mostrarCliente) return;
    if (esEdicion && clienteIdInicial != null) return;
    const sigueHabilitado = clientesFiltrados.some((c) => String(c.id) === String(clienteId));
    if (clienteId && !sigueHabilitado) setClienteId("");
  }, [tipo, mostrarCliente, clientesFiltrados, clienteId, esEdicion, clienteIdInicial]);

  function limpiar() {
    setValor("");
    setClienteId("");
    setComentarios("");
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    const datos = {
      tipo,
      valor: Number(valor),
      cliente_id: mostrarCliente && clienteId ? Number(clienteId) : null,
      comentarios: comentarios.trim() ? comentarios.trim() : null,
    };
    if (esEdicion) {
      const ok = await onActualizar(datos);
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
          <label htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            required
          >
            <option value="">Selecciona...</option>
            {tipos.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.nombre}
              </option>
            ))}
          </select>
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
            <label htmlFor="cliente">
              Cliente {esMinorista ? "(requerido)" : "(opcional)"}
            </label>
            <select
              id="cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Sin cliente asociado</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo})
                </option>
              ))}
            </select>
            {clientesFiltrados.length === 0 && (
              <small>No hay clientes con este tipo de crédito habilitado.</small>
            )}
            {clienteSel && (
              <small style={{ display: "block", marginTop: "var(--spacing-1)" }}>
                Balance: {formatMoney(clienteSel.balance)} · Deuda permitida:{" "}
                {formatMoney(clienteSel.deuda_permitida)} · Disponible: {formatMoney(disponible)}
              </small>
            )}
            {faltaCliente && (
              <small style={{ color: "var(--danger)" }}>Debes seleccionar un cliente para Minorista.</small>
            )}
            {excedeLimite && (
              <small style={{ color: "var(--danger)" }}>
                El valor supera la deuda permitida del cliente (disponible: {formatMoney(disponible)}).
                Un superadministrador debe ampliar la deuda permitida.
              </small>
            )}
          </div>
        )}

        <div className="field field--full">
          <label htmlFor="comentarios_transaccion">Comentarios (opcional)</label>
          <textarea
            id="comentarios_transaccion"
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            rows={2}
            placeholder="Opcional: quedará en la trazabilidad..."
          />
        </div>

        <div className="field field--full modal__acciones">
          {esEdicion && (
            <button type="button" className="btn btn--ghost" onClick={onCancelarEditar} disabled={cargando}>
              Cancelar edición
            </button>
          )}
          <button
            type="submit"
            className="btn btn--primary"
            disabled={cargando || excedeLimite || faltaCliente}
          >
            {esEdicion
              ? cargando
                ? "Guardando..."
                : "Guardar cambios"
              : cargando
                ? "Registrando..."
                : "Registrar"}
          </button>
        </div>
      </div>
    </form>
  );
}