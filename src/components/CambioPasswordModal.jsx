import { useState, useEffect, useRef } from "react";

/**
 * Modal para cambiar/establecer una contraseña.
 *
 * - requiereActual=true  -> autoservicio: pide la contraseña actual.
 * - requiereActual=false -> reseteo por superadmin: solo pide la nueva.
 *
 * onGuardar(actual, nueva) debe devolver una Promesa; si falla, muestra
 * err.detail dentro del modal.
 */
export default function CambioPasswordModal({
  open,
  titulo = "Cambiar contraseña",
  requiereActual = false,
  onCerrar,
  onGuardar,
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const primeraRef = useRef(null);

  useEffect(() => {
    if (open) {
      setActual("");
      setNueva("");
      setConfirmacion("");
      setError(null);
      primeraRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function manejarTecla(e) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [open, onCerrar]);

  if (!open) return null;

  async function manejarSubmit(e) {
    e.preventDefault();
    if (nueva.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nueva !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await onGuardar(actual, nueva);
      onCerrar();
    } catch (err) {
      setError(err.detail || "No se pudo cambiar la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal--form" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">{titulo}</h3>
          <button className="modal__close" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={manejarSubmit}>
          {requiereActual && (
            <div className="field">
              <label htmlFor="pass-actual">Contraseña actual</label>
              <input
                id="pass-actual"
                ref={primeraRef}
                type="password"
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="pass-nueva">Contraseña nueva</label>
            <input
              id="pass-nueva"
              ref={requiereActual ? undefined : primeraRef}
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="field">
            <label htmlFor="pass-confirmar">Confirmar contraseña</label>
            <input
              id="pass-confirmar"
              type="password"
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="modal__acciones">
            <button type="button" className="btn btn--ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={cargando}>
              {cargando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}