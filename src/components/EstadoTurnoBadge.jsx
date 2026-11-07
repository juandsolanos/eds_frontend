import { TURNO_ESTADO_LABELS, TURNO_ESTADO_COLORS } from "../utils/estados";

export default function EstadoTurnoBadge({ estado }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "#fff",
        background: TURNO_ESTADO_COLORS[estado] || "var(--text-muted)",
      }}
    >
      {TURNO_ESTADO_LABELS[estado] || estado}
    </span>
  );
}
