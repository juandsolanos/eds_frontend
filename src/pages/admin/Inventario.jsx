import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import RegistrosTabla from "../../components/RegistrosTabla";
import Select from "../../components/Select";
import { formatCant } from "../../utils/format";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function nombreIsla(isla) {
  return isla === 0 ? "Bodega Isla 0" : `Isla ${isla}`;
}

export default function Inventario() {
  const { token } = useAuth();

  const [bodegas, setBodegas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [islaSel, setIslaSel] = useState("");
  const [cargandoTabla, setCargandoTabla] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const [modal, setModal] = useState(null); // { tipo: "mover" | "ajuste", fila }
  const [moverCantidad, setMoverCantidad] = useState("");
  const [moverIsla, setMoverIsla] = useState("");
  const [moverBodega, setMoverBodega] = useState("");
  const [ajustarCantidad, setAjustarCantidad] = useState("");
  const [ajustarSigno, setAjustarSigno] = useState(1);

  const islas = useMemo(
    () =>
      [...new Set(bodegas.map((b) => b.isla).filter((i) => i !== null && i !== undefined))].sort(
        (a, b) => a - b
      ),
    [bodegas]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    api.listarMovimientos(token, { signal }).then(setMovimientos).catch((err) => {
      if (err.name !== "AbortError") setError(err.detail);
    });
    api.bodegas
      .listar(token, { signal })
      .then(setBodegas)
      .catch(() => {});
    return () => ctrl.abort();
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    setCargandoTabla(true);
    api
      .listarInventarioDetallado(token, islaSel || null, { signal: ctrl.signal })
      .then(setFilas)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.detail);
      })
      .finally(() => setCargandoTabla(false));
    return () => ctrl.abort();
  }, [token, islaSel]);

  async function recargar() {
    const [mov, fil] = await Promise.all([
      api.listarMovimientos(token),
      api.listarInventarioDetallado(token, islaSel || null),
    ]);
    setMovimientos(mov);
    setFilas(fil);
  }

  function cerrarModal() {
    setModal(null);
    setMoverCantidad("");
    setMoverIsla("");
    setMoverBodega("");
    setAjustarCantidad("");
    setAjustarSigno(1);
  }

  function abrirMover(fila) {
    setModal({ tipo: "mover", fila });
    setMoverCantidad("1");
    setMoverIsla("");
    setMoverBodega("");
  }

  function abrirAjuste(fila) {
    setModal({ tipo: "ajuste", fila });
    setAjustarCantidad("");
    setAjustarSigno(1);
  }

  async function confirmarMover(e) {
    e.preventDefault();
    setError(null);
    setExito(null);
    try {
      const bodegaDestino = bodegasDestino.length === 1 ? bodegasDestino[0].id : Number(moverBodega);
      await api.transferirInventario(token, {
        codigo: modal.fila.codigo,
        cantidad: Number(moverCantidad),
        bodega_origen_id: modal.fila.bodega_id,
        bodega_destino_id: bodegaDestino,
      });
      setExito("Producto movido correctamente.");
      cerrarModal();
      await recargar();
    } catch (err) {
      setError(err.detail);
    }
  }

  async function confirmarAjuste(e) {
    e.preventDefault();
    setError(null);
    setExito(null);
    try {
      await api.ajustarInventario(token, {
        codigo: modal.fila.codigo,
        cantidad: Number(ajustarCantidad),
        bodega_id: modal.fila.bodega_id,
        signo: Number(ajustarSigno),
      });
      setExito("Inventario ajustado.");
      cerrarModal();
      await recargar();
    } catch (err) {
      setError(err.detail);
    }
  }

  async function manejarCerrarDia() {
    if (!window.confirm("¿Congelar el inventario actual de todas las bodegas como cierre de hoy?")) {
      return;
    }
    setError(null);
    setExito(null);
    try {
      const r = await api.cerrarDiaInventario(token);
      setExito(`Cierre de día registrado (${r.registros} registros).`);
      await recargar();
    } catch (err) {
      setError(err.detail);
    }
  }

  const fuentesMovimiento = islas.filter((i) => {
    const fila = modal?.fila;
    if (!fila || islaSel === "") return i !== null && i !== undefined;
    const bodegaOrigen = bodegas.find((b) => b.id === fila.bodega_id);
    return bodegaOrigen ? i !== bodegaOrigen.isla : true;
  });
  const bodegasDestino = (moverIsla !== "" ? bodegas.filter((b) => b.isla === Number(moverIsla)) : []).sort(
    (a, b) => a.id - b.id
  );

  const vistaGeneral = islaSel === "";

  const columnas = vistaGeneral
    ? [
        { key: "producto", label: "Producto", render: (f) => f.producto_nombre || f.codigo },
        { key: "bodega_nombre", label: "Bodega", render: () => "Todas" },
        {
          key: "cantidad_dia_anterior",
          label: "Cant. día anterior",
          render: (f) => formatCant(f.cantidad_dia_anterior),
        },
        { key: "cantidad_ventas", label: "Cant. ventas", render: (f) => formatCant(f.cantidad_ventas) },
        { key: "cantidad_actual", label: "Cantidad actual", render: (f) => formatCant(f.cantidad) },
        {
          key: "_acciones",
          label: "",
          render: (f) => renderAcciones(f, true),
        },
      ]
    : [
        { key: "bodega_nombre", label: "Bodega" },
        { key: "producto", label: "Producto", render: (f) => f.producto_nombre || f.codigo },
        {
          key: "cantidad_dia_anterior",
          label: "Cant. día anterior",
          render: (f) => formatCant(f.cantidad_dia_anterior),
        },
        { key: "cantidad_ventas", label: "Cant. ventas", render: (f) => formatCant(f.cantidad_ventas) },
        { key: "cantidad_actual", label: "Cantidad actual", render: (f) => formatCant(f.cantidad) },
        {
          key: "_acciones",
          label: "",
          render: (f) => renderAcciones(f, false),
        },
      ];

  function renderAcciones(fila, deshabilitado) {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          className="btn"
          disabled={deshabilitado}
          onClick={() => abrirMover(fila)}
          title={deshabilitado ? "Selecciona una isla para mover productos." : "Mover a otra isla"}
        >
          Mover
        </button>
        <button
          className="btn"
          disabled={deshabilitado}
          onClick={() => abrirAjuste(fila)}
          title={deshabilitado ? "Selecciona una isla para ajustar." : "Ajustar entrada/salida"}
        >
          Ajustar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
      {error && <div className="alert alert--error">{error}</div>}
      {exito && <div className="alert alert--success">{exito}</div>}

      <div className="card">
        <div className="card__header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--spacing-3)" }}>
          <h3 className="card__title">Inventario</h3>
          <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
              <label htmlFor="isla_filtro" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Ver
              </label>
              <Select
                id="isla_filtro"
                value={islaSel}
                onChange={setIslaSel}
                placeholder="Todas las bodegas"
                options={islas.map((i) => ({ value: i, label: nombreIsla(i) }))}
                style={{ minWidth: 180 }}
              />
            </div>
            <button className="btn" onClick={manejarCerrarDia} title="Congela el inventario actual como cierre de hoy">
              Cerrar día
            </button>
          </div>
        </div>

        {cargandoTabla && filas.length === 0 ? (
          <div className="empty-state">Cargando inventario...</div>
        ) : filas.length === 0 ? (
          <div className="empty-state">No hay inventario registrado.</div>
        ) : (
          <RegistrosTabla columnas={columnas} filas={filas} vacio="Sin inventario." />
        )}

        {islaSel !== "" && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "var(--spacing-3)" }}>
            Usa <strong>Mover</strong> para transferir el producto a otra isla y <strong>Ajustar</strong> para
            corregir su existencia (entrada/salida) en esta bodega. La vista general muestra el total de todas
            las bodegas y no permite movimientos.
          </p>
        )}
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

      {modal && (
        <Modal onClose={cerrarModal}>
          {modal.tipo === "mover" ? (
            <form onSubmit={confirmarMover}>
              <h3 style={{ marginBottom: "var(--spacing-4)" }}>Mover producto a otra isla</h3>
              <div className="field">
                <label>Producto</label>
                <input value={modal.fila.producto_nombre || modal.fila.codigo} readOnly />
              </div>
              <div className="field">
                <label>Bodega origen</label>
                <input value={modal.fila.bodega_nombre} readOnly />
              </div>
              <div className="field">
                <label htmlFor="mov_cantidad">Cantidad</label>
                <input
                  id="mov_cantidad"
                  type="number"
                  min="1"
                  value={moverCantidad}
                  onChange={(e) => setMoverCantidad(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="mov_isla">Isla destino</label>
                <Select
                  id="mov_isla"
                  value={moverIsla}
                  onChange={(v) => {
                    setMoverIsla(v);
                    setMoverBodega("");
                  }}
                  placeholder="Selecciona..."
                  options={fuentesMovimiento.map((i) => ({ value: i, label: nombreIsla(i) }))}
                  required
                />
              </div>
              {bodegasDestino.length > 1 && (
                <div className="field">
                  <label htmlFor="mov_bodega">Bodega destino</label>
                  <Select
                    id="mov_bodega"
                    value={moverBodega}
                    onChange={setMoverBodega}
                    options={bodegasDestino.map((b) => ({ value: b.id, label: b.nombre }))}
                    required
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={bodegasDestino.length === 0 || (bodegasDestino.length > 1 && !moverBodega)}
                >
                  Mover
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={confirmarAjuste}>
              <h3 style={{ marginBottom: "var(--spacing-4)" }}>Ajustar inventario</h3>
              <div className="field">
                <label>Producto</label>
                <input value={modal.fila.producto_nombre || modal.fila.codigo} readOnly />
              </div>
              <div className="field">
                <label>Bodega</label>
                <input value={modal.fila.bodega_nombre} readOnly />
              </div>
              <div className="field">
                <label htmlFor="aj_signo">Operación</label>
                <Select
                  id="aj_signo"
                  value={ajustarSigno}
                  onChange={(v) => setAjustarSigno(Number(v))}
                  options={[
                    { value: 1, label: "Entrada (+) — incrementar" },
                    { value: -1, label: "Salida (−) — decrementar" },
                  ]}
                />
              </div>
              <div className="field">
                <label htmlFor="aj_cantidad">Cantidad</label>
                <input
                  id="aj_cantidad"
                  type="number"
                  min="1"
                  value={ajustarCantidad}
                  onChange={(e) => setAjustarCantidad(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary">
                  Aplicar
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "var(--spacing-5)",
          width: "min(480px, 92vw)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}