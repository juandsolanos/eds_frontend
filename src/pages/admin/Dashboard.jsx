import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { formatMoney } from "../../utils/format";

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

export default function Dashboard() {
  const { token } = useAuth();
  const [desde, setDesde] = useState(haceDiasISO(7));
  const [hasta, setHasta] = useState(hoyISO());
  const [reporte, setReporte] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async ({ signal } = {}) => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.reporteDiario(token, desde, hasta, { signal });
      setReporte(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    } finally {
      setCargando(false);
    }
  }, [token, desde, hasta]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Resumen por día</h3>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span style={{ color: "var(--text-muted)" }}>a</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}
        {cargando && <div className="empty-state">Cargando...</div>}

        {!cargando && reporte.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ventas combustible</th>
                <th>Ventas por unidad</th>
                <th>Transacciones por tipo</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {reporte.map((dia) => (
                <tr key={dia.fecha}>
                  <td className="mono">{dia.fecha}</td>
                  <td>{formatMoney(dia.ventas_granel_valor)}</td>
                  <td>{formatMoney(dia.ventas_unidad_valor)}</td>
                  <td>
                    {dia.transacciones_por_tipo.length === 0 ? (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    ) : (
                      dia.transacciones_por_tipo.map((t) => (
                        <div key={t.tipo} style={{ fontSize: "0.85rem" }}>
                          {t.nombre}: {formatMoney(t.valor_total)}{" "}
                          <span style={{ color: t.signo === 1 ? "var(--success)" : "var(--danger)" }}>
                            ({t.signo === 1 ? "+" : "-"})
                          </span>
                        </div>
                      ))
                    )}
                  </td>
                  <td
                    className="mono"
                    style={{ color: dia.balance >= 0 ? "var(--success)" : "var(--danger)" }}
                  >
                    {formatMoney(dia.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!cargando && reporte.length === 0 && !error && (
          <div className="empty-state">Sin datos en este rango de fechas.</div>
        )}
      </div>
    </div>
  );
}
