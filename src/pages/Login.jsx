import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, error, cargando } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function manejarSubmit(evento) {
    evento.preventDefault();
    login(username, password).catch(() => {
      // El error ya queda expuesto vía el contexto (useAuth().error);
      // no necesitamos hacer nada más aquí.
    });
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-card__title">
          <span className="mono" style={{ color: "var(--accent)" }}>
            EDS
          </span>{" "}
          Panel
        </h1>
        <p className="login-card__subtitle">Inicia sesión para registrar tu turno.</p>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={manejarSubmit}>
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn--primary btn--full" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
