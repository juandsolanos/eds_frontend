import { useState, useEffect, useRef } from "react";
import RegistrosTabla from "./RegistrosTabla";
import { formatMoney, formatVol, formatCant } from "../utils/format";

export default function ResumenTurno({
  abierto,
  turno,
  lecturas,
  ventas,
  ventasGranel,
  transacciones,
  tiposTransaccion,
  clientes,
  productos,
  productosGranel,
  modoCierre = false,
  cargando = false,
  onConfirmarCierre,
  onCerrar,
}) {
  const cancelarRef = useRef(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (abierto) setTexto("");
  }, [abierto]);

  useEffect(() => {
    if (abierto && cancelarRef.current) {
      cancelarRef.current.focus();
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function manejarTecla(e) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const tipoMap = new Map((tiposTransaccion || []).map((t) => [t.id, t]));
  const clienteMap = new Map((clientes || []).map((c) => [c.id, c]));
  const productoMap = new Map((productos || []).map((p) => [p.codigo, p]));
  const productoGranelMap = new Map((productosGranel || []).map((p) => [p.codigo, p]));

  const lecturasList = lecturas || [];
  const ventasUnidad = ventas || [];
  const ventasGranelList = ventasGranel || [];
  const transaccionesList = transacciones || [];

  const ventasCombinadas = [
    ...ventasGranelList.map((v) => ({
      ...v,
      id: `g-${v.id}`,
      _granel: true,
      _nombre: productoGranelMap.get(v.codigo)?.nombre || v.codigo,
      _cantidad: v.cantidad,
    })),
    ...ventasUnidad.map((v) => ({
      ...v,
      id: `u-${v.id}`,
      _granel: false,
      _nombre: productoMap.get(v.codigo)?.nombre || v.codigo,
      _cantidad: v.cantidad,
    })),
  ].sort((a, b) => new Date(b.tiempo) - new Date(a.tiempo));

  const transaccionesConResumen = transaccionesList.map((tf) => {
    const tipo = tipoMap.get(tf.tipo);
    const signo = tipo?.signo ?? 1;
    return { ...tf, _tipoNombre: tipo?.nombre || tf.tipo, _signo: signo };
  });

  const totalGalonesLecturas = lecturasList.reduce((acc, l) => acc + (l.lectura_final - l.lectura_inicial), 0);
  const totalValorLecturas = lecturasList.reduce((acc, l) => acc + (l.valor_total || 0), 0);
  const totalVentas = ventasCombinadas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
  const totalIngresosTransacciones = transaccionesConResumen
    .filter((t) => t._signo > 0)
    .reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalEgresosTransacciones = transaccionesConResumen
    .filter((t) => t._signo < 0)
    .reduce((acc, t) => acc + (t.valor || 0), 0);
  const balanceTransacciones = totalIngresosTransacciones - totalEgresosTransacciones;
  const balanceFinal = totalValorLecturas + totalVentas + balanceTransacciones;

  const columnasLecturas = [
    { key: "manguera_id", label: "Manguera" },
    {
      key: "galones",
      label: "Galones",
      render: (f) => formatVol(f.lectura_final - f.lectura_inicial),
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
  ];

  const columnasVentas = [
    { key: "producto", label: "Producto", render: (f) => f._nombre },
    { key: "tipo", label: "Tipo", render: (f) => (f._granel ? "Combustible" : "Complementario") },
    { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f._cantidad) },
    {
      key: "isla",
      label: "Isla",
      render: (f) => (Number(f.isla) === Number(turno?.isla) ? `Isla ${f.isla}` : `Isla ${f.isla} (otra)`),
    },
    { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
  ];

  const columnasTransacciones = [
    { key: "tipo", label: "Tipo", render: (f) => f._tipoNombre },
    {
      key: "cliente",
      label: "Cliente",
      render: (f) => (f.cliente_id && clienteMap.get(f.cliente_id)?.nombre) || "—",
    },
    {
      key: "valor",
      label: "Valor",
      mono: true,
      render: (f) => formatMoney(f._signo < 0 ? -(f.valor || 0) : f.valor || 0),
    },
  ];

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal--form modal--resumen" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">Resumen del turno {turno?.id}</h3>
          <button ref={cancelarRef} className="modal__close" onClick={onCerrar} disabled={cargando} type="button">
            &times;
          </button>
        </div>

        <div className="resumen-meta">
          <span>
            Isla <strong>{turno?.isla}</strong>
          </span>
          {turno?.responsable && <span>Responsable: {turno.responsable}</span>}
          <span className="mono">{turno?.estado}</span>
        </div>

        <section className="resumen-seccion">
          <h4 className="resumen-seccion__titulo">Lecturas de manguera</h4>
          <RegistrosTabla columnas={columnasLecturas} filas={lecturasList} vacio="Sin lecturas registradas." />
          {lecturasList.length > 0 && (
            <div className="resumen-total linea">
              <span>Total lecturas</span>
              <span>
                {formatVol(totalGalonesLecturas)} gal &middot; {formatMoney(totalValorLecturas)}
              </span>
            </div>
          )}
        </section>

        <section className="resumen-seccion">
          <h4 className="resumen-seccion__titulo">Ventas</h4>
          <RegistrosTabla columnas={columnasVentas} filas={ventasCombinadas} vacio="Sin ventas registradas." />
          {ventasCombinadas.length > 0 && (
            <div className="resumen-total linea">
              <span>Total ventas</span>
              <span>{formatMoney(totalVentas)}</span>
            </div>
          )}
        </section>

        <section className="resumen-seccion">
          <h4 className="resumen-seccion__titulo">Transacciones</h4>
          <RegistrosTabla
            columnas={columnasTransacciones}
            filas={transaccionesConResumen}
            vacio="Sin transacciones registradas."
          />
        </section>

        <div className="resumen-totales">
          <div className="resumen-total">
            <span>Total lecturas</span>
            <span>{formatMoney(totalValorLecturas)}</span>
          </div>
          <div className="resumen-total">
            <span>Total ventas</span>
            <span>{formatMoney(totalVentas)}</span>
          </div>
          <div className="resumen-total">
            <span>Transacciones ingreso</span>
            <span>{formatMoney(totalIngresosTransacciones)}</span>
          </div>
          <div className="resumen-total">
            <span>Transacciones egreso</span>
            <span>{formatMoney(-totalEgresosTransacciones)}</span>
          </div>
          <div className="resumen-total resumen-total--balance">
            <span>Balance del turno</span>
            <span>{formatMoney(balanceFinal)}</span>
          </div>
        </div>

        <div className="modal__acciones">
          {modoCierre && (
            <div className="resumen-cierre">
              <div className="field">
                <label htmlFor="resumen-observaciones">Observaciones del cierre (opcional)</label>
                <textarea
                  id="resumen-observaciones"
                  rows={2}
                  placeholder="Opcional..."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={cargando}
                />
              </div>
              <div className="modal__acciones">
                <button className="btn btn--ghost" onClick={onCerrar} disabled={cargando}>
                  Cancelar
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => onConfirmarCierre(texto)}
                  disabled={cargando}
                >
                  {cargando ? "Cerrando..." : "Confirmar cierre"}
                </button>
              </div>
            </div>
          )}
          {!modoCierre && (
            <button className="btn btn--ghost" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}