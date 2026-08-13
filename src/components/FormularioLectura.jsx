import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function FormularioLectura({ mangueras, onRegistrar, cargando }) {
  const { token } = useAuth();

  const [manguera, setManguera] = useState("");
  const [tiempoInicial, setTiempoInicial] = useState("");
  const [tiempoFinal, setTiempoFinal] = useState("");
  const [lecturaInicial, setLecturaInicial] = useState("");
  const [lecturaFinal, setLecturaFinal] = useState("");
  const [foto, setFoto] = useState(null);
  const [texto, setTexto] = useState("");

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);

  function limpiar() {
    setManguera("");
    setTiempoInicial("");
    setTiempoFinal("");
    setLecturaInicial("");
    setLecturaFinal("");
    setFoto(null);
    setTexto("");
    setErrorFoto(null);
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorFoto(null);

    // La foto se sube primero (a Supabase Storage vía el backend) para
    // obtener su URL, y solo entonces se crea la lectura con esa URL.
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
      manguera_id: Number(manguera),
      tiempo_inicial: tiempoInicial,
      tiempo_final: tiempoFinal,
      lectura_inicial: Number(lecturaInicial),
      lectura_final: Number(lecturaFinal),
      foto_url: fotoUrl,
      texto,
    });
    if (ok) limpiar();
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="manguera">Manguera</label>
          <select id="manguera" value={manguera} onChange={(e) => setManguera(e.target.value)} required>
            <option value="">Selecciona...</option>
            {mangueras.map((m) => (
              <option key={m.id} value={m.id}>
                Manguera {m.id} — {m.codigo_combustible}
              </option>
            ))}
          </select>
        </div>

        <div />

        <div className="field">
          <label htmlFor="tiempo_inicial">Hora inicial</label>
          <input
            id="tiempo_inicial"
            type="datetime-local"
            value={tiempoInicial}
            onChange={(e) => setTiempoInicial(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="tiempo_final">Hora final</label>
          <input
            id="tiempo_final"
            type="datetime-local"
            value={tiempoFinal}
            onChange={(e) => setTiempoFinal(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="lectura_inicial">Lectura inicial (galones)</label>
          <input
            id="lectura_inicial"
            type="number"
            step="0.01"
            value={lecturaInicial}
            onChange={(e) => setLecturaInicial(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="lectura_final">Lectura final (galones)</label>
          <input
            id="lectura_final"
            type="number"
            step="0.01"
            value={lecturaFinal}
            onChange={(e) => setLecturaFinal(e.target.value)}
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
  );
}
