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
import ResumenTurno from "../components/ResumenTurno";
import TareasTab from "../components/TareasTab";
import CatalogoManager from "../components/CatalogoManager";
import { formatMoney, formatVol, formatCant, unidadGranel } from "../utils/format";

const CAMPOS_CLIENTES = [
  { key: "nombre", label: "Nombre", type: "text" },
  { key: "tipo", label: "Tipo", type: "text" },
  {
    key: "creditos",
    label: "Tipos de crédito habilitados",
    type: "multiselect-credito",
    required: false,
  },
];

const TABS = [
  { key: "lecturas", label: "Lecturas de manguera" },
  { key: "ventas", label: "Ventas de complementarios" },
  { key: "pagos", label: "Crédito" },
  { key: "clientes", label: "Clientes" },
  { key: "transacciones", label: "Transacciones" },
  { key: "otrasIslas", label: "Venta en otras islas" },
  { key: "inventario", label: "Inventario" },
  { key: "tareas", label: "Tareas" },
];

const SUBTABS_OTRAS_ISLAS = [
  { key: "combustible", label: "Venta de combustible" },
  { key: "complementarios", label: "Venta de complementarios" },
];

const ESTADOS_PERMITIDOS = ["creado", "en_espera", "abierto", "en_revision"];

export default function OperarioPanel() {
  const { token, usuario, logout } = useAuth();

  const [turnos, setTurnos] = useState([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [mangueras, setMangueras] = useState([]);
  const [productosGranel, setProductosGranel] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tiposTransaccion, setTiposTransaccion] = useState([]);
  const [islas, setIslas] = useState([]);

  const [tab, setTab] = useState("lecturas");
  const [otraIsla, setOtraIsla] = useState("");
  const [subtabOtras, setSubtabOtras] = useState("combustible");
  const [otraIslaData, setOtraIslaData] = useState({ mangueras: [], inventario: [] });
  const [lecturas, setLecturas] = useState([]);
  const [ventasGranel, setVentasGranel] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [tareas, setTareas] = useState([]);

  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [resumenEnCierre, setResumenEnCierre] = useState(false);
  const [turnoEnRevision, setTurnoEnRevision] = useState(null);
  const [tareasRevision, setTareasRevision] = useState([]);
  const [lecturasRevision, setLecturasRevision] = useState([]);
  const [inventarioRevision, setInventarioRevision] = useState([]);
  const [alertas, setAlertas] = useState([]);

  // Estado del formulario para levantar alerta de inventario durante la revisión
  const [mostrarFormAlerta, setMostrarFormAlerta] = useState(false);
  const [alertaDescripcion, setAlertaDescripcion] = useState("");
  const [productoDiferencia, setProductoDiferencia] = useState("");
  const [cantFisica, setCantFisica] = useState("");
  const [cantSistema, setCantSistema] = useState("");
  const [diferencias, setDiferencias] = useState([]);
  const [observacionDiferencia, setObservacionDiferencia] = useState("");

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

  const cargarRevision = useCallback(async ({ signal } = {}) => {
    try {
      const turno = await api.turnoEnRevision(token, { signal });
      setTurnoEnRevision(turno || null);
    } catch {
      setTurnoEnRevision(null);
    }
  }, [token]);

  const cargarClientes = useCallback(async ({ signal } = {}) => {
    try {
      const data = await api.listarClientes(token, { signal });
      setClientes(data);
    } catch {
      if (signal?.aborted) return;
      setClientes([]);
    }
  }, [token]);

  const cargarRegistrosDelTurno = useCallback(
    async (turno, { signal } = {}) => {
      if (!turno) {
        setLecturas([]);
        setVentasGranel([]);
        setVentas([]);
        setTransacciones([]);
        setInventario([]);
        setTareas([]);
        return;
      }
      const [l, vg, v, t, ta] = await Promise.all([
        api.listarLecturas(token, turno.id, { signal }),
        api.listarVentasGranel(token, turno.id, { signal }),
        api.listarVentas(token, turno.id, { signal }),
        api.listarTransacciones(token, turno.id, { signal }),
        api.tareasActivas(token, { signal }),
      ]);
      setLecturas(l);
      setVentasGranel(vg);
      setVentas(v);
      setTransacciones(t);
      setTareas(ta);

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
    cargarRevision({ signal });
    api.listarAlertas(token, { signal }).then(setAlertas).catch(() => setAlertas([]));
    api.listarProductosGranel(token, { signal }).then(setProductosGranel).catch(() => setProductosGranel([]));
    api.listarProductosUnidad(token, undefined, { signal }).then(setProductos).catch(() => setProductos([]));
    cargarClientes({ signal });
    api.listarIslas(token, { signal }).then(setIslas).catch(() => setIslas([]));
    api.tiposTransaccion.listar(token, { signal }).then(setTiposTransaccion).catch(() => setTiposTransaccion([]));

    return () => ctrl.abort();
  }, [token, cargarTurnos, cargarRevision, cargarClientes]);

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

  // Restablecer la isla destino de "venta en otras islas" cuando cambia
  // el turno (y por tanto la isla desde la que opera el operario).
  useEffect(() => {
    if (!turnoSeleccionado) return;
    const otras = islas.filter((i) => Number(i.id) !== Number(turnoSeleccionado.isla));
    setOtraIsla((prev) => {
      if (prev && otras.some((i) => Number(i.id) === Number(prev))) return prev;
      return otras.length > 0 ? otras[0].id : "";
    });
  }, [islas, turnoSeleccionado]);

  // Cargar mangueras e inventario de la isla destino para filtrar las
  // opciones de producto de la venta en otras islas.
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    if (!otraIsla) {
      setOtraIslaData({ mangueras: [], inventario: [] });
      return;
    }
    Promise.all([
      api.listarManguerasPorIsla(token, otraIsla, { signal }),
      api.listarInventarioPorIsla(token, otraIsla, { signal }),
    ])
      .then(([mangueras, inventario]) => setOtraIslaData({ mangueras, inventario }))
      .catch(() => setOtraIslaData({ mangueras: [], inventario: [] }));
    return () => ctrl.abort();
  }, [token, otraIsla]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (turnoSeleccionado?.estado === "abierto") {
      cargarRegistrosDelTurno(turnoSeleccionado, { signal: ctrl.signal });
    } else {
      setLecturas([]);
      setVentasGranel([]);
      setVentas([]);
      setTransacciones([]);
      setInventario([]);
      setTareas([]);
    }
    return () => ctrl.abort();
  }, [turnoSeleccionado, cargarRegistrosDelTurno]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!turnoEnRevision) {
      setLecturasRevision([]);
      setTareasRevision([]);
      setInventarioRevision([]);
      return;
    }
    Promise.all([
      api.listarLecturasPorTurno(token, turnoEnRevision.id, { signal: ctrl.signal }),
      api.tareasPorTurno(token, turnoEnRevision.id, { signal: ctrl.signal }),
      api.listarInventarioPorIsla(token, turnoEnRevision.isla, { signal: ctrl.signal }),
    ])
      .then(([lecturas, tareas, inv]) => {
        setLecturasRevision(lecturas);
        setTareasRevision(tareas);
        setInventarioRevision(inv);
      })
      .catch(() => {
        setLecturasRevision([]);
        setTareasRevision([]);
        setInventarioRevision([]);
      });
    return () => ctrl.abort();
  }, [turnoEnRevision, token]);

  function textoError(err) {
    const detalle = err?.detail ?? err?.message ?? err;
    if (typeof detalle === "string") return detalle;
    if (Array.isArray(detalle)) return detalle.map((d) => textoError(d)).join(". ");
    if (detalle && typeof detalle === "object") {
      if (typeof detalle.detail === "string") return detalle.detail;
      const msg = detalle.msg || detalle.message;
      if (typeof msg === "string") return msg;
      try {
        return JSON.stringify(detalle);
      } catch {
        return "Ocurrió un error inesperado.";
      }
    }
    return "Ocurrió un error inesperado.";
  }

  function mostrarError(err) {
    setMensaje({ tipo: "error", texto: textoError(err) });
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

  async function manejarCerrarTurno(texto = "") {
    setResumenAbierto(false);
    setResumenEnCierre(false);
    setCargandoAccion(true);
    try {
      await api.cerrarTurno(token, turnoSeleccionado.id, texto);
      mostrarExito("Turno enviado a revisión.");
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

  async function abrirResumen(modoCierre) {
    if (!turnoSeleccionado) return;
    setCargandoAccion(true);
    try {
      await cargarRegistrosDelTurno(turnoSeleccionado);
      setResumenEnCierre(modoCierre);
      setResumenAbierto(true);
    } catch {
      mostrarError("No se pudo cargar el resumen del turno.");
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarRevisar(aprobado) {
    setCargandoAccion(true);
    try {
      await api.revisarTurno(token, turnoEnRevision.id, aprobado);
      mostrarExito(aprobado ? "Turno aprobado y cerrado." : "Turno rechazado. Vuelve a estar abierto.");
      await cargarRevision();
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

  function agregarDiferencia() {
    if (!productoDiferencia) {
      mostrarError({ detail: "Selecciona un producto." });
      return;
    }
    const cantF = parseFloat(cantFisica);
    const cantS = parseFloat(cantSistema);
    if (Number.isNaN(cantF) && Number.isNaN(cantS)) {
      mostrarError({ detail: "Indica al menos una de las cantidades (física o sistema)." });
      return;
    }
    const fisica = Number.isNaN(cantF) ? cantS : cantF;
    const sistema = Number.isNaN(cantS) ? cantF : cantS;
    setDiferencias((prev) => [
      ...prev.filter((d) => d.codigo !== productoDiferencia),
      {
        codigo: productoDiferencia,
        cantidad_fisica: fisica,
        cantidad_sistema: sistema,
        diferencia: fisica - sistema,
        observacion: observacionDiferencia.trim() || null,
      },
    ]);
    setProductoDiferencia("");
    setCantFisica("");
    setCantSistema("");
    setObservacionDiferencia("");
  }

  function quitarDiferencia(codigo) {
    setDiferencias((prev) => prev.filter((d) => d.codigo !== codigo));
  }

  async function manejarLevantarAlerta() {
    if (!alertaDescripcion.trim()) {
      mostrarError({ detail: "Escribe una descripción de la diferencia." });
      return;
    }
    if (diferencias.length === 0) {
      mostrarError({ detail: "Agrega al menos un producto con diferencia." });
      return;
    }
    setCargandoAccion(true);
    try {
      await api.alertaInventario(token, turnoEnRevision.id, {
        descripcion: alertaDescripcion.trim(),
        productos: diferencias,
      });
      mostrarExito("Alerta de inventario levantada.");
      setMostrarFormAlerta(false);
      setAlertaDescripcion("");
      setDiferencias([]);
      api.listarAlertas(token).then(setAlertas).catch(() => setAlertas([]));
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
      await api.crearVentaGranel(token, {
        ...datos,
        isla: datos.isla ?? turnoSeleccionado.isla,
      });
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
      await api.crearVenta(token, {
        ...datos,
        isla: datos.isla ?? turnoSeleccionado.isla,
      });
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

  async function manejarMarcarTarea(tareaId, realizada) {
    setCargandoAccion(true);
    try {
      await api.marcarTareaRealizada(token, tareaId, realizada);
      mostrarExito(realizada ? "Tarea marcada como realizada." : "Tarea marcada como pendiente.");
      const t = await api.tareasActivas(token);
      setTareas(t);
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  async function manejarMarcarTareaRevisada(tareaId, revisada) {
    if (!turnoEnRevision) return;
    setCargandoAccion(true);
    try {
      await api.marcarTareaRevisada(token, tareaId, turnoEnRevision.id, revisada);
      mostrarExito(revisada ? "Tarea marcada como revisada." : "Tarea marcada como pendiente de revisión.");
      setTareasRevision((prev) => prev.map((t) => (t.tarea === tareaId ? { ...t, revisada } : t)));
      return true;
    } catch (err) {
      mostrarError(err);
      return false;
    } finally {
      setCargandoAccion(false);
    }
  }

  const turnoAbierto = turnoSeleccionado?.estado === "abierto";

  const granelUnidadPorCodigo = new Map((productosGranel || []).map((p) => [String(p.codigo), p.unidad]));
  function unidadCortoDeManguera(mangueraId) {
    const manguera = mangueras.find((m) => m.id === Number(mangueraId));
    const codigo = manguera ? String(manguera.codigo_combustible) : null;
    return codigo ? unidadGranel(granelUnidadPorCodigo.get(codigo)).corto : "gal";
  }

  // Los tipos de transacción y su signo vienen del backend ("TiposTransaccion").
  // La pestaña "Crédito" muestra únicamente las de tipo "credito"; la pestaña
  // "Transacciones" muestra las demás transacciones
  const tiposNoCredito = tiposTransaccion.filter((t) => t.tipo != "credito");
  const tiposCredito = tiposTransaccion.filter((t) => t.tipo === "credito");

  const transaccionesCredito = transacciones.filter((t) =>
    tiposCredito.some((tc) => tc.id === t.tipo)
  );
  const transaccionesNoCredito = transacciones.filter((t) =>
    tiposNoCredito.some((tg) => tg.id === t.tipo)
  );

  // Filtros para la venta en otras islas: combustible disponible según las
  // mangueras de la isla seleccionada, y complementarios según su inventario.
  const otrasIslas = islas.filter((i) => Number(i.id) !== Number(turnoSeleccionado?.isla));
  const codigosCombustibleOtra = new Set(otraIslaData.mangueras.map((m) => m.codigo_combustible));
  const productosGranelOtra = productosGranel.filter((p) => codigosCombustibleOtra.has(p.codigo));
  const codigosInventarioOtra = new Set(otraIslaData.inventario.map((i) => i.codigo));
  const productosOtra = productos.filter((p) => codigosInventarioOtra.has(p.codigo));
  const ventasGranelOtra = ventasGranel.filter((v) => Number(v.isla) === Number(otraIsla));
  const ventasOtra = ventas.filter((v) => Number(v.isla) === Number(otraIsla));

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

        {alertas.length > 0 && (
          <div className="card" style={{ marginBottom: "var(--spacing-4)" }}>
            <h3 className="card__title" style={{ marginBottom: "var(--spacing-3)" }}>
              Alertas
            </h3>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{a.estado}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{a.tipo}</td>
                    <td>
                      {a.descripcion}
                      {a.tipo === "inventario_diferencia" && (
                        <div style={{ marginTop: "var(--spacing-2)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {(() => {
                            const detalle = a.entidades?.find((e) => e.tabla === "InventarioDiferencia");
                            const productos = detalle?.productos || [];
                            return productos.length > 0
                              ? productos
                                  .map(
                                    (p) =>
                                      `${p.codigo}: ${formatCant(p.cantidad_fisica)} física vs ${formatCant(
                                        p.cantidad_sistema
                                      )} sistema (dif. ${formatCant(p.diferencia)}${p.observacion ? ` — ${p.observacion}` : ""})`
                                  )
                                  .join(" · ")
                              : "Diferencia de inventario";
                          })()}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(a.tiempo).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          onCerrar={() => abrirResumen(true)}
          onVerResumen={() => abrirResumen(false)}
          onSolicitarAbrir={manejarSolicitarAbrir}
          cargando={cargandoAccion}
          bloquearAbrir={Boolean(turnoEnRevision)}
          mensajeBloqueo="Debes revisar el turno anterior (inventario, tareas y lecturas) y aprobar o rechazar su cierre antes de abrir este turno."
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
                  lecturas={lecturas}
                  productosGranel={productosGranel}
                  onRegistrar={manejarRegistrarLectura}
                  cargando={cargandoAccion}
                />
                <div style={{ marginTop: "var(--spacing-6)" }}>
                  <RegistrosTabla
                    columnas={[
                      { key: "manguera_id", label: "Manguera" },
                      {
                        key: "cantidad",
                        label: "Volumen",
                        render: (f) =>
                          `${formatVol(f.lectura_final - f.lectura_inicial)} ${unidadCortoDeManguera(f.manguera_id)}`,
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
                    filas={lecturas}
                    vacio="Sin lecturas registradas en este turno."
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
                  tipos={tiposCredito}
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
                    filas={transaccionesCredito}
                    vacio="Sin créditos registrados en este turno."
                  />
                </div>
              </>
            )}

            {tab === "clientes" && (
              <CatalogoManager
                titulo="Clientes"
                apiResource={api.clientes}
                idField="id"
                campos={CAMPOS_CLIENTES}
                formEnModal
                permitirEliminar={false}
                onCambio={cargarClientes}
              />
            )}

            {tab === "transacciones" && (
              <>
                <FormularioTransaccion
                  tipos={tiposNoCredito}
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
                    filas={transaccionesNoCredito}
                    vacio="Sin transacciones registradas en este turno."
                  />
                </div>
              </>
            )}

            {tab === "otrasIslas" && (
              <div>
                <div className="tabs">
                  {SUBTABS_OTRAS_ISLAS.map((st) => (
                    <button
                      key={st.key}
                      className={`tab ${subtabOtras === st.key ? "tab--activo" : ""}`}
                      onClick={() => setSubtabOtras(st.key)}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="field" style={{ marginTop: "var(--spacing-4)" }}>
                  <label htmlFor="otra_isla">Isla desde la que vendes</label>
                  <select
                    id="otra_isla"
                    value={otraIsla}
                    onChange={(e) => setOtraIsla(e.target.value)}
                    required
                    style={{ minWidth: 220 }}
                  >
                    {otrasIslas.length === 0 && <option value="">No hay otras islas</option>}
                    {otrasIslas.map((i) => (
                      <option key={i.id} value={i.id}>
                        Isla {i.id}
                      </option>
                    ))}
                  </select>
                </div>

                {!otraIsla ? (
                  <div className="empty-state">No hay otras islas disponibles.</div>
                ) : subtabOtras === "combustible" ? (
                  <>
                    <FormularioVentaGranel
                      productos={productosGranelOtra}
                      onRegistrar={(datos) =>
                        manejarRegistrarVentaGranel({ ...datos, isla: Number(otraIsla) })
                      }
                      cargando={cargandoAccion}
                    />
                    <div style={{ marginTop: "var(--spacing-6)" }}>
                      <RegistrosTabla
                        columnas={[
                          { key: "codigo", label: "Combustible" },
                          {
                            key: "cantidad",
                            label: "Cantidad",
                            render: (f) =>
                              `${formatVol(f.cantidad)} ${unidadGranel(granelUnidadPorCodigo.get(String(f.codigo))).corto}`,
                          },
                          { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
                        ]}
                        filas={ventasGranelOtra}
                        vacio="Sin ventas de combustible en esta isla."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <FormularioVenta
                      productos={productosOtra}
                      onRegistrar={(datos) =>
                        manejarRegistrarVenta({ ...datos, isla: Number(otraIsla) })
                      }
                      cargando={cargandoAccion}
                    />
                    <div style={{ marginTop: "var(--spacing-6)" }}>
                      <RegistrosTabla
                        columnas={[
                          { key: "codigo", label: "Producto" },
                          { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f.cantidad) },
                          { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
                        ]}
                        filas={ventasOtra}
                        vacio="Sin ventas de complementarios en esta isla."
                      />
                    </div>
                  </>
                )}
              </div>
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
                      { key: "codigo", label: "Producto", render: (f) => f.producto_nombre || f.codigo },
                      { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f.cantidad) },
                    ]}
                    filas={inventario}
                    vacio="Sin inventario."
                  />
                )}
              </div>
            )}

            {tab === "tareas" && (
              <TareasTab tareas={tareas} onMarcar={manejarMarcarTarea} cargando={cargandoAccion} />
            )}
          </div>
        )}

        {turnoEnRevision && (
          <div className="card" style={{ borderColor: "#f97316" }}>
            <h3 style={{ marginBottom: "var(--spacing-4)" }}>
              Revisión del turno {turnoEnRevision.id} — Isla {turnoEnRevision.isla}
            </h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--spacing-6)" }}>
              El operario anterior envió este turno a revisión. Verifica la información antes de
              aprobar o rechazar el cierre.
            </p>

            <div style={{ marginBottom: "var(--spacing-6)" }}>
              <h4 style={{ marginBottom: "var(--spacing-3)" }}>Tareas asignadas</h4>
              {tareasRevision.length === 0 ? (
                <div className="empty-state">No hay tareas registradas para este turno.</div>
              ) : (
                <>
                  <p style={{ color: "var(--text-muted)", marginBottom: "var(--spacing-4)" }}>
                    Marca como revisadas las tareas que compruebas que sí se hicieron en el turno
                    anterior.
                  </p>
                  <RegistrosTabla
                    columnas={[
                      { key: "objetivo", label: "Objetivo" },
                      { key: "detalle", label: "Detalle" },
                      {
                        key: "revisada",
                        label: "Revisada",
                        render: (f) => (
                          <span style={{ color: f.revisada ? "#10b981" : "#6b7280", fontWeight: 600 }}>
                            {f.revisada ? "Vista" : "Sin revisar"}
                          </span>
                        ),
                      },
                      {
                        key: "_acciones",
                        label: "",
                        render: (f) => (
                          <button
                            className={`btn btn--sm ${f.revisada ? "btn--ghost" : "btn--primary"}`}
                            disabled={cargandoAccion}
                            onClick={() => manejarMarcarTareaRevisada(f.tarea, !f.revisada)}
                          >
                            {f.revisada ? "Desmarcar" : "Marcar como revisada"}
                          </button>
                        ),
                      },
                    ]}
                    filas={tareasRevision}
                    vacio="Sin tareas."
                  />
                </>
              )}
            </div>

            <div style={{ marginBottom: "var(--spacing-6)" }}>
              <h4 style={{ marginBottom: "var(--spacing-3)" }}>Lecturas de mangueras</h4>
              {lecturasRevision.length === 0 ? (
                <div className="empty-state">No hay lecturas registradas para este turno.</div>
              ) : (
                <RegistrosTabla
                  columnas={[
                    { key: "manguera_id", label: "Manguera" },
                    {
                      key: "cantidad",
                      label: "Volumen",
                      render: (f) =>
                        `${formatVol(f.lectura_final - f.lectura_inicial)} ${unidadCortoDeManguera(f.manguera_id)}`,
                    },
                    { key: "valor_total", label: "Valor", mono: true, render: (f) => formatMoney(f.valor_total) },
                  ]}
                  filas={lecturasRevision}
                  vacio="Sin lecturas."
                />
              )}
            </div>

            <div style={{ marginBottom: "var(--spacing-6)" }}>
              <h4 style={{ marginBottom: "var(--spacing-3)" }}>Inventario — Isla {turnoEnRevision.isla}</h4>
              {inventarioRevision.length === 0 ? (
                <div className="empty-state">No hay inventario registrado para esta isla.</div>
              ) : (
                <RegistrosTabla
                  columnas={[
                    { key: "bodega_nombre", label: "Bodega" },
                    { key: "codigo", label: "Producto", render: (f) => f.producto_nombre || f.codigo },
                    { key: "cantidad", label: "Cantidad", render: (f) => formatCant(f.cantidad) },
                  ]}
                  filas={inventarioRevision}
                  vacio="Sin inventario."
                />
              )}
            </div>

            <div style={{ marginBottom: "var(--spacing-6)" }}>
              <h4 style={{ marginBottom: "var(--spacing-3)" }}>Alerta de diferencia de inventario</h4>
              <p style={{ color: "var(--text-muted)", marginBottom: "var(--spacing-4)" }}>
                Si existen diferencias entre las existencias físicas y las del sistema en este turno,
                levanta una alerta para que quede registrada.
              </p>

              {!mostrarFormAlerta ? (
                <button
                  className="btn btn--primary"
                  onClick={() => setMostrarFormAlerta(true)}
                  disabled={cargandoAccion}
                >
                  Levantar alerta de inventario
                </button>
              ) : (
                <div className="card" style={{ borderColor: "#f59e0b" }}>
                  <div className="field">
                    <label htmlFor="alerta_producto">Producto</label>
                    <div style={{ display: "flex", gap: "var(--spacing-2)", flexWrap: "wrap" }}>
                      <select
                        id="alerta_producto"
                        value={productoDiferencia}
                        onChange={(e) => {
                          setProductoDiferencia(e.target.value);
                          const inv = inventarioRevision.find(
                            (i) => String(i.codigo) === e.target.value
                          );
                          setCantSistema(inv ? String(inv.cantidad) : "");
                          setCantFisica("");
                          setObservacionDiferencia("");
                        }}
                        style={{ minWidth: 220 }}
                      >
                        <option value="">Selecciona un producto</option>
                        {productos.map((p) => {
                          const inv = inventarioRevision.find(
                            (i) => String(i.codigo) === String(p.codigo)
                          );
                          return (
                            <option key={p.codigo} value={p.codigo}>
                              {p.nombre} ({p.codigo}) — sistema: {formatCant(inv ? inv.cantidad : 0)}
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="number"
                        placeholder="Cant. física"
                        value={cantFisica}
                        onChange={(e) => setCantFisica(e.target.value)}
                        style={{ width: 120 }}
                      />
                      <input
                        type="number"
                        placeholder="Cant. sistema"
                        value={cantSistema}
                        onChange={(e) => setCantSistema(e.target.value)}
                        style={{ width: 120 }}
                      />
                      <input
                        type="text"
                        placeholder="Observación (opcional)"
                        value={observacionDiferencia}
                        onChange={(e) => setObservacionDiferencia(e.target.value)}
                        style={{ minWidth: 160, flex: 1 }}
                      />
                      <button className="btn" type="button" onClick={agregarDiferencia}>
                        Agregar
                      </button>
                    </div>
                  </div>

                  {diferencias.length > 0 && (
                    <div style={{ marginTop: "var(--spacing-4)" }}>
                      <RegistrosTabla
                        columnas={[
                          { key: "codigo", label: "Producto" },
                          { key: "cantidad_fisica", label: "Física", render: (f) => formatCant(f.cantidad_fisica) },
                          { key: "cantidad_sistema", label: "Sistema", render: (f) => formatCant(f.cantidad_sistema) },
                          {
                            key: "diferencia",
                            label: "Diferencia",
                            render: (f) => (
                              <span style={{ color: f.diferencia !== 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                                {formatCant(f.diferencia)}
                              </span>
                            ),
                          },
                          {
                            key: "quitar",
                            label: "",
                            render: (f) => (
                              <button className="btn btn--danger" type="button" onClick={() => quitarDiferencia(f.codigo)}>
                                Quitar
                              </button>
                            ),
                          },
                        ]}
                        filas={diferencias}
                        vacio="Sin diferencias agregadas."
                      />
                    </div>
                  )}

                  <div className="field" style={{ marginTop: "var(--spacing-4)" }}>
                    <label htmlFor="alerta_descripcion">Descripción de la diferencia</label>
                    <textarea
                      id="alerta_descripcion"
                      value={alertaDescripcion}
                      onChange={(e) => setAlertaDescripcion(e.target.value)}
                      rows={3}
                      placeholder="Describe la diferencia detectada en el inventario..."
                    />
                  </div>

                  <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
                    <button
                      className="btn"
                      onClick={() => {
                        setMostrarFormAlerta(false);
                        setAlertaDescripcion("");
                        setDiferencias([]);
                        setProductoDiferencia("");
                        setCantFisica("");
                        setCantSistema("");
                        setObservacionDiferencia("");
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn btn--primary"
                      onClick={manejarLevantarAlerta}
                      disabled={cargandoAccion}
                    >
                      {cargandoAccion ? "Guardando..." : "Levantar alerta"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
              <button
                className="btn btn--danger"
                onClick={() => manejarRevisar(false)}
                disabled={cargandoAccion}
              >
                {cargandoAccion ? "Procesando..." : "Rechazar"}
              </button>
              <button
                className="btn btn--primary"
                onClick={() => manejarRevisar(true)}
                disabled={cargandoAccion}
              >
                {cargandoAccion ? "Procesando..." : "Aprobar cierre"}
              </button>
            </div>
          </div>
        )}

        {!turnoAbierto && turnoSeleccionado && turnoSeleccionado.estado !== "abierto" && (
          <>
            {turnoSeleccionado.estado === "en_espera" && (
              <div className="card" style={{ textAlign: "center", padding: "var(--spacing-8)" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                  Este turno está en espera. Solicita abrirlo para comenzar a operar.
                </p>
              </div>
            )}
            {turnoSeleccionado.estado === "creado" && (
              <div className="card" style={{ textAlign: "center", padding: "var(--spacing-8)" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                  Este turno aún no está disponible. Espera a que llegue su hora de inicio.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <ResumenTurno
        abierto={resumenAbierto}
        turno={turnoSeleccionado}
        lecturas={lecturas}
        ventas={ventas}
        ventasGranel={ventasGranel}
        transacciones={transacciones}
        tiposTransaccion={tiposTransaccion}
        clientes={clientes}
        productos={productos}
        productosGranel={productosGranel}
        mangueras={mangueras}
        modoCierre={resumenEnCierre}
        cargando={cargandoAccion}
        onConfirmarCierre={manejarCerrarTurno}
        onCerrar={() => {
          setResumenAbierto(false);
          setResumenEnCierre(false);
        }}
      />
    </div>
  );
}
