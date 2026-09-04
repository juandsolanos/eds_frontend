const nfMiles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

function formatMiles(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  const num = typeof valor === "string" ? Number(valor.replace(/\./g, "").replace(",", ".")) : valor;
  if (isNaN(num)) return "";
  return nfMiles.format(num);
}

export function parseMiles(texto) {
  const limpio = texto.replace(/\./g, "").replace(",", ".");
  return limpio;
}

export default function InputMiles({ value, onChange, step, required, id, ...rest }) {
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
