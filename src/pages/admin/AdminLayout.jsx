import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import CambioPasswordModal from "../../components/CambioPasswordModal";

const NAV_ITEMS = [
  { to: "/admin/turnos", label: "Turnos" },
  { to: "/admin/registros", label: "Detalles Turnos" },
  { to: "/admin/snapshots", label: "Snapshots" },
  { to: "/admin/inventario", label: "Inventario" },
  { to: "/admin/estados-cuenta", label: "Estados de cuenta" },
  { to: "/admin/alertas", label: "Alertas" },
  { to: "/admin/catalogos", label: "Configuración", soloSuperadmin: true },
  { to: "/admin/historial-precios", label: "Historial de precios" },
  { to: "/admin/trazabilidad", label: "Trazabilidad" },
];

export default function AdminLayout() {
  const { token, usuario, logout } = useAuth();
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false);

  const itemsVisibles = NAV_ITEMS.filter(
    (item) => !item.soloSuperadmin || usuario.rol === "superadministrador"
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__brand-mark mono">EDS</span>
          <span style={{ color: "var(--text-muted)" }}>Panel de administración</span>
        </div>
        <div className="topbar__user">
          <span>
            {usuario.username} · {usuario.rol}
          </span>
          <button className="topbar__logout" onClick={() => setMostrarCambioPassword(true)}>
            Cambiar contraseña
          </button>
          <button className="topbar__logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <CambioPasswordModal
        open={mostrarCambioPassword}
        titulo="Cambiar mi contraseña"
        requiereActual
        onCerrar={() => setMostrarCambioPassword(false)}
        onGuardar={(actual, nueva) => api.cambiarMiPassword(token, actual, nueva)}
      />

      <div style={{ display: "flex", flex: 1 }}>
        <nav
          style={{
            width: 200,
            borderRight: "1px solid var(--border)",
            padding: "var(--spacing-6) var(--spacing-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-1)",
          }}
        >
          {itemsVisibles.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: "var(--spacing-3)",
                borderRadius: "var(--radius-sm)",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                background: isActive ? "var(--accent-soft)" : "transparent",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="main" style={{ margin: 0, maxWidth: "none" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
