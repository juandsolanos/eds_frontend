import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import OperarioPanel from "./pages/OperarioPanel";
import AdminLayout from "./pages/admin/AdminLayout";
import Catalogos from "./pages/admin/Catalogos";
import Registros from "./pages/admin/Registros";
import Inventario from "./pages/admin/Inventario";
import HistorialPrecios from "./pages/admin/HistorialPrecios";
import Trazabilidad from "./pages/admin/Trazabilidad";
import Turnos from "./pages/admin/Turnos";
import Alertas from "./pages/admin/Alertas";
import Snapshots from "./pages/admin/Snapshots";
import EstadosCuenta from "./pages/admin/EstadosCuenta";

export default function App() {
  const { token, usuario } = useAuth();

  if (!token) return <Login />;

  const esAdministrador = ["administrador", "superadministrador"].includes(usuario.rol);
  const esSuperadmin = usuario.rol === "superadministrador";
  const esOperario = usuario.rol === "operario";

  return (
    <BrowserRouter>
      <Routes>
        {/* Operar turnos requiere credenciales de operario: los
            administradores editan turnos puntuales desde Detalles Turnos */}
        {esOperario ? <Route path="/operar" element={<OperarioPanel />} /> : null}

        {esAdministrador ? (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="turnos" replace />} />
            <Route path="turnos" element={<Turnos />} />
            <Route path="turnos/:turnoId/editar" element={<OperarioPanel />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="registros" element={<Registros />} />
            <Route path="snapshots" element={<Snapshots />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="estados-cuenta" element={<EstadosCuenta />} />
            {esSuperadmin && <Route path="catalogos" element={<Catalogos />} />}
            <Route path="historial-precios" element={<HistorialPrecios />} />
            <Route path="trazabilidad" element={<Trazabilidad />} />
          </Route>
        ) : null}

        <Route
          path="*"
          element={<Navigate to={esAdministrador ? "/admin" : esOperario ? "/operar" : "/admin"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
