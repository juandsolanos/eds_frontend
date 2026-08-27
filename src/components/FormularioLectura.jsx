import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const nfMiles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

function formatMiles(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  const num = typeof valor === "string" ? Number(valor.replace(/\./g, "").replace(",", ".")) : valor;
  if (isNaN(num)) return "";
  return nfMiles.format(num);
}

function parseMiles(texto) {
  const limpio = texto.replace(/\./g, "").replace(",", ".");
  return limpio;
}

function InputMiles({ value, onChange, step, required, id, ...rest }) {
  function handleChange(e) {
    const raw = parseMiles(e.target.value);
    if (raw === "" || raw === "-" || raw === "." || /^-?\d*\.?\d*$/.test(raw)) {
      onChange(raw);
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      step={step}
      value={formatMiles(value)}
      onChange={handleChange}
      required={required}
      {...rest}
    />
  );
}

export default function FormularioLectura({ mangueras, lecturas, onRegistrar, cargando }) {
  const { token } = useAuth();

  const [mangueraActiva, setMangueraActiva] = useState(null);
  const [lecturaInicial, setLecturaInicial] = useState("");
  const [lecturaFinal, setLecturaFinal] = useState("");
  const [foto, setFoto] = useState(null);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);

  const cancelarRef = useRef(null);

  const mangueraIdsLeidas = new Set((lecturas || []).map((l) => l.manguera_id));

  function seleccionarManguera(manguera) {
    setMangueraActiva(manguera.id);
    setLecturaInicial(String(manguera.ultima_lectura || 0));
    setLecturaFinal("");
    setFoto(null);
    setErrorFoto(null);
  }

  function cancelar() {
    setMangueraActiva(null);
    setLecturaInicial("");
    setLecturaFinal("");
    setFoto(null);
    setErrorFoto(null);
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
  }, [mangueraActiva]);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorFoto(null);

    setSubiendoFoto(true);
    let fotoUrl;
    try {
      const resultado = await api.subirFotoLectura(token, foto);
      fotoUrl = resultado.foto_url;
    } catch (err) {
      setErrorFoto(err.detail || "No se pudo subir la foto.");
      setSubiendoFoto(false);
      return;
    }
    setSubiendoFoto(false);

    const ok = await onRegistrar({
      manguera_id: mangueraActiva,
      lectura_inicial: Number(parseMiles(String(lecturaInicial))),
      lectura_final: Number(parseMiles(String(lecturaFinal))),
      foto_url: fotoUrl,
    });
    if (ok) cancelar();
  }

  const mangueraSeleccionada = mangueras.find((m) => m.id === mangueraActiva);

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
                        return lectura ? `${nfMiles.format(lectura.lectura_final - lectura.lectura_inicial)} gal` : null;
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {!leida && (
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
                  <label htmlFor="lectura_inicial">Lectura inicial (galones)</label>
                  <InputMiles
                    id="lectura_inicial"
                    step="0.01"
                    value={lecturaInicial}
                    onChange={() => {}}
                    readOnly
                    className="input--readonly"
                  />
                </div>
                <div className="field">
                  <label htmlFor="lectura_final">Lectura final (galones)</label>
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
                  <input
                    id="foto"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => setFoto(e.target.files[0] ?? null)}
                    required
                  />
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
                    {subiendoFoto ? "Subiendo foto..." : cargando ? "Registrando..." : "Registrar lectura"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
