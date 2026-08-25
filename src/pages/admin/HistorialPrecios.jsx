import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";
import { formatMoney } from "../../utils/format";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function HistorialPrecios() {
  const { token } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState(null);

  const cargar = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.listarHistorialPrecios(token, codigo || undefined, { signal });
      setHistorial(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [token, codigo]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [cargar]);

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Historial de precios</h3>
        <input
          placeholder="Filtrar por código de producto..."
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <RegistrosTabla
        columnas={[
          { key: "codigo", label: "Código", mono: true },
          { key: "tipo_producto", label: "Tipo" },
          {
            key: "precio_anterior",
            label: "Precio anterior",
            render: (h) => formatMoney(h.precio_anterior),
          },
          {
            key: "precio_nuevo",
            label: "Precio nuevo",
            mono: true,
            render: (h) => formatMoney(h.precio_nuevo),
          },
          { key: "fecha_cambio", label: "Fecha del cambio", render: (h) => formatoFecha(h.fecha_cambio) },
        ]}
        filas={historial}
        vacio="Sin cambios de precio registrados."
      />
    </div>
  );
}
