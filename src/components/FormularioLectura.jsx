import { useState, useEffect } from "react";
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

function toLocalDatetime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ahoraLocalDatetime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FormularioLectura({ mangueras, lecturas, lecturasCierre, onRegistrar, cargando }) {
  const { token } = useAuth();

  const [mangueraActiva, setMangueraActiva] = useState(null);
  const [tiempoInicial, setTiempoInicial] = useState("");
  const [tiempoFinal, setTiempoFinal] = useState("");
  const [lecturaInicial, setLecturaInicial] = useState("");
  const [lecturaFinal, setLecturaFinal] = useState("");
  const [foto, setFoto] = useState(null);
  const [texto, setTexto] = useState("");

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);

  const mangueraIdsLeidas = new Set((lecturas || []).map((l) => l.manguera_id));

  function seleccionarManguera(mangueraId) {
    setMangueraActiva(mangueraId);
    setLecturaInicial("");
    setLecturaFinal("");
    setFoto(null);
    setTexto("");
    setErrorFoto(null);

    const cierre = (lecturasCierre || []).find((c) => c.manguera_id === mangueraId);
    setTiempoInicial(cierre?.tiempo_final ? toLocalDatetime(cierre.tiempo_final) : "");
    setTiempoFinal(ahoraLocalDatetime());
  }

  function cancelar() {
    setMangueraActiva(null);
    setTiempoInicial("");
    setTiempoFinal("");
    setLecturaInicial("");
    setLecturaFinal("");
    setFoto(null);
    setTexto("");
    setErrorFoto(null);
  }

  useEffect(() => {
    if (mangueraActiva) {
      setTiempoFinal(ahoraLocalDatetime());
    }
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
      tiempo_inicial: tiempoInicial,
      tiempo_final: tiempoFinal,
      lectura_inicial: Number(parseMiles(String(lecturaInicial))),
      lectura_final: Number(parseMiles(String(lecturaFinal))),
      foto_url: fotoUrl,
      texto,
    });
    if (ok) cancelar();
  }

  const mangueraSeleccionada = mangueras.find((m) => m.id === mangueraActiva);

  return (
    <div>
      <div className="manguera-list">
        {mangueras.map((m) => {
          const leida = mangueraIdsLeidas.has(m.id);
          const activa = mangueraActiva === m.id;
          const lectura = leida ? lecturas.find((l) => l.manguera_id === m.id) : null;

          return (
            <div
              key={m.id}
              className={`manguera-item ${leida ? "manguera-item--leida" : ""} ${activa ? "manguera-item--activa" : ""}`}
            >
              <div className="manguera-item__info">
                <span className={`manguera-item__badge ${leida ? "manguera-item__badge--ok" : "manguera-item__badge--pend"}`}>
                  {leida ? "\u2713" : "\u25CB"}
                </span>
                <div>
                  <div className="manguera-item__nombre">
                    Manguera {m.id} &mdash; {m.nombre_combustible || m.codigo_combustible}
                  </div>
                  {leida && lectura && (
                    <div className="manguera-item__resumen">
                      {nfMiles.format(lectura.lectura_final - lectura.lectura_inicial)} gal
                    </div>
                  )}
                </div>
              </div>
              {!leida && !activa && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => seleccionarManguera(m.id)}
                  disabled={cargando || subiendoFoto}
                >
                  Tomar lectura
                </button>
              )}
              {activa && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={cancelar}
                  disabled={cargando || subiendoFoto}
                >
                  Cancelar
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
        <form onSubmit={manejarSubmit} style={{ marginTop: "var(--spacing-4)" }}>
          <div className="form-grid">
            <div className="field field--full">
              <label>Manguera seleccionada</label>
              <div className="manguera-seleccionada">
                Manguera {mangueraSeleccionada.id} &mdash; {mangueraSeleccionada.nombre_combustible || mangueraSeleccionada.codigo_combustible}
              </div>
            </div>

            <div className="field">
              <label htmlFor="tiempo_inicial">Hora inicial</label>
              <input
                id="tiempo_inicial"
                type="datetime-local"
                value={tiempoInicial}
                readOnly
                className="input--readonly"
              />
            </div>
            <div className="field">
              <label htmlFor="tiempo_final">Hora final</label>
              <input
                id="tiempo_final"
                type="datetime-local"
                value={tiempoFinal}
                readOnly
                className="input--readonly"
              />
            </div>

            <div className="field">
              <label htmlFor="lectura_inicial">Lectura inicial (galones)</label>
              <InputMiles
                id="lectura_inicial"
                step="0.01"
                value={lecturaInicial}
                onChange={setLecturaInicial}
                required
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

            <div className="field field--full">
              <label htmlFor="texto">Notas / observaciones</label>
              <input
                id="texto"
                type="text"
                placeholder="Ej. medidor funcionando normal, sin novedades"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                required
              />
            </div>

            {errorFoto && (
              <div className="field field--full">
                <div className="alert alert--error">{errorFoto}</div>
              </div>
            )}

            <div className="field field--full">
              <button type="submit" className="btn btn--primary" disabled={cargando || subiendoFoto}>
                {subiendoFoto ? "Subiendo foto..." : cargando ? "Registrando..." : "Registrar lectura"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
