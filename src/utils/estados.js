export const TURNO_ESTADO_LABELS = {
  creado: "Creado",
  en_espera: "En espera",
  abierto: "Abierto",
  en_revision: "En revisión",
  cerrado: "Cerrado",
};

export const TURNO_ESTADO_COLORS = {
  creado: "var(--warning)",
  en_espera: "var(--info)",
  abierto: "var(--success)",
  en_revision: "var(--warning)",
  cerrado: "var(--text-muted)",
};

export const TURNO_ESTADOS_VALIDOS = Object.keys(TURNO_ESTADO_LABELS);

export const ALERTA_ESTADO_LABELS = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
};

export const ALERTA_ESTADO_COLORS = {
  pendiente: "var(--warning)",
  en_proceso: "var(--info)",
  resuelta: "var(--success)",
};