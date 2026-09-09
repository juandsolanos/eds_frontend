import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/turnos", label: "Turnos" },
  { to: "/admin/registros", label: "Registros" },
  { to: "/admin/inventario", label: "Inventario" },
  { to: "/admin/alertas", label: "Alertas" },
  { to: "/admin/catalogos", label: "Configuración", soloSuperadmin: true },
  { to: "/admin/historial-precios", label: "Historial de precios" },
];

export default function AdminLayout() {
  const { usuario, logout } = useAuth();

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
          {usuario.operarioId && (
            <NavLink to="/operar" className="topbar__logout">
              Operar turno
            </NavLink>
          )}
          <button className="topbar__logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

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
