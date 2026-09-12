import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";
import { formatMoney } from "../../utils/format";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function formatoValor(v) {
  return v == null ? "—" : formatMoney(Number(v));
}

function resumenCambios(h) {
  const anterior = h.datos_anteriores || {};
  const nuevo = h.datos_nuevos || {};

  if (h.accion === "anular") {
    return `Tipo: ${anterior.tipo ?? "—"} · Valor: ${formatoValor(anterior.valor)} · Cliente: ${
      anterior.cliente_id ?? "—"
    }`;
  }

  const partes = [];
  const campos = [
    { key: "tipo", nombre: "Tipo", formato: (v) => (v == null ? "—" : v) },
    { key: "valor", nombre: "Valor", formato: formatoValor },
    { key: "cliente_id", nombre: "Cliente", formato: (v) => (v == null ? "—" : v) },
  ];
  campos.forEach((c) => {
    const a = c.formato(anterior[c.key]);
    const b = c.formato(nuevo[c.key]);
    if (a !== b) partes.push(`${c.nombre}: ${a} → ${b}`);
  });
  return partes.length > 0 ? partes.join(" · ") : "Sin cambios";
}

export default function Trazabilidad() {
  const { token } = useAuth();
  const [transaccionFiltro, setTransaccionFiltro] = useState("");
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState(null);

  const cargar = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.listarHistorialTransacciones(token, transaccionFiltro || undefined, { signal });
      setHistorial(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [token, transaccionFiltro]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Trazabilidad de transacciones</h3>
        <input
          placeholder="Filtrar por id de transacción..."
          value={transaccionFiltro}
          onChange={(e) => setTransaccionFiltro(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>

      <p style={{ color: "var(--text-muted)", marginBottom: "var(--spacing-4)" }}>
        Registro de ediciones y anulaciones de los movimientos de crédito y caja.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      <RegistrosTabla
        columnas={[
          { key: "tiempo", label: "Fecha", render: (h) => formatoFecha(h.tiempo) },
          { key: "transaccion_id", label: "Transacción", mono: true },
          {
            key: "accion",
            label: "Acción",
            render: (h) => (
              <span style={{ color: h.accion === "anular" ? "#ef4444" : "#2563eb", fontWeight: 600 }}>
                {h.accion === "anular" ? "Anulada" : "Editada"}
              </span>
            ),
          },
          { key: "operario_id", label: "Operario", mono: true },
          { key: "cambios", label: "Cambios", render: resumenCambios },
        ]}
        filas={historial}
        vacio="Sin movimientos de trazabilidad registrados."
      />
    </div>
  );
}