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
  { key: "transacciones", label: "Transacciones" },
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

  const [tab, setTab] = useState("lecturas");
  const [lecturas, setLecturas] = useState([]);
  const [ventasGranel, setVentasGranel] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [transacciones, setTransacciones] = useState([]);

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
    async (turnoId, { signal } = {}) => {
      if (!turnoId) {
        setLecturas([]);
        setVentasGranel([]);
        setVentas([]);
        setTransacciones([]);
        return;
      }
      const [l, vg, v, t] = await Promise.all([
        api.listarLecturas(token, turnoId, { signal }),
        api.listarVentasGranel(token, turnoId, { signal }),
        api.listarVentas(token, turnoId, { signal }),
        api.listarTransacciones(token, turnoId, { signal }),
      ]);
      setLecturas(l);
      setVentasGranel(vg);
      setVentas(v);
      setTransacciones(t);
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
    api.listarMangueras(token, { signal }).then(setMangueras).catch(() => setMangueras([]));
    api.listarProductosGranel(token, { signal }).then(setProductosGranel).catch(() => setProductosGranel([]));
    api.listarProductosUnidad(token, undefined, { signal }).then(setProductos).catch(() => setProductos([]));
    api.listarClientes(token, { signal }).then(setClientes).catch(() => setClientes([]));

    return () => ctrl.abort();
  }, [token, cargarTurnos]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (turnoSeleccionado?.estado === "abierto") {
      cargarRegistrosDelTurno(turnoSeleccionado.id, { signal: ctrl.signal });
    } else {
      setLecturas([]);
      setVentasGranel([]);
      setVentas([]);
      setTransacciones([]);
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
      await cargarRegistrosDelTurno(turnoSeleccionado.id);
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
      await cargarRegistrosDelTurno(turnoSeleccionado.id);
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
      await cargarRegistrosDelTurno(turnoSeleccionado.id);
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
      await cargarRegistrosDelTurno(turnoSeleccionado.id);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  const turnoAbierto = turnoSeleccionado?.estado === "abierto";

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

            {tab === "transacciones" && (
              <>
                <FormularioTransaccion
                  clientes={clientes}
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
                    filas={transacciones}
                    vacio="Sin transacciones registradas en este turno."
                  />
                </div>
              </>
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
