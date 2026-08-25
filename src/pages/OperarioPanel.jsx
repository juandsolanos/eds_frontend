import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

import TurnoStatus from "../components/TurnoStatus";
import FormularioLectura from "../components/FormularioLectura";
import FormularioVenta from "../components/FormularioVenta";
import FormularioVentaGranel from "../components/FormularioVentaGranel";
import FormularioTransaccion from "../components/FormularioTransaccion";
import RegistrosTabla from "../components/RegistrosTabla";
import ConfirmModal from "../components/ConfirmModal";
import { formatMoney, formatVol, formatCant } from "../utils/format";

const TABS = [
  { key: "lecturas", label: "Lecturas de manguera" },
  { key: "combustible", label: "Ventas de combustible" },
  { key: "ventas", label: "Ventas de complementarios" },
  { key: "pagos", label: "Pagos" },
  { key: "transacciones", label: "Transacciones" },
  { key: "inventario", label: "Inventario" },
];

const ESTADOS_PERMITIDOS = ["creado", "en_espera", "abierto"];

export default function OperarioPanel() {
  const { token, usuario, logout } = useAuth();

  const [turnos, setTurnos] = useState([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [mangueras, setMangueras] = useState([]);
  const [productosGranel, setProductosGranel] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tiposTransaccion, setTiposTransaccion] = useState([]);

  const [tab, setTab] = useState("lecturas");
  const [lecturas, setLecturas] = useState([]);
  const [ventasGranel, setVentasGranel] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [lecturasCierre, setLecturasCierre] = useState([]);
  const [inventario, setInventario] = useState([]);

  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [confirmarCerrarTurno, setConfirmarCerrarTurno] = useState(false);

  const cargarTurnos = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.listarTurnos(token, undefined, { signal });
      const disponibles = data.filter((t) => ESTADOS_PERMITIDOS.includes(t.estado));
      setTurnos(disponibles);
      return disponibles;
    } catch {
      setTurnos([]);
      return [];
    }
  }, [token]);

  const cargarRegistrosDelTurno = useCallback(
    async (turno, { signal } = {}) => {
      if (!turno) {
        setLecturas([]);
        setVentasGranel([]);
        setVentas([]);
        setTransacciones([]);
        setLecturasCierre([]);
        setInventario([]);
        return;
      }
      const [l, vg, v, t] = await Promise.all([
        api.listarLecturas(token, turno.id, { signal }),
        api.listarVentasGranel(token, turno.id, { signal }),
        api.listarVentas(token, turno.id, { signal }),
        api.listarTransacciones(token, turno.id, { signal }),
      ]);
      setLecturas(l);
      setVentasGranel(vg);
      setVentas(v);
      setTransacciones(t);

      // Cargar lecturas de cierre del turno anterior para prefill
      try {
        const anterior = await api.turnoAnterior(token, turno.id, { signal });
        const cierre = await api.lecturasCierre(token, anterior.id, { signal });
        setLecturasCierre(cierre);
      } catch {
        setLecturasCierre([]);
      }

      // Cargar inventario de la isla del turno
      try {
        const inv = await api.listarInventarioPorIsla(token, turno.isla, { signal });
        setInventario(inv);
      } catch {
        setInventario([]);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;

    cargarTurnos({ signal }).then((disponibles) => {
      if (disponibles.length > 0) {
        setTurnoSeleccionado((prev) => {
          if (prev && disponibles.some((t) => t.id === prev.id)) return prev;
          const abierto = disponibles.find((t) => t.estado === "abierto");
          return abierto || disponibles[0];
        });
      } else {
        setTurnoSeleccionado(null);
      }
    });
    api.listarProductosGranel(token, { signal }).then(setProductosGranel).catch(() => setProductosGranel([]));
    api.listarProductosUnidad(token, undefined, { signal }).then(setProductos).catch(() => setProductos([]));
    api.listarClientes(token, { signal }).then(setClientes).catch(() => setClientes([]));
    api.tiposTransaccion.listar(token, { signal }).then(setTiposTransaccion).catch(() => setTiposTransaccion([]));

    return () => ctrl.abort();
  }, [token, cargarTurnos]);

  // Cargar mangueras filtradas por isla del turno seleccionado
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    if (turnoSeleccionado) {
      api.listarManguerasPorIsla(token, turnoSeleccionado.isla, { signal })
        .then(setMangueras)
        .catch(() => setMangueras([]));
    } else {
      setMangueras([]);
    }
    return () => ctrl.abort();
  }, [token, turnoSeleccionado]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (turnoSeleccionado?.estado === "abierto") {
      cargarRegistrosDelTurno(turnoSeleccionado, { signal: ctrl.signal });
    } else {
      setLecturas([]);
      setVentasGranel([]);
      setVentas([]);
      setTransacciones([]);
      setLecturasCierre([]);
      setInventario([]);
    }
    return () => ctrl.abort();
  }, [turnoSeleccionado, cargarRegistrosDelTurno]);

  function mostrarError(err) {
    setMensaje({ tipo: "error", texto: err.detail || "Ocurrió un error inesperado." });
  }

  function mostrarExito(texto) {
    setMensaje({ tipo: "success", texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  async function manejarSolicitarAbrir() {
    setCargandoAccion(true);
    try {
      const turnoAbierto = await api.solicitarAbrirTurno(token, turnoSeleccionado.id);
      setTurnoSeleccionado(turnoAbierto);
      setTurnos((prev) => prev.map((t) => (t.id === turnoAbierto.id ? turnoAbierto : t)));
      mostrarExito(`Turno ${turnoAbierto.id} abierto.`);
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarCerrarTurno() {
    setConfirmarCerrarTurno(false);
    setCargandoAccion(true);
    try {
      await api.cerrarTurno(token, turnoSeleccionado.id);
      mostrarExito("Turno cerrado.");
      setTurnoSeleccionado(null);
      const disponibles = await cargarTurnos();
      if (disponibles.length > 0) {
        const abierto = disponibles.find((t) => t.estado === "abierto");
        setTurnoSeleccionado(abierto || disponibles[0]);
      }
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarRegistrarLectura(datos) {
    setCargandoAccion(true);
    try {
      await api.crearLectura(token, datos);
      mostrarExito("Lectura registrada.");
      await cargarRegistrosDelTurno(turnoSeleccionado);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarRegistrarVentaGranel(datos) {
    setCargandoAccion(true);
    try {
      await api.crearVentaGranel(token, datos);
      mostrarExito("Venta de combustible registrada.");
      await cargarRegistrosDelTurno(turnoSeleccionado);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarRegistrarVenta(datos) {
    setCargandoAccion(true);
    try {
      await api.crearVenta(token, datos);
      mostrarExito("Venta registrada.");
      await cargarRegistrosDelTurno(turnoSeleccionado);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarRegistrarTransaccion(datos) {
    setCargandoAccion(true);
    try {
      await api.crearTransaccion(token, datos);
      mostrarExito("Transacción registrada.");
      await cargarRegistrosDelTurno(turnoSeleccionado);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  const turnoAbierto = turnoSeleccionado?.estado === "abierto";

  // Separar transacciones por signo: pagos (signo=1) y gastos (signo=-1)
  const tiposPago = tiposTransaccion.filter((t) => t.signo === 1);
  const tiposGasto = tiposTransaccion.filter((t) => t.signo === -1);

  const transaccionesPago = transacciones.filter((t) =>
    tiposPago.some((tp) => tp.id === t.tipo)
  );
  const transaccionesGasto = transacciones.filter((t) =>
    tiposGasto.some((tg) => tg.id === t.tipo)
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__brand-mark mono">EDS</span>
          <span style={{ color: "var(--text-muted)" }}>Panel de operación</span>
        </div>
        <div className="topbar__user">
          <span>
            {usuario.username} · {usuario.rol}
          </span>
          {["administrador", "superadministrador"].includes(usuario.rol) && (
            <Link to="/admin" className="topbar__logout">
              Ir al panel admin
            </Link>
          )}
          <button className="topbar__logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="main">
        {mensaje && (
          <div className={`alert alert--${mensaje.tipo === "error" ? "error" : "success"}`}>
            {mensaje.texto}
          </div>
        )}

        {turnos.length > 0 && (
          <div className="card" style={{ marginBottom: "var(--spacing-4)" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "var(--spacing-2)" }}>
              Seleccionar turno
            </label>
            <select
              value={turnoSeleccionado?.id || ""}
              onChange={(e) => {
                const t = turnos.find((t) => t.id === e.target.value);
                setTurnoSeleccionado(t || null);
              }}
              style={{ minWidth: 250 }}
            >
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} — Isla {t.isla} ({t.estado})
                </option>
              ))}
            </select>
          </div>
        )}

        <TurnoStatus
          turno={turnoSeleccionado}
          turnosDisponibles={turnos}
          onCerrar={() => setConfirmarCerrarTurno(true)}
          onSolicitarAbrir={manejarSolicitarAbrir}
          cargando={cargandoAccion}
        />

        {turnoAbierto && (
          <div className="card">
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? "tab--activo" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "lecturas" && (
              <>
                <FormularioLectura
                  mangueras={mangueras}
                  lecturasCierre={lecturasCierre}
                  onRegistrar={manejarRegistrarLectura}
                  cargando={cargandoAccion}
                />
                <div style={{ marginTop: "var(--spacing-6)" }}>
                  <RegistrosTabla
                    columnas={[
                      { key: "manguera_id", label: "Manguera" },
                      {
                        key: "cantidad",
                        label: "Galones",
                        render: (f) => formatVol(f.lectura_final - f.lectura_inicial),
                      },
                      { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
                      { key: "texto", label: "Notas" },
                    ]}
                    filas={lecturas}
                    vacio="Sin lecturas registradas en este turno."
                  />
                </div>
              </>
            )}

            {tab === "combustible" && (
              <>
                <FormularioVentaGranel
                  productos={productosGranel}
                  onRegistrar={manejarRegistrarVentaGranel}
                  cargando={cargandoAccion}
                />
                <div style={{ marginTop: "var(--spacing-6)" }}>
                  <RegistrosTabla
                    columnas={[
                      { key: "codigo", label: "Combustible" },
                      { key: "cantidad", label: "Galones", render: (f) => formatVol(f.cantidad) },
                      { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
                    ]}
                    filas={ventasGranel}
                    vacio="Sin ventas de combustible registradas en este turno."
                  />
                </div>
              </>
            )}

            {tab === "ventas" && (
              <>
                <FormularioVenta
                  productos={productos}
                  onRegistrar={manejarRegistrarVenta}
                  cargando={cargandoAccion}
                />
                <div style={{ marginTop: "var(--spacing-6)" }}>
                  <RegistrosTabla
                    columnas={[
                      { key: "codigo", label: "Producto" },
                      { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f.cantidad) },
                      { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
                    ]}
                    filas={ventas}
                    vacio="Sin ventas registradas en este turno."
                  />
                </div>
              </>
            )}

            {tab === "pagos" && (
              <>
                <FormularioTransaccion
                  tipos={tiposPago}
                  clientes={clientes}
                  mostrarCliente={true}
                  onRegistrar={manejarRegistrarTransaccion}
                  cargando={cargandoAccion}
                />
                <div style={{ marginTop: "var(--spacing-6)" }}>
                  <RegistrosTabla
                    columnas={[
                      { key: "id", label: "ID", mono: true },
                      { key: "tipo", label: "Tipo" },
                      { key: "valor", label: "Valor", mono: true, render: (f) => formatMoney(f.valor) },
                    ]}
                    filas={transaccionesPago}
                    vacio="Sin pagos registrados en este turno."
                  />
                </div>
              </>
            )}

            {tab === "transacciones" && (
              <>
                <FormularioTransaccion
                  tipos={tiposGasto}
                  clientes={clientes}
                  mostrarCliente={false}
                  onRegistrar={manejarRegistrarTransaccion}
                  cargando={cargandoAccion}
                />
                <div style={{ marginTop: "var(--spacing-6)" }}>
                  <RegistrosTabla
                    columnas={[
                      { key: "id", label: "ID", mono: true },
                      { key: "tipo", label: "Tipo" },
                      { key: "valor", label: "Valor", mono: true, render: (f) => formatMoney(f.valor) },
                    ]}
                    filas={transaccionesGasto}
                    vacio="Sin transacciones registradas en este turno."
                  />
                </div>
              </>
            )}

            {tab === "inventario" && (
              <div>
                <h3 style={{ marginBottom: "var(--spacing-4)" }}>
                  Inventario — Isla {turnoSeleccionado?.isla}
                </h3>
                {inventario.length === 0 ? (
                  <div className="empty-state">No hay inventario registrado para esta isla.</div>
                ) : (
                  <RegistrosTabla
                    columnas={[
                      { key: "bodega_nombre", label: "Bodega" },
                      { key: "codigo", label: "Producto" },
                      { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f.cantidad) },
                    ]}
                    filas={inventario}
                    vacio="Sin inventario."
                  />
                )}
              </div>
            )}
          </div>
        )}

        {!turnoAbierto && turnoSeleccionado && turnoSeleccionado.estado !== "abierto" && (
          <div className="card" style={{ textAlign: "center", padding: "var(--spacing-8)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
              {turnoSeleccionado.estado === "en_espera"
                ? "Este turno está en espera. Solicita abrirlo para comenzar a operar."
                : "Este turno aún no está disponible. Espera a que llegue su hora de inicio."}
            </p>
          </div>
        )}
      </main>

      <ConfirmModal
        open={confirmarCerrarTurno}
        mensaje={`¿Cerrar el turno ${turnoSeleccionado?.id}? No podrás registrar más movimientos en él.`}
        onConfirmar={manejarCerrarTurno}
        onCancelar={() => setConfirmarCerrarTurno(false)}
      />
    </div>
  );
}
