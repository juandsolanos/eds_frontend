import { useEffect, useId, useRef } from "react";

const SELECTOR_FOCALIZABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// getClientRects() filtra los elementos ocultos; offsetParent no sirve aquí
// porque devuelve null en los que tienen position: fixed.
function focalizables(root) {
  return Array.from(root.querySelectorAll(SELECTOR_FOCALIZABLE)).filter(
    (el) => el.getClientRects().length > 0
  );
}

/**
 * Accesibilidad compartida por todos los modales, para no repetir la misma
 * lógica cinco veces:
 *
 * - Semántica de diálogo: role="dialog" + aria-modal, y el título del modal
 *   se asocia con aria-labelledby si el marcado trae data-titulo-modal.
 * - Foco inicial: al elemento con data-foco-inicial, o al primero focalizable.
 * - Escape para cerrar.
 * - Focus trap: con Tab el foco no puede salir del modal.
 * - Al cerrar, el foco vuelve al elemento que lo abrió.
 *
 * @param {boolean} abierto    si el modal está visible
 * @param {Function} onCerrar  se invoca con Escape o al restaurar foco
 * @param {string} etiqueta    nombre accesible si el modal no tiene título
 */
export function useModalA11y({ abierto, onCerrar, etiqueta }) {
  const refModal = useRef(null);
  const refCerrar = useRef(onCerrar);
  const refQuienAbrio = useRef(null);
  const idTitulo = useId();

  // El padre suele pasar onCerrar como arrow inline; guardarlo en un ref
  // evita que el efecto se reinicie (y con él, el foco) en cada render.
  refCerrar.current = onCerrar;

  useEffect(() => {
    const root = refModal.current;
    if (!root) return;

    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");

    const titulo = root.querySelector("[data-titulo-modal]");
    if (titulo) {
      if (!titulo.id) titulo.id = idTitulo;
      root.setAttribute("aria-labelledby", titulo.id);
    } else if (etiqueta) {
      root.setAttribute("aria-label", etiqueta);
    }
  }, [idTitulo, etiqueta]);

  useEffect(() => {
    if (!abierto) return undefined;
    const root = refModal.current;
    if (!root) return undefined;

    refQuienAbrio.current = document.activeElement;

    // El contenedor debe poder recibir foco si no hay nada focalizable
    // dentro, para que el lector de pantalla lo anuncie igual.
    if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");

    const objetivo = root.querySelector("[data-foco-inicial]") || focalizables(root)[0] || root;
    objetivo.focus();

    function manejarTecla(e) {
      if (e.key === "Escape") {
        refCerrar.current?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focalizables(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }

      const primero = items[0];
      const ultimo = items[items.length - 1];
      const activo = document.activeElement;

      if (e.shiftKey && (activo === primero || !root.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !root.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", manejarTecla);

    return () => {
      document.removeEventListener("keydown", manejarTecla);
      const quienAbrio = refQuienAbrio.current;
      if (quienAbrio && document.contains(quienAbrio)) quienAbrio.focus();
    };
  }, [abierto]);

  return refModal;
}