import { useState } from "react";
import { api } from "../../api/client";
import CatalogoManager from "../../components/CatalogoManager";

const CATALOGOS = [
  {
    key: "islas",
    titulo: "Islas",
    apiResource: api.islas,
    idField: "id",
    campos: [{ key: "id", label: "ID (número de isla)", type: "number" }],
  },
  {
    key: "operarios",
    titulo: "Operarios",
    apiResource: api.operarios,
    idField: "id",
    campos: [
      { key: "id", label: "ID (cédula)", type: "text" },
      { key: "nombre", label: "Nombre", type: "text" },
    ],
  },
  {
    key: "administradores",
    titulo: "Administradores",
    apiResource: api.administradores,
    idField: "id",
    campos: [
      { key: "id", label: "ID", type: "text" },
      { key: "nombre", label: "Nombre", type: "text" },
    ],
  },
  {
    key: "clientes",
    titulo: "Clientes",
    apiResource: api.clientes,
    idField: "id",
    campos: [
      { key: "nombre", label: "Nombre", type: "text" },
      { key: "tipo", label: "Tipo", type: "text" },
    ],
  },
  {
    key: "productos-granel",
    titulo: "Productos a granel",
    apiResource: api.productosGranel,
    idField: "codigo",
    campos: [
      { key: "codigo", label: "Código", type: "text" },
      { key: "nombre", label: "Nombre", type: "text" },
      { key: "precio_unitario", label: "Precio unitario", type: "number", format: "money" },
    ],
  },
  {
    key: "productos-unidad",
    titulo: "Productos por unidad",
    apiResource: api.productosUnidad,
    idField: "codigo",
    filtroPor: "tipo",
    campos: [
      { key: "codigo", label: "Código", type: "text" },
      { key: "tipo", label: "Tipo", type: "text" },
      { key: "nombre", label: "Nombre", type: "text" },
      { key: "precio_unitario", label: "Precio unitario", type: "number", format: "money" },
    ],
  },
  {
    key: "mangueras",
    titulo: "Mangueras",
    apiResource: api.mangueras,
    idField: "id",
    campos: [
      { key: "id", label: "ID", type: "number" },
      { key: "isla", label: "Isla", type: "number" },
      { key: "codigo_combustible", label: "Código de combustible", type: "text" },
    ],
  },
  {
    key: "bodegas",
    titulo: "Bodegas",
    apiResource: api.bodegas,
    idField: "id",
    campos: [{ key: "nombre", label: "Nombre", type: "text" }],
  },
  {
    key: "tipos-transaccion",
    titulo: "Tipos de transacción",
    apiResource: api.tiposTransaccion,
    idField: "tipo",
    campos: [
      { key: "tipo", label: "Código (ej. efectivo)", type: "text" },
      { key: "nombre", label: "Nombre visible", type: "text" },
      { key: "signo", label: "Signo (1 = suma, -1 = resta)", type: "number" },
    ],
  },
];

export default function Catalogos() {
  const [tab, setTab] = useState(CATALOGOS[0].key);
  const catalogo = CATALOGOS.find((c) => c.key === tab);

  return (
    <div className="card">
      <div className="tabs">
        {CATALOGOS.map((c) => (
          <button
            key={c.key}
            className={`tab ${tab === c.key ? "tab--activo" : ""}`}
            onClick={() => setTab(c.key)}
          >
            {c.titulo}
          </button>
        ))}
      </div>

      <CatalogoManager
        key={catalogo.key /* fuerza remount al cambiar de pestaña */}
        titulo={catalogo.titulo}
        apiResource={catalogo.apiResource}
        campos={catalogo.campos}
        idField={catalogo.idField}
        filtroPor={catalogo.filtroPor}
      />
    </div>
  );
}
