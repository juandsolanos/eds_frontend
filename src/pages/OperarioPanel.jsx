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

const TABS = [
  { key: "lecturas", label: "Lecturas de manguera" },
  { key: "combustible", label: "Ventas de combustible" },
  { key: "ventas", label: "Ventas por unidad" },
  { key: "transacciones", label: "Transacciones" },
];

export default function OperarioPanel() {
  const { token, usuario, logout } = useAuth();

  const [turno, setTurno] = useState(null);
  const [islas, setIslas] = useState([]);
  const [mangueras, setMangueras] = useState([]);
  const [productosGranel, setProductosGranel] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [islaParaAbrir, setIslaParaAbrir] = useState("");

  const [tab, setTab] = useState("lecturas");
  const [lecturas, setLecturas] = useState([]);
  const [ventasGranel, setVentasGranel] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [transacciones, setTransacciones] = useState([]);

  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'error' | 'success', texto }

  const cargarTurnoActivo = useCallback(async () => {
    try {
      const t = await api.turnoActivo(token);
      setTurno(t);
    } catch {
      setTurno(null);
    }
  }, [token]);

  const cargarRegistrosDelTurno = useCallback(
    async (turnoId) => {
      if (!turnoId) {
        setLecturas([]);
        setVentasGranel([]);
        setVentas([]);
        setTransacciones([]);
        return;
      }
      const [l, vg, v, t] = await Promise.all([
        api.listarLecturas(token, turnoId),
        api.listarVentasGranel(token, turnoId),
        api.listarVentas(token, turnoId),
        api.listarTransacciones(token, turnoId),
      ]);
      setLecturas(l);
      setVentasGranel(vg);
      setVentas(v);
      setTransacciones(t);
    },
    [token]
  );

  // Carga inicial: turno activo + catálogos necesarios para los formularios
  useEffect(() => {
    cargarTurnoActivo();
    api.listarIslas(token).then(setIslas).catch(() => setIslas([]));
    api.listarMangueras(token).then(setMangueras).catch(() => setMangueras([]));
    api.listarProductosGranel(token).then(setProductosGranel).catch(() => setProductosGranel([]));
    api.listarProductosUnidad(token).then(setProductos).catch(() => setProductos([]));
    api.listarClientes(token).then(setClientes).catch(() => setClientes([]));
  }, [token, cargarTurnoActivo]);

  // Cuando cambia el turno activo, recargamos sus registros
  useEffect(() => {
    cargarRegistrosDelTurno(turno?.id);
  }, [turno, cargarRegistrosDelTurno]);

  function mostrarError(err) {
    setMensaje({ tipo: "error", texto: err.detail || "Ocurrió un error inesperado." });
  }

  function mostrarExito(texto) {
    setMensaje({ tipo: "success", texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  async function manejarAbrirTurno() {
    setCargandoAccion(true);
    try {
      const nuevoTurno = await api.abrirTurno(token, Number(islaParaAbrir));
      setTurno(nuevoTurno);
      setIslaParaAbrir("");
      mostrarExito(`Turno ${nuevoTurno.id} abierto.`);
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarCerrarTurno() {
    if (!confirm(`¿Cerrar el turno ${turno.id}? No podrás registrar más movimientos en él.`)) return;
    setCargandoAccion(true);
    try {
      await api.cerrarTurno(token, turno.id);
      mostrarExito("Turno cerrado.");
      setTurno(null);
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
      await cargarRegistrosDelTurno(turno.id);
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
      await cargarRegistrosDelTurno(turno.id);
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
      await cargarRegistrosDelTurno(turno.id);
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
      await cargarRegistrosDelTurno(turno.id);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

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
          {usuario.rol === "administrador" && (
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

        <TurnoStatus
          turno={turno}
          onAbrir={manejarAbrirTurno}
          onCerrar={manejarCerrarTurno}
          islas={islas}
          isla={islaParaAbrir}
          setIsla={setIslaParaAbrir}
          cargando={cargandoAccion}
        />

        {turno && (
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
                        render: (f) => (f.lectura_final - f.lectura_inicial).toFixed(2),
                      },
                      { key: "valor_total", label: "Valor", mono: true, render: (f) => `$${f.valor_total.toFixed(2)}` },
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
                      { key: "cantidad", label: "Galones" },
                      { key: "valor_total", label: "Valor", mono: true, render: (f) => `$${f.valor_total.toFixed(2)}` },
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
                      { key: "cantidad", label: "Cantidad" },
                      { key: "valor_total", label: "Valor", mono: true, render: (f) => `$${f.valor_total.toFixed(2)}` },
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
                      { key: "valor", label: "Valor", mono: true, render: (f) => `$${f.valor.toFixed(2)}` },
                    ]}
                    filas={transacciones}
                    vacio="Sin transacciones registradas en este turno."
                  />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
