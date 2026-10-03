// Cliente HTTP simple, sin librerías externas (fetch nativo es suficiente
// para lo que necesitamos): agrega el header de autenticación si hay
// token, y centraliza el manejo de errores para que cada componente no
// tenga que repetir la lógica de "revisar response.ok".

// Si VITE_API_URL no está definido (por ejemplo en un clon nuevo, porque
// .env está en .gitignore) caemos al backend de producción: apuntar a
// "localhost" dejaría la app sin servidor dentro del APK, donde localhost es
// el propio teléfono.
const API_URL_POR_DEFECTO = "https://eds-backend-w91z.onrender.com";
const API_URL = (import.meta.env.VITE_API_URL || API_URL_POR_DEFECTO).replace(/\/+$/, "");

// Tope de espera para que una petición colgada no deje la interfaz cargando
// para siempre. Las subidas de foto usan un límite mayor por el tamaño.
const TIMEOUT_MS = 30000;
const TIMEOUT_ARCHIVO_MS = 60000;

let onUnauthorized = null;

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

class ApiError extends Error {
  constructor(status, detail, data = null) {
    super(detail || `Error ${status}`);
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

// Combina el AbortSignal del llamador con un timeout propio. Devolvemos el
// signal combinado y una función de limpieza para no dejar el temporizador
// colgando cuando la respuesta llega antes de tiempo.
function signalConTimeout(signal, timeout) {
  const controller = new AbortController();
  const propagar = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    propagar();
  } else if (signal) {
    signal.addEventListener("abort", propagar, { once: true });
  }

  const temporizador =
    timeout > 0
      ? setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeout)
      : null;

  return {
    signal: controller.signal,
    limpiar() {
      if (temporizador) clearTimeout(temporizador);
      signal?.removeEventListener("abort", propagar);
    },
  };
}

// 204 no trae body; un body no-JSON (HTML de un proxy o 502) no se puede
// parsear, así que lo leemos como texto y lo distinguimos de un JSON válido.
async function leerRespuesta(response) {
  if (response.status === 204) return { esJSON: true, datos: null };

  const texto = await response.text().catch(() => "");
  if (!texto.trim()) return { esJSON: true, datos: null };

  try {
    return { esJSON: true, datos: JSON.parse(texto) };
  } catch {
    return { esJSON: false, texto };
  }
}

// FastAPI devuelve los errores de validación como lista de {msg, loc}; los
// unimos para que el mensaje que ve el operario sea útil.
function mensajeDeDetalle(data) {
  if (Array.isArray(data)) {
    const partes = data
      .map((item) => (typeof item === "string" ? item : item?.msg || item?.detail))
      .filter(Boolean);
    return partes.length ? partes.join(". ") : null;
  }
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
  }
  return null;
}

function mensajeDeError(response, leida) {
  if (leida.esJSON) {
    return mensajeDeDetalle(leida.datos) || "Ocurrió un error inesperado.";
  }
  // Respuesta no-JSON: no mostramos el HTML crudo, solo el status.
  return response.statusText || `Error ${response.status}`;
}

function esErrorDeTimeout(error) {
  if (error?.name === "TimeoutError") return true;
  // Un abort del llamador también lanza AbortError, pero solo tratamos como
  // timeout el que genera nuestro propio temporizador.
  return error?.name === "AbortError" && /timeout/i.test(error?.message || "");
}

async function enviar(url, { method, headers, body, signal, timeout, manejarUnauthorized = true } = {}) {
  const { signal: signalFinal, limpiar } = signalConTimeout(signal, timeout);

  try {
    const response = await fetch(url, { method, headers, body, signal: signalFinal });
    const leida = await leerRespuesta(response);

    if (!response.ok) {
      if (response.status === 401 && onUnauthorized && manejarUnauthorized) {
        onUnauthorized();
      }
      throw new ApiError(
        response.status,
        mensajeDeError(response, leida),
        leida.esJSON ? leida.datos : null
      );
    }

    return leida.datos ?? null;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (esErrorDeTimeout(error)) {
      throw new ApiError(
        0,
        "El servidor tardó demasiado en responder. Revisa la conexión e intenta de nuevo."
      );
    }
    throw error;
  } finally {
    limpiar();
  }
}

async function request(path, { method = "GET", body, token, signal, timeout = TIMEOUT_MS, manejarUnauthorized = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return enviar(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    timeout,
    manejarUnauthorized,
  });
}

// Para subir archivos usamos FormData en vez de JSON — el navegador arma
// el Content-Type (multipart/form-data con boundary) automáticamente,
// por eso NO seteamos el header manualmente aquí, a diferencia de `request`.
async function requestArchivo(path, { archivo, token, signal, timeout = TIMEOUT_ARCHIVO_MS } = {}) {
  const formData = new FormData();
  formData.append("archivo", archivo);

  return enviar(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    signal,
    timeout,
  });
}

// Helper para los catálogos: todos siguen el mismo patrón REST
// (GET /, GET /{id}, POST /, PUT /{id}, DELETE /{id}), así que en vez de
// repetir 5 funciones casi idénticas por catálogo, generamos las llamadas
// a partir de la ruta base. La función `request` de arriba sigue siendo
// donde vive toda la lógica real (headers, errores); esto solo evita
// repetir la construcción de la URL.
function crudEndpoints(basePath, { permitirEliminar = true } = {}) {
  const endpoints = {
    listar: (token, opts) => request(`${basePath}/`, { token, ...opts }),
    obtener: (token, id, opts) => request(`${basePath}/${encodeURIComponent(id)}`, { token, ...opts }),
    crear: (token, datos, opts) => request(`${basePath}/`, { method: "POST", token, body: datos, ...opts }),
    actualizar: (token, id, datos, opts) =>
      request(`${basePath}/${encodeURIComponent(id)}`, { method: "PUT", token, body: datos, ...opts }),
  };
  if (permitirEliminar) {
    endpoints.eliminar = (token, id, opts) =>
      request(`${basePath}/${encodeURIComponent(id)}`, { method: "DELETE", token, ...opts });
  }
  return endpoints;
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: { username, password },
      manejarUnauthorized: false,
    }),

  turnoActivo: (token, opts) => request("/api/turnos/activo", { token, ...opts }),
  turnoEnEspera: (token, opts) => request("/api/turnos/en_espera", { token, ...opts }),
  abrirTurno: (token, isla) =>
    request("/api/turnos/abrir", { method: "POST", token, body: { isla } }),
  solicitarAbrirTurno: (token, turnoId) =>
    request(`/api/turnos/${turnoId}/abrir`, { method: "POST", token }),
  cerrarTurno: (token, turnoId, texto = "") =>
    request(`/api/turnos/${turnoId}/cerrar`, { method: "POST", token, body: { texto } }),
  crearTurno: (token, datos) =>
    request("/api/turnos/", { method: "POST", token, body: datos }),
  actualizarTurno: (token, turnoId, datos) =>
    request(`/api/turnos/${encodeURIComponent(turnoId)}`, { method: "PUT", token, body: datos }),
  cambiarEstadoTurno: (token, turnoId, estado) =>
    request(`/api/turnos/${encodeURIComponent(turnoId)}/estado`, { method: "PUT", token, body: { estado } }),
  asignarResponsable: (token, turnoId, responsable) =>
    request(`/api/turnos/${turnoId}/responsable`, { method: "PUT", token, body: { responsable } }),
  listarTurnos: (token, operarioId, opts) =>
    request(
      `/api/turnos/${operarioId ? `?operario_id=${encodeURIComponent(operarioId)}` : ""}`,
      { token, ...opts }
    ),
  obtenerTurno: (token, turnoId, opts) =>
    request(`/api/turnos/${encodeURIComponent(turnoId)}`, { token, ...opts }),
  turnoAnterior: (token, turnoId, opts) =>
    request(`/api/turnos/${encodeURIComponent(turnoId)}/anterior`, { token, ...opts }),
  lecturasCierre: (token, turnoId, opts) =>
    request(`/api/turnos/${encodeURIComponent(turnoId)}/lecturas-cierre`, { token, ...opts }),
  turnoEnRevision: (token, opts) => request("/api/turnos/en_revision", { token, ...opts }),
  revisarTurno: (token, turnoId, aprobado) =>
    request(`/api/turnos/${turnoId}/revisar`, { method: "POST", token, body: { aprobado } }),
  alertaInventario: (token, turnoId, datos) =>
    request(`/api/turnos/${turnoId}/alerta-inventario`, {
      method: "POST",
      token,
      body: datos,
    }),

  subirFotoLectura: (token, archivo) =>
    requestArchivo("/api/lecturas-mangueras/foto", { archivo, token }),
  crearLectura: (token, datos) =>
    request("/api/lecturas-mangueras/", { method: "POST", token, body: datos }),
  actualizarLectura: (token, id, datos) =>
    request(`/api/lecturas-mangueras/${id}`, { method: "PUT", token, body: datos }),
  eliminarLectura: (token, id, comentarios) =>
    request(`/api/lecturas-mangueras/${id}`, {
      method: "DELETE",
      token,
      body: comentarios ? { comentarios } : {},
    }),
  listarLecturas: (token, turnoId, opts) =>
    request(`/api/lecturas-mangueras/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),
  listarLecturasPorTurno: (token, turnoId, opts) =>
    request(`/api/lecturas-mangueras/turno/${encodeURIComponent(turnoId)}`, { token, ...opts }),

  crearVenta: (token, datos) =>
    request("/api/productos-unidad-ventas/", { method: "POST", token, body: datos }),
  actualizarVenta: (token, id, datos) =>
    request(`/api/productos-unidad-ventas/${id}`, { method: "PUT", token, body: datos }),
  eliminarVenta: (token, id, comentarios) =>
    request(`/api/productos-unidad-ventas/${id}`, {
      method: "DELETE",
      token,
      body: comentarios ? { comentarios } : {},
    }),
  listarVentas: (token, turnoId, opts) =>
    request(`/api/productos-unidad-ventas/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),

  crearVentaGranel: (token, datos) =>
    request("/api/ventas-granel/", { method: "POST", token, body: datos }),
  actualizarVentaGranel: (token, id, datos) =>
    request(`/api/ventas-granel/${id}`, { method: "PUT", token, body: datos }),
  eliminarVentaGranel: (token, id, comentarios) =>
    request(`/api/ventas-granel/${id}`, {
      method: "DELETE",
      token,
      body: comentarios ? { comentarios } : {},
    }),
  listarVentasGranel: (token, turnoId, opts) =>
    request(`/api/ventas-granel/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),

  crearTransaccion: (token, datos) =>
    request("/api/transacciones-financieras/", { method: "POST", token, body: datos }),
  actualizarTransaccion: (token, id, datos) =>
    request(`/api/transacciones-financieras/${encodeURIComponent(id)}`, { method: "PUT", token, body: datos }),
  anularTransaccion: (token, id, comentarios) =>
    request(`/api/transacciones-financieras/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
      body: comentarios ? { comentarios } : {},
    }),
  listarTransacciones: (token, turnoId, opts) =>
    request(`/api/transacciones-financieras/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),
  listarHistorialTransacciones: (token, transaccionId, opts) =>
    request(
      `/api/transacciones-financieras/historial${
        transaccionId ? `?transaccion_id=${encodeURIComponent(transaccionId)}` : ""
      }`,
      { token, ...opts }
    ),
  listarHistorialMovimientos: (token, { entidad, registroId, turnoId } = {}, opts) => {
    const params = new URLSearchParams();
    if (entidad) params.set("entidad", entidad);
    if (registroId) params.set("registro_id", registroId);
    if (turnoId) params.set("turno_id", turnoId);
    const qs = params.toString();
    return request(`/api/historial-movimientos/${qs ? `?${qs}` : ""}`, { token, ...opts });
  },

  listarMovimientos: (token, opts) => request("/api/productos-unidad-movimientos/", { token, ...opts }),
  transferirInventario: (token, datos) =>
    request("/api/productos-unidad-movimientos/transferir", { method: "POST", token, body: datos }),
  ajustarInventario: (token, datos) =>
    request("/api/productos-unidad-movimientos/ajustar", { method: "POST", token, body: datos }),

  listarHistorialPrecios: (token, codigo, opts) =>
    request(
      `/api/historial-precios/${codigo ? `?codigo=${encodeURIComponent(codigo)}` : ""}`,
      { token, ...opts }
    ),

  reporteDiario: (token, desde, hasta, opts) =>
    request(`/api/reportes/diario?desde=${desde}&hasta=${hasta}`, { token, ...opts }),

  // Inventario por bodega
  listarInventario: (token, bodegaId) => request(`/api/bodegas/${bodegaId}/inventario`, { token }),
  listarInventarioPorIsla: (token, isla, opts) =>
    request(`/api/bodegas/inventario-por-isla/${isla}`, { token, ...opts }),
  actualizarInventario: (token, bodegaId, codigo, cantidad) =>
    request(`/api/bodegas/${bodegaId}/inventario/${encodeURIComponent(codigo)}`, {
      method: "PUT",
      token,
      body: { cantidad },
    }),

  // Inventario administrativo con detalle de día anterior y ventas del día
  listarInventarioDetallado: (token, isla, opts) =>
    request(`/api/inventario/${isla ? `?isla=${isla}` : ""}`, { token, ...opts }),
  cerrarDiaInventario: (token, opts) =>
    request("/api/inventario/cerrar-dia", { method: "POST", token, ...opts }),

  // Snapshots diarios de operación (resumen congelado y re-ejecutable del día)
  listarSnapshots: (token, desde, hasta, opts) =>
    request(`/api/snapshots/?desde=${desde}&hasta=${hasta}`, { token, ...opts }),
  snapshotVivo: (token, fecha, opts) =>
    request(`/api/snapshots/vivo${fecha ? `?fecha=${fecha}` : ""}`, { token, ...opts }),
  obtenerSnapshot: (token, fecha, opts) =>
    request(`/api/snapshots/${fecha}`, { token, ...opts }),
  cerrarDiaOperativo: (token, fecha, opts) =>
    request("/api/snapshots/cerrar-dia", {
      method: "POST",
      token,
      body: fecha ? { fecha } : {},
      ...opts,
    }),
  cerrarDiaLock: (token, fecha, opts) =>
    request(`/api/snapshots/${fecha}/cerrar`, { method: "POST", token, ...opts }),
  reabrirDia: (token, fecha, opts) =>
    request(`/api/snapshots/${fecha}/reabrir`, { method: "POST", token, ...opts }),
  fijarValidacion: (token, fecha, tipo, valor, opts) =>
    request(`/api/snapshots/${fecha}/validacion`, {
      method: "PUT",
      token,
      body: { tipo, valor },
      ...opts,
    }),
  cargarValidadoExcel: (token, fecha, archivo, opts) =>
    requestArchivo(`/api/snapshots/${fecha}/validado-excel`, { archivo, token, ...opts }),

  // Catálogos (CRUD completo, usado por el panel de administrador)
  islas: crudEndpoints("/api/islas"),
  operarios: crudEndpoints("/api/operarios", { permitirEliminar: false }),
  administradores: crudEndpoints("/api/administradores", { permitirEliminar: false }),
  clientes: crudEndpoints("/api/clientes"),
  productosGranel: crudEndpoints("/api/productos-granel"),
  productosUnidad: crudEndpoints("/api/productos-unidad"),
  mangueras: crudEndpoints("/api/mangueras"),
  bodegas: crudEndpoints("/api/bodegas"),
  tiposTransaccion: crudEndpoints("/api/tipos-transaccion"),
  tareas: crudEndpoints("/api/tareas"),

  // Tareas del turno (operario)
  tareasActivas: (token, opts) => request("/api/registros-tareas/activo", { token, ...opts }),
  tareasPorTurno: (token, turnoId, opts) =>
    request(`/api/registros-tareas/turno/${encodeURIComponent(turnoId)}`, { token, ...opts }),
  marcarTareaRealizada: (token, tareaId, realizada) =>
    request(`/api/registros-tareas/${tareaId}/realizacion`, { method: "PATCH", token, body: { realizada } }),
  marcarTareaRevisada: (token, tareaId, turnoId, revisada) =>
    request(`/api/registros-tareas/${tareaId}/revision`, { method: "PATCH", token, body: { turno: turnoId, revisada } }),

  // Alias de solo lectura usados también desde el panel de operario
  listarMangueras: (token, opts) => request("/api/mangueras/", { token, ...opts }),
  listarManguerasPorIsla: (token, isla, opts) =>
    request(`/api/mangueras/?isla=${isla}`, { token, ...opts }),
  listarProductosGranel: (token, opts) => request("/api/productos-granel/", { token, ...opts }),
  listarProductosUnidad: (token, tipo, opts) =>
    request(`/api/productos-unidad/${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ""}`, { token, ...opts }),
  listarClientes: (token, opts) => request("/api/clientes/", { token, ...opts }),
  listarIslas: (token, opts) => request("/api/islas/", { token, ...opts }),

  // Estado de cuenta de clientes (balance + deuda permitida + abonos)
  listarEstadosCuenta: (token, opts) => request("/api/estados-cuenta/", { token, ...opts }),
  obtenerEstadoCuenta: (token, clienteId, opts) =>
    request(`/api/estados-cuenta/${encodeURIComponent(clienteId)}`, { token, ...opts }),
  actualizarDeudaPermitida: (token, clienteId, deudaPermitida, opts) =>
    request(`/api/estados-cuenta/${encodeURIComponent(clienteId)}/deuda-permitida`, {
      method: "PUT",
      token,
      body: { deuda_permitida: deudaPermitida },
      ...opts,
    }),
  listarAbonos: (token, clienteId, opts) =>
    request(`/api/estados-cuenta/${encodeURIComponent(clienteId)}/abonos`, { token, ...opts }),
  crearAbono: (token, clienteId, datos, opts) =>
    request(`/api/estados-cuenta/${encodeURIComponent(clienteId)}/abonos`, {
      method: "POST",
      token,
      body: datos,
      ...opts,
    }),
  anularAbono: (token, abonoId, opts) =>
    request(`/api/estados-cuenta/abonos/${encodeURIComponent(abonoId)}`, {
      method: "DELETE",
      token,
      ...opts,
    }),


  // Alertas
  listarAlertas: (token, opts) => request("/api/alertas/", { token, ...opts }),
  crearAlerta: (token, datos, opts) =>
    request("/api/alertas/", { method: "POST", token, body: datos, ...opts }),
  atenderAlerta: (token, alertaId, estado, comentarios, opts) =>
    request(`/api/alertas/${encodeURIComponent(alertaId)}/atender`, {
      method: "PUT",
      token,
      body: { estado, comentarios },
      ...opts,
    }),
  listarPermisosAlertas: (token, opts) =>
    request("/api/alertas/permisos", { token, ...opts }),
  guardarPermisoAlerta: (token, tipo, datos, opts) =>
    request(`/api/alertas/permisos/${encodeURIComponent(tipo)}`, {
      method: "PUT",
      token,
      body: datos,
      ...opts,
    }),

  // Usuarios del sistema (solo superadmin para gestión; autoservicio para cambiar mi contraseña)
  listarUsuarios: (token, opts) => request("/api/usuarios/", { token, ...opts }),
  crearUsuario: (token, datos, opts) =>
    request("/api/usuarios/", { method: "POST", token, body: datos, ...opts }),
  actualizarUsuario: (token, id, datos, opts) =>
    request(`/api/usuarios/${id}`, { method: "PUT", token, body: datos, ...opts }),
  resetearPassword: (token, id, password, opts) =>
    request(`/api/usuarios/${id}/password`, {
      method: "POST",
      token,
      body: { password },
      ...opts,
    }),
  cambiarMiPassword: (token, passwordActual, passwordNueva, opts) =>
    request("/api/usuarios/me/cambiar-password", {
      method: "POST",
      token,
      body: { password_actual: passwordActual, password_nueva: passwordNueva },
      ...opts,
    }),
};

export { ApiError };
