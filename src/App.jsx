import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import OperarioPanel from "./pages/OperarioPanel";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Catalogos from "./pages/admin/Catalogos";
import Registros from "./pages/admin/Registros";
import HistorialPrecios from "./pages/admin/HistorialPrecios";

export default function App() {
  const { token, usuario } = useAuth();

  if (!token) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Cualquier usuario autenticado con operario_id puede usar el panel de operación */}
        <Route path="/operar" element={<OperarioPanel />} />

        {usuario.rol === "administrador" ? (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="registros" element={<Registros />} />
            <Route path="catalogos" element={<Catalogos />} />
            <Route path="historial-precios" element={<HistorialPrecios />} />
          </Route>
        ) : null}

        <Route
          path="*"
          element={<Navigate to={usuario.rol === "administrador" ? "/admin" : "/operar"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
