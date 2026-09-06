import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";
import { formatMoney, formatVol, formatCant, unidadGranel } from "../../utils/format";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function Registros() {
  const { token } = useAuth();

  const [operarioFiltro, setOperarioFiltro] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState({ lecturas: [], ventas: [], transacciones: [] });

  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productosGranel, setProductosGranel] = useState([]);
  const [mangueras, setMangueras] = useState([]);
  const [formMovimiento, setFormMovimiento] = useState({ codigo: "", cantidad: "", origen: "", destino: "" });
  const [error, setError] = useState(null);

  const cargarTurnos = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.listarTurnos(token, operarioFiltro || undefined, { signal });
      setTurnos(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.detail);
    }
  }, [token, operarioFiltro]);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    cargarTurnos({ signal });
    api.listarMovimientos(token, { signal }).then(setMovimientos).catch((err) => {
      if (err.name !== "AbortError") setError(err.detail);
    });
    api.listarProductosUnidad(token, undefined, { signal }).then(setProductos).catch(() => {});
    api.listarProductosGranel(token, undefined, { signal }).then(setProductosGranel).catch(() => {});
    api.listarMangueras(token, undefined, { signal }).then(setMangueras).catch(() => {});
    return () => ctrl.abort();
  }, [token, cargarTurnos]);

  async function verDetalle(turno) {
    setTurnoSeleccionado(turno);
    try {
      const [lecturas, ventas, transacciones] = await Promise.all([
        api.listarLecturas(token, turno.id),
        api.listarVentas(token, turno.id),
        api.listarTransacciones(token, turno.id),
      ]);
      setDetalle({ lecturas, ventas, transacciones });
    } catch (err) {
      setError(err.detail);
    }
  }

  async function manejarCrearMovimiento(evento) {
    evento.preventDefault();
    setError(null);
    try {
      await api.crearMovimiento(token, {
        ...formMovimiento,
        cantidad: Number(formMovimiento.cantidad),
      });
      setFormMovimiento({ codigo: "", cantidad: "", origen: "", destino: "" });
      const actualizados = await api.listarMovimientos(token);
      setMovimientos(actualizados);
    } catch (err) {
      setError(err.detail);
    }
  }

  const granelUnidadPorCodigo = new Map((productosGranel || []).map((p) => [String(p.codigo), p.unidad]));
  function unidadCortoLectura(lectura) {
    const manguera = mangueras.find((m) => m.id === Number(lectura.manguera_id));
    const codigo = manguera ? String(manguera.codigo_combustible) : null;
    return codigo ? unidadGranel(granelUnidadPorCodigo.get(codigo)).corto : "gal";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Turnos</h3>
          <input
            placeholder="Filtrar por ID de operario..."
            value={operarioFiltro}
            onChange={(e) => setOperarioFiltro(e.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>

        <RegistrosTabla
          columnas={[
            { key: "id", label: "Turno", mono: true },
            { key: "isla", label: "Isla" },
            { key: "responsable", label: "Operario" },
            { key: "tiempo_inicio", label: "Inicio", render: (t) => formatoFecha(t.tiempo_inicio) },
            {
              key: "tiempo_final",
              label: "Estado",
              render: (t) => (t.tiempo_final ? formatoFecha(t.tiempo_final) : "Activo"),
            },
            {
              key: "_ver",
              label: "",
              render: (t) => (
                <button className="btn btn--ghost" onClick={() => verDetalle(t)}>
                  Ver detalle
                </button>
              ),
            },
          ]}
          filas={turnos}
          vacio="Sin turnos registrados."
        />
      </div>

      {turnoSeleccionado && (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title mono">Detalle de {turnoSeleccionado.id}</h3>
            <button className="btn btn--ghost" onClick={() => setTurnoSeleccionado(null)}>
              Cerrar
            </button>
          </div>

          <h4 style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "0.85rem" }}>
            LECTURAS DE MANGUERA
          </h4>
          <RegistrosTabla
            columnas={[
              { key: "manguera_id", label: "Manguera" },
              {
                key: "volumen",
                label: "Volumen",
                render: (f) =>
                  `${formatVol(f.lectura_final - f.lectura_inicial)} ${unidadCortoLectura(f)}`,
              },
              { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
              {
                key: "foto_url",
                label: "Evidencia",
                render: (f) =>
                  f.foto_url ? (
                    <a href={f.foto_url} target="_blank" rel="noreferrer">
                      <img src={f.foto_url} className="foto-thumb" alt="Evidencia" />
                    </a>
                  ) : (
                    "—"
                  ),
              },
            ]}
            filas={detalle.lecturas}
            vacio="Sin lecturas en este turno."
          />

          <h4 style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "0.85rem", marginTop: "var(--spacing-6)" }}>
            VENTAS
          </h4>
          <RegistrosTabla
            columnas={[
              { key: "codigo", label: "Producto" },
              { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f.cantidad) },
              { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
            ]}
            filas={detalle.ventas}
            vacio="Sin ventas en este turno."
          />

          <h4 style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "0.85rem", marginTop: "var(--spacing-6)" }}>
            TRANSACCIONES FINANCIERAS
          </h4>
          <RegistrosTabla
            columnas={[
              { key: "id", label: "ID", mono: true },
              { key: "tipo", label: "Tipo" },
              { key: "valor", label: "Valor", mono: true, render: (f) => formatMoney(f.valor) },
            ]}
            filas={detalle.transacciones}
            vacio="Sin transacciones en este turno."
          />
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Movimientos de inventario</h3>
        </div>

        <form onSubmit={manejarCrearMovimiento} style={{ marginBottom: "var(--spacing-6)" }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="mov_codigo">Producto</label>
              <select
                id="mov_codigo"
                value={formMovimiento.codigo}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, codigo: e.target.value })}
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
              <label htmlFor="mov_cantidad">Cantidad</label>
              <input
                id="mov_cantidad"
                type="number"
                value={formMovimiento.cantidad}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, cantidad: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="mov_origen">Origen</label>
              <input
                id="mov_origen"
                type="text"
                value={formMovimiento.origen}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, origen: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="mov_destino">Destino</label>
              <input
                id="mov_destino"
                type="text"
                value={formMovimiento.destino}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, destino: e.target.value })}
                required
              />
            </div>
            <div className="field field--full">
              <button type="submit" className="btn btn--primary">
                Registrar movimiento
              </button>
            </div>
          </div>
        </form>

        <RegistrosTabla
          columnas={[
            { key: "codigo", label: "Producto" },
            { key: "cantidad", label: "Cantidad", render: (m) => formatCant(m.cantidad) },
            { key: "origen", label: "Origen" },
            { key: "destino", label: "Destino" },
            { key: "tiempo", label: "Fecha", render: (m) => formatoFecha(m.tiempo) },
          ]}
          filas={movimientos}
          vacio="Sin movimientos registrados."
        />
      </div>
    </div>
  );
}
