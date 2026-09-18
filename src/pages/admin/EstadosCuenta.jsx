import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { formatMoney } from "../../utils/format";
import InputMiles from "../../components/InputMiles";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function colorBalance(balance) {
  const n = Number(balance ?? 0);
  if (n > 0) return "#ef4444";
  if (n < 0) return "#22c55e";
  return "var(--text-muted)";
}

export default function EstadosCuenta() {
  const { token, usuario } = useAuth();
  const esSuperadmin = usuario.rol === "superadministrador";

  const [estados, setEstados] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [deudaModal, setDeudaModal] = useState(null);
  const [deudaValor, setDeudaValor] = useState("");

  const [abonoModal, setAbonoModal] = useState(null);
  const [abonoValor, setAbonoValor] = useState("");
  const [abonoNotas, setAbonoNotas] = useState("");

  const [abonosPanel, setAbonosPanel] = useState(null);
  const [abonos, setAbonos] = useState([]);

  const cargar = useCallback(
    async ({ signal } = {}) => {
      try {
        setError(null);
        const data = await api.listarEstadosCuenta(token, { signal });
        setEstados(data);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.detail);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  const filtrados = estados.filter((e) =>
    (e.nombre || "").toLowerCase().includes(filtro.toLowerCase())
  );

  function abrirDeuda(estado) {
    setError(null);
    setAviso(null);
    setDeudaModal(estado);
    setDeudaValor(String(estado.deuda_permitida ?? 0));
  }

  async function guardarDeuda(evento) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      await api.actualizarDeudaPermitida(token, deudaModal.cliente_id, Number(deudaValor) || 0);
      setAviso(`Deuda permitida actualizada para ${deudaModal.nombre}.`);
      setDeudaModal(null);
      await cargar();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  function abrirAbono(estado) {
    setError(null);
    setAviso(null);
    setAbonoModal(estado);
    setAbonoValor("");
    setAbonoNotas("");
  }

  async function registrarAbono(evento) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      await api.crearAbono(token, abonoModal.cliente_id, {
        valor: Number(abonoValor),
        notas: abonoNotas.trim() ? abonoNotas.trim() : null,
      });
      setAviso(`Abono registrado para ${abonoModal.nombre}.`);
      setAbonoModal(null);
      await cargar();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function verAbonos(estado) {
    setError(null);
    setAviso(null);
    setAbonosPanel(estado);
    setAbonos([]);
    try {
      const data = await api.listarAbonos(token, estado.cliente_id);
      setAbonos(data);
    } catch (err) {
      setError(err.detail);
    }
  }

  async function anularAbono(abono) {
    setCargando(true);
    setError(null);
    try {
      await api.anularAbono(token, abono.id);
      const data = await api.listarAbonos(token, abonosPanel.cliente_id);
      setAbonos(data);
      await cargar();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Estados de cuenta</h3>
        <input
          placeholder="Filtrar por cliente..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>

      <p style={{ color: "var(--text-muted)", marginBottom: "var(--spacing-4)" }}>
        Balance positivo = el cliente nos debe; balance negativo = saldo a favor del cliente.
        La deuda permitida {esSuperadmin ? "la puedes modificar" : "solo la modifica un superadministrador"}.
      </p>

      {error && <div className="alert alert--error">{error}</div>}
      {aviso && <div className="alert alert--success">{aviso}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th style={{ textAlign: "right" }}>Deuda permitida</th>
              <th style={{ textAlign: "right" }}>Disponible</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => {
              const disponible = Number(e.deuda_permitida) - Number(e.balance);
              return (
                <tr key={e.cliente_id}>
                  <td>{e.nombre}</td>
                  <td>{e.tipo}</td>
                  <td className="mono" style={{ textAlign: "right", color: colorBalance(e.balance) }}>
                    {formatMoney(e.balance)}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {formatMoney(e.deuda_permitida)}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {formatMoney(disponible)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--spacing-2)", flexWrap: "wrap" }}>
                      <button className="btn btn--ghost" onClick={() => verAbonos(e)}>
                        Abonos
                      </button>
                      <button className="btn btn--primary" onClick={() => abrirAbono(e)}>
                        Abono a cuenta
                      </button>
                      {esSuperadmin && (
                        <button className="btn btn--ghost" onClick={() => abrirDeuda(e)}>
                          Deuda permitida
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  Sin clientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deudaModal && (
        <div className="modal-overlay" onClick={() => setDeudaModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h4>Deuda permitida · {deudaModal.nombre}</h4>
            <form onSubmit={guardarDeuda}>
              <div className="field" style={{ marginBottom: "var(--spacing-4)" }}>
                <label htmlFor="deuda">Deuda permitida</label>
                <InputMiles id="deuda" value={deudaValor} onChange={setDeudaValor} required />
              </div>
              <div className="modal__acciones">
                <button type="button" className="btn btn--ghost" onClick={() => setDeudaModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={cargando}>
                  {cargando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {abonoModal && (
        <div className="modal-overlay" onClick={() => setAbonoModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h4>Abono a cuenta · {abonoModal.nombre}</h4>
            <p style={{ color: "var(--text-muted)" }}>
              Balance actual: {formatMoney(abonoModal.balance)}
            </p>
            <form onSubmit={registrarAbono}>
              <div className="field" style={{ marginBottom: "var(--spacing-3)" }}>
                <label htmlFor="abono-valor">Valor del abono</label>
                <InputMiles id="abono-valor" value={abonoValor} onChange={setAbonoValor} required />
              </div>
              <div className="field" style={{ marginBottom: "var(--spacing-4)" }}>
                <label htmlFor="abono-notas">Notas (opcional)</label>
                <textarea
                  id="abono-notas"
                  rows={2}
                  value={abonoNotas}
                  onChange={(e) => setAbonoNotas(e.target.value)}
                />
              </div>
              <div className="modal__acciones">
                <button type="button" className="btn btn--ghost" onClick={() => setAbonoModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={cargando}>
                  {cargando ? "Registrando..." : "Registrar abono"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {abonosPanel && (
        <div className="modal-overlay" onClick={() => setAbonosPanel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h4>Abonos · {abonosPanel.nombre}</h4>
            {abonos.length === 0 && <p style={{ color: "var(--text-muted)" }}>Sin abonos.</p>}
            {abonos.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                      <th>Notas</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonos.map((a) => (
                      <tr key={a.id} style={{ opacity: a.anulado ? 0.5 : 1 }}>
                        <td>{formatoFecha(a.tiempo)}</td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {formatMoney(a.valor)}
                        </td>
                        <td>{a.notas || "—"}</td>
                        <td>{a.anulado ? "Anulado" : "Activo"}</td>
                        <td>
                          {!a.anulado && (
                            <button
                              className="btn btn--danger"
                              disabled={cargando}
                              onClick={() => anularAbono(a)}
                            >
                              Anular
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal__acciones">
              <button className="btn btn--ghost" onClick={() => setAbonosPanel(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
