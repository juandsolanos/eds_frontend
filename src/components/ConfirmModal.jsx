import { useEffect, useRef } from "react";

export default function ConfirmModal({ open, mensaje, onConfirmar, onCancelar }) {
  const cancelarRef = useRef(null);

  useEffect(() => {
    if (open && cancelarRef.current) {
      cancelarRef.current.focus();
    }
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
        <div className="modal__acciones">
          <button ref={cancelarRef} className="btn btn--ghost" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn btn--danger" onClick={onConfirmar}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
