import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";
import { formatCant } from "../../utils/format";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function Inventario() {
  const { token } = useAuth();

  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [formTransferencia, setFormTransferencia] = useState({ codigo: "", cantidad: "", origen: "", destino: "" });
  const [formAjuste, setFormAjuste] = useState({ codigo: "", cantidad: "", bodega_id: "", signo: 1 });
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    api.listarMovimientos(token, { signal }).then(setMovimientos).catch((err) => {
      if (err.name !== "AbortError") setError(err.detail);
    });
    api.listarProductosUnidad(token, undefined, { signal }).then(setProductos).catch(() => {});
    api.bodegas
      .listar(token, { signal })
      .then((b) => {
        setBodegas(b);
        const b0 = b.find((x) => x.isla === 0);
        if (b0) setFormAjuste((f) => (f.bodega_id ? f : { ...f, bodega_id: b0.id }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [token]);

  async function manejarTransferir(evento) {
    evento.preventDefault();
    setError(null);
    try {
      await api.transferirInventario(token, {
        codigo: formTransferencia.codigo,
        cantidad: Number(formTransferencia.cantidad),
        bodega_origen_id: Number(formTransferencia.origen),
        bodega_destino_id: Number(formTransferencia.destino),
      });
      setFormTransferencia({ codigo: "", cantidad: "", origen: "", destino: "" });
      const actualizados = await api.listarMovimientos(token);
      setMovimientos(actualizados);
    } catch (err) {
      setError(err.detail);
    }
  }

  async function manejarAjustar(evento) {
    evento.preventDefault();
    setError(null);
    try {
      await api.ajustarInventario(token, {
        codigo: formAjuste.codigo,
        cantidad: Number(formAjuste.cantidad),
        bodega_id: Number(formAjuste.bodega_id),
        signo: Number(formAjuste.signo),
      });
      setFormAjuste((f) => ({ ...f, codigo: "", cantidad: "" }));
      const actualizados = await api.listarMovimientos(token);
      setMovimientos(actualizados);
    } catch (err) {
      setError(err.detail);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Transferencia entre bodegas</h3>
        </div>
        <form onSubmit={manejarTransferir}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="transf_codigo">Producto</label>
              <select
                id="transf_codigo"
                value={formTransferencia.codigo}
                onChange={(e) => setFormTransferencia({ ...formTransferencia, codigo: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {productos.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="transf_cantidad">Cantidad</label>
              <input
                id="transf_cantidad"
                type="number"
                min="1"
                value={formTransferencia.cantidad}
                onChange={(e) => setFormTransferencia({ ...formTransferencia, cantidad: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="transf_origen">Bodega origen</label>
              <select
                id="transf_origen"
                value={formTransferencia.origen}
                onChange={(e) => setFormTransferencia({ ...formTransferencia, origen: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="transf_destino">Bodega destino</label>
              <select
                id="transf_destino"
                value={formTransferencia.destino}
                onChange={(e) => setFormTransferencia({ ...formTransferencia, destino: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--full">
              <button type="submit" className="btn btn--primary">
                Transferir
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Ajuste de inventario (entrada/salida)</h3>
        </div>
        <form onSubmit={manejarAjustar}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="aj_codigo">Producto</label>
              <select
                id="aj_codigo"
                value={formAjuste.codigo}
                onChange={(e) => setFormAjuste({ ...formAjuste, codigo: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {productos.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj_cantidad">Cantidad</label>
              <input
                id="aj_cantidad"
                type="number"
                min="1"
                value={formAjuste.cantidad}
                onChange={(e) => setFormAjuste({ ...formAjuste, cantidad: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="aj_signo">Operación</label>
              <select
                id="aj_signo"
                value={formAjuste.signo}
                onChange={(e) => setFormAjuste({ ...formAjuste, signo: Number(e.target.value) })}
              >
                <option value={1}>Entrada (+) — incrementar</option>
                <option value={-1}>Salida (−) — decrementar</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj_bodega">Bodega</label>
              <select
                id="aj_bodega"
                value={formAjuste.bodega_id}
                onChange={(e) => setFormAjuste({ ...formAjuste, bodega_id: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
              <small style={{ color: "var(--text-muted)" }}>Por defecto la Bodega Isla 0.</small>
            </div>
            <div className="field field--full">
              <button type="submit" className="btn btn--primary">
                Aplicar ajuste
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Historial de movimientos</h3>
        </div>
        <RegistrosTabla
          columnas={[
            { key: "codigo", label: "Producto", render: (m) => m.producto_nombre || m.codigo },
            { key: "cantidad", label: "Cantidad", render: (m) => formatCant(m.cantidad) },
            {
              key: "tipo",
              label: "Tipo",
              render: (m) => (m.tipo === "ajuste" ? "Ajuste" : "Transferencia"),
            },
            { key: "origen", label: "Origen", render: (m) => m.origen || "—" },
            { key: "destino", label: "Destino", render: (m) => m.destino || "—" },
            { key: "tiempo", label: "Fecha", render: (m) => formatoFecha(m.tiempo) },
          ]}
          filas={movimientos}
          vacio="Sin movimientos registrados."
        />
      </div>
    </div>
  );
}