import { useState, useEffect, useId } from "react";
import { useModalA11y } from "../hooks/useModalA11y";

export default function ConfirmModal({ open, mensaje, textoLabel, onConfirmar, onCancelar }) {
  const [texto, setTexto] = useState("");
  const idTexto = useId();
  const refModal = useModalA11y({ abierto: open, onCerrar: onCancelar, etiqueta: "Confirmar acción" });

  useEffect(() => {
    if (open) setTexto("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div ref={refModal} className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal__mensaje" data-titulo-modal>
          {mensaje}
        </p>

        {textoLabel && (
          <div className="field" style={{ marginBottom: "var(--spacing-4)" }}>
            <label htmlFor={idTexto}>{textoLabel}</label>
            <input
              id={idTexto}
              type="text"
              placeholder="Opcional..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
        )}

        <div className="modal__acciones">
          <button type="button" data-foco-inicial className="btn btn--ghost" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onConfirmar(texto)}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
