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
  const { token, usuario } = useAuth();
  const esSuperadmin = usuario.rol === "superadministrador";
  const esAdmin = ["administrador", "superadministrador"].includes(usuario.rol);
  const [fecha, setFecha] = useState(hoyISO());
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [detalle, setDetalle] = useState(null); // SnapshotDatos (vivo o guardado)
  const [origen, setOrigen] = useState(null); // "vivo" | "guardado"
  const [cerradoDetalle, setCerradoDetalle] = useState(false);
  const [validacionesInput, setValidacionesInput] = useState({});
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

  function cerradoEnHistorial(fechaISO) {
    const fila = historial.find((s) => s.fecha === fechaISO);
    return fila ? !!fila.cerrado : false;
  }

  async function verVivo() {
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.snapshotVivo(token, fecha);
      setDetalle(data);
      setOrigen("vivo");
      setCerradoDetalle(cerradoEnHistorial(data.fecha));
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
      setCerradoDetalle(!!data.cerrado);
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
      setCerradoDetalle(!!data.cerrado);
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
    // Cierra el día: congela el snapshot y bloquea la edición de sus
    // turnos y movimientos (solo superadmin).
    if (
      !window.confirm(
        `¿Cerrar el día ${fecha}? No se podrán editar sus turnos, transacciones, lecturas ni ventas, ni recalcular el snapshot.`
      )
    ) {
      return;
    }
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.cerrarDiaLock(token, fecha);
      setDetalle(data.datos);
      setOrigen("guardado");
      setCerradoDetalle(true);
      setExito(`Día ${data.fecha} cerrado: sus turnos y movimientos quedaron bloqueados.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  async function manejarReabrir() {
    const fechaCierre = detalle ? detalle.fecha : fecha;
    if (
      !window.confirm(
        `¿Reabrir el día ${fechaCierre}? Se volverán a permitir ediciones de sus turnos y movimientos.`
      )
    ) {
      return;
    }
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.reabrirDia(token, fechaCierre);
      setDetalle(data.datos);
      setOrigen("guardado");
      setCerradoDetalle(false);
      setFecha(data.fecha);
      setExito(`Día ${data.fecha} reabierto.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.detail);
    } finally {
      setCargando(false);
    }
  }

  // Efectivo según planillas: suma del valor de caja_fuerte + caja_facil.
  // Validado en físico: suma de las validaciones fijadas en esas dos cajas.
  const TIPOS_PLANILLA = ["caja_fuerte", "caja_facil"];

  function efectivoSegunPlanillas() {
    if (!detalle) return 0;
    return (detalle.transacciones_por_tipo || [])
      .filter((t) => TIPOS_PLANILLA.includes(t.tipo))
      .reduce((acc, t) => acc + Number(t.valor_total || 0), 0);
  }

  function validadoEnFisico() {
    if (!detalle) return null;
    const validaciones = detalle.validaciones || {};
    if (!TIPOS_PLANILLA.some((tipo) => validaciones[tipo] !== undefined)) return null;
    return TIPOS_PLANILLA.reduce((acc, tipo) => acc + Number(validaciones[tipo]?.valor || 0), 0);
  }

  async function manejarFijarValidacion(tipo) {
    if (!detalle) return;
    const valor = Number(validacionesInput[tipo]);
    if (validacionesInput[tipo] === undefined || validacionesInput[tipo] === "" || Number.isNaN(valor)) {
      setError("El valor de validación debe ser un número.");
      return;
    }
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const data = await api.fijarValidacion(token, detalle.fecha, tipo, valor);
      setDetalle(data.datos);
      setOrigen("guardado");
      setCerradoDetalle(!!data.cerrado);
      setValidacionesInput((prev) => ({ ...prev, [tipo]: "" }));
      setExito(`Validación de ${tipo} guardada.`);
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
            {esSuperadmin && (
              <button className="btn btn--primary" onClick={manejarCerrarDia} disabled={cargando || !fecha}>
                Cerrar día
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}
        {exito && <div className="alert alert--success">{exito}</div>}
        {cargando && <div className="empty-state">Cargando...</div>}

        {!cargando && detalle && (
          <>
            <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center", flexWrap: "wrap" }}>
              {esSuperadmin && !cerradoDetalle && (
                <button className="btn" onClick={manejarActualizar} disabled={cargando}>
                  Actualizar snapshot
                </button>
              )}
              {esSuperadmin && cerradoDetalle && (
                <button className="btn" onClick={manejarReabrir} disabled={cargando}>
                  Reabrir día
                </button>
              )}
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                {origen === "vivo"
                  ? `Vista previa sin guardar del ${detalle.fecha} (todos los turnos, todas las islas).`
                  : `Snapshot guardado del ${detalle.fecha}.`}
                {" "}Turnos del día: {detalle.turnos.length}
              </p>
              {cerradoDetalle && (
                <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: "0.85rem" }}>
                  Día cerrado (edición bloqueada)
                </span>
              )}
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
                    <th>Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.transacciones_por_tipo.map((t) => {
                    const validacion = (detalle.validaciones || {})[t.tipo];
                    const puedeValidar = esAdmin && origen === "guardado" && !cerradoDetalle;
                    return (
                      <tr key={t.tipo}>
                        <td>
                          {t.nombre || t.tipo}{" "}
                          <span style={{ color: t.signo === 1 ? "var(--success)" : "var(--danger)" }}>
                            ({t.signo === 1 ? "+" : "-"})
                          </span>
                        </td>
                        <td className="mono">{formatCant(t.cantidad)}</td>
                        <td className="mono">{formatMoney(t.valor_total)}</td>
                        <td>
                          {validacion ? (
                            <span className="mono" title={`Fijado por ${validacion.por || "—"}${validacion.en ? ` · ${validacion.en.replace("T", " ")}` : ""}`}>
                              {formatMoney(validacion.valor)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                          {puedeValidar && (
                            <span style={{ display: "inline-flex", gap: 4, marginLeft: 8 }}>
                              <input
                                type="number"
                                step="any"
                                placeholder="Valor..."
                                value={validacionesInput[t.tipo] ?? ""}
                                onChange={(e) =>
                                  setValidacionesInput((prev) => ({ ...prev, [t.tipo]: e.target.value }))
                                }
                                style={{ maxWidth: 110 }}
                              />
                              <button
                                className="btn"
                                onClick={() => manejarFijarValidacion(t.tipo)}
                                disabled={cargando || (validacionesInput[t.tipo] ?? "") === ""}
                              >
                                Guardar
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

            <h4>Efectivo esperado</h4>
            {(() => {
              const planillas = efectivoSegunPlanillas();
              const fisico = validadoEnFisico();
              const diferencia = fisico === null ? null : detalle.efectivo_esperado - fisico;
              return (
                <>
                  <table className="table">
                    <tbody>
                      <tr>
                        <td>Mangueras + Complementarios − Consumos = Total ventas</td>
                        <td className="mono">
                          {formatMoney(detalle.ventas_mangueras_valor)} +{" "}
                          {formatMoney(detalle.ventas_complementarios_valor)} −{" "}
                          {formatMoney(detalle.consumos_valor)} ={" "}
                          <strong>{formatMoney(detalle.total_ventas)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td>Total ventas − Créditos = Efectivo esperado</td>
                        <td className="mono">
                          {formatMoney(detalle.total_ventas)} − {formatMoney(detalle.creditos_valor)} ={" "}
                          <strong>{formatMoney(detalle.efectivo_esperado)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td>Efectivo según planillas (caja fuerte + caja fácil)</td>
                        <td className="mono">{formatMoney(planillas)}</td>
                      </tr>
                      <tr>
                        <td>Validado en físico (validaciones de esas cajas)</td>
                        <td className="mono">
                          {fisico === null ? (
                            <span style={{ color: "var(--text-muted)" }}>sin diligenciar</span>
                          ) : (
                            formatMoney(fisico)
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Diferencia (Esperado − Físico)</strong>
                        </td>
                        <td
                          className="mono"
                          style={{
                            color:
                              diferencia === null
                                ? "var(--text-muted)"
                                : diferencia === 0
                                  ? "var(--success)"
                                  : "var(--danger)",
                            fontWeight: 700,
                          }}
                        >
                          {diferencia === null ? "—" : formatMoney(diferencia)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </>
              );
            })()}
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
                <th>Estado</th>
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
                  <td style={{ color: s.cerrado ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                    {s.cerrado ? "Cerrado" : "Abierto"}
                  </td>
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
