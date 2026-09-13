import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { formatMoney, formatVol, formatCant } from "../../utils/format";

function aISO(fecha) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

function hoyISO() {
  return aISO(new Date());
}

function haceDiasISO(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return aISO(fecha);
}

export default function Snapshots() {
  const { token } = useAuth();
  const [fecha, setFecha] = useState(hoyISO());
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [detalle, setDetalle] = useState(null); // SnapshotDatos (vivo o guardado)
  const [origen, setOrigen] = useState(null); // "vivo" | "guardado"
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargarHistorial = useCallback(
    async ({ signal } = {}) => {
      try {
        const data = await api.listarSnapshots(token, desde, hasta, { signal });
        setHistorial(data);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.detail);
      }
    },
    [token, desde, hasta]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    cargarHistorial({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargarHistorial]);

  async function verVivo() {
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.snapshotVivo(token, fecha);
      setDetalle(data);
      setOrigen("vivo");
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function verGuardado(fechaGuardada) {
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.obtenerSnapshot(token, fechaGuardada);
      setDetalle(data.datos);
      setOrigen("guardado");
      setFecha(fechaGuardada);
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function manejarActualizar() {
    // Recalcula el snapshot releyendo los datos del día y lo guarda
    // (el backend hace UPSERT: si ya existe, lo actualiza).
    if (!detalle) return;
    if (
      !window.confirm(
        `¿Releer los datos del ${detalle.fecha} y recalcular su snapshot? Se actualizará el guardado.`
      )
    ) {
      return;
    }
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.cerrarDiaOperativo(token, detalle.fecha);
      setDetalle(data.datos);
      setOrigen("guardado");
      setFecha(data.fecha);
      setExito(`Snapshot del ${data.fecha} recalculado y actualizado.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function manejarCerrarDia() {
    if (
      !window.confirm(
        `¿Congelar el resumen del día ${fecha}? Si ya existe, se recalcula y actualiza.`
      )
    ) {
      return;
    }
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.cerrarDiaOperativo(token, fecha);
      setDetalle(data.datos);
      setOrigen("guardado");
      setExito(`Snapshot del ${data.fecha} guardado.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Snapshot del día de operación</h3>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <button className="btn" onClick={verVivo} disabled={cargando || !fecha}>
              Ver resumen
            </button>
            <button className="btn btn--primary" onClick={manejarCerrarDia} disabled={cargando || !fecha}>
              Cerrar día
            </button>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}
        {exito && <div className="alert alert--success">{exito}</div>}
        {cargando && <div className="empty-state">Cargando...</div>}

        {!cargando && detalle && (
          <>
            <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                {origen === "vivo"
                  ? `Vista previa sin guardar del ${detalle.fecha} (todos los turnos, todas las islas).`
                  : `Snapshot guardado del ${detalle.fecha}.`}
                {" "}Turnos del día: {detalle.turnos.length}
              </p>
              <button className="btn" onClick={manejarActualizar} disabled={cargando}>
                Actualizar snapshot
              </button>
            </div>

            <h4>Transacciones por tipo</h4>
            {detalle.transacciones_por_tipo.length === 0 ? (
              <div className="empty-state">Sin transacciones este día.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.transacciones_por_tipo.map((t) => (
                    <tr key={t.tipo}>
                      <td>
                        {t.nombre || t.tipo}{" "}
                        <span style={{ color: t.signo === 1 ? "var(--success)" : "var(--danger)" }}>
                          ({t.signo === 1 ? "+" : "-"})
                        </span>
                      </td>
                      <td className="mono">{formatCant(t.cantidad)}</td>
                      <td className="mono">{formatMoney(t.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4>Lecturas por manguera</h4>
            {detalle.mangueras.length === 0 ? (
              <div className="empty-state">Sin lecturas este día.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Manguera</th>
                    <th>Isla</th>
                    <th>Combustible</th>
                    <th>Lecturas</th>
                    <th>Galones</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.mangueras.map((m) => (
                    <tr key={m.manguera_id}>
                      <td className="mono">{m.manguera_id}</td>
                      <td className="mono">{m.isla}</td>
                      <td>{m.codigo_combustible}</td>
                      <td className="mono">{formatCant(m.num_lecturas)}</td>
                      <td className="mono">{formatVol(m.galones)}</td>
                      <td className="mono">{formatMoney(m.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4>Combustibles</h4>
            {detalle.combustibles.length === 0 ? (
              <div className="empty-state">Sin ventas de combustible este día.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Combustible</th>
                    <th>Galones</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.combustibles.map((c) => (
                    <tr key={c.codigo}>
                      <td>{c.codigo}</td>
                      <td className="mono">{formatVol(c.galones)}</td>
                      <td className="mono">{formatMoney(c.valor_total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total combustibles</strong>
                    </td>
                    <td className="mono">
                      <strong>{formatVol(detalle.total_combustible_galones)}</strong>
                    </td>
                    <td className="mono">
                      <strong>{formatMoney(detalle.total_combustible_valor)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Historial de snapshots guardados</h3>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span style={{ color: "var(--text-muted)" }}>a</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        {historial.length === 0 ? (
          <div className="empty-state">Sin snapshots guardados en este rango.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Total combustible</th>
                <th>Mangueras</th>
                <th>Tipos transacción</th>
                <th>Turnos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historial.map((s) => (
                <tr key={s.fecha}>
                  <td className="mono">{s.fecha}</td>
                  <td className="mono">
                    {formatVol(s.total_combustible_galones)} gal ·{" "}
                    {formatMoney(s.total_combustible_valor)}
                  </td>
                  <td className="mono">{formatCant(s.num_mangueras)}</td>
                  <td className="mono">{formatCant(s.num_tipos_transaccion)}</td>
                  <td className="mono">{formatCant(s.num_turnos)}</td>
                  <td>
                    <button className="btn" onClick={() => verGuardado(s.fecha)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
