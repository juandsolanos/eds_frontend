const estiloCampo = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--spacing-3)",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

const estiloHora = {
  ...estiloCampo,
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
};

const HORAS = Array.from({ length: 24 }, (_, n) => String(n).padStart(2, "0"));
const MINUTOS = Array.from({ length: 60 }, (_, n) => String(n).padStart(2, "0"));

export default function SelectorHora24({
  value = "",
  onChange,
  required,
  disabled,
  id,
}) {
  const [hora = "", minuto = ""] = value ? value.split(":") : [];

  function cambiarHora(e) {
    const nuevaHora = e.target.value;
    if (!nuevaHora) {
      onChange("");
      return;
    }
    onChange(`${nuevaHora}:${minuto || "00"}`);
  }

  function cambiarMinuto(e) {
    const nuevoMinuto = e.target.value;
    if (!nuevoMinuto) {
      onChange("");
      return;
    }
    onChange(`${hora || "00"}:${nuevoMinuto}`);
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-2)",
      }}
    >
      <select
        id={id}
        aria-label="Hora (24 horas)"
        value={hora}
        onChange={cambiarHora}
        required={required}
        disabled={disabled}
        style={{ ...estiloHora, minWidth: 72 }}
      >
        <option value="">HH</option>
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
      >
        :
      </span>
      <select
        aria-label="Minutos"
        value={minuto}
        onChange={cambiarMinuto}
        required={required}
        disabled={disabled}
        style={{ ...estiloHora, minWidth: 72 }}
      >
        <option value="">MM</option>
        {MINUTOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SelectorFechaHora24({
  value = "",
  onChange,
  required,
  disabled,
  id,
}) {
  const [fecha = "", hora = ""] = value ? value.split("T") : [];

  function cambiarFecha(e) {
    const nuevaFecha = e.target.value;
    if (!nuevaFecha) {
      onChange("");
      return;
    }
    onChange(`${nuevaFecha}T${hora || "00:00"}`);
  }

  function cambiarHora(nuevaHora) {
    if (!nuevaHora) {
      onChange(fecha ? `${fecha}T` : "");
      return;
    }
    onChange(`${fecha}T${nuevaHora}`);
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-2)",
        flexWrap: "wrap",
      }}
    >
      <input
        id={id}
        type="date"
        value={fecha}
        onChange={cambiarFecha}
        required={required}
        disabled={disabled}
        style={estiloCampo}
      />
      <SelectorHora24
        value={hora}
        onChange={cambiarHora}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
