import { useState, useEffect, useRef } from "react";

export default function ConfirmModal({ open, mensaje, textoLabel, onConfirmar, onCancelar }) {
  const cancelarRef = useRef(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (open && cancelarRef.current) {
      cancelarRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open) setTexto("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function manejarTecla(e) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [open, onCancelar]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal__mensaje">{mensaje}</p>

        {textoLabel && (
          <div className="field" style={{ marginBottom: "var(--spacing-4)" }}>
            <label htmlFor="modal-texto">{textoLabel}</label>
            <input
              id="modal-texto"
              type="text"
              placeholder="Opcional..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
        )}

        <div className="modal__acciones">
          <button ref={cancelarRef} className="btn btn--ghost" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn btn--danger" onClick={() => onConfirmar(texto)}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
