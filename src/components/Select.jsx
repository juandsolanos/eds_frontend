import { useState, useRef, useEffect } from "react";

function normalizarOpciones(opciones) {
  return (opciones || []).map((op) =>
    typeof op === "string" ? { value: op, label: op } : { value: String(op.value), label: String(op.label) }
  );
}

/**
 * Dropdown custom con dos acciones separadas (abrir la lista y elegir una
 * opción). La lista se ancla al borde inferior del control (top: 100%) y
 * nunca se solapa con él ni se abre hacia arriba, a diferencia del popup
 * nativo de <select>, cuyo renderizado controla el navegador/SO.
 *
 * Conserva un <select> nativo oculto sincronizado únicamente para que la
 * validación `required` del formulario y la semántica del control sigan
 * funcionando igual que antes (opacity 0 + pointer-events none, así que su
 * popup jamás se abre).
 *
 * onChange recibe el valor de la opción como string (igual que e.target.value
 * de un <select> nativo).
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = "Selecciona...",
  disabled = false,
  required = false,
  id,
  name,
  style,
  className = "",
}) {
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const raizRef = useRef(null);
  const listaRef = useRef(null);

  const opciones = normalizarOpciones(options);
  const seleccionada = opciones.find((o) => o.value === String(value));

  useEffect(() => {
    if (!abierto) return;
    function alClickFuera(e) {
      if (raizRef.current && !raizRef.current.contains(e.target)) setAbierto(false);
    }
    function alTecla(e) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", alClickFuera);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClickFuera);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !listaRef.current) return;
    listaRef.current.querySelector('[data-activa="true"]')?.scrollIntoView({ block: "nearest" });
  }, [abierto, activa]);

  function abrir() {
    if (disabled) return;
    const idx = opciones.findIndex((o) => o.value === String(value));
    setActiva(idx);
    setAbierto(true);
  }

  function elegir(opcion) {
    onChange(opcion.value);
    setAbierto(false);
  }

  function alternar() {
    if (abierto) setAbierto(false);
    else abrir();
  }

  function alTeclaEnControl(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (abierto) {
        const op = opciones[activa];
        if (op) elegir(op);
      } else {
        abrir();
      }
    } else if (abierto && e.key === "ArrowDown") {
      e.preventDefault();
      setActiva((a) => Math.min(opciones.length - 1, a === -1 ? 0 : a + 1));
    } else if (abierto && e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((a) => Math.max(0, a - 1));
    } else if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      abrir();
    }
  }

  return (
    <div ref={raizRef} className={`select ${className}`} style={style}>
      <button
        type="button"
        className="select__control"
        id={id}
        onClick={alternar}
        onKeyDown={alTeclaEnControl}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        <span className={`select__etiqueta ${seleccionada ? "" : "select__etiqueta--placeholder"}`}>
          {seleccionada ? seleccionada.label : placeholder}
        </span>
        <span className="select__chevron" aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <div className="select__lista" role="listbox" ref={listaRef}>
          {opciones.length === 0 ? (
            <div className="select__vacia">Sin opciones.</div>
          ) : (
            opciones.map((op, i) => (
              <div
                key={op.value}
                role="option"
                aria-selected={op.value === String(value)}
                data-activa={i === activa}
                className={`select__opcion ${i === activa ? "select__opcion--activa" : ""} ${
                  op.value === String(value) ? "select__opcion--seleccionada" : ""
                }`}
                onMouseEnter={() => setActiva(i)}
                onClick={() => elegir(op)}
              >
                {op.label}
              </div>
            ))
          )}
        </div>
      )}

      <div className="select__hueco">
        <select
          value={String(value ?? "")}
          onChange={() => {}}
          required={required}
          name={name}
          tabIndex={-1}
          aria-hidden="true"
        >
          <option value="">{placeholder}</option>
          {opciones.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}