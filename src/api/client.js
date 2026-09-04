// Cliente HTTP simple, sin librerías externas (fetch nativo es suficiente
// para lo que necesitamos): agrega el header de autenticación si hay
// token, y centraliza el manejo de errores para que cada componente no
// tenga que repetir la lógica de "revisar response.ok".

const API_URL = import.meta.env.VITE_API_URL || "https://localhost:8000";

let onUnauthorized = null;

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = "GET", body, token, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // 204 No Content no trae body que parsear
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const detail = data?.detail || "Ocurrió un error inesperado.";
    throw new ApiError(response.status, detail);
  }

  return data;
}

// Para subir archivos usamos FormData en vez de JSON — el navegador arma
// el Content-Type (multipart/form-data con boundary) automáticamente,
// por eso NO seteamos el header manualmente aquí, a diferencia de `request`.
async function requestArchivo(path, { archivo, token, signal }) {
  const formData = new FormData();
  formData.append("archivo", archivo);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError(response.status, data?.detail || "Ocurrió un error inesperado.");
  }

  return data;
}

// Helper para los catálogos: todos siguen el mismo patrón REST
// (GET /, GET /{id}, POST /, PUT /{id}, DELETE /{id}), así que en vez de
// repetir 5 funciones casi idénticas por catálogo, generamos las llamadas
// a partir de la ruta base. La función `request` de arriba sigue siendo
// donde vive toda la lógica real (headers, errores); esto solo evita
// repetir la construcción de la URL.
function crudEndpoints(basePath) {
  return {
    listar: (token, opts) => request(`${basePath}/`, { token, ...opts }),
    obtener: (token, id, opts) => request(`${basePath}/${encodeURIComponent(id)}`, { token, ...opts }),
    crear: (token, datos, opts) => request(`${basePath}/`, { method: "POST", token, body: datos, ...opts }),
    actualizar: (token, id, datos, opts) =>
      request(`${basePath}/${encodeURIComponent(id)}`, { method: "PUT", token, body: datos, ...opts }),
    eliminar: (token, id, opts) =>
      request(`${basePath}/${encodeURIComponent(id)}`, { method: "DELETE", token, ...opts }),
  };
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: { username, password } }),

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
  listarLecturas: (token, turnoId, opts) =>
    request(`/api/lecturas-mangueras/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),
  listarLecturasPorTurno: (token, turnoId, opts) =>
    request(`/api/lecturas-mangueras/turno/${encodeURIComponent(turnoId)}`, { token, ...opts }),

  crearVenta: (token, datos) =>
    request("/api/productos-unidad-ventas/", { method: "POST", token, body: datos }),
  listarVentas: (token, turnoId, opts) =>
    request(`/api/productos-unidad-ventas/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),

  crearVentaGranel: (token, datos) =>
    request("/api/ventas-granel/", { method: "POST", token, body: datos }),
  listarVentasGranel: (token, turnoId, opts) =>
    request(`/api/ventas-granel/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),

  crearTransaccion: (token, datos) =>
    request("/api/transacciones-financieras/", { method: "POST", token, body: datos }),
  listarTransacciones: (token, turnoId, opts) =>
    request(`/api/transacciones-financieras/?turno_id=${encodeURIComponent(turnoId)}`, { token, ...opts }),

  listarMovimientos: (token, opts) => request("/api/productos-unidad-movimientos/", { token, ...opts }),
  crearMovimiento: (token, datos) =>
    request("/api/productos-unidad-movimientos/", { method: "POST", token, body: datos }),

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

  // Catálogos (CRUD completo, usado por el panel de administrador)
  islas: crudEndpoints("/api/islas"),
  operarios: crudEndpoints("/api/operarios"),
  administradores: crudEndpoints("/api/administradores"),
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
};

export { ApiError };
