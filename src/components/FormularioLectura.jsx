import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import InputMiles, { parseMiles } from "./InputMiles";
import CamaraCaptura from "./CamaraCaptura";
import { unidadGranel } from "../utils/format";

const nfMiles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export default function FormularioLectura({
  mangueras,
  lecturas,
  onRegistrar,
  cargando,
  productosGranel = [],
  inicial = null,
  onActualizar = null,
  onCancelarEditar = null,
}) {
  const { token } = useAuth();
  const esEdicion = Boolean(inicial);

  const [mangueraActiva, setMangueraActiva] = useState(null);
  const [lecturaInicial, setLecturaInicial] = useState("");
  const [lecturaFinal, setLecturaFinal] = useState("");
  const [foto, setFoto] = useState(null);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const cancelarRef = useRef(null);

  const mangueraIdsLeidas = new Set((lecturas || []).map((l) => l.manguera_id));

  useEffect(() => {
    if (inicial) {
      setMangueraActiva(inicial.manguera_id);
      setLecturaInicial(String(inicial.lectura_inicial));
      setLecturaFinal(String(inicial.lectura_final));
      setFoto(null);
      setPreviewUrl(null);
      setErrorFoto(null);
      setCamaraAbierta(false);
    } else {
      setMangueraActiva(null);
      setLecturaInicial("");
      setLecturaFinal("");
      setFoto(null);
      setPreviewUrl(null);
      setErrorFoto(null);
      setCamaraAbierta(false);
    }
  }, [inicial]);

  function seleccionarManguera(manguera) {
    setMangueraActiva(manguera.id);
    setLecturaInicial(String(manguera.ultima_lectura || 0));
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
    setMangueraActiva(null);
    setLecturaInicial("");
    setLecturaFinal("");
    setFoto(null);
    setPreviewUrl(null);
    setErrorFoto(null);
    setCamaraAbierta(false);
  }

  useEffect(() => {
    if (mangueraActiva && cancelarRef.current) {
      cancelarRef.current.focus();
    }
  }, [mangueraActiva]);

  useEffect(() => {
    if (!mangueraActiva) return;
    function manejarTecla(e) {
      if (e.key === "Escape") cancelar();
    }
    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [mangueraActiva, esEdicion]);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorFoto(null);

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
      manguera_id: mangueraActiva,
      lectura_inicial: Number(parseMiles(String(lecturaInicial))),
      lectura_final: Number(parseMiles(String(lecturaFinal))),
      foto_url: fotoUrl,
    };

    if (esEdicion) {
      const ok = await onActualizar(datos);
      if (ok) onCancelarEditar?.();
      return;
    }

    const ok = await onRegistrar(datos);
    if (ok) cancelar();
  }

  const mangueraSeleccionada = mangueras.find((m) => m.id === mangueraActiva);

  function unidadDeManguera(manguera) {
    const producto = (productosGranel || []).find((p) => p.codigo === String(manguera.codigo_combustible));
    return unidadGranel(producto?.unidad);
  }

  return (
    <div>
      <div className="manguera-list">
        {mangueras.map((m) => {
          const leida = mangueraIdsLeidas.has(m.id);

          return (
            <div
              key={m.id}
              className={`manguera-item ${leida ? "manguera-item--leida" : ""}`}
            >
              <div className="manguera-item__info">
                <span className={`manguera-item__badge ${leida ? "manguera-item__badge--ok" : "manguera-item__badge--pend"}`}>
                  {leida ? "\u2713" : "\u25CB"}
                </span>
                <div>
                  <div className="manguera-item__nombre">
                    Manguera {m.id} &mdash; {m.nombre_combustible || m.codigo_combustible}
                  </div>
                  {leida && (
                    <div className="manguera-item__resumen">
                      {(() => {
                        const lectura = lecturas.find((l) => l.manguera_id === m.id);
                        return lectura
                          ? `${nfMiles.format(lectura.lectura_final - lectura.lectura_inicial)} ${unidadDeManguera(m).corto}`
                          : null;
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {!leida && !esEdicion && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => seleccionarManguera(m)}
                  disabled={cargando || subiendoFoto}
                >
                  Tomar lectura
                </button>
              )}
            </div>
          );
        })}
        {mangueras.length === 0 && (
          <div className="empty-state">No hay mangueras configuradas para esta isla.</div>
        )}
      </div>

      {mangueraActiva && mangueraSeleccionada && (
        <div className="modal-overlay" onClick={cancelar}>
          <div className="modal modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">
                {esEdicion ? "Editar lectura — " : ""}
                Manguera {mangueraSeleccionada.id} &mdash; {mangueraSeleccionada.nombre_combustible || mangueraSeleccionada.codigo_combustible}
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
                  <label htmlFor="lectura_inicial">Lectura inicial ({unidadDeManguera(mangueraSeleccionada).nombre.toLowerCase()})</label>
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
                  <label htmlFor="lectura_final">Lectura final ({unidadDeManguera(mangueraSeleccionada).nombre.toLowerCase()})</label>
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
                    <div className="alert alert--error">{errorFoto}</div>
                  </div>
                )}

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
          setPreviewUrl(URL.createObjectURL(archivo));
          setErrorFoto(null);
        }}
        onCerrar={() => setCamaraAbierta(false)}
      />
    </div>
  );
}