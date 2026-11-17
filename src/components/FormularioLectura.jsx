import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import InputMiles, { parseMiles } from "./InputMiles";
import CamaraCaptura from "./CamaraCaptura";
import { unidadGranel } from "../utils/format";

const nfMiles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

function claveDeLectura(lectura) {
  if (lectura?.tipo === "combustible") return `combustible:${lectura.codigo_combustible}`;
  return `manguera:${lectura?.manguera_id}`;
}

export default function FormularioLectura({
  mangueras = [],
  combustibles = [],
  lecturas = [],
  onRegistrar,
  cargando,
  productosGranel = [],
  inicial = null,
  onActualizar = null,
  onCancelarEditar = null,
}) {
  const { token } = useAuth();
  const esEdicion = Boolean(inicial);

  const [medidorActivo, setMedidorActivo] = useState(null);
  const [lecturaInicial, setLecturaInicial] = useState("");
  const [lecturaFinal, setLecturaFinal] = useState("");
  const [foto, setFoto] = useState(null);
  const [comentarios, setComentarios] = useState("");

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewUrlRef = useRef(null);

  const cancelarRef = useRef(null);

  function fijarPreviewUrl(url) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const grupos = [];
  const codigosConModo = new Set();
  (combustibles || []).forEach((combustible) => {
    const codigo = String(combustible.codigo_combustible);
    codigosConModo.add(codigo);
    if (combustible.modo_lectura === "combustible") {
      grupos.push({
        codigo,
        nombre: combustible.nombre_combustible || codigo,
        opciones: [
          {
            clave: `combustible:${codigo}`,
            tipo: "combustible",
            valor: combustible.codigo_combustible,
            codigo_combustible: combustible.codigo_combustible,
            nombre: combustible.nombre_combustible || combustible.codigo_combustible,
            unidad: combustible.unidad,
            ultima_lectura: combustible.ultima_lectura,
          },
        ],
      });
      return;
    }
    const opciones = (mangueras || [])
      .filter((m) => String(m.codigo_combustible) === codigo)
      .map((m) => ({
        clave: `manguera:${m.id}`,
        tipo: "manguera",
        valor: m.id,
        codigo_combustible: m.codigo_combustible,
        nombre: m.nombre_combustible || combustible.nombre_combustible || m.codigo_combustible,
        unidad: combustible.unidad,
        ultima_lectura: m.ultima_lectura,
      }));
    if (opciones.length > 0) {
      grupos.push({
        codigo,
        nombre: combustible.nombre_combustible || codigo,
        opciones,
      });
    }
  });
  (mangueras || []).forEach((m) => {
    const codigo = String(m.codigo_combustible);
    if (codigosConModo.has(codigo)) return;
    const opcion = {
      clave: `manguera:${m.id}`,
      tipo: "manguera",
      valor: m.id,
      codigo_combustible: m.codigo_combustible,
      nombre: m.nombre_combustible || codigo,
      ultima_lectura: m.ultima_lectura,
    };
    const grupo = grupos.find((g) => g.codigo === codigo);
    if (grupo) grupo.opciones.push(opcion);
    else grupos.push({ codigo, nombre: m.nombre_combustible || codigo, opciones: [opcion] });
  });

  const opciones = grupos.flatMap((grupo) => grupo.opciones);
  const lecturasPorClave = new Map((lecturas || []).map((l) => [claveDeLectura(l), l]));
  const opcionSeleccionada = opciones.find((o) => o.clave === medidorActivo);

  useEffect(() => {
    if (inicial) {
      setMedidorActivo(claveDeLectura(inicial));
      setLecturaInicial(String(inicial.lectura_inicial));
      setLecturaFinal(String(inicial.lectura_final));
      setComentarios("");
      setFoto(null);
      setPreviewUrl(null);
      setErrorFoto(null);
      setCamaraAbierta(false);
    } else {
      setMedidorActivo(null);
      setLecturaInicial("");
      setLecturaFinal("");
      setComentarios("");
      setFoto(null);
      setPreviewUrl(null);
      setErrorFoto(null);
      setCamaraAbierta(false);
    }
  }, [inicial]);

  function seleccionarOpcion(opcion) {
    setMedidorActivo(opcion.clave);
    setLecturaInicial(String(opcion.ultima_lectura || 0));
    setLecturaFinal("");
    setFoto(null);
    setPreviewUrl(null);
    setErrorFoto(null);
  }

  function cancelar() {
    if (esEdicion) {
      onCancelarEditar?.();
      return;
    }
    setMedidorActivo(null);
    setLecturaInicial("");
    setLecturaFinal("");
    setComentarios("");
    setFoto(null);
    setPreviewUrl(null);
    setErrorFoto(null);
    setCamaraAbierta(false);
  }

  useEffect(() => {
    if (medidorActivo && cancelarRef.current) {
      cancelarRef.current.focus();
    }
  }, [medidorActivo]);

  useEffect(() => {
    if (!medidorActivo) return;
    function manejarTecla(e) {
      if (e.key === "Escape") cancelar();
    }
    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [medidorActivo, esEdicion]);

  function unidadDeOpcion(opcion) {
    const producto = (productosGranel || []).find(
      (p) => String(p.codigo) === String(opcion.codigo_combustible)
    );
    return unidadGranel(opcion.unidad || producto?.unidad);
  }

  function etiquetaOpcion(opcion) {
    if (opcion.tipo === "combustible") {
      return `Combustible ${opcion.codigo_combustible} — ${opcion.nombre}`;
    }
    return `Manguera ${opcion.valor} — ${opcion.nombre}`;
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorFoto(null);

    if (!opcionSeleccionada) return;

    if (!esEdicion && !foto) {
      setErrorFoto("Debes tomar una foto del medidor con la cámara como evidencia.");
      return;
    }

    let fotoUrl = esEdicion ? inicial.foto_url || "" : "";

    if (foto) {
      setSubiendoFoto(true);
      try {
        const resultado = await api.subirFotoLectura(token, foto);
        fotoUrl = resultado.foto_url;
      } catch (err) {
        setErrorFoto(err.detail || "No se pudo subir la foto.");
        setSubiendoFoto(false);
        return;
      }
      setSubiendoFoto(false);
    }

    const datos = {
      lectura_inicial: Number(parseMiles(String(lecturaInicial))),
      lectura_final: Number(parseMiles(String(lecturaFinal))),
      foto_url: fotoUrl,
      comentarios: comentarios.trim() ? comentarios.trim() : null,
    };

    if (opcionSeleccionada.tipo === "combustible") {
      datos.codigo_combustible = opcionSeleccionada.valor;
    } else {
      datos.manguera_id = opcionSeleccionada.valor;
    }

    if (esEdicion) {
      const ok = await onActualizar(datos);
      if (ok) onCancelarEditar?.();
      return;
    }

    const ok = await onRegistrar(datos);
    if (ok) cancelar();
  }

  return (
    <div>
      <div className="manguera-list">
        {grupos.map((grupo) => (
          <div key={grupo.codigo} style={{ marginBottom: "var(--spacing-4)" }}>
            <div
              className="manguera-item__nombre"
              style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "var(--spacing-2)" }}
            >
              {grupo.nombre} ({grupo.codigo})
            </div>
            {grupo.opciones.map((opcion) => {
              const leida = lecturasPorClave.has(opcion.clave);
              const lectura = lecturasPorClave.get(opcion.clave);

              return (
                <div
                  key={opcion.clave}
                  className={`manguera-item ${leida ? "manguera-item--leida" : ""}`}
                >
                  <div className="manguera-item__info">
                    <span className={`manguera-item__badge ${leida ? "manguera-item__badge--ok" : "manguera-item__badge--pend"}`}>
                      {leida ? "\u2713" : "\u25CB"}
                    </span>
                    <div>
                      <div className="manguera-item__nombre">{etiquetaOpcion(opcion)}</div>
                      {leida && lectura && (
                        <div className="manguera-item__resumen">
                          {`${nfMiles.format(lectura.lectura_final - lectura.lectura_inicial)} ${unidadDeOpcion(opcion).corto}`}
                        </div>
                      )}
                    </div>
                  </div>
                  {!leida && !esEdicion && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => seleccionarOpcion(opcion)}
                      disabled={cargando || subiendoFoto}
                    >
                      Tomar lectura
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {opciones.length === 0 && (
          <div className="empty-state">No hay medidores configurados para esta isla.</div>
        )}
      </div>

      {medidorActivo && opcionSeleccionada && (
        <div className="modal-overlay" onClick={cancelar}>
          <div className="modal modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">
                {esEdicion ? "Editar lectura — " : ""}
                {etiquetaOpcion(opcionSeleccionada)}
              </h3>
              <button
                ref={cancelarRef}
                className="modal__close"
                onClick={cancelar}
                disabled={cargando || subiendoFoto}
                type="button"
              >
                &times;
              </button>
            </div>

            <form onSubmit={manejarSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="lectura_inicial">Lectura inicial ({unidadDeOpcion(opcionSeleccionada).nombre.toLowerCase()})</label>
                  <InputMiles
                    id="lectura_inicial"
                    step="0.01"
                    value={lecturaInicial}
                    onChange={setLecturaInicial}
                    required
                    className={esEdicion ? "" : "input--readonly"}
                    readOnly={!esEdicion}
                  />
                </div>
                <div className="field">
                  <label htmlFor="lectura_final">Lectura final ({unidadDeOpcion(opcionSeleccionada).nombre.toLowerCase()})</label>
                  <InputMiles
                    id="lectura_final"
                    step="0.01"
                    value={lecturaFinal}
                    onChange={setLecturaFinal}
                    required
                  />
                </div>

                <div className="field field--full">
                  <label htmlFor="foto">Foto del medidor (evidencia)</label>
                  {foto && previewUrl ? (
                    <div className="foto-evidencia">
                      <img src={previewUrl} className="foto-preview" alt="Evidencia capturada" />
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setCamaraAbierta(true)}
                        disabled={subiendoFoto}
                      >
                        Retomar foto
                      </button>
                    </div>
                  ) : esEdicion && inicial.foto_url ? (
                    <div className="foto-evidencia">
                      <img src={inicial.foto_url} className="foto-preview" alt="Evidencia actual" />
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setCamaraAbierta(true)}
                        disabled={subiendoFoto}
                      >
                        Cambiar foto
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => setCamaraAbierta(true)}
                      disabled={subiendoFoto}
                    >
                      Abrir cámara para tomar foto
                    </button>
                  )}
                </div>

                {errorFoto && (
                  <div className="field field--full">
                    <div className="alert alert--error" role="alert">{errorFoto}</div>
                  </div>
                )}

                <div className="field field--full">
                  <label htmlFor="comentarios">Comentarios (opcional)</label>
                  <textarea
                    id="comentarios"
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    rows={2}
                    placeholder="Opcional: quedará en la trazabilidad..."
                  />
                </div>

                <div className="field field--full modal__acciones">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={cancelar}
                    disabled={cargando || subiendoFoto}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={cargando || subiendoFoto}>
                    {subiendoFoto
                      ? "Subiendo foto..."
                      : esEdicion
                        ? cargando
                          ? "Guardando..."
                          : "Guardar cambios"
                        : cargando
                          ? "Registrando..."
                          : "Registrar lectura"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <CamaraCaptura
        abierta={camaraAbierta}
        onCapturar={(archivo) => {
          setFoto(archivo);
          fijarPreviewUrl(URL.createObjectURL(archivo));
          setErrorFoto(null);
        }}
        onCerrar={() => setCamaraAbierta(false)}
      />
    </div>
  );
}
