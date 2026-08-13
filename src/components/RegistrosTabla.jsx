export default function RegistrosTabla({ columnas, filas, vacio = "Sin registros todavía." }) {
  if (filas.length === 0) {
    return <div className="empty-state">{vacio}</div>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          {columnas.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={fila.id ?? i}>
            {columnas.map((col) => (
              <td key={col.key} className={col.mono ? "mono" : undefined}>
                {col.render ? col.render(fila) : fila[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
