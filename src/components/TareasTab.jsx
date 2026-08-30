import RegistrosTabla from "./RegistrosTabla";

/**
 * Pestaña de tareas del turno. El operario visualiza las tareas que le
 * corresponden (generadas automáticamente al abrir el turno) y marca o
 * desmarca su realización. El tiempo de realización lo fija el backend.
 */
export default function TareasTab({ tareas, onMarcar, cargando }) {
  const columnas = [
    { key: "objetivo", label: "Objetivo" },
    { key: "detalle", label: "Detalle" },
    {
      key: "estado",
      label: "Estado",
      render: (t) => (t.realizada ? "Realizada" : "Pendiente"),
    },
    {
      key: "tiempo_realizacion",
      label: "Realizada el",
      render: (t) =>
        t.tiempo_realizacion
          ? new Date(t.tiempo_realizacion).toLocaleString("es-CO")
          : "—",
    },
    {
      key: "_acciones",
      label: "",
      render: (t) => (
        <button
          className={`btn ${t.realizada ? "btn--ghost" : "btn--primary"}`}
          disabled={cargando}
          onClick={() => onMarcar(t.tarea, !t.realizada)}
        >
          {t.realizada ? "Desmarcar" : "Marcar como realizada"}
        </button>
      ),
    },
  ];

  return (
    <RegistrosTabla
      columnas={columnas}
      filas={tareas}
      vacio="Este turno no tiene tareas asignadas."
    />
  );
}