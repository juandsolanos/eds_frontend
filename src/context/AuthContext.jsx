import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "eds_token";

function decodificarPayload(token) {
  // El JWT tiene 3 partes separadas por "." — la del medio es el payload
  // en base64. Lo decodificamos manualmente aquí (sin librería externa)
  // para saber quién es el usuario sin tener que consultar al backend.
  try {
    const payloadBase64 = token.split(".")[1];
    const json = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const payload = token ? decodificarPayload(token) : null;

  const login = useCallback(async (username, password) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.login(username, password);
      localStorage.setItem(STORAGE_KEY, respuesta.access_token);
      setToken(respuesta.access_token);
    } catch (err) {
      setError(err.detail || "No se pudo iniciar sesión.");
      throw err;
    } finally {
      setCargando(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  const value = {
    token,
    usuario: payload
      ? {
          id: payload.sub,
          username: payload.username,
          rol: payload.rol,
          operarioId: payload.operario_id,
        }
      : null,
    login,
    logout,
    error,
    cargando,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
